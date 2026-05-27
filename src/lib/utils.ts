import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';
import type { PcbaOption, LcdSupplyOption, ManagedMaterialWorkbook } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize a storage string like "4+128", "128+4", "128G+4G" into
 * a canonical "smaller+larger" form without G suffix.
 * Returns "" if the input does not contain two numeric tokens separated by "+".
 */
export function normalizeStorage(raw: string): string {
  const match = raw.replace(/[Gg]/g, '').match(/(\d+)\+(\d+)/);
  if (!match) return '';
  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);
  return `${Math.min(a, b)}+${Math.max(a, b)}`;
}

/**
 * 从上传的配置表文件中提取 PCBA 配置选项，同时解析出货市场信息。
 *
 * 策略：
 * 1. 遍历所有 sheet，找名称包含 "PCBA配置表" 的 sheet。
 * 2. 将该 sheet 转为 AOA（rows × cols，空格均保留为 null）。
 * 3. 扫描行，找到某一行中有单元格文字匹配 "PCBA 配置" / "PCBA配置" 的行作为表头行。
 * 4. 在表头行中查找匹配 /出货\s*市场/ 的列作为 marketColIdx。
 * 5. 从表头行下一行开始逐行读取：
 *    - 跳过 null / 空字符串
 *    - 跳过分隔行：包含中文字符或含空格
 *    - 每个 PCBA 标识只取首次出现的行（跳过重复行）
 * 6. 取首次出现行的 market 值：
 *    - 无值 -> {pcba, band:'', bandConflict:false}
 *    - 有值 -> {pcba, band:value, bandConflict:false}
 */
export async function extractPcbaOptions(file: File): Promise<PcbaOption[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // Step 1: find target sheet
  const targetSheetName = wb.SheetNames.find(name => name.includes('PCBA配置表'));
  if (!targetSheetName) return [];

  const ws = wb.Sheets[targetSheetName];

  // Convert to AOA, keep blank cells as null
  const aoa: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: true,
  }) as (string | number | null | undefined)[][];

  if (!aoa.length) return [];

  // Step 2: collect all header candidates (exact match "PCBA配置" or "PCBA 配置"),
  // then pick the one whose column contains the most valid PCBA data rows below.
  let headerRowIdx = -1;
  let headerColIdx = -1;
  let marketColIdx = -1;

  const headerCandidates: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] ?? '').trim();
      if (/^PCBA\s*配置$/.test(val)) {
        headerCandidates.push({ row: r, col: c });
      }
    }
  }

  if (headerCandidates.length === 0) return [];

  // Score each candidate by counting valid (non-separator, non-empty) data rows below it
  let bestCandidate: { row: number; col: number; score: number } | null = null;
  for (const cand of headerCandidates) {
    let score = 0;
    for (let r = cand.row + 1; r < aoa.length; r++) {
      const rawVal = aoa[r]?.[cand.col];
      if (rawVal === null || rawVal === undefined) continue;
      const v = String(rawVal).trim();
      if (!v) continue;
      const isSep = /[一-龥]/.test(v) || /\s/.test(v);
      if (isSep) continue;
      score++;
    }
    if (!bestCandidate || score > bestCandidate.score ||
        (score === bestCandidate.score && cand.col > bestCandidate.col)) {
      bestCandidate = { ...cand, score };
    }
  }

  if (!bestCandidate || bestCandidate.score === 0) return [];
  headerRowIdx = bestCandidate.row;
  headerColIdx = bestCandidate.col;

  // Step 3: find market column in the same header row
  const headerRow = aoa[headerRowIdx];
  for (let c = 0; c < headerRow.length; c++) {
    const val = String(headerRow[c] ?? '').trim();
    if (/出货\s*市场/.test(val)) {
      marketColIdx = c;
      break;
    }
  }

  // Find EMMC, DDR, and projectName columns
  let emmcColIdx = -1;
  let ddrColIdx = -1;
  let projectNameColIdx = -1;
  for (let c = 0; c < headerRow.length; c++) {
    const raw = String(headerRow[c] ?? '').trim();
    const upper = raw.toUpperCase();
    if (upper === 'EMMC') emmcColIdx = c;
    if (upper === 'DDR')  ddrColIdx  = c;
    if (raw === '项目名') projectNameColIdx = c;
  }

  // Step 4: collect data rows, build map of pcba -> Set<market>
  const pcbaMarkets = new Map<string, Set<string>>();
  const pcbaEmmcSets = new Map<string, Set<string>>();
  const pcbaDdrSets  = new Map<string, Set<string>>();
  const pcbaProjectNames = new Map<string, string>();
  const pcbaOrder: string[] = [];

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const row = aoa[r];
    const rawVal = row[headerColIdx];
    if (rawVal === null || rawVal === undefined) continue;

    const val = String(rawVal).trim();
    if (!val) continue;

    // Detect separator/merged row: contains Chinese chars or whitespace
    const isMergedRow = /[一-龥]/.test(val) || /\s/.test(val);
    if (isMergedRow) continue;

    if (!pcbaMarkets.has(val)) {
      pcbaMarkets.set(val, new Set<string>());
      pcbaOrder.push(val);

      // Collect market value from first occurrence only
      if (marketColIdx !== -1) {
        const marketRaw = row[marketColIdx];
        if (marketRaw !== null && marketRaw !== undefined) {
          const market = String(marketRaw).trim();
          if (market) {
            pcbaMarkets.get(val)!.add(market);
          }
        }
      }

      // Collect projectName from first occurrence only
      if (projectNameColIdx !== -1) {
        const pnRaw = row[projectNameColIdx];
        if (pnRaw !== null && pnRaw !== undefined) {
          const pn = String(pnRaw).trim();
          if (pn) pcbaProjectNames.set(val, pn);
        }
      }

      // Collect EMMC/DDR from first occurrence only
      const collectFirst = (colIdx: number, map: Map<string, Set<string>>) => {
        if (colIdx === -1) return;
        const raw = row[colIdx];
        if (raw === null || raw === undefined) return;
        const v = String(raw).trim();
        if (!v) return;
        if (!map.has(val)) map.set(val, new Set<string>());
        map.get(val)!.add(v);
      };
      collectFirst(emmcColIdx, pcbaEmmcSets);
      collectFirst(ddrColIdx,  pcbaDdrSets);
    }
  }

  // Step 5: build result
  const results: PcbaOption[] = pcbaOrder.map(pcba => {
    const markets     = pcbaMarkets.get(pcba)!;
    const emmcSet     = pcbaEmmcSets.get(pcba) ?? new Set<string>();
    const ddrSet      = pcbaDdrSets.get(pcba)  ?? new Set<string>();
    const emmc        = emmcSet.size === 1 ? [...emmcSet][0] : '';
    const ddr         = ddrSet.size  === 1 ? [...ddrSet][0]  : '';
    const projectName = pcbaProjectNames.get(pcba) ?? '';
    if (markets.size === 0) {
      return { pcba, projectName, band: '', bandConflict: false, emmc, ddr };
    } else if (markets.size === 1) {
      return { pcba, projectName, band: [...markets][0], bandConflict: false, emmc, ddr };
    } else {
      return { pcba, projectName, band: '', bandConflict: true, emmc, ddr };
    }
  });

  return results;
}

