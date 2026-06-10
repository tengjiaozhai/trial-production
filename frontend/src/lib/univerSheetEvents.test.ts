import { describe, it, expect } from 'vitest';
import { mapUniverEditToBusinessEdit } from './univerSheetEvents';
import type { TrialProductionCellKey } from './univerTrialProductionSheet';

const sampleCellMap: Record<string, TrialProductionCellKey> = {
  '0-1': { skuId: 'sku1', supplyId: 's1', fieldId: 'project', scope: 'supply' },
  '0-2': { skuId: 'sku1', supplyId: 's2', fieldId: 'project', scope: 'supply' },
  '1-1': { skuId: 'sku1', supplyId: 's1', fieldId: 'band', scope: 'sku' },
  '1-2': { skuId: 'sku1', supplyId: 's2', fieldId: 'band', scope: 'sku' },
  '2-1': { skuId: 'sku1', fieldId: 'mb_id', scope: 'sku' },
};

describe('mapUniverEditToBusinessEdit', () => {
  it('maps a valid cell to the correct business key', () => {
    const result = mapUniverEditToBusinessEdit({
      row: 0,
      column: 1,
      value: 'X6728',
      cellMap: sampleCellMap,
    });

    expect(result).not.toBeNull();
    expect(result!.key.skuId).toBe('sku1');
    expect(result!.key.supplyId).toBe('s1');
    expect(result!.key.fieldId).toBe('project');
    expect(result!.key.scope).toBe('supply');
  });

  it('normalizes value to string', () => {
    const result = mapUniverEditToBusinessEdit({
      row: 0,
      column: 1,
      value: 123,
      cellMap: sampleCellMap,
    });

    expect(result).not.toBeNull();
    expect(result!.value).toBe('123');
  });

  it('normalizes null/undefined value to empty string', () => {
    const result = mapUniverEditToBusinessEdit({
      row: 0,
      column: 1,
      value: null,
      cellMap: sampleCellMap,
    });

    expect(result).not.toBeNull();
    expect(result!.value).toBe('');
  });

  it('returns null for unmapped cells', () => {
    const result = mapUniverEditToBusinessEdit({
      row: 99,
      column: 99,
      value: 'test',
      cellMap: sampleCellMap,
    });

    expect(result).toBeNull();
  });

  it('preserves SKU-scoped key for SKU-scoped fields', () => {
    const result = mapUniverEditToBusinessEdit({
      row: 1,
      column: 1,
      value: 'MEA',
      cellMap: sampleCellMap,
    });

    expect(result).not.toBeNull();
    expect(result!.key.fieldId).toBe('band');
    expect(result!.key.scope).toBe('sku');
  });

  it('preserves supply-scoped key for supply-scoped fields', () => {
    const result = mapUniverEditToBusinessEdit({
      row: 0,
      column: 2,
      value: 'X6728B',
      cellMap: sampleCellMap,
    });

    expect(result).not.toBeNull();
    expect(result!.key.supplyId).toBe('s2');
    expect(result!.key.scope).toBe('supply');
  });

  it('handles cellMap entries without supplyId', () => {
    const result = mapUniverEditToBusinessEdit({
      row: 2,
      column: 1,
      value: 'MB-A1',
      cellMap: sampleCellMap,
    });

    expect(result).not.toBeNull();
    expect(result!.key.fieldId).toBe('mb_id');
    expect(result!.key.supplyId).toBeUndefined();
  });
});
