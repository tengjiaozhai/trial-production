import { describe, expect, it } from 'vitest';
import { buildStep5TableModel } from './step5TableModel';
import type { FieldDefinition, SKUData } from '../types';

const activeFields: FieldDefinition[] = [
  { id: 'project', label: 'Project', group: 'Basic', behavior: 'manual' },
  { id: 'stage', label: 'Stage', group: 'Basic', behavior: 'manual' },
  { id: 'storage', label: 'Storage', group: 'Basic', behavior: 'manual' },
  { id: 'emmc', label: 'flash EMMC', group: 'Storage/Board', behavior: 'manual' },
  { id: 'ddr', label: 'flash DDR', group: 'Storage/Board', behavior: 'manual' },
];

const skuData: SKUData[] = [
  {
    id: 'sku_1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    fieldOptions: {},
    supplies: [
      {
        id: 's1',
        supplyKey: '一供',
        label: 'Supply A',
        values: {
          project: 'X6728',
          stage: 'PR1',
          storage: '4+128',
          emmc: 'emmc-a-128G',
          ddr: 'ddr-a-4G',
        },
      },
      {
        id: 's2',
        supplyKey: '二供',
        label: 'Supply B',
        values: {
          project: 'X6728',
          stage: 'PR1',
          storage: '4+128',
          emmc: 'emmc-b-128G',
          ddr: 'ddr-b-4G',
        },
      },
    ],
  },
];

describe('buildStep5TableModel', () => {
  it('first row is a title row for the first group', () => {
    const model = buildStep5TableModel({ activeFields, skuData });
    expect(model.rows[0].kind).toBe('title');
  });

  it('storage row has colSpan=2 (merged across supplies)', () => {
    const model = buildStep5TableModel({ activeFields, skuData });
    const storageRow = model.rows.find((r) => r.kind === 'field' && r.fieldId === 'storage');
    expect(storageRow).toBeDefined();
    if (storageRow?.kind !== 'field') throw new Error('expected field row');
    expect(storageRow.cells).toEqual([{ value: '4+128', colSpan: 2 }]);
  });

  it('emmc row has one cell per supply (not merged)', () => {
    const model = buildStep5TableModel({ activeFields, skuData });
    const emmcRow = model.rows.find((r) => r.kind === 'field' && r.fieldId === 'emmc');
    if (emmcRow?.kind !== 'field') throw new Error('expected field row');
    expect(emmcRow.cells.length).toBe(2);
    expect(emmcRow.cells[0].value).toBe('emmc-a-128G');
    expect(emmcRow.cells[1].value).toBe('emmc-b-128G');
  });

  it('includes supplier row after basic info fields when includeSupplierRow is true', () => {
    const model = buildStep5TableModel({ activeFields, skuData, includeSupplierRow: true });
    const supplierRow = model.rows.find((r) => r.kind === 'field' && r.fieldId === '__supplier__');
    expect(supplierRow).toBeDefined();
    if (supplierRow?.kind !== 'field') throw new Error('expected field row');
    expect(supplierRow.fieldLabel).toBe('一供/二供');
  });

  describe('efuse label formatting', () => {
    const efuseActiveFields: FieldDefinition[] = [
      { id: 'hw_eng', label: '硬件', group: '内部样机需求', behavior: 'manual' },
      { id: 'project', label: '项目名称', group: '基本信息', behavior: 'manual' },
    ];

    const efuseSkuData: SKUData[] = [
      {
        id: 'sku_1',
        stage: 'PR1',
        orderNo: '',
        project: 'X6728',
        fieldOptions: {},
        supplies: [
          {
            id: 's1',
            supplyKey: '一供',
            label: 'Supply A',
            values: { hw_eng: '8', project: 'X6728' },
          },
        ],
      },
    ];

    it('appends the selected efuse mode to supported Step 5 labels', () => {
      const model = buildStep5TableModel({
        activeFields: efuseActiveFields,
        skuData: efuseSkuData,
        efuseConfigs: { hw_eng: 'efuse' },
      });

      const row = model.rows.find((item) => item.kind === 'field' && item.fieldId === 'hw_eng');
      if (!row || row.kind !== 'field') throw new Error('expected hw_eng field row');
      expect(row.fieldLabel).toBe('硬件(efuse)');
    });

    it('keeps labels unchanged when no efuse mode is selected', () => {
      const model = buildStep5TableModel({
        activeFields: efuseActiveFields,
        skuData: efuseSkuData,
        efuseConfigs: {},
      });

      const row = model.rows.find((item) => item.kind === 'field' && item.fieldId === 'hw_eng');
      if (!row || row.kind !== 'field') throw new Error('expected hw_eng field row');
      expect(row.fieldLabel).toBe('硬件');
    });
  });
});
