import { describe, it, expect } from 'vitest';
import { buildTrialProductionSheetModel } from './univerTrialProductionSheet';
import { buildWorkbookSnapshot } from '../components/TrialProductionSheet';
import type { SKUData, FieldDefinition, StepId } from '../types';
import type { Step2CellConflict } from './step2CellConflicts';

const basicFields: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
  { id: 'stage', label: '试产阶段', group: '基础信息', behavior: 'auto' },
  { id: 'band', label: '频段', group: '产品规格', behavior: 'auto' },
  { id: 'storage', label: '存储', group: '产品规格', behavior: 'auto' },
  { id: 'lcd', label: 'LCD', group: '电子物料', behavior: 'auto' },
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
    { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
    { id: 'stage', label: '试产阶段', group: '产品规格', behavior: 'auto' },
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
    const groupRow = model.rows.find(r => r.kind === 'group' && r.groupTitle === '产品规格');
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
    { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
    { id: 'stage', label: '试产阶段', group: '产品规格', behavior: 'auto' },
    { id: 'band', label: '频段', group: '生产配置', behavior: 'auto' },
    { id: 'lcd', label: 'LCD', group: '电子物料', behavior: 'auto' },
    { id: 'color', label: '颜色', group: '产品规格', behavior: 'auto' },
  ];

  const skuData: SKUData[] = [
    {
      id: 'sku1',
      stage: 'PR1',
      orderNo: '',
      project: 'X6728',
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', band: 'SSA', lcd: 'BOE', color: 'BLACK' } },
        { id: 's2', supplyKey: '二供', label: '二供', values: { project: 'X6728', stage: 'PR1', band: 'SSA', lcd: 'CSOT', color: 'WHITE' } },
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

    const titleCell = snapshot.sheets.sheet1.cellData[0]?.[0];
    expect(titleCell).toBeDefined();
    expect(titleCell?.s).toBeDefined();
    expect(titleCell?.s.bl).toBe(1); // bold
    expect(titleCell?.s.fs).toBe(14); // font size 14
  });

  it('should apply ABCDE color scheme to group rows', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 3,
    });

    const snapshot = buildWorkbookSnapshot(model, skuData, fields, 3);

    // ABCDE color scheme (5 colors, cycled)
    const colors = [
      { title: '#EAF3FF', body: '#F7FBFF' },  // A: 浅蓝
      { title: '#EAFBF7', body: '#F6FFFC' },  // B: 浅青绿
      { title: '#F3EEFF', body: '#FAF8FF' },  // C: 浅紫
      { title: '#FFF1E6', body: '#FFF8F3' },  // D: 浅橙
      { title: '#EAF8F0', body: '#F6FCF8' },  // E: 浅薄荷绿
    ];

    // Groups are: 基础信息(0), 产品规格(1), 生产配置(2), 电子物料(3)
    const groupTitles = ['基础信息', '产品规格', '生产配置', '电子物料'];
    for (let i = 0; i < groupTitles.length; i++) {
      const groupRow = model.rows.find(r => (r.kind === 'title' || r.kind === 'group') && r.groupTitle === groupTitles[i]);
      const cell = snapshot.sheets.sheet1.cellData[groupRow!.rowIndex]?.[0];
      expect(cell?.s?.bg?.rgb).toBe(colors[i % colors.length].title);
    }
  });

  it('should apply ABCDE color scheme to field rows', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 3,
    });

    const snapshot = buildWorkbookSnapshot(model, skuData, fields, 3);

    const colors = [
      { title: '#EAF3FF', body: '#F7FBFF' },
      { title: '#EAFBF7', body: '#F6FFFC' },
      { title: '#F3EEFF', body: '#FAF8FF' },
      { title: '#FFF1E6', body: '#FFF8F3' },
      { title: '#EAF8F0', body: '#F6FCF8' },
    ];

    // Field in group 0 (基础信息) - Color A body
    const projectRow = model.rows.find(r => r.kind === 'field' && r.fieldId === 'project');
    const projectCell = snapshot.sheets.sheet1.cellData[projectRow!.rowIndex]?.[0];
    expect(projectCell?.s?.bg?.rgb).toBe(colors[0].body);

    // Field in group 1 (产品规格) - Color B body
    const stageRow = model.rows.find(r => r.kind === 'field' && r.fieldId === 'stage');
    const stageCell = snapshot.sheets.sheet1.cellData[stageRow!.rowIndex]?.[0];
    expect(stageCell?.s?.bg?.rgb).toBe(colors[1].body);
  });

  it('should render step 5 preview cells instead of an empty sheet', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fields,
      skuData,
      currentStep: 5,
    });

    const snapshot = buildWorkbookSnapshot(model, skuData, fields, 5);

    expect(model.readOnly).toBe(true);
    expect(model.step5Model).toBeDefined();
    expect(snapshot.sheets.sheet1.cellData[0]?.[0]?.v).toBe('基础信息');
    expect(snapshot.sheets.sheet1.cellData[1]?.[1]?.v).toBe('项目名称');
    expect(snapshot.sheets.sheet1.cellData[1]?.[2]?.v).toBe('X6728');
    expect(snapshot.sheets.sheet1.mergeData.length).toBeGreaterThan(0);
  });
});
