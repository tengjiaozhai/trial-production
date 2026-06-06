import type { SKUData, StepId, SupplyTag } from '../types';

const SUPPLY_ORDER: SupplyTag[] = ['一供', '二供', '三供', '四供', ''];

export function normalizeSelectedSupplyKey(sku: SKUData): SKUData {
  const valid = new Set<string>(sku.supplies.map((s) => s.supplyKey));
  const current = sku.selectedSupplyKey;
  const selected =
    current !== undefined && valid.has(current)
      ? current
      : sku.supplies[0]?.supplyKey ?? '';
  return { ...sku, selectedSupplyKey: selected };
}

export function projectSkuForStep(sku: SKUData, step: StepId | number): SKUData {
  const normalized = normalizeSelectedSupplyKey(sku);
  if (step < 3) return normalized;
  const selected = normalized.selectedSupplyKey;
  const one = normalized.supplies.find((s) => s.supplyKey === selected) ?? normalized.supplies[0];
  return { ...normalized, supplies: one ? [one] : [] };
}

export function projectSkusForStep(skus: SKUData[], step: StepId | number): SKUData[] {
  return skus.map((sku) => projectSkuForStep(sku, step));
}

export function listSupplyKeys(sku: SKUData): SupplyTag[] {
  const keys = new Set<string>(sku.supplies.map((s) => s.supplyKey));
  return SUPPLY_ORDER.filter((k) => keys.has(k));
}
