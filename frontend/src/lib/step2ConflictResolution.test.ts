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
      {
        id: 'sup-3',
        supplyKey: '三供',
        label: '三供',
        values: { band: '拉美', battery: '一供锂威', storage: '4+128' },
      },
      {
        id: 'sup-4',
        supplyKey: '四供',
        label: '四供',
        values: { band: '拉美', battery: '一供锂威', storage: '4+128' },
      },
    ],
  },
];

describe('clearStep2ConflictValues', () => {
  it('ignores sku-scoped conflicts', () => {
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

    // SKU 范围的冲突被忽略，值保持不变
    expect(result[0].supplies.map((supply) => supply.values.band)).toEqual(['拉美', '拉美', '拉美', '拉美']);
    expect(result[0].supplies.map((supply) => supply.values.storage)).toEqual(['4+128', '4+128', '4+128', '4+128']);
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

    // 供应范围冲突现在会清空所有供应的该字段值
    expect(result[0].supplies[0].values.battery).toBe('');
    expect(result[0].supplies[1].values.battery).toBe('');
    expect(result[0].supplies[2].values.battery).toBe('');
    expect(result[0].supplies[3].values.battery).toBe('');
  });

  it('clears all supplies when 一供 has conflict (fallback scenario)', () => {
    const conflicts: Step2CellConflict[] = [
      {
        kind: 'cell_conflict',
        scope: 'supply',
        cellId: 'step2-cell-sku-1-sup-1-battery',
        skuId: 'sku-1',
        supplyId: 'sup-1',
        fieldId: 'battery',
        fieldLabel: '电池',
        pcba: 'A1',
        supplyLabel: '一供',
        candidates: [],
      },
    ];

    const result = clearStep2ConflictValues(baseSkuData, conflicts);

    // 所有供应的电池字段都应该被清空
    expect(result[0].supplies.map((supply) => supply.values.battery)).toEqual(['', '', '', '']);
    // 其他字段不受影响
    expect(result[0].supplies.map((supply) => supply.values.band)).toEqual(['拉美', '拉美', '拉美', '拉美']);
  });

  it('ignores sku-scoped conflicts', () => {
    const conflicts: Step2CellConflict[] = [
      {
        kind: 'cell_conflict',
        scope: 'sku',
        cellId: 'step2-cell-sku-1-storage',
        skuId: 'sku-1',
        fieldId: 'storage',
        fieldLabel: '存储',
        pcba: 'A1',
        supplyLabel: '整列',
        candidates: [],
      },
    ];

    const result = clearStep2ConflictValues(baseSkuData, conflicts);

    // SKU 范围的冲突现在被忽略
    expect(result[0].supplies.map((supply) => supply.values.storage)).toEqual(['4+128', '4+128', '4+128', '4+128']);
  });

  it('returns original data when no conflicts', () => {
    const result = clearStep2ConflictValues(baseSkuData, []);
    expect(result).toBe(baseSkuData);
  });
});
