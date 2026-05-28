import * as XLSX from 'xlsx';
import type { ManagedMaterialCoreMatch, ManagedMaterialCoreRow, PcbaOption, SplitFieldOption, SplitOptionFieldId, SupplyTag } from '../types';
import { KEY_MATERIAL_LLM_CONFIG } from '../config/keyMaterialLLM';

const STATIC_TARGETS = [
  { key: 'cpu' as const, label: 'CPU', hint: '主芯片/应用处理器' },
  { key: 'pmu' as const, label: '电源管理', hint: 'PMU/电源IC' },
  { key: 'tx' as const, label: '无线发射', hint: '常见候选名可能是无线收发器、PA或功放' },
  { key: 'rf_transceiver' as const, label: '射频收发器', hint: 'RF Transceiver' },
  { key: 'nfc' as const, label: 'NFC', hint: '近场通信芯片' },
];

function formatTargetLabel(label: string, hint?: string): string {
  return hint ? `${label}（${hint}）` : label;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '');
}

function toSupplyTag(raw: string): SupplyTag {
  return raw === '一供' || raw === '二供' || raw === '三供' ? raw : '';
}

function extractSize(raw: string): string {
  return String(raw ?? '').match(/\d+/)?.[0] ?? '';
}

function pickAllowedName(value: unknown, allowed: Set<string>): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
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

function findFirstByRegex(materialNames: string[], patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = materialNames.find((name) => pattern.test(name));
    if (found) return found;
  }
  return undefined;
}

function fallbackMatchStaticField(
  key: 'cpu' | 'pmu' | 'tx' | 'rf_transceiver' | 'nfc',
  materialNames: string[]
): string | undefined {
  switch (key) {
    case 'cpu':
      return findFirstByRegex(materialNames, [/^CPU$/i, /CPU/i]);
    case 'pmu':
      return findFirstByRegex(materialNames, [/电源管理/i, /PMU/i, /电源IC/i]);
    case 'tx':
      return findFirstByRegex(materialNames, [/无线收发/i, /功放/i, /PA/i, /发射/i]);
    case 'rf_transceiver':
      return findFirstByRegex(materialNames, [/射频收发/i, /RF.*收发/i, /Transceiver/i]);
    case 'nfc':
      return findFirstByRegex(materialNames, [/^NFC$/i, /NFC/i]);
    default:
      return undefined;
  }
}

function fallbackMatchEmmcBySize(materialNames: string[], size: string): string | undefined {
  if (!size) return undefined;
  const sizePattern = new RegExp(`${size}\\s*G?`, 'i');
  return materialNames.find((name) => /EMMC/i.test(name) && sizePattern.test(name));
}

function fallbackMatchDdrBySize(materialNames: string[], size: string): string | undefined {
  if (!size) return undefined;
  const sizePattern = new RegExp(`${size}\\s*G?`, 'i');
  return materialNames.find((name) => /(LPD|DDR)/i.test(name) && sizePattern.test(name));
}

export async function parseManagedMaterialCoreWorkbook(file: File): Promise<{
  sourceFileName: string;
  sourceSheetName: string;
  rows: ManagedMaterialCoreRow[];
  materialNames: string[];
} | null> {
  if (!file.name.includes('管控物料表')) return null;

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  for (const [sheetIdx, sheetName] of wb.SheetNames.entries()) {
    const meta = wb.Workbook?.Sheets?.[sheetIdx];
    if (meta?.Hidden) continue;

    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    const topRows = aoa.slice(0, 10).flat().map((cell) => String(cell ?? '').trim());
    const hasTitle = topRows.some((cell) => cell.includes('管控物料表'));
    if (!hasTitle) continue;

    const headerRowIdx = aoa.findIndex((row) => {
      const normalized = row.map(normalizeHeader);
      return (
        normalized.includes('物料名称') &&
        normalized.some((cell) => /编码/.test(cell)) &&
        normalized.includes('供应商')
      );
    });
    if (headerRowIdx === -1) continue;

    const header = aoa[headerRowIdx].map(normalizeHeader);
    const materialIdx = header.findIndex((cell) => cell === '物料名称');
    const codeIdx = header.findIndex((cell) => /编码/.test(cell));
    const vendorIdx = header.findIndex((cell) => cell === '供应商');
    const supplyIdx = header.findIndex((cell) => cell === '一/二供');
    if ([materialIdx, codeIdx, vendorIdx, supplyIdx].some((idx) => idx === -1)) continue;

    const rows: ManagedMaterialCoreRow[] = [];
    const materialNamesSet = new Set<string>();

    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const materialName = String(row[materialIdx] ?? '').trim();
      if (!materialName) continue;
      const code = String(row[codeIdx] ?? '').trim();
      const vendor = String(row[vendorIdx] ?? '').trim();
      const supply = String(row[supplyIdx] ?? '').trim();
      rows.push({ materialName, code, vendor, supply });
      materialNamesSet.add(materialName);
    }

    return {
      sourceFileName: file.name,
      sourceSheetName: sheetName,
      rows,
      materialNames: Array.from(materialNamesSet),
    };
  }

  return null;
}

