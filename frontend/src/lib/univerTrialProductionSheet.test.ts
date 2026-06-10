import { describe, it, expect } from 'vitest';
import { buildTrialProductionSheetModel } from './univerTrialProductionSheet';
import type { SKUData, FieldDefinition } from '../types';
import type { Step2CellConflict } from './step2CellConflicts';

const basicFields: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基本信息', behavior: 'auto' },
  { id: 'stage', label: '试产阶段', group: '基本信息', behavior: 'auto' },
  { id: 'band', label: '频段', group: '常用项', behavior: 'auto' },
  { id: 'storage', label: '存储', group: '存储/PCBA', behavior: 'auto' },
  { id: 'lcd', label: 'LCD', group: '常规器件', behavior: 'auto' },
];

const singleSku: SKUData[] = [
  {
    id: 'sku1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    supplies: [
      { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', band: 'SSA', storage: '4+128', lcd: 'BOE' } },
      { id: 's2', supplyKey: '二供', label: '二供', values: { project: 'X6728', stage: 'PR1', band: 'SSA', storage: '4+128', lcd: 'CSOT' } },
    ],
  },
];

const twoSkus: SKUData[] = [
  {
    id: 'sku1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    supplies: [
      { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', band: 'SSA', storage: '4+128', lcd: 'BOE' } },
    ],
  },
  {
    id: 'sku2',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728B',
    supplies: [
      { id: 's3', supplyKey: '一供', label: '一供', values: { project: 'X6728B', stage: 'PR1', band: 'MEA', storage: '6+128', lcd: 'TIANMA' } },
    ],
  },
];

describe('buildTrialProductionSheetModel', () => {
  it('generates correct columns from skuData and supplies', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 3,
    });

    expect(model.columns).toHaveLength(2);
    expect(model.columns[0]).toEqual({ skuId: 'sku1', supplyId: 's1', label: '一供' });
    expect(model.columns[1]).toEqual({ skuId: 'sku1', supplyId: 's2', label: '二供' });
  });

  it('generates rows with group headers and field rows', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 3,
    });

    const groupRows = model.rows.filter((r) => r.kind === 'group' || r.kind === 'title');
    const fieldRows = model.rows.filter((r) => r.kind === 'field');

    expect(groupRows.length).toBeGreaterThanOrEqual(2);
    expect(fieldRows).toHaveLength(basicFields.length);
  });

  it('maps field cells to correct business keys', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 3,
    });

    const projectRow = model.rows.find((r) => r.kind === 'field' && r.fieldId === 'project');
    expect(projectRow).toBeDefined();

    const cellKey = model.cellMap[`${(projectRow as any).rowIndex}-1`];
    expect(cellKey).toBeDefined();
    expect(cellKey!.skuId).toBe('sku1');
    expect(cellKey!.fieldId).toBe('project');
    expect(cellKey!.scope).toBe('sku');
  });

  it('maps SKU-scoped fields with scope "sku"', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 3,
    });

    const bandRow = model.rows.find((r) => r.kind === 'field' && r.fieldId === 'band');
    expect(bandRow).toBeDefined();

    const cellKey = model.cellMap[`${(bandRow as any).rowIndex}-1`];
    expect(cellKey).toBeDefined();
    expect(cellKey!.scope).toBe('sku');
    expect(cellKey!.fieldId).toBe('band');
  });

  it('maps every visible value cell with the sheet column offset applied', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 3,
    });

    const lcdRow = model.rows.find((r) => r.kind === 'field' && r.fieldId === 'lcd');
    expect(lcdRow).toBeDefined();

    const firstSupplyCell = model.cellMap[`${(lcdRow as any).rowIndex}-1`];
    const secondSupplyCell = model.cellMap[`${(lcdRow as any).rowIndex}-2`];

    expect(firstSupplyCell).toMatchObject({
      skuId: 'sku1',
      supplyId: 's1',
      fieldId: 'lcd',
      scope: 'supply',
    });
    expect(secondSupplyCell).toMatchObject({
      skuId: 'sku1',
      supplyId: 's2',
      fieldId: 'lcd',
      scope: 'supply',
    });
  });

  it('Step 5 uses buildStep5TableModel and marks cells read-only', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 5,
    });

    expect(model.readOnly).toBe(true);
    expect(model.step5Model).toBeDefined();
    expect(model.step5Model!.rows.length).toBeGreaterThan(0);
  });

  it('Step 2 conflict cells have conflict style', () => {
    const conflicts: Step2CellConflict[] = [
      {
        kind: 'cell_conflict',
        scope: 'supply',
        cellId: 'step2-cell-sku1-s1-band',
        skuId: 'sku1',
        supplyId: 's1',
        fieldId: 'band',
        fieldLabel: '频段',
        pcba: 'A1',
        supplyLabel: '一供',
        candidates: ['SSA', 'MEA'],
      },
    ];

    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 2,
      step2Conflicts: conflicts,
    });

    expect(model.conflictCellKeys.size).toBeGreaterThan(0);
  });

  it('marks every visible column for sku-scoped conflicts', () => {
    const conflicts: Step2CellConflict[] = [
      {
        kind: 'cell_conflict',
        scope: 'sku',
        cellId: 'step2-cell-sku1-band',
        skuId: 'sku1',
        fieldId: 'band',
        fieldLabel: '频段',
        pcba: 'A1',
        supplyLabel: '整列',
        candidates: ['拉美', '沙特（艾为PD IC）'],
      },
    ];

    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 2,
      step2Conflicts: conflicts,
    });

    const bandRow = model.rows.find((r) => r.kind === 'field' && r.fieldId === 'band');
    expect(bandRow).toBeDefined();
    expect(model.conflictCellKeys.has(`${(bandRow as any).rowIndex}-1`)).toBe(true);
    expect(model.conflictCellKeys.has(`${(bandRow as any).rowIndex}-2`)).toBe(true);
  });

  it('generates correct columns for multiple SKUs', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: twoSkus,
      currentStep: 3,
    });

    expect(model.columns).toHaveLength(2);
    expect(model.columns[0].skuId).toBe('sku1');
    expect(model.columns[1].skuId).toBe('sku2');
  });

  it('cellMap contains entries for all visible field cells', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: basicFields,
      skuData: singleSku,
      currentStep: 3,
    });

    const fieldRows = model.rows.filter((r) => r.kind === 'field');
    const expectedEntries = fieldRows.length * singleSku[0].supplies.length;
    expect(Object.keys(model.cellMap).length).toBe(expectedEntries);
  });
});
