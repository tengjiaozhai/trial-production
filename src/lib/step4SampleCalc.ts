import type { SplitFieldOption, SupplyTag } from '../types';

export const INTERNAL_IDS = [
  'hw_eng',
  'hw_test',
  'sw_eng',
  'sw_test',
  'struct_eng',
  'reliability_eng',
  'pressure_test',
  'image_eng',
  'npm',
  'ux',
  'parts',
  'pm',
] as const;

export const CUSTOMER_IDS = [
  'reliability',
  'field_test',
  'fan_sample',
  'ce_cert',
] as const;

const SUPPLY_ORDER: SupplyTag[] = ['一供', '二供', '三供', '四供'];

export interface SupplyColumn {
  supplyKey: SupplyTag | '';
  label: string;
}

/**
 * Recompute derived Step 4 values:
 * - t_long_rd_total = sum of INTERNAL_IDS fields
 * - customer_sample_req = sum of CUSTOMER_IDS fields (reliability + field_test + fan_sample + ce_cert)
 * - total_qty = t_long_rd_total + customer_sample_req
 */
export function recomputeStep4Values(
  values: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = { ...values };

  const internalSum = INTERNAL_IDS.reduce((acc, id) => {
    const v = parseInt(values[id] ?? '', 10);
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  const customerSum = CUSTOMER_IDS.reduce((acc, id) => {
    const v = parseInt(values[id] ?? '', 10);
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  const total = internalSum + customerSum;

  if (internalSum === 0) {
    delete result['t_long_rd_total'];
  } else {
    result['t_long_rd_total'] = String(internalSum);
  }

  if (customerSum === 0) {
    delete result['customer_sample_req'];
  } else {
    result['customer_sample_req'] = String(customerSum);
  }

  if (total === 0) {
    delete result['total_qty'];
  } else {
    result['total_qty'] = String(total);
  }

  return result;
}

/**
 * Derive unique supply columns from all split field options, ordered by SUPPLY_ORDER.
 * Falls back to [{ supplyKey: '', label: '主供' }] when no supply info found.
 */
export function deriveSupplyColumnsFromFieldOptions(
  fieldOptions: Partial<Record<string, SplitFieldOption[]>>,
): SupplyColumn[] {
  const supplySet = new Set<SupplyTag>();
  for (const options of Object.values(fieldOptions)) {
    if (!options) continue;
    for (const opt of options) {
      if (opt.supply) {
        supplySet.add(opt.supply);
      }
    }
  }

  const ordered = SUPPLY_ORDER.filter((s) => supplySet.has(s));

  if (ordered.length === 0) {
    return [{ supplyKey: '', label: '主供' }];
  }

  return ordered.map((s) => ({ supplyKey: s, label: s }));
}

export function buildSupplyValuesForSupplyKey(
  fieldOptions: Partial<Record<string, SplitFieldOption[]>>,
  supplyKey: SupplyTag | ''
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [fieldId, options] of Object.entries(fieldOptions)) {
    const hit = (options ?? []).find((o) => o.supply === supplyKey);
    if (hit?.text) values[fieldId] = hit.text;
  }
  return values;
}
