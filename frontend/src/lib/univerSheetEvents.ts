import type { TrialProductionCellKey } from './univerTrialProductionSheet';

export interface TrialProductionSheetEdit {
  key: TrialProductionCellKey;
  value: string;
}

export function normalizeUniverEditValue(value: unknown): string {
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

export function normalizeUniverCellDataValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    if ('v' in value) {
      return normalizeUniverEditValue((value as { v?: unknown }).v);
    }

    const dataStream = (value as { p?: { body?: { dataStream?: unknown } } }).p?.body?.dataStream;
    if (typeof dataStream === 'string') {
      return dataStream.replace(/\r?\n$/, '');
    }
  }

  return normalizeUniverEditValue(value);
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
