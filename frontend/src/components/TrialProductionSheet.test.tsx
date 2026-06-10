import { describe, it, expect } from 'vitest';
import type { FieldDefinition } from '../types';
import type { TrialProductionSheetModel } from '../lib/univerTrialProductionSheet';

function calculateColumnWidths(
  model: TrialProductionSheetModel,
  activeFields: FieldDefinition[]
): Record<number, number> {
  const widths: Record<number, number> = {};

  const maxLabelLength = Math.max(
    ...activeFields.map(f => f.label.length),
    6
  );
  widths[0] = Math.max(maxLabelLength * 16, 120);

  for (let i = 0; i < model.columns.length; i++) {
    widths[i + 1] = 120;
  }

  return widths;
}

describe('calculateColumnWidths', () => {
  const mockModel: TrialProductionSheetModel = {
    columns: [
      { skuId: 'sku1', supplyId: 'supply1', label: '一供' },
      { skuId: 'sku1', supplyId: 'supply2', label: '二供' },
    ],
    rows: [],
    cellMap: {},
    conflictCellKeys: new Set(),
    readOnly: false,
  };

  it('标签列宽度应 >= 120px', () => {
    const fields: FieldDefinition[] = [
      { id: 'field1', label: '短标签', group: '基本信息', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields);
    expect(widths[0]).toBeGreaterThanOrEqual(120);
  });

  it('标签列宽度应根据最长标签自适应', () => {
    const longLabel = '这是一个很长的标签名'; // 10 chars
    const fields: FieldDefinition[] = [
      { id: 'field1', label: '短', group: '基本信息', behavior: 'auto' },
      { id: 'field2', label: longLabel, group: '基本信息', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields);
    expect(widths[0]).toBe(longLabel.length * 16); // 10 chars * 16px = 160
  });

  it('数据列宽度应为 120px', () => {
    const fields: FieldDefinition[] = [
      { id: 'field1', label: '标签', group: '基本信息', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields);
    expect(widths[1]).toBe(120);
    expect(widths[2]).toBe(120);
  });
});
