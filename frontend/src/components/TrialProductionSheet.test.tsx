import { describe, it, expect } from 'vitest';
import type { FieldDefinition, SKUData } from '../types';
import type { TrialProductionSheetModel } from '../lib/univerTrialProductionSheet';

function calculateColumnWidths(
  model: TrialProductionSheetModel,
  activeFields: FieldDefinition[],
  skuData: SKUData[]
): Record<number, { w: number }> {
  const widths: Record<number, { w: number }> = {};

  const maxLabelLength = Math.max(
    ...activeFields.map(f => f.label.length),
    6
  );
  widths[0] = { w: Math.max(maxLabelLength * 16, 120) };

  const maxTextsPerCol: string[] = new Array(model.columns.length).fill('');

  for (const row of model.rows) {
    if (row.kind !== 'field' || !row.fieldId) continue;
    const fieldId = row.fieldId;

    for (let ci = 0; ci < model.columns.length; ci++) {
      const col = model.columns[ci];
      const sku = skuData.find(s => s.id === col.skuId);
      const supply = sku?.supplies.find(s => s.id === col.supplyId);
      const value = String(supply?.values[fieldId] ?? '');
      if (value.length > maxTextsPerCol[ci].length) maxTextsPerCol[ci] = value;
    }
  }

  const measureWidth = (text: string): number => {
    let w = 0;
    for (const ch of text) {
      w += ch.charCodeAt(0) > 0x7f ? 16 : 8;
    }
    return w;
  };

  for (let i = 0; i < model.columns.length; i++) {
    const width = Math.max(measureWidth(maxTextsPerCol[i]) + 16, 80);
    widths[i + 1] = { w: width };
  }

  return widths;
}

describe('calculateColumnWidths', () => {
  const mockModel: TrialProductionSheetModel = {
    columns: [
      { skuId: 'sku1', supplyId: 'supply1', label: '一供' },
      { skuId: 'sku1', supplyId: 'supply2', label: '二供' },
    ],
    rows: [
      { kind: 'field', rowIndex: 0, fieldId: 'lcd', fieldLabel: 'LCD' },
      { kind: 'field', rowIndex: 1, fieldId: 'band', fieldLabel: '频段' },
    ],
    cellMap: {},
    conflictCellKeys: new Set(),
    readOnly: false,
  };

  const mockSkuData: SKUData[] = [
    {
      id: 'sku1',
      stage: 'EVT',
      orderNo: '',
      project: 'X6728',
      supplies: [
        { id: 'supply1', supplyKey: '一供', label: '一供', values: { lcd: 'LCD_6.5寸_OLED', band: 'B1/B3/B5' } },
        { id: 'supply2', supplyKey: '二供', label: '二供', values: { lcd: 'LCD_6.8寸', band: 'B1/B3' } },
      ],
    },
  ];

  it('标签列宽度应 >= 120px', () => {
    const fields: FieldDefinition[] = [
      { id: 'field1', label: '短标签', group: '基本信息', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields, mockSkuData);
    expect(widths[0].w).toBeGreaterThanOrEqual(120);
  });

  it('标签列宽度应根据最长标签自适应', () => {
    const longLabel = '这是一个很长的标签名'; // 10 chars
    const fields: FieldDefinition[] = [
      { id: 'field1', label: '短', group: '基本信息', behavior: 'auto' },
      { id: 'field2', label: longLabel, group: '基本信息', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields, mockSkuData);
    expect(widths[0].w).toBe(longLabel.length * 16); // 10 chars * 16px = 160
  });

  it('数据列宽度应根据最长单元格值自适应（区分中英文宽度）', () => {
    const fields: FieldDefinition[] = [
      { id: 'lcd', label: 'LCD', group: '屏幕', behavior: 'auto' },
      { id: 'band', label: '频段', group: '通信', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields, mockSkuData);
    // col0: lcd='LCD_6.5寸_OLED'(112px) > band='B1/B3/B5'(64px) => 112+16=128
    expect(widths[1].w).toBe(128);
    // col1: lcd='LCD_6.8寸'(72px) > band='B1/B3'(40px) => 72+16=88
    expect(widths[2].w).toBe(88);
  });

  it('空值列应使用最小宽度 80px', () => {
    const emptySkuData: SKUData[] = [
      {
        id: 'sku1',
        stage: 'EVT',
        orderNo: '',
        project: 'X6728',
        supplies: [
          { id: 'supply1', supplyKey: '一供', label: '一供', values: {} },
        ],
      },
    ];
    const emptyModel: TrialProductionSheetModel = {
      columns: [{ skuId: 'sku1', supplyId: 'supply1', label: '一供' }],
      rows: [{ kind: 'field', rowIndex: 0, fieldId: 'lcd', fieldLabel: 'LCD' }],
      cellMap: {},
      conflictCellKeys: new Set(),
      readOnly: false,
    };
    const fields: FieldDefinition[] = [
      { id: 'lcd', label: 'LCD', group: '屏幕', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(emptyModel, fields, emptySkuData);
    expect(widths[1].w).toBe(80);
  });
});
