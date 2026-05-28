import * as XLSX from 'xlsx';
import { KEY_MATERIAL_LLM_CONFIG } from '../config/keyMaterialLLM';
import type { SplitOptionFieldId, SplitFieldOption } from '../types';

const KEYWORDS = ['关键物料选项模版', '关键物料选项模板', '关键物料选型模板'];

function hasKeyword(input: string): boolean {
  return KEYWORDS.some((k) => input.includes(k));
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '');
}

function pickAllowedName(value: unknown, allowed: Set<string>): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/^["'""'']+|["'""'']+$/g, '').trim();
  if (!cleaned) return undefined;
  if (allowed.has(cleaned)) return cleaned;

  for (const candidate of allowed) {
    if (cleaned.includes(candidate) || candidate.includes(cleaned)) {
      return candidate;
    }
  }
  return undefined;
}

async function requestJsonObjectFromLLM(prompt: string): Promise<Record<string, string | null>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KEY_MATERIAL_LLM_CONFIG.timeoutMs);

  try {
    const resp = await fetch(
      `${KEY_MATERIAL_LLM_CONFIG.baseUrl}${KEY_MATERIAL_LLM_CONFIG.endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KEY_MATERIAL_LLM_CONFIG.apiKey}`,
        },
        body: JSON.stringify({
          model: KEY_MATERIAL_LLM_CONFIG.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      }
    );

    if (!resp.ok) return {};
    const json = await resp.json();
    return JSON.parse(json?.choices?.[0]?.message?.content ?? '{}') as Record<string, string | null>;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

function fallbackMatchCategory2(
  fieldId: SplitOptionFieldId,
  category2List: string[]
): string | undefined {
  const patterns: Partial<Record<SplitOptionFieldId, RegExp[]>> = {
    battery: [/电池/],
    speaker: [/喇叭|扬声器|BOX|SPK/i],
    receiver: [/听筒|receiver|earpiece/i],
    mic: [/^MIC$|麦克风/i],
    motor: [/马达|振子|motor/i],
    fingerprint: [/指纹|fingerprint|FP.*module/i],
    spk_fpc: [/spk.*fpc|喇叭.*fpc/i],
    sidekey_fpc: [/sidekey.*fpc|侧键.*fpc/i],
    ir_fpc: [/ir.*fpc/i],
    lens: [/镜片|lens/i],
    housing: [/壳料|housing|后壳|中框/i],
    battery_cover: [/电池盖|battery.*cover|后盖/i],
    sim_tray: [/卡托|sim.*tray/i],
    side_key: [/侧键|side.*key/i],
    aux_material: [/辅料/i],
    cooling: [/散热|导热|石墨|vc/i],
    pcb: [/^PCB$|主板/i],
    sub_board: [/小板|sub.*board/i],
  };

  const fieldPatterns = patterns[fieldId];
  if (!fieldPatterns) return undefined;

  for (const pattern of fieldPatterns) {
    const found = category2List.find((name) => pattern.test(name));
    if (found) return found;
  }
  return undefined;
}

export interface KeyMaterialTemplateRow {
  category2: string;
  description: string;
  brand: string;
  vendor: string;
  supply: string;
}

export interface ParsedKeyMaterialTemplate {
  sourceFileName: string;
  sourceSheetName: string;
  category2List: string[];
  rows: KeyMaterialTemplateRow[];
}

export async function parseKeyMaterialTemplate(
  file: File
): Promise<ParsedKeyMaterialTemplate | null> {
  if (!hasKeyword(file.name)) return null;

  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const firstSheetName = wb.SheetNames[0] ?? '';
  if (!hasKeyword(firstSheetName)) return null;

  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  const header = (rows[0] ?? []).map(normalizeHeader);

  const category2Idx = header.findIndex((h) => h === '分类2');
  const descIdx = header.findIndex((h) => h === '物料描述');
  const brandIdx = header.findIndex((h) => h === '品牌');
  const vendorIdx = header.findIndex((h) => h === '供应商');
  const supplyIdx = header.findIndex((h) => h === '主二供');

  if ([category2Idx, descIdx, brandIdx, vendorIdx, supplyIdx].some((idx) => idx === -1)) {
    return null;
  }

  const parsedRows: KeyMaterialTemplateRow[] = [];
  const set = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const category2 = String(row[category2Idx] ?? '').trim();
    if (!category2) continue;

    parsedRows.push({
      category2,
      description: String(row[descIdx] ?? '').trim(),
      brand: String(row[brandIdx] ?? '').trim(),
      vendor: String(row[vendorIdx] ?? '').trim(),
      supply: String(row[supplyIdx] ?? '').trim(),
    });
    set.add(category2);
  }

  return {
    sourceFileName: file.name,
    sourceSheetName: firstSheetName,
    category2List: Array.from(set),
    rows: parsedRows,
  };
}

