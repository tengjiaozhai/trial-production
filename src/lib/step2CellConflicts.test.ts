import { describe, it, expect } from 'vitest';
import { buildStep2CellConflicts } from './step2CellConflicts';

it('emits one unresolved supply cell conflict when duplicate source rows produce two different candidates', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { lcd: 'BOE', emmc: '128G' } },
      { pcba: 'A1', sourceIndex: 1, values: { lcd: 'CSOT', emmc: '128G' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { lcd: '' } },
        ],
      },
    ],
  });

  expect(result).toEqual([
    {
      kind: 'cell_conflict',
      scope: 'supply',
      cellId: 'step2-cell-sku-1-sup-1-lcd',
      skuId: 'sku-1',
      supplyId: 'sup-1',
      fieldId: 'lcd',
      fieldLabel: 'LCD',
      pcba: 'A1',
      supplyLabel: '一供',
      candidates: ['BOE', 'CSOT'],
    },
  ]);
});

it('does not emit a conflict when the current cell already has a resolved non-empty value', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { stage: 'PR1' } },
      { pcba: 'A1', sourceIndex: 1, values: { stage: 'PR2' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { stage: 'PR1' } },
        ],
      },
    ],
  });

  expect(result).toEqual([]);
});

it('emits one sku-scoped conflict for band instead of one per supply', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['D1'],
    pcbaRows: [
      { pcba: 'D1', sourceIndex: 0, values: { band: '拉美' } },
      { pcba: 'D1', sourceIndex: 1, values: { band: '沙特（艾为PD IC）' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'D1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { band: '' } },
          { id: 'sup-2', supplyKey: '二供', label: '二供', values: { band: '' } },
          { id: 'sup-3', supplyKey: '三供', label: '三供', values: { band: '' } },
        ],
      },
    ],
  });

  expect(result).toEqual([
    {
      kind: 'cell_conflict',
      scope: 'sku',
      cellId: 'step2-cell-sku-1-band',
      skuId: 'sku-1',
      fieldId: 'band',
      fieldLabel: '频段',
      pcba: 'D1',
      supplyLabel: '整列',
      candidates: ['拉美', '沙特（艾为PD IC）'],
    },
  ]);
});
