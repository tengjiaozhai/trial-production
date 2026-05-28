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
});