const TARGETS: { fieldId: SplitOptionFieldId; materialName: string; hint: string; mode: 'desc' | 'brand' }[] = [
  { fieldId: 'battery', materialName: '电池', hint: '锂电池/Battery', mode: 'desc' },
  { fieldId: 'speaker', materialName: '喇叭', hint: '扬声器/BOX/SPK', mode: 'desc' },
  { fieldId: 'receiver', materialName: '听筒', hint: 'Receiver/Earpiece', mode: 'desc' },
  { fieldId: 'mic', materialName: 'MIC', hint: '麦克风', mode: 'desc' },
  { fieldId: 'motor', materialName: '马达', hint: '振子/Motor', mode: 'desc' },
  { fieldId: 'fingerprint', materialName: '指纹', hint: '指纹识别/Fingerprint/FP Module', mode: 'desc' },
  { fieldId: 'spk_fpc', materialName: 'spk FPC', hint: '喇叭FPC/SPK FPC', mode: 'desc' },
  { fieldId: 'sidekey_fpc', materialName: 'Sidekey FPC', hint: '侧键FPC', mode: 'desc' },
  { fieldId: 'ir_fpc', materialName: 'IR FPC', hint: '红外FPC', mode: 'desc' },
  { fieldId: 'lens', materialName: '镜片', hint: 'Lens/摄像头镜片', mode: 'desc' },
  { fieldId: 'housing', materialName: '壳料', hint: 'Housing/后壳/中框', mode: 'desc' },
  { fieldId: 'battery_cover', materialName: '电池盖', hint: 'Battery Cover/后盖', mode: 'desc' },
  { fieldId: 'sim_tray', materialName: '卡托', hint: 'SIM Tray', mode: 'desc' },
  { fieldId: 'side_key', materialName: '侧键', hint: 'Side Key/音量键/电源键', mode: 'desc' },
  { fieldId: 'aux_material', materialName: '辅料', hint: '辅助材料/Auxiliary Material', mode: 'desc' },
  { fieldId: 'cooling', materialName: '散热', hint: '导热/石墨/VC均热板', mode: 'desc' },
  { fieldId: 'pcb', materialName: 'PCB', hint: '主板/PCB Board', mode: 'brand' },
  { fieldId: 'sub_board', materialName: '小板', hint: 'Sub Board/副板', mode: 'brand' },
];

export async function matchCategory2WithLLM(
  category2List: string[]
): Promise<Partial<Record<SplitOptionFieldId, string>>> {
  const allowed = new Set(category2List);
  const out: Partial<Record<SplitOptionFieldId, string>> = {};

  // Split TARGETS into two groups for concurrent LLM requests
  const groupA = TARGETS.filter((_, i) => i % 2 === 0);
  const groupB = TARGETS.filter((_, i) => i % 2 === 1);

  const buildPrompt = (group: typeof TARGETS) => [
    '你是BOM物料匹配助手。',
    '我会给你分类2候选列表与目标物料名。',
    '请为每个目标物料返回最可能同一物料的分类2。',
    '返回必须是JSON对象，key是fieldId，value是候选列表中"完全一致"的分类2字符串或null。',
    '禁止返回候选列表外的值。',
    `候选分类2: ${JSON.stringify(category2List)}`,
    `目标物料: ${JSON.stringify(group.map((x) => ({ fieldId: x.fieldId, materialName: `${x.materialName}（${x.hint}）` })))}`,
  ].join('\n');

  const [rawA, rawB] = await Promise.all([
    requestJsonObjectFromLLM(buildPrompt(groupA)),
    requestJsonObjectFromLLM(buildPrompt(groupB)),
  ]);

  const merged = { ...rawA, ...rawB };
  for (const target of TARGETS) {
    const value = pickAllowedName(merged[target.fieldId], allowed);
    if (value) out[target.fieldId] = value;
  }

  // Local fallback for any still-missing field
  for (const target of TARGETS) {
    if (out[target.fieldId]) continue;
    const fallback = fallbackMatchCategory2(target.fieldId, category2List);
    if (fallback) out[target.fieldId] = fallback;
  }

  return out;
}

const SUPPLY_ORDER: Record<string, number> = { '一供': 1, '二供': 2, '三供': 3 };

export function buildOptionsByField(
  parsed: ParsedKeyMaterialTemplate,
  category2ByField: Partial<Record<SplitOptionFieldId, string>>
): Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> {
  const output: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> = {};

  for (const t of TARGETS) {
    const category2 = category2ByField[t.fieldId];
    if (!category2) continue;

    const matchedRows = parsed.rows
      .filter((r) => r.category2 === category2)
      .sort((a, b) => (SUPPLY_ORDER[a.supply] ?? 99) - (SUPPLY_ORDER[b.supply] ?? 99))
      .slice(0, 3);

    const options: SplitFieldOption[] = [];

    for (const row of matchedRows) {
      if (t.mode === 'brand') {
        const brand = row.brand.trim();
        if (!brand) continue;
        options.push({
          supply: (row.supply as SplitFieldOption['supply']) || '',
          text: brand,
          sourceCategory2: category2,
        });
      } else {
        const supply = row.supply.trim();
        const vendor = row.vendor.trim();
        const desc = row.description.trim();
        if (!supply || !vendor || !desc) continue;
        options.push({
          supply: (supply as SplitFieldOption['supply']) || '',
          text: `${supply}${vendor}${desc}`,
          sourceCategory2: category2,
        });
      }
    }

    if (options.length > 0) output[t.fieldId] = options;
  }

  return output;
}

export function serializeSplitOptions(options: SplitFieldOption[]): string {
  return options.map((o) => o.text).join(' / ');
}
