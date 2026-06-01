import { describe, expect, it } from 'vitest';
import { buildTableViewportMetrics } from './tableViewport';

describe('buildTableViewportMetrics', () => {
  it('returns one shared table width for both table shells', () => {
    const metrics = buildTableViewportMetrics({
      currentStep: 2,
      skuData: [
        {
          id: 'sku1',
          stage: 'PR1',
          orderNo: '',
          project: 'X6728',
          supplies: [
            { id: 's1', supplyKey: '一供', label: '一供', values: {} },
            { id: 's2', supplyKey: '二供', label: '二供', values: {} },
          ],
        },
      ],
      colWidths: { s1: 140, s2: 180 },
    });

    expect(metrics.totalTableWidthPx).toBe(metrics.topTableWidthPx);
    expect(metrics.totalTableWidthPx).toBe(metrics.bottomTableWidthPx);
    expect(metrics.basicInfoColSpan).toBe(metrics.bodyColSpan);
    expect(metrics.totalValueColumns).toBe(2);
  });

  it('adds step4 extra column per sku when currentStep is 4', () => {
    const metrics = buildTableViewportMetrics({
      currentStep: 4,
      skuData: [
        { id: 'sku1', stage: 'PR1', orderNo: '', project: 'A', supplies: [{ id: 's1', supplyKey: '一供', label: '一供', values: {} }] },
        { id: 'sku2', stage: 'PR1', orderNo: '', project: 'B', supplies: [{ id: 's2', supplyKey: '一供', label: '一供', values: {} }] },
      ],
      colWidths: { s1: 140, s2: 140 },
    });
    expect(metrics.totalValueColumns).toBe(4); // 1 supply each + 1 step4 extra per sku
  });
});