export async function matchManagedMaterialNamesWithLLM(args: {
  materialNames: string[];
  emmcSizes: string[];
  ddrSizes: string[];
}): Promise<Pick<ManagedMaterialCoreMatch, 'materialNameByStaticField' | 'materialNameByEmmcSize' | 'materialNameByDdrSize'>> {
  const targets = [
    ...STATIC_TARGETS.map((item) => ({ key: item.key, label: formatTargetLabel(item.label, item.hint) })),
    ...args.emmcSizes.map((size) => ({ key: `emmc_${size}`, label: `flash EMMC ${size}G` })),
    ...args.ddrSizes.map((size) => ({ key: `ddr_${size}`, label: `flash DDR ${size}G` })),
  ];

  const prompt = [
    '你是手机BOM物料匹配助手。',
    '我会给你一组目标字段和一组源表中的物料名称候选。',
    '请为每个目标字段返回一个"完全等于候选列表中某项"的物料名称，或者返回 null。',
    '对于语义接近但词面不完全一致的情况（例如“无线发射”与“无线收发器”），应返回最接近且存在于候选中的物料名称。',
    '禁止输出候选列表外的值。',
    `候选物料名称: ${JSON.stringify(args.materialNames)}`,
    `目标字段: ${JSON.stringify(targets)}`,
    '只返回 JSON 对象，例如：{"cpu":"CPU","tx":"无线收发器","emmc_128":"128GB EMMC","ddr_4":"LPD4X 4GB"}',
  ].join('\n');

  try {
    const raw = await requestJsonObjectFromLLM(prompt);
    const allowed = new Set(args.materialNames);

    const materialNameByStaticField: ManagedMaterialCoreMatch['materialNameByStaticField'] = {};
    const materialNameByEmmcSize: Record<string, string> = {};
    const materialNameByDdrSize: Record<string, string> = {};
    const staticMap = materialNameByStaticField as Record<string, string | undefined>;

    for (const item of STATIC_TARGETS) {
      const value = pickAllowedName(raw[item.key], allowed);
      if (value) staticMap[item.key] = value;
    }
    for (const size of args.emmcSizes) {
      const value = pickAllowedName(raw[`emmc_${size}`], allowed);
      if (value) materialNameByEmmcSize[size] = value;
    }
    for (const size of args.ddrSizes) {
      const value = pickAllowedName(raw[`ddr_${size}`], allowed);
      if (value) materialNameByDdrSize[size] = value;
    }

    const missingStaticTargets = STATIC_TARGETS.filter((item) => !staticMap[item.key]);
    if (missingStaticTargets.length > 0) {
      const retryPrompt = [
        '你是手机BOM物料匹配助手。',
        '请仅针对下列缺失字段，从候选物料名称中选出最相似且语义对应的一项；无匹配则返回 null。',
        '返回值必须是候选列表中的原文字符串。',
        `候选物料名称: ${JSON.stringify(args.materialNames)}`,
        `缺失字段: ${JSON.stringify(missingStaticTargets.map((item) => ({
          key: item.key,
          label: formatTargetLabel(item.label, item.hint),
        })))}`,
        '只返回 JSON 对象，例如：{"tx":"无线收发器"}',
      ].join('\n');

      const retryRaw = await requestJsonObjectFromLLM(retryPrompt);
      for (const item of missingStaticTargets) {
        const value = pickAllowedName(retryRaw[item.key], allowed);
        if (value) staticMap[item.key] = value;
      }
    }

    for (const item of STATIC_TARGETS) {
      if (staticMap[item.key]) continue;
      const fallback = fallbackMatchStaticField(item.key, args.materialNames);
      if (fallback) staticMap[item.key] = fallback;
    }
    for (const size of args.emmcSizes) {
      if (materialNameByEmmcSize[size]) continue;
      const fallback = fallbackMatchEmmcBySize(args.materialNames, size);
      if (fallback) materialNameByEmmcSize[size] = fallback;
    }
    for (const size of args.ddrSizes) {
      if (materialNameByDdrSize[size]) continue;
      const fallback = fallbackMatchDdrBySize(args.materialNames, size);
      if (fallback) materialNameByDdrSize[size] = fallback;
    }

    return { materialNameByStaticField, materialNameByEmmcSize, materialNameByDdrSize };
  } catch {
    return { materialNameByStaticField: {}, materialNameByEmmcSize: {}, materialNameByDdrSize: {} };
  }
}

export function buildManagedMaterialCoreFieldOptions(
  match: ManagedMaterialCoreMatch,
  pcbaOption?: PcbaOption
): Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> {
  if (!pcbaOption) return {};

  const emmcSize = extractSize(pcbaOption.emmc);
  const ddrSize = extractSize(pcbaOption.ddr);
  const sortWeight: Record<string, number> = { '一供': 1, '二供': 2, '三供': 3 };

  const buildRows = (
    materialName: string | undefined,
    formatter: (row: ManagedMaterialCoreRow) => string
  ): SplitFieldOption[] => {
    if (!materialName) return [];
    return match.rows
      .filter((row) => row.materialName === materialName)
      .sort((a, b) => (sortWeight[a.supply] ?? 99) - (sortWeight[b.supply] ?? 99))
      .slice(0, 3)
      .map((row) => ({
        supply: toSupplyTag(row.supply),
        text: formatter(row),
        sourceCategory2: materialName,
      }))
      .filter((row) => row.text.trim() !== '');
  };

  const result: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> = {};

  const cpuRows = buildRows(match.materialNameByStaticField.cpu, (row) => row.code);
  if (cpuRows.length > 0) result.cpu = cpuRows;

  const emmcRows = buildRows(
    match.materialNameByEmmcSize[emmcSize],
    (row) => `${row.code}${row.supply}${row.vendor}${emmcSize}G`
  );
  if (emmcRows.length > 0) result.emmc = emmcRows;

  const ddrRows = buildRows(
    match.materialNameByDdrSize[ddrSize],
    (row) => `${row.code}${row.supply}${row.vendor}${ddrSize}G`
  );
  if (ddrRows.length > 0) result.ddr = ddrRows;

  const pmuRows = buildRows(match.materialNameByStaticField.pmu, (row) => `${row.code}${row.supply}`);
  if (pmuRows.length > 0) result.pmu = pmuRows;

  const txRows = buildRows(match.materialNameByStaticField.tx, (row) => `${row.code}${row.supply}`);
  if (txRows.length > 0) result.tx = txRows;

  const rfRows = buildRows(match.materialNameByStaticField.rf_transceiver, (row) => `${row.code}${row.supply}`);
  if (rfRows.length > 0) result.rf_transceiver = rfRows;

  const nfcRows = buildRows(match.materialNameByStaticField.nfc, (row) => `${row.code}${row.supply}`);
  if (nfcRows.length > 0) result.nfc = nfcRows;

  return result;
}

export function serializeSplitFieldOptions(options: SplitFieldOption[]): string {
  return options.map((item) => item.text).join(' / ');
}
