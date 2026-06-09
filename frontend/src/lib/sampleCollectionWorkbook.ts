import * as XLSX from 'xlsx';
import type { SampleCollectionWorkbookData, SampleCollectionSheet, SampleCollectionFieldId, SplitFieldOption, SupplyTag } from '../types';
import { KEY_MATERIAL_LLM_CONFIG } from '../config/keyMaterialLLM';

// 12 target fields: Chinese label -> fieldId
const SAMPLE_TARGETS: { fieldId: SampleCollectionFieldId; label: string; hint: string }[] = [
  { fieldId: 'hw_eng',        label: '硬件',  hint: '硬件工程师/HW Eng' },
  { fieldId: 'hw_test',       label: '硬测',  hint: '硬件测试/HW Test' },
  { fieldId: 'sw_eng',        label: '软件',  hint: '软件工程师/SW Eng' },
  { fieldId: 'sw_test',       label: '软测',  hint: '软件测试/SW Test' },
  { fieldId: 'struct_eng',    label: '结构',  hint: '结构工程师/Structure Eng' },
  { fieldId: 'reliability_eng', label: '可靠性', hint: '可靠性测试/Reliability' },
  { fieldId: 'pressure_test', label: '压测',  hint: '压力测试/Pressure Test' },
  { fieldId: 'image_eng',     label: '影像',  hint: '影像工程师/Image Eng' },
  { fieldId: 'npm',           label: 'NPM',   hint: 'NPM/新产品导入' },
  { fieldId: 'ux',            label: '体验',  hint: '用户体验/UX' },
  { fieldId: 'parts',         label: '器件',  hint: '器件工程师/Parts Eng' },
  { fieldId: 'pm',            label: '产品',  hint: '产品经理/PM' },
];

function pickAllowedName(value: unknown, allowed: Set<string>): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, '').trim();
  if (!cleaned) return undefined;
  if (allowed.has(cleaned)) return cleaned;
  for (const candidate of allowed) {
    if (cleaned.includes(candidate) || candidate.includes(cleaned)) return candidate;
  }
  return undefined;
}