export function normalizeMaterialName(raw: string): string {
  const compact = String(raw ?? '').replace(/\s+/g, '').replace(/[()（）_\-/]/g, '').trim().toUpperCase();
  if (compact === 'LCD' || compact === 'LCM' || compact === '\u663e\u793a\u5c4f') return 'LCD';
  return compact;
}

export async function extractManagedMaterialWorkbook(file: File): Promise<ManagedMaterialWorkbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const lcdBySheet: Record<string, import('../types').LcdSupplyOption[]> = {};

  const sheetVisibility = wb.Workbook?.Sheets ?? [];

  for (let si = 0; si < wb.SheetNames.length; si++) {
    const sheetName = wb.SheetNames[si];
    const sheetMeta = sheetVisibility[si];
    // Hidden: 0 = visible, 1 = hidden, 2 = very hidden
    if (sheetMeta && (sheetMeta.Hidden === 1 || sheetMeta.Hidden === 2)) continue;

    const ws = wb.Sheets[sheetName];
    const aoa: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      blankrows: true,
    }) as (string | number | null | undefined)[][];

    // Find header row in first 10 rows: must have material-name, code, vendor, supply columns
    let headerRowIdx = -1;
    let materialColIdx = -1;
    let codeColIdx = -1;
    let vendorColIdx = -1;
    let supplyColIdx = -1;

    for (let r = 0; r < Math.min(10, aoa.length); r++) {
      const row = aoa[r];
      let mCol = -1, cdCol = -1, vCol = -1, sCol = -1;
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] ?? '').replace(/\s+/g, '').trim();
        if (cell === '\u7269\u6599\u540d\u79f0') mCol = c;
        if (/\u7f16\u7801/.test(cell)) cdCol = c;
        if (cell === '\u4f9b\u5e94\u5546') vCol = c;
        if (/[\u4e00]\/[\n\r]?[\u4e8c]\u4f9b|[\u4e00\u4e8c]\u4f9b/.test(cell) ||
            cell === '\u4e00/\u4e8c\u4f9b') sCol = c;
      }
      if (mCol !== -1 && cdCol !== -1 && vCol !== -1 && sCol !== -1) {
        headerRowIdx = r;
        materialColIdx = mCol;
        codeColIdx = cdCol;
        vendorColIdx = vCol;
        supplyColIdx = sCol;
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    const lcdOptions: import('../types').LcdSupplyOption[] = [];
    const seenSupply = new Set<string>();

    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const row = aoa[r];
      const materialRaw = String(row[materialColIdx] ?? '').trim();
      if (!materialRaw) continue;
      if (normalizeMaterialName(materialRaw) !== 'LCD') continue;

      const supplyRaw = String(row[supplyColIdx] ?? '').replace(/\s+/g, '').trim();
      if (supplyRaw !== '\u4e00\u4f9b' && supplyRaw !== '\u4e8c\u4f9b') continue;
      if (seenSupply.has(supplyRaw)) continue;
      seenSupply.add(supplyRaw);

      const code = String(row[codeColIdx] ?? '').trim();
      const vendor = String(row[vendorColIdx] ?? '').trim();
      const supply = supplyRaw as '\u4e00\u4f9b' | '\u4e8c\u4f9b';
      lcdOptions.push({ supply, code, vendor, text: `${code} ${supply} ${vendor}` });
    }

    // Sort: 一供 before 二供
    lcdOptions.sort((a, b) => (a.supply === '\u4e00\u4f9b' ? -1 : 1));

    if (lcdOptions.length > 0) {
      lcdBySheet[sheetName] = lcdOptions;
    }
  }

  return { lcdBySheet };
}

export function resolveLcdOptionsForProject(
  projectName: string,
  workbook?: ManagedMaterialWorkbook
): LcdSupplyOption[] {
  return projectName && workbook?.lcdBySheet[projectName]
    ? workbook.lcdBySheet[projectName]
    : [];
}

export function serializeLcdOptions(options: LcdSupplyOption[]): string {
  return options.map(o => o.text).join(' / ');
}
