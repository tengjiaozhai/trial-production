import * as XLSX from 'xlsx';
import type { ManagedMaterialCoreMatch, ManagedMaterialCoreRow, PcbaOption, SplitFieldOption, SplitOptionFieldId, SupplyTag } from '../types';
import { KEY_MATERIAL_LLM_CONFIG } from '../config/keyMaterialLLM';

const STATIC_TARGETS = [
  { key: 'cpu' as const, label: 'CPU' },
  { key: 'pmu' as const, label: '电源管理' },
  { key: 'tx' as const, label: '无线发射' },
  { key: 'rf_transceiver' as const, label: '射频收发器' },
  { key: 'nfc' as const, label: 'NFC' },
];

function normalizeHeader(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '');
}

function toSupplyTag(raw: string): SupplyTag {
  return raw === '一供' || raw === '二供' || raw === '三供' ? raw : '';
}

function extractSize(raw: string): string {
  return String(raw ?? '').match(/\d+/)?.[0] ?? '';
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
    if (headerRowIdx === -1) return null;

    const header = aoa[headerRowIdx].map(normalizeHeader);
    const materialIdx = header.findIndex((cell) => cell === '物料名称');
    const codeIdx = header.findIndex((cell) => /编码/.test(cell));
    const vendorIdx = header.findIndex((cell) => cell === '供应商');
    const supplyIdx = header.findIndex((cell) => cell === '一/二供');
    if ([materialIdx, codeIdx, vendorIdx, supplyIdx].some((idx) => idx === -1)) return null;

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
    ...STATIC_TARGETS.map((item) => ({ key: item.key, label: item.label })),
    ...args.emmcSizes.map((size) => ({ key: `emmc_${size}`, label: `flash EMMC ${size}G` })),
    ...args.ddrSizes.map((size) => ({ key: `ddr_${size}`, label: `flash DDR ${size}G` })),
  ];

  const prompt = [
    '你是手机BOM物料匹配助手。',
    '我会给你一组目标字段和一组源表中的物料名称候选。',
    '请为每个目标字段返回一个"完全等于候选列表中某项"的物料名称，或者返回 null。',
    '禁止输出候选列表外的值。',
    `候选物料名称: ${JSON.stringify(args.materialNames)}`,
    `目标字段: ${JSON.stringify(targets)}`,
    '只返回 JSON 对象，例如：{"cpu":"CPU","emmc_128":"128GB EMMC","ddr_4":"LPD4X 4GB"}',
  ].join('\n');

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
      }
    );

    if (!resp.ok) {
      return { materialNameByStaticField: {}, materialNameByEmmcSize: {}, materialNameByDdrSize: {} };
    }

    const json = await resp.json();
    const raw = JSON.parse(json?.choices?.[0]?.message?.content ?? '{}') as Record<string, string | null>;
    const allowed = new Set(args.materialNames);

    const materialNameByStaticField: ManagedMaterialCoreMatch['materialNameByStaticField'] = {};
    const materialNameByEmmcSize: Record<string, string> = {};
    const materialNameByDdrSize: Record<string, string> = {};

    for (const item of STATIC_TARGETS) {
      const value = raw[item.key];
      if (typeof value === 'string' && allowed.has(value)) {
        (materialNameByStaticField as Record<string, string>)[item.key] = value;
      }
    }
    for (const size of args.emmcSizes) {
      const value = raw[`emmc_${size}`];
      if (typeof value === 'string' && allowed.has(value)) materialNameByEmmcSize[size] = value;
    }
    for (const size of args.ddrSizes) {
      const value = raw[`ddr_${size}`];
      if (typeof value === 'string' && allowed.has(value)) materialNameByDdrSize[size] = value;
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