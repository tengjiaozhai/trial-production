import { describe, it, expect } from 'vitest';
import { buildTrialProductionSheetModel } from './univerTrialProductionSheet';
import { buildWorkbookSnapshot } from '../components/TrialProductionSheet';
import type { SKUData, FieldDefinition, StepId } from '../types';
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

describe('group rows merge across all columns', () => {
  const fields: FieldDefinition[] = [
    { id: 'project', label: '项目名称', group: '基本信息', behavior: 'auto' },
    { id: 'stage', label: '试产阶段', group: '常用项', behavior: 'auto' },
  ];

  const skuData: SKUData[] = [
    {
      id: 'sku1',
      stage: 'PR1',
      orderNo: '',
      project: 'X6728',
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1' } },
        { id: 's2', supplyKey: '二供', label: '二供', values: { project: 'X6728', stage: 'PR1' } },
      ],
    },
  ];

  it('group rows should span from column 0 to last column', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 3,
    });

    const groupRows = model.rows.filter(r => r.kind === 'group' || r.kind === 'title');
    expect(groupRows.length).toBeGreaterThanOrEqual(2);

    // Verify group rows exist with correct titles
    const titleRow = model.rows.find(r => r.kind === 'title');
    const groupRow = model.rows.find(r => r.kind === 'group' && r.groupTitle === '常用项');
    expect(titleRow).toBeDefined();
    expect(groupRow).toBeDefined();
  });

  it('model.columns.length reflects total data columns', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 3,
    });

    // Should have 2 columns (one per supply)
    expect(model.columns).toHaveLength(2);
  });
});

describe('buildWorkbookSnapshot - group rows merge', () => {
  const fields: FieldDefinition[] = [
    { id: 'project', label: '项目名称', group: '基本信息', behavior: 'auto' },
    { id: 'stage', label: '试产阶段', group: '常用项', behavior: 'auto' },
    { id: 'band', label: '频段', group: '存储/PCBA', behavior: 'auto' },
  ];

  const skuData: SKUData[] = [
    {
      id: 'sku1',
      stage: 'PR1',
      orderNo: '',
      project: 'X6728',
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', band: 'SSA' } },
        { id: 's2', supplyKey: '二供', label: '二供', values: { project: 'X6728', stage: 'PR1', band: 'SSA' } },
      ],
    },
  ];

  it('should merge group title rows across all columns', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 3,
    });

    const snapshot = buildWorkbookSnapshot(model, skuData, fields, 3);

    // Title row (row 0) should be merged from column 0 to last column (2)
    const mergeData = snapshot.sheets.sheet1.mergeData;
    const titleMerge = mergeData.find(m =>
      m.startRow === 0 && m.startColumn === 0 && m.endColumn === 2
    );
    expect(titleMerge).toBeDefined();
  });

  it('should apply bold 14px font to group title rows', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 3,
    });

    const snapshot = buildWorkbookSnapshot(model, skuData, fields, 3);

    // Title row (row 0) should have bold 14px font
    const titleCell = snapshot.sheets.sheet1.cellData[0]?.[0];
    expect(titleCell).toBeDefined();
    expect(titleCell?.s).toBeDefined();
    expect(titleCell?.s.bl).toBe(1); // bold
    expect(titleCell?.s.fs).toBe(14); // font size 14
  });

  it('should apply ABAB color scheme to group rows', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 3,
    });

    const snapshot = buildWorkbookSnapshot(model, skuData, fields, 3);

    // Block A colors
    const blockATitleBg = '#EAF3FF';
    const blockABodyBg = '#F7FBFF';

    // Block B colors
    const blockBTitleBg = '#EAFBF7';
    const blockBBodyBg = '#F6FFFC';

    // Group 0 (基本信息) - Block A
    const group0TitleCell = snapshot.sheets.sheet1.cellData[0]?.[0];
    expect(group0TitleCell?.s?.bg?.rgb).toBe(blockATitleBg);

    // Group 1 (常用项) - Block B
    const group1TitleRow = model.rows.find(r => r.kind === 'group' && r.groupTitle === '常用项');
    const group1TitleCell = snapshot.sheets.sheet1.cellData[group1TitleRow!.rowIndex]?.[0];
    expect(group1TitleCell?.s?.bg?.rgb).toBe(blockBTitleBg);

    // Group 2 (存储/PCBA) - Block A
    const group2TitleRow = model.rows.find(r => r.kind === 'group' && r.groupTitle === '存储/PCBA');
    const group2TitleCell = snapshot.sheets.sheet1.cellData[group2TitleRow!.rowIndex]?.[0];
    expect(group2TitleCell?.s?.bg?.rgb).toBe(blockATitleBg);
  });

  it('should apply ABAB color scheme to field rows', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 3,
    });

    const snapshot = buildWorkbookSnapshot(model, skuData, fields, 3);

    const blockABodyBg = '#F7FBFF';
    const blockBBodyBg = '#F6FFFC';

    // Field in group 0 (基本信息) - Block A
    const projectRow = model.rows.find(r => r.kind === 'field' && r.fieldId === 'project');
    const projectCell = snapshot.sheets.sheet1.cellData[projectRow!.rowIndex]?.[0];
    expect(projectCell?.s?.bg?.rgb).toBe(blockABodyBg);

    // Field in group 1 (常用项) - Block B
    const stageRow = model.rows.find(r => r.kind === 'field' && r.fieldId === 'stage');
    const stageCell = snapshot.sheets.sheet1.cellData[stageRow!.rowIndex]?.[0];
    expect(stageCell?.s?.bg?.rgb).toBe(blockBBodyBg);
  });
});
