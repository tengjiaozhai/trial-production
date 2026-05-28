import { describe, expect, it } from 'vitest';
import { recomputeStep4Values } from './step4SampleCalc';

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

  it('keeps customer_sample_req manual and adds into total_qty', () => {
    const result = recomputeStep4Values({
      hw_eng: '10',
      customer_sample_req: '7',
    });
    expect(result.customer_sample_req).toBe('7');
    expect(result.t_long_rd_total).toBe('10');
    expect(result.total_qty).toBe('17');
  });
});

import { deriveSupplyColumnsFromFieldOptions } from './step4SampleCalc';

describe('deriveSupplyColumnsFromFieldOptions', () => {
  it('derives supply columns from internal field options', () => {
    const columns = deriveSupplyColumnsFromFieldOptions({
      hw_eng: [
        { supply: '一供', text: '12', sourceCategory2: '硬件' },
        { supply: '二供', text: '8', sourceCategory2: '硬件' },
      ],
    } as any);
    expect(columns.map((c) => c.label)).toEqual(['一供', '二供']);
  });

  it('falls back to single 主供 column when no supply info', () => {
    const columns = deriveSupplyColumnsFromFieldOptions({});
    expect(columns).toHaveLength(1);
    expect(columns[0].label).toBe('主供');
  });
});
