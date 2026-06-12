import { describe, expect, it } from 'vitest';
import { diffSheetData } from './sheetDataDiff';

describe('diffSheetData', () => {
  it('returns empty when both cellMaps and values are identical', () => {
    const result = diffSheetData({
      cellMap: { '0-1': { skuId: 's1', fieldId: 'project', scope: 'sku' } },
      cellValues: { '0-1': 'X6728' },
      previousCellValues: { '0-1': 'X6728' },
    });
    expect(result).toEqual([]);
  });

  it('emits a single update when a value changes', () => {
    const result = diffSheetData({
      cellMap: { '0-1': { skuId: 's1', fieldId: 'project', scope: 'sku' } },
      cellValues: { '0-1': 'X9999' },
      previousCellValues: { '0-1': 'X6728' },
    });
    expect(result).toEqual([{ row: 0, column: 1, value: 'X9999' }]);
  });

  it('skips cells not present in cellMap', () => {
    const result = diffSheetData({
      cellMap: {},
      cellValues: { '0-1': 'X9999' },
      previousCellValues: {},
    });
    expect(result).toEqual([]);
  });

  it('treats missing previousCellValues entry as empty string', () => {
    const result = diffSheetData({
      cellMap: { '0-1': { skuId: 's1', fieldId: 'project', scope: 'sku' } },
      cellValues: { '0-1': 'X9999' },
      previousCellValues: {},
    });
    expect(result).toEqual([{ row: 0, column: 1, value: 'X9999' }]);
  });

  it('emits an update when value becomes empty (clearing a cell)', () => {
    const result = diffSheetData({
      cellMap: { '0-1': { skuId: 's1', fieldId: 'project', scope: 'sku' } },
      cellValues: { '0-1': '' },
      previousCellValues: { '0-1': 'X6728' },
    });
    expect(result).toEqual([{ row: 0, column: 1, value: '' }]);
  });
});
