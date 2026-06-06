import { describe, expect, it } from 'vitest';
import {
  buildSupplyValuesForSupplyKey,
  deriveSupplyColumnsFromFieldOptions,
  recomputeStep4Values,
} from './step4SampleCalc';

describe('recomputeStep4Values', () => {
  it('computes t_long_rd_total from internal fields only', () => {
    const result = recomputeStep4Values({
      hw_eng: '2',
      hw_test: '3',
      sw_eng: '4',
      sw_test: '1',
      struct_eng: '5',
      reliability_eng: '2',
      pressure_test: '1',
      image_eng: '1',
      npm: '1',
      ux: '2',
      parts: '3',
      pm: '4',
      customer_sample_req: '',
    });
    expect(result.t_long_rd_total).toBe('29');
    expect(result.total_qty).toBe('29');
  });

  it('computes customer_sample_req from customer fields and adds into total_qty', () => {
    const result = recomputeStep4Values({
      hw_eng: '10',
      reliability: '3',
      field_test: '2',
      fan_sample: '1',
      ce_cert: '1',
    });
    expect(result.customer_sample_req).toBe('7');
    expect(result.t_long_rd_total).toBe('10');
    expect(result.total_qty).toBe('17');
  });

  it('computes customer_sample_req from reliability + field_test + fan_sample + ce_cert', () => {
    const result = recomputeStep4Values({
      hw_eng: '5',
      reliability: '3',
      field_test: '2',
      fan_sample: '1',
      ce_cert: '4',
    });
    expect(result.customer_sample_req).toBe('10');
    expect(result.t_long_rd_total).toBe('5');
    expect(result.total_qty).toBe('15');
  });

  it('deletes customer_sample_req when customer fields are all empty', () => {
    const result = recomputeStep4Values({
      hw_eng: '5',
    });
    expect(result.customer_sample_req).toBeUndefined();
    expect(result.total_qty).toBe('5');
  });

  it('deletes customer_sample_req when sum is 0', () => {
    const result = recomputeStep4Values({
      hw_eng: '5',
      reliability: '0',
      field_test: '0',
      fan_sample: '',
      ce_cert: '',
    });
    expect(result.customer_sample_req).toBeUndefined();
    expect(result.total_qty).toBe('5');
  });
});

describe('deriveSupplyColumnsFromFieldOptions', () => {
  it('derives supply columns from all split fields union', () => {
    const columns = deriveSupplyColumnsFromFieldOptions({
      emmc: [
        { supply: '一供', text: 'E1', sourceCategory2: 'EMMC' },
        { supply: '三供', text: 'E3', sourceCategory2: 'EMMC' },
      ],
      battery: [{ supply: '二供', text: 'B2', sourceCategory2: '电池' }],
    } as any);

    expect(columns.map((c) => c.label)).toEqual(['一供', '二供', '三供']);
    expect(columns.map((c) => c.supplyKey)).toEqual(['一供', '二供', '三供']);
  });

  it('derives four supply columns when four supplies exist', () => {
    const columns = deriveSupplyColumnsFromFieldOptions({
      emmc: [
        { supply: '一供', text: 'E1', sourceCategory2: 'EMMC' },
        { supply: '二供', text: 'E2', sourceCategory2: 'EMMC' },
        { supply: '三供', text: 'E3', sourceCategory2: 'EMMC' },
        { supply: '四供', text: 'E4', sourceCategory2: 'EMMC' },
      ],
    } as any);

    expect(columns.map((c) => c.label)).toEqual(['一供', '二供', '三供', '四供']);
    expect(columns.map((c) => c.supplyKey)).toEqual(['一供', '二供', '三供', '四供']);
  });

  it('falls back to 主供 when no supply tags exist', () => {
    const columns = deriveSupplyColumnsFromFieldOptions({
      pcb: [{ supply: '', text: 'qualcomm', sourceCategory2: 'PCB' }],
    } as any);
    expect(columns).toEqual([{ supplyKey: '', label: '主供' }]);
  });
});

describe('buildSupplyValuesForSupplyKey', () => {
  it('fills only matched supply and leaves unmatched field absent', () => {
    const values = buildSupplyValuesForSupplyKey(
      {
        emmc: [
          { supply: '一供', text: 'E1', sourceCategory2: 'EMMC' },
          { supply: '二供', text: 'E2', sourceCategory2: 'EMMC' },
        ],
        ddr: [{ supply: '一供', text: 'D1', sourceCategory2: 'DDR' }],
      } as any,
      '二供',
    );

    expect(values).toEqual({ emmc: 'E2' });
    expect(values.ddr).toBeUndefined();
  });
});
