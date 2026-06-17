import { describe, it, expect } from 'vitest';
import type { FieldDefinition, SKUData } from '../types';
import type { TrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { buildTrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { buildWorkbookSnapshot, getSheetDataBounds } from './TrialProductionSheet';
import { calculateStep5ColumnWidths } from '../lib/step5Style';

describe('calculateStep5ColumnWidths', () => {
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
  const mockStep5Model = {
    columns: mockModel.columns,
    rows: [
      { kind: 'title' as const, title: 'Basic' },
      { kind: 'field' as const, fieldId: 'lcd', fieldLabel: 'LCD', cells: [
        { value: 'LCD_6.5寸_OLED', colSpan: 1 },
        { value: 'LCD_6.8寸', colSpan: 1 },
      ] },
    ],
  };
  const mockSkuData: SKUData[] = [
    {
      id: 'sku1', stage: 'EVT', orderNo: '', project: 'X6728',
      supplies: [
        { id: 'supply1', supplyKey: '一供', label: '一供', values: { lcd: 'LCD_6.5寸_OLED', band: 'B1/B3/B5' } },
        { id: 'supply2', supplyKey: '二供', label: '二供', values: { lcd: 'LCD_6.8寸', band: 'B1/B3' } },
      ],
    },
  ];
  const fields: FieldDefinition[] = [
    { id: 'lcd', label: 'LCD', group: '屏幕', behavior: 'auto' },
    { id: 'band', label: '频段', group: '通信', behavior: 'auto' },
  ];

  it('labelPx >= 120', () => {
    const result = calculateStep5ColumnWidths({ model: mockStep5Model });
    expect(result.labelPx).toBeGreaterThanOrEqual(120);
  });

  it('empty data column uses min 80px', () => {
    const emptyModel = {
      columns: [{ skuId: 'sku1', supplyId: 'supply1', label: '一供' }],
      rows: [{ kind: 'field' as const, fieldId: 'lcd', fieldLabel: 'LCD', cells: [{ value: '', colSpan: 1 }] }],
    };
    const result = calculateStep5ColumnWidths({ model: emptyModel });
    expect(result.dataPx[0]).toBe(80);
  });
});

describe('freeze rows behavior', () => {
  const fields: FieldDefinition[] = [
    { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
    { id: 'stage', label: '试产阶段', group: '基础信息', behavior: 'auto' },
    { id: 'order_no', label: '订单号', group: '基础信息', behavior: 'manual' },
    { id: 'band', label: '频段', group: '产品规格', behavior: 'auto' },
    { id: 'lcd', label: 'LCD', group: '电子物料', behavior: 'auto' },
  ];

  const skuData: SKUData[] = [
    {
      id: 'sku1',
      stage: 'PR1',
      orderNo: 'O1',
      project: 'X6728',
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', orderNo: 'O1', band: 'SSA', lcd: 'BOE' } },
      ],
    },
  ];

  it('Step 2 model should not be readOnly (freeze is applicable)', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 2,
    });
    expect(model.readOnly).toBe(false);
  });

  it('Step 5 model should be readOnly (freeze not applicable)', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 5,
    });
    expect(model.readOnly).toBe(true);
  });

  it('Step 2 snapshot has cellData for freeze rows', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 2,
    });
    const snapshot = buildWorkbookSnapshot(model, skuData, fields, 2);
    // Row 0-3 should exist in cellData (these are the rows to freeze)
    expect(snapshot.sheets.sheet1.cellData[0]).toBeDefined();
    expect(snapshot.sheets.sheet1.cellData[1]).toBeDefined();
    expect(snapshot.sheets.sheet1.cellData[2]).toBeDefined();
    expect(snapshot.sheets.sheet1.cellData[3]).toBeDefined();
  });
});

describe('getSheetDataBounds', () => {
  const fields: FieldDefinition[] = [
    { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
    { id: 'lcd', label: 'LCD', group: '电子物料', behavior: 'auto' },
  ];

  const skuData: SKUData[] = [
    {
      id: 'sku1',
      stage: 'PR1',
      orderNo: 'O1',
      project: 'X6728',
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', lcd: 'BOE' } },
      ],
    },
  ];

  it('returns lastRow/lastCol for step 2 editable sheet', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 2,
    });
    const bounds = getSheetDataBounds(model);
    expect(bounds.lastRow).toBe(model.rows.length - 1);
    expect(bounds.lastCol).toBe(model.columns.length);
  });

  it('returns lastRow/lastCol for step 5 preview sheet', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 5,
    });
    const bounds = getSheetDataBounds(model);
    expect(bounds.lastRow).toBe(model.step5Model!.rows.length - 1);
    expect(bounds.lastCol).toBe(model.step5Model!.columns.length);
  });
});
