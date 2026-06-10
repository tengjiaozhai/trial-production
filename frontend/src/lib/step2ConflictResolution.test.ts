import { describe, expect, it } from 'vitest';
import { clearStep2ConflictValues } from './step2ConflictResolution';
import type { Step2CellConflict } from './step2CellConflicts';
import type { SKUData } from '../types';

const baseSkuData: SKUData[] = [
  {
    id: 'sku-1',
    stage: 'PR1',
    orderNo: '',
    project: 'A1',
    supplies: [
      {
        id: 'sup-1',
        supplyKey: '一供',
        label: '一供',
        values: { band: '拉美', battery: '一供锂威', storage: '4+128' },
      },
      {
        id: 'sup-2',
        supplyKey: '二供',
        label: '二供',
        values: { band: '拉美', battery: '二供ATL', storage: '4+128' },
      },
    ],
  },
];

describe('clearStep2ConflictValues', () => {
  it('clears all supply cells for a sku-scoped Step2 conflict', () => {
    const conflicts: Step2CellConflict[] = [
      {
        kind: 'cell_conflict',
        scope: 'sku',
        cellId: 'step2-cell-sku-1-band',
        skuId: 'sku-1',
        fieldId: 'band',
        fieldLabel: '频段',
        pcba: 'A1',
        supplyLabel: '整列',
        candidates: [],
      },
    ];

    const result = clearStep2ConflictValues(baseSkuData, conflicts);

    expect(result[0].supplies.map((supply) => supply.values.band)).toEqual(['', '']);
    expect(result[0].supplies.map((supply) => supply.values.storage)).toEqual(['4+128', '4+128']);
  });

  it('clears only the target supply cell for a supply-scoped Step2 conflict', () => {
    const conflicts: Step2CellConflict[] = [
      {
        kind: 'cell_conflict',
        scope: 'supply',
        cellId: 'step2-cell-sku-1-sup-2-battery',
        skuId: 'sku-1',
        supplyId: 'sup-2',
        fieldId: 'battery',
        fieldLabel: '电池',
        pcba: 'A1',
        supplyLabel: '二供',
        candidates: [],
      },
    ];

    const result = clearStep2ConflictValues(baseSkuData, conflicts);

    expect(result[0].supplies[0].values.battery).toBe('一供锂威');
    expect(result[0].supplies[1].values.battery).toBe('');
  });
});
