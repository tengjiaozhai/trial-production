import { describe, expect, it } from 'vitest';
import { getStep5GroupStyle, normalizeStep5CellValue, calculateStep5ColumnWidths } from './step5Style';
import type { Step5TableModel } from './step5TableModel';
import type { FieldDefinition, SKUData } from '../types';

describe('getStep5GroupStyle', () => {
  it('returns A title style for groupIndex 0 isTitle', () => {
    const s = getStep5GroupStyle(0, true);
    expect(s.bg.rgb).toBe('EAF3FF');
    expect(s.fs).toBe(14);
    expect(s.bl).toBe(1);
  });

  it('returns A body style for groupIndex 0 isTitle=false', () => {
    const s = getStep5GroupStyle(0, false);
    expect(s.bg.rgb).toBe('F7FBFF');
    expect(s.fs).toBeUndefined();
    expect(s.bl).toBeUndefined();
  });

  it('cycles 5 colors: B/C/D/E for groupIndex 1/2/3/4', () => {
    expect(getStep5GroupStyle(1, true).bg.rgb).toBe('EAFBF7');
    expect(getStep5GroupStyle(2, true).bg.rgb).toBe('F3EEFF');
    expect(getStep5GroupStyle(3, true).bg.rgb).toBe('FFF1E6');
    expect(getStep5GroupStyle(4, true).bg.rgb).toBe('EAF8F0');
  });

  it('wraps around after 5 (groupIndex 5 → A again)', () => {
    expect(getStep5GroupStyle(5, true).bg.rgb).toBe('EAF3FF');
  });
});

describe('normalizeStep5CellValue', () => {
  it('uses normalizeBusinessValue for supply_select', () => {
    expect(normalizeStep5CellValue('supply_select', '一供')).toBe('一供');
    expect(normalizeStep5CellValue('supply_select', '')).toBe('');
  });

  it('uses normalizeFieldValue for normal fields and strips trailing newline', () => {
    // normalizeFieldValue → cleanText → stripTrailingNewline removes \n / \r\n at end
    expect(normalizeStep5CellValue('storage', '4+128\n')).toBe('4+128');
    expect(normalizeStep5CellValue('storage', '4+128')).toBe('4+128');
  });
});

describe('calculateStep5ColumnWidths', () => {
  const model: Step5TableModel = {
    columns: [
      { skuId: 'sku1', supplyId: 's1', label: '一供' },
      { skuId: 'sku1', supplyId: 's2', label: '二供' },
    ],
    rows: [
      { kind: 'title', title: 'Basic' },
      { kind: 'field', fieldId: 'lcd', fieldLabel: 'LCD', cells: [
        { value: 'LCD_6.5寸_OLED', colSpan: 1 },
        { value: 'LCD_6.8寸', colSpan: 1 },
      ] },
    ],
  };

  const activeFields: FieldDefinition[] = [
    { id: 'lcd', label: 'LCD', group: 'Basic', behavior: 'auto' },
  ];

  const skuData: SKUData[] = [
    {
      id: 'sku1', stage: 'EVT', orderNo: '', project: 'X6728',
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { lcd: 'LCD_6.5寸_OLED' } },
        { id: 's2', supplyKey: '二供', label: '二供', values: { lcd: 'LCD_6.8寸' } },
      ],
    },
  ];

  it('returns labelPx >= 120 and content-based dataPx', () => {
    const result = calculateStep5ColumnWidths({ model });
    expect(result.labelPx).toBeGreaterThanOrEqual(120);
    expect(result.dataPx).toHaveLength(2);
    // LCD_6.5寸_OLED = 12 ASCII (96px) + 1 CJK 寸 (16px) = 112px; +16 padding = 128
    expect(result.dataPx[0]).toBe(128);
  });

  it('uses layout.supplyWidths when provided', () => {
    const result = calculateStep5ColumnWidths({
      model, layout: { supplyWidths: { s1: 200, s2: 300 } },
    });
    expect(result.dataPx[0]).toBe(200);
    expect(result.dataPx[1]).toBe(300);
  });

  it('applies min 80px to empty data columns', () => {
    const emptyModel: Step5TableModel = {
      columns: [{ skuId: 'sku1', supplyId: 's1', label: '一供' }],
      rows: [{ kind: 'field', fieldId: 'x', fieldLabel: 'X', cells: [{ value: '', colSpan: 1 }] }],
    };
    const result = calculateStep5ColumnWidths({ model: emptyModel });
    expect(result.dataPx[0]).toBe(80);
  });
});
