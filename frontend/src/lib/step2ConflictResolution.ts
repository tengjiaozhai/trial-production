import type { SKUData } from '../types';
import type { Step2CellConflict } from './step2CellConflicts';
import { recomputeStep4Values } from './step4SampleCalc';

export function clearStep2ConflictValues(skuData: SKUData[], conflicts: Step2CellConflict[]): SKUData[] {
  if (conflicts.length === 0) return skuData;

  const conflictsBySku = new Map<string, Step2CellConflict[]>();
  for (const conflict of conflicts) {
    const existing = conflictsBySku.get(conflict.skuId) ?? [];
    existing.push(conflict);
    conflictsBySku.set(conflict.skuId, existing);
  }

  return skuData.map((sku) => {
    const skuConflicts = conflictsBySku.get(sku.id);
    if (!skuConflicts || skuConflicts.length === 0) return sku;

    let skuChanged = false;
    const nextSupplies = sku.supplies.map((supply) => {
      const targetFieldIds = skuConflicts
        .filter((conflict) => conflict.scope === 'sku' || conflict.supplyId === supply.id)
        .map((conflict) => conflict.fieldId);

      if (targetFieldIds.length === 0) return supply;

      let supplyChanged = false;
      const nextValues = { ...supply.values };
      for (const fieldId of targetFieldIds) {
        if (!Object.prototype.hasOwnProperty.call(nextValues, fieldId) || nextValues[fieldId] === '') {
          continue;
        }
        nextValues[fieldId] = '';
        supplyChanged = true;
      }

      if (!supplyChanged) return supply;
      skuChanged = true;
      return {
        ...supply,
        values: recomputeStep4Values(nextValues),
      };
    });

    if (!skuChanged) return sku;
    return {
      ...sku,
      supplies: nextSupplies,
    };
  });
}
