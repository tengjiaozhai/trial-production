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
 * - assembly_qty = ceil(total_qty / prod_yield)
 * - pcba = next multiple of 4 >= (board_adj_qty + assembly_qty)
 * - sub_board_qty = pcba
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

  // 组装数量 = 总计 / (生产良率 / 100)
  const prodYield = parseFloat(values['prod_yield'] ?? '');
  if (total > 0 && !isNaN(prodYield) && prodYield > 0) {
    result['assembly_qty'] = String(Math.ceil(total / (prodYield / 100)));
  } else {
    delete result['assembly_qty'];
  }

  // PCBA = 大于（调板数量 + 组装数量）的最近的4的倍数
  const assemblyQty = parseInt(result['assembly_qty'] ?? '', 10);
  const boardAdjQty = parseInt(values['board_adj_qty'] ?? '', 10) || 0;
  if (!isNaN(assemblyQty) && assemblyQty > 0) {
    const sum = boardAdjQty + assemblyQty;
    result['pcba'] = String(Math.ceil(sum / 4) * 4);
  } else {
    delete result['pcba'];
  }

  // 小板数量 = PCBA
  const pcba = parseInt(result['pcba'] ?? '', 10);
  if (!isNaN(pcba) && pcba > 0) {
    result['sub_board_qty'] = String(pcba);
  } else {
    delete result['sub_board_qty'];
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
