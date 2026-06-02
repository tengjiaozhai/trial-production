import { describe, expect, it } from 'vitest';
import type { SupplyTag } from '../types';
import {
  BASIC_INFO_BLOCK_HEIGHT_PX,
  buildTableViewportMetrics,
} from './tableViewport';

describe('BASIC_INFO_BLOCK_HEIGHT_PX', () => {
  it('is exported as 200', () => {
    expect(BASIC_INFO_BLOCK_HEIGHT_PX).toBe(200);
  });
});

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

  it('keeps step4 width aligned to visible supply columns only', () => {
    const metrics = buildTableViewportMetrics({
      currentStep: 4,
      skuData: [
        { id: 'sku1', stage: 'PR1', orderNo: '', project: 'A', supplies: [{ id: 's1', supplyKey: '一供', label: '一供', values: {} }] },
        { id: 'sku2', stage: 'PR1', orderNo: '', project: 'B', supplies: [{ id: 's2', supplyKey: '一供', label: '一供', values: {} }] },
      ],
      colWidths: { s1: 140, s2: 140 },
    });
    expect(metrics.totalValueColumns).toBe(2);
    expect(metrics.totalTableWidthPx).toBe(32 + 120 + 140 + 140);
  });

  it('exposes the fixed basic info block height and a body scrollable flag', () => {
    const metrics = buildTableViewportMetrics({
      currentStep: 2,
      skuData: [
        { id: 'sku1', stage: 'PR1', orderNo: '', project: 'A', supplies: [{ id: 's1', supplyKey: '一供', label: '一供', values: {} }] },
      ],
      colWidths: { s1: 140 },
    });
    expect(metrics.basicInfoBlockHeightPx).toBe(BASIC_INFO_BLOCK_HEIGHT_PX);
    expect(metrics.basicInfoBlockHeightPx).toBe(200);
    expect(metrics.hasBodyScrollableRegion).toBe(true);
  });

  it('keeps total table width correct when there are many supply columns', () => {
    const supplies = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i + 1}`,
      supplyKey: `${i + 1}供` as SupplyTag,
      label: `${i + 1}供`,
      values: {},
    }));
    const colWidths: Record<string, number> = {};
    supplies.forEach((s, i) => { colWidths[s.id] = 120 + i * 10; });
    const metrics = buildTableViewportMetrics({
      currentStep: 2,
      skuData: [{ id: 'sku1', stage: 'PR1', orderNo: '', project: 'A', supplies }],
      colWidths,
    });

    const expectedSupplyWidthPx = supplies.reduce(
      (sum, s) => sum + (colWidths[s.id] ?? 140),
      0,
    );
    const expectedTotalPx = 32 + 120 + expectedSupplyWidthPx;
    expect(metrics.totalTableWidthPx).toBe(expectedTotalPx);
    expect(metrics.totalValueColumns).toBe(8);
    expect(metrics.basicInfoColSpan).toBe(2 + 8);
    expect(metrics.basicInfoBlockHeightPx).toBe(200);
  });
});
