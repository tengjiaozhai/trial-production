import type { TrialProductionCellKey } from './univerTrialProductionSheet';

export interface TrialProductionSheetEdit {
  key: TrialProductionCellKey;
  value: string;
}

export function mapUniverEditToBusinessEdit(input: {
  row: number;
  column: number;
  value: unknown;
  cellMap: Record<string, TrialProductionCellKey>;
}): TrialProductionSheetEdit | null {
  const { row, column, value, cellMap } = input;
  const key = `${row}-${column}`;
  const cellKey = cellMap[key];

  if (!cellKey) return null;

  const normalizedValue =
    value === null || value === undefined ? '' : String(value);

  return {
    key: cellKey,
    value: normalizedValue,
  };
}
