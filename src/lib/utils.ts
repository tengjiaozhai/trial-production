import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';
import type { PcbaOption } from '../types';

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

  // Step 2: find header row — row where a cell matches /PCBA\s*\u914d\u7f6e/
  let headerRowIdx = -1;
  let headerColIdx = -1;
  let marketColIdx = -1;

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] ?? '').trim();
      if (/PCBA\s*配置/.test(val)) {
        headerRowIdx = r;
        headerColIdx = c;
        break;
      }
    }
    if (headerRowIdx !== -1) break;
  }

  if (headerRowIdx === -1 || headerColIdx === -1) return [];

  // Step 3: find market column in the same header row
  const headerRow = aoa[headerRowIdx];
  for (let c = 0; c < headerRow.length; c++) {
    const val = String(headerRow[c] ?? '').trim();
    if (/出货\s*市场/.test(val)) {
      marketColIdx = c;
      break;
    }
  }

  // Find EMMC and DDR columns
  let emmcColIdx = -1;
  let ddrColIdx = -1;
  for (let c = 0; c < headerRow.length; c++) {
    const val = String(headerRow[c] ?? '').trim().toUpperCase();
    if (val === 'EMMC') emmcColIdx = c;
    if (val === 'DDR')  ddrColIdx  = c;
  }

  // Step 4: collect data rows, build map of pcba -> Set<market>
  const pcbaMarkets = new Map<string, Set<string>>();
  const pcbaEmmcSets = new Map<string, Set<string>>();
  const pcbaDdrSets  = new Map<string, Set<string>>();
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
    const markets  = pcbaMarkets.get(pcba)!;
    const emmcSet  = pcbaEmmcSets.get(pcba) ?? new Set<string>();
    const ddrSet   = pcbaDdrSets.get(pcba)  ?? new Set<string>();
    const emmc = emmcSet.size === 1 ? [...emmcSet][0] : '';
    const ddr  = ddrSet.size  === 1 ? [...ddrSet][0]  : '';
    if (markets.size === 0) {
      return { pcba, band: '', bandConflict: false, emmc, ddr };
    } else if (markets.size === 1) {
      return { pcba, band: [...markets][0], bandConflict: false, emmc, ddr };
    } else {
      return { pcba, band: '', bandConflict: true, emmc, ddr };
    }
  });

  return results;
}
