import type { SplitFieldOption } from '../types';

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

const SUPPLY_ORDER = ['一供', '二供', '三供'] as const;

type InternalId = (typeof INTERNAL_IDS)[number];

export interface SupplyColumn {
  supply: string;
  label: string;
}

/**
 * Recompute derived Step 4 values:
 * - t_long_rd_total = sum of INTERNAL_IDS fields
 * - total_qty = t_long_rd_total + customer_sample_req
 * - customer_sample_req is kept as-is (manual input)
 */
export function recomputeStep4Values(
  values: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = { ...values };

  const internalSum = INTERNAL_IDS.reduce((acc, id) => {
    const v = parseInt(values[id] ?? '', 10);
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  const customerReq = parseInt(values['customer_sample_req'] ?? '', 10);
  const customerVal = isNaN(customerReq) ? 0 : customerReq;

  const total = internalSum + customerVal;

  if (internalSum === 0) {
    delete result['t_long_rd_total'];
  } else {
    result['t_long_rd_total'] = String(internalSum);
  }

  if (total === 0) {
    delete result['total_qty'];
  } else {
    result['total_qty'] = String(total);
  }

  return result;
}

/**
 * Derive unique supply columns from internal field options, ordered by SUPPLY_ORDER.
 * Falls back to [{ supply: '主供', label: '主供' }] when no supply info found.
 */
export function deriveSupplyColumnsFromFieldOptions(
  fieldOptions: Partial<Record<string, SplitFieldOption[]>>,
): SupplyColumn[] {
  const supplySet = new Set<string>();

  for (const id of INTERNAL_IDS) {
    const options = fieldOptions[id as InternalId];
    if (!options) continue;
    for (const opt of options) {
      if (opt.supply) {
        supplySet.add(opt.supply);
      }
    }
  }

  const ordered = SUPPLY_ORDER.filter((s) => supplySet.has(s));

  if (ordered.length === 0) {
    return [{ supply: '主供', label: '主供' }];
  }

  return ordered.map((s) => ({ supply: s, label: s }));
}
