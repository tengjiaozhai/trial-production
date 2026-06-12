import type { TrialProductionCellKey } from './univerTrialProductionSheet';

export interface SheetDataDiffEntry {
  row: number;
  column: number;
  value: string;
}

export interface SheetDataDiffInput {
  cellMap: Record<string, TrialProductionCellKey>;
  cellValues: Record<string, string>;
  previousCellValues: Record<string, string>;
}

export function diffSheetData(input: SheetDataDiffInput): SheetDataDiffEntry[] {
  const result: SheetDataDiffEntry[] = [];

  for (const [key, cellKey] of Object.entries(input.cellMap)) {
    const sep = key.indexOf('-');
    if (sep < 0) continue;
    const row = Number(key.slice(0, sep));
    const column = Number(key.slice(sep + 1));
    if (!Number.isFinite(row) || !Number.isFinite(column)) continue;

    const nextValue = input.cellValues[key] ?? '';
    const prevValue = input.previousCellValues[key] ?? '';
    if (nextValue === prevValue) continue;

    result.push({ row, column, value: nextValue });
  }

  return result;
}
