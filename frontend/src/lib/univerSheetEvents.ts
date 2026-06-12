import type { TrialProductionCellKey } from './univerTrialProductionSheet';
import { normalizeBusinessValue } from './skuValueNormalization';

export interface TrialProductionSheetEdit {
  key: TrialProductionCellKey;
  value: string;
}

export function normalizeUniverEditValue(value: unknown): string {
  return normalizeBusinessValue(value);
}

export function normalizeUniverCellDataValue(value: unknown): string {
  return normalizeBusinessValue(value);
}

export function hasUniverCellDataValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value !== 'object') {
    return false;
  }

  if ('toPlainText' in value) {
    return true;
  }

  if ('v' in value) {
    return true;
  }

  const bodyDataStream = (value as { body?: { dataStream?: unknown } }).body?.dataStream;
  if (typeof bodyDataStream === 'string') {
    return true;
  }

  const richTextDataStream = (value as { p?: { body?: { dataStream?: unknown } } }).p?.body?.dataStream;
  return typeof richTextDataStream === 'string';
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
