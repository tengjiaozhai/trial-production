import * as XLSX from 'xlsx';
import { KEY_MATERIAL_LLM_CONFIG } from '../config/keyMaterialLLM';
import type { SplitOptionFieldId, SplitFieldOption } from '../types';

const KEYWORDS = ['关键物料选项模版', '关键物料选项模板', '关键物料选型模板'];

function hasKeyword(input: string): boolean {
  return KEYWORDS.some((k) => input.includes(k));
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
  const header = (rows[0] ?? []).map((v: any) => String(v).trim());

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

const TARGETS: { fieldId: SplitOptionFieldId; materialName: string; mode: 'desc' | 'brand' }[] = [
  { fieldId: 'battery', materialName: '电池', mode: 'desc' },
  { fieldId: 'speaker', materialName: '喇叭', mode: 'desc' },
  { fieldId: 'receiver', materialName: '听筒', mode: 'desc' },
  { fieldId: 'mic', materialName: 'MIC', mode: 'desc' },
  { fieldId: 'motor', materialName: '马达', mode: 'desc' },
  { fieldId: 'spk_fpc', materialName: 'spk FPC', mode: 'desc' },
  { fieldId: 'sidekey_fpc', materialName: 'Sidekey FPC', mode: 'desc' },
  { fieldId: 'ir_fpc', materialName: 'IR FPC', mode: 'desc' },
  { fieldId: 'lens', materialName: '镜片', mode: 'desc' },
  { fieldId: 'housing', materialName: '壳料', mode: 'desc' },
  { fieldId: 'battery_cover', materialName: '电池盖', mode: 'desc' },
  { fieldId: 'sim_tray', materialName: '卡托', mode: 'desc' },
  { fieldId: 'side_key', materialName: '侧键', mode: 'desc' },
  { fieldId: 'aux_material', materialName: '辅料', mode: 'desc' },
  { fieldId: 'cooling', materialName: '散热', mode: 'desc' },
  { fieldId: 'pcb', materialName: 'PCB', mode: 'brand' },
  { fieldId: 'sub_board', materialName: '小板', mode: 'brand' },
];

export async function matchCategory2WithLLM(
  category2List: string[]
): Promise<Partial<Record<SplitOptionFieldId, string>>> {
  const prompt = [
    '你是BOM物料匹配助手。',
    '我会给你分类2候选列表与目标物料名。',
    '请为每个目标物料返回最可能同一物料的分类2。',
    '返回必须是JSON对象，key是fieldId，value是候选列表中"完全一致"的分类2字符串或null。',
    '禁止返回候选列表外的值。',
    `候选分类2: ${JSON.stringify(category2List)}`,
    `目标物料: ${JSON.stringify(TARGETS.map((x) => ({ fieldId: x.fieldId, materialName: x.materialName })))}`,
  ].join('\n');

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

    clearTimeout(timer);
    if (!resp.ok) return {};

    const json = await resp.json();
    const text = (json?.choices?.[0]?.message?.content ?? '{}') as string;
    const raw = JSON.parse(text) as Record<string, string | null>;

    const allowed = new Set(category2List);
    const out: Partial<Record<SplitOptionFieldId, string>> = {};

    for (const target of TARGETS) {
      const picked = raw[target.fieldId];
      if (typeof picked === 'string' && allowed.has(picked)) {
        out[target.fieldId] = picked;
      }
    }
    return out;
  } catch {
    clearTimeout(timer);
    return {};
  }
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
