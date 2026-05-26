import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 从上传的配置表文件中提取 PCBA 配置选项。
 *
 * 策略：
 * 1. 遍历所有 sheet，找名称包含 "PCBA配置表" 的 sheet。
 * 2. 将该 sheet 转为 AOA（rows × cols，空格均保留为 null）。
 * 3. 扫描行，找到某一行中有单元格文字匹配 "PCBA 配置" / "PCBA配置" 的行作为
 *    "表头行"，记下该列索引 headerColIdx。
 * 4. 从表头行下一行开始逐行读取 headerColIdx 列的值：
 *    - 跳过 null / 空字符串
 *    - 跳过"合并分隔行"：判定条件 = 该行除 headerColIdx 外所有列均为空
 *      且 该列值不像正常 PCBA 编号（不含字母数字组合，或含中文）
 * 5. 对结果去重后返回。
 */
export async function extractPcbaOptions(file: File): Promise<string[]> {
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

  // Step 2: find header row — row where a cell matches /PCBA\s*配置/
  let headerRowIdx = -1;
  let headerColIdx = -1;

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

  // Step 3: collect data rows, skip merged/separator rows
  const results: string[] = [];
  const seen = new Set<string>();

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const row = aoa[r];
    const rawVal = row[headerColIdx];
    if (rawVal === null || rawVal === undefined) continue;

    const val = String(rawVal).trim();
    if (!val) continue;

    // Detect separator/merged row: value contains Chinese chars or looks like a description
    // A real PCBA code looks like A1, B1, U1, Aa1, Ab1 etc. — letters + digits, no spaces/Chinese
    const isMergedRow = /[\u4e00-\u9fa5]/.test(val) || /\s/.test(val);
    if (isMergedRow) continue;

    if (!seen.has(val)) {
      seen.add(val);
      results.push(val);
    }
  }

  return results;
}
