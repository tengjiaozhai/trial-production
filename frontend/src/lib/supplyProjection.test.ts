import { describe, expect, it } from 'vitest';
import type { SKUData, SupplyTag } from '../types';
import {
  normalizeSelectedSupplyKey,
  projectSkuForStep,
  projectSkusForStep,
  listSupplyKeys,
} from './supplyProjection';

const makeSupply = (supplyKey: SupplyTag, id?: string) => ({
  id: id ?? `s_${supplyKey}`,
  supplyKey,
  label: supplyKey || '主供',
  values: {} as Record<string, string>,
});

const makeSku = (supplies: ReturnType<typeof makeSupply>[], selectedSupplyKey?: string): SKUData => ({
  id: 'sku_1',
  stage: 'PR1',
  orderNo: '',
  project: 'A1',
  fieldOptions: {},
  supplies,
  selectedSupplyKey: selectedSupplyKey as any,
});

describe('supplyProjection', () => {
  it('defaults to first available supply when selectedSupplyKey is missing', () => {
    const input = makeSku([makeSupply('一供'), makeSupply('二供')]);
    expect(normalizeSelectedSupplyKey(input).selectedSupplyKey).toBe('一供');
  });

  it('normalizes legacy sku without selectedSupplyKey', () => {
    const input = makeSku([makeSupply('二供')]);
    expect(normalizeSelectedSupplyKey(input).selectedSupplyKey).toBe('二供');
  });

  it('projects single visible supply from step 3 onward', () => {
    const input = makeSku([makeSupply('一供'), makeSupply('二供')], '二供');
    expect(projectSkuForStep(input, 3).supplies.map((s) => s.supplyKey)).toEqual(['二供']);
    expect(projectSkuForStep(input, 2).supplies.map((s) => s.supplyKey)).toEqual(['一供', '二供']);
  });

  it('keeps all skus projected consistently for step 4 and step 5', () => {
    const sku1 = makeSku([makeSupply('一供')], '一供');
    const sku2 = makeSku([makeSupply('二供')], '二供');
    const step4 = projectSkusForStep([sku1, sku2], 4);
    const step5 = projectSkusForStep([sku1, sku2], 5);
    expect(step4.map((s) => s.supplies.length)).toEqual([1, 1]);
    expect(step5.map((s) => s.supplies.length)).toEqual([1, 1]);
  });

  it('handles four supplies correctly', () => {
    const input = makeSku(
      [makeSupply('一供'), makeSupply('二供'), makeSupply('三供'), makeSupply('四供')],
      '四供'
    );
    expect(normalizeSelectedSupplyKey(input).selectedSupplyKey).toBe('四供');
    expect(projectSkuForStep(input, 3).supplies.map((s) => s.supplyKey)).toEqual(['四供']);
    expect(projectSkuForStep(input, 2).supplies.map((s) => s.supplyKey)).toEqual(['一供', '二供', '三供', '四供']);
  });

  it('lists four supply keys in correct order', () => {
    const input = makeSku(
      [makeSupply('四供'), makeSupply('一供'), makeSupply('三供'), makeSupply('二供')],
    );
    expect(listSupplyKeys(input)).toEqual(['一供', '二供', '三供', '四供']);
  });
});