async function requestJsonObjectFromLLM(prompt: string): Promise<Record<string, string | null>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KEY_MATERIAL_LLM_CONFIG.timeoutMs);
  try {
    const resp = await fetch(`${KEY_MATERIAL_LLM_CONFIG.baseUrl}${KEY_MATERIAL_LLM_CONFIG.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY_MATERIAL_LLM_CONFIG.apiKey}` },
      body: JSON.stringify({ model: KEY_MATERIAL_LLM_CONFIG.model, temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    });
    if (!resp.ok) return {};
    const json = await resp.json();
    return JSON.parse(json?.choices?.[0]?.message?.content ?? '{}') as Record<string, string | null>;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

function fallbackMatchSampleField(
  fieldId: SampleCollectionFieldId,
  rowNames: string[]
): string | undefined {
  const patterns: Record<SampleCollectionFieldId, RegExp[]> = {
    hw_eng:         [/^\s*\u786c\u4ef6\s*$/],
    hw_test:        [/\u786c\u6d4b|\u786c\u4ef6\u6d4b\u8bd5/],
    sw_eng:         [/^\s*\u8f6f\u4ef6\s*$/],
    sw_test:        [/\u8f6f\u6d4b|\u8f6f\u4ef6\u6d4b\u8bd5/],
    struct_eng:     [/^\s*\u7ed3\u6784\s*$/],
    reliability_eng:[/\u53ef\u9760\u6027|reliability/i],
    pressure_test:  [/\u538b\u6d4b|\u538b\u529b\u6d4b\u8bd5/],
    image_eng:      [/\u5f71\u50cf/],
    npm:            [/^\s*NPM\s*$/i],
    ux:             [/\u4f53\u9a8c/],
    parts:          [/^\s*\u5668\u4ef6\s*$/],
    pm:             [/^\s*\u4ea7\u54c1\s*$/],
  };
  for (const pattern of (patterns[fieldId] ?? [])) {
    const found = rowNames.find(n => pattern.test(n));
    if (found) return found;
  }
  return undefined;
}


// Fill-forward: propagate non-empty values left-to-right in a row
function fillForward(row: unknown[]): string[] {
  const result: string[] = [];
  let last = '';
  for (const cell of row) {
    const v = String(cell ?? '').trim();
    if (v) last = v;
    result.push(last);
  }
  return result;
}

export async function parseSampleCollectionWorkbook(file: File): Promise<Omit<SampleCollectionWorkbookData, 'rowNameByField'> | null> {
  if (!file.name.includes('样机收集表')) return null;

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const sheets: SampleCollectionSheet[] = [];

  for (const [sheetIdx, sheetName] of wb.SheetNames.entries()) {
    const meta = wb.Workbook?.Sheets?.[sheetIdx];
    if (meta?.Hidden) continue;
    if (!sheetName.includes('样机')) continue;

    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
    if (aoa.length < 4) continue;

    const row0 = fillForward(aoa[0] ?? []);  // stage row
    const row1 = fillForward(aoa[1] ?? []);  // supply row
    const row2 = (aoa[2] ?? []).map(c => String(c ?? '').trim());  // pcba row

    // Build column headers from col 1 onwards (col 0 is row-name col)
    const colHeaders: SampleCollectionSheet['colHeaders'] = [];
    for (let c = 1; c < Math.max(row0.length, row1.length, row2.length); c++) {
      const stage = row0[c] ?? '';
      const supply = row1[c] ?? '';
      const pcba = row2[c] ?? '';
      if (stage || supply || pcba) {
        colHeaders.push({ colIndex: c, stage, supply, pcba });
      }
    }

    // Collect data rows (from row index 3 onwards), using col 0 as row name
    const rowNameColIdx = 0;
    const dataRows: typeof sheets[0]['rows'] = [];
    const rowNamesSet = new Set<string>();

    for (let r = 3; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const rowName = String(row[rowNameColIdx] ?? '').trim();
      if (!rowName) continue;

      const cells: Record<string, string> = {};
      for (const ch of colHeaders) {
        const key = `${ch.stage}__${ch.supply}__${ch.pcba}`;
        cells[key] = String(row[ch.colIndex] ?? '').trim();
      }
      dataRows.push({ rowName, cells });
      rowNamesSet.add(rowName);
    }

    sheets.push({ sheetName, colHeaders, rows: dataRows, rowNames: Array.from(rowNamesSet) });
  }

  if (sheets.length === 0) return null;
  return { sourceFileName: file.name, sheets };
}


export async function matchSampleCollectionRowsWithLLM(
  rowNames: string[]
): Promise<Partial<Record<SampleCollectionFieldId, string>>> {
  const allowed = new Set(rowNames);
  const out: Partial<Record<SampleCollectionFieldId, string>> = {};

  // Split into two concurrent groups
  const groupA = SAMPLE_TARGETS.filter((_, i) => i % 2 === 0);
  const groupB = SAMPLE_TARGETS.filter((_, i) => i % 2 === 1);

  const buildPrompt = (group: typeof SAMPLE_TARGETS) => [
    '你是BOM样机收集表匹配助手。',
    '我会给你行名候选列表与目标字段名。',
    '请为每个目标字段返回最可能对应的行名，value必须是候选列表中完全一致的字符串，无匹配返回 null。',
    '禁止返回候选列表外的值。',
    `候选行名: ${JSON.stringify(rowNames)}`,
    `目标字段: ${JSON.stringify(group.map(x => ({ fieldId: x.fieldId, label: `${x.label}（${x.hint}）` })))}`,
    '只返回 JSON 对象。',
  ].join('\n');

  const [rawA, rawB] = await Promise.all([
    requestJsonObjectFromLLM(buildPrompt(groupA)),
    requestJsonObjectFromLLM(buildPrompt(groupB)),
  ]);

  const merged = { ...rawA, ...rawB };
  for (const target of SAMPLE_TARGETS) {
    const value = pickAllowedName(merged[target.fieldId], allowed);
    if (value) out[target.fieldId] = value;
  }

  // Local fallback for still-missing fields
  for (const target of SAMPLE_TARGETS) {
    if (out[target.fieldId]) continue;
    const fallback = fallbackMatchSampleField(target.fieldId, rowNames);
    if (fallback) out[target.fieldId] = fallback;
  }

  return out;
}

function extractNumber(raw: string): string {
  const m = raw.match(/\d+/);
  return m ? m[0] : '';
}

export function buildSampleCollectionFieldOptions(
  data: SampleCollectionWorkbookData,
  stage: string,
  pcba: string
): Partial<Record<SampleCollectionFieldId, SplitFieldOption[]>> {
  const result: Partial<Record<SampleCollectionFieldId, SplitFieldOption[]>> = {};

  // Find the first sheet that has a column header matching this pcba
  const sheet = data.sheets.find(s => s.colHeaders.some(h => h.pcba === pcba));
  if (!sheet) return result;

  // Filter column headers for current stage + this pcba
  const stageHeaders = sheet.colHeaders.filter(h => h.stage === stage && h.pcba === pcba);
  if (stageHeaders.length === 0) return result;

  for (const target of SAMPLE_TARGETS) {
    const rowName = data.rowNameByField[target.fieldId];
    if (!rowName) continue;

    const dataRow = sheet.rows.find(r => r.rowName === rowName);
    if (!dataRow) continue;

    const options: SplitFieldOption[] = [];
    for (const ch of stageHeaders) {
      const supplyLower = ch.supply.toLowerCase();
      let supplyTag: SupplyTag = '';
      if (supplyLower.includes('一供') || supplyLower.includes('1st') || supplyLower === '一供') supplyTag = '一供';
      else if (supplyLower.includes('二供') || supplyLower.includes('2nd') || supplyLower === '二供') supplyTag = '二供';

      const key = `${ch.stage}__${ch.supply}__${ch.pcba}`;
      const raw = dataRow.cells[key] ?? '';
      const num = extractNumber(raw);
      if (!num) continue;
      options.push({ supply: supplyTag, text: num, sourceCategory2: rowName });
    }

    if (options.length > 0) result[target.fieldId] = options.slice(0, 3);
  }

  return result;
}
