import type { SKUData } from '../types';
import type { Step2CellConflict } from './step2CellConflicts';
import { recomputeStep4Values } from './step4SampleCalc';

export function clearStep2ConflictValues(skuData: SKUData[], conflicts: Step2CellConflict[]): SKUData[] {
  if (conflicts.length === 0) return skuData;

  // 收集每个 SKU 的供应范围冲突 fieldId（使用 Set 去重）
  const conflictFieldIdsBySku = new Map<string, Set<string>>();
  for (const conflict of conflicts) {
    if (conflict.scope !== 'supply') continue;
    const existing = conflictFieldIdsBySku.get(conflict.skuId) ?? new Set();
    existing.add(conflict.fieldId);
    conflictFieldIdsBySku.set(conflict.skuId, existing);
  }

  return skuData.map((sku) => {
    const conflictFieldIds = conflictFieldIdsBySku.get(sku.id);
    if (!conflictFieldIds || conflictFieldIds.size === 0) return sku;

    let skuChanged = false;
    const nextSupplies = sku.supplies.map((supply) => {
      let supplyChanged = false;
      const nextValues = { ...supply.values };

      // 清空所有供应的冲突字段值
      for (const fieldId of conflictFieldIds) {
        if (!nextValues[fieldId]) continue;
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
    return { ...sku, supplies: nextSupplies };
  });
}
