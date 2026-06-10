import type { TrialProductionCellKey } from './univerTrialProductionSheet';

export interface TrialProductionSheetEdit {
  key: TrialProductionCellKey;
  value: string;
}

function normalizeUniverEditValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object' && value !== null && 'toPlainText' in value) {
    const toPlainText = (value as { toPlainText?: () => string }).toPlainText;
    if (typeof toPlainText === 'function') {
      return toPlainText.call(value).replace(/\r?\n$/, '');
    }
  }

  return String(value);
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

  return {
    key: cellKey,
    value: normalizeUniverEditValue(value),
  };
}
