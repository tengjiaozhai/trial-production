import type { PcbaSourceRow, SKUData } from '../types';
import { FIELD_DEFS } from '../constants';

export interface Step2CellConflict {
  kind: 'cell_conflict';
  scope: 'sku' | 'supply';
  cellId: string;
  skuId: string;
  supplyId?: string;
  fieldId: string;
  fieldLabel: string;
  pcba: string;
  supplyLabel: string;
  candidates: string[];
}

export function buildStep2CellConflicts(input: {
  checkedPcbaOptions: string[];
  pcbaRows: PcbaSourceRow[];
  skuData: SKUData[];
}): Step2CellConflict[] {
  const { checkedPcbaOptions, pcbaRows, skuData } = input;

  // 1. Group raw rows by PCBA
  const rowsByPcba = new Map<string, PcbaSourceRow[]>();
  for (const row of pcbaRows) {
    if (!checkedPcbaOptions.includes(row.pcba)) continue;
    const existing = rowsByPcba.get(row.pcba) ?? [];
    existing.push(row);
    rowsByPcba.set(row.pcba, existing);
  }

  const conflicts: Step2CellConflict[] = [];

  // 2. For each selected PCBA with duplicates
  for (const [pcba, rows] of rowsByPcba) {
    if (rows.length < 2) continue;

    // 3. Find matching SKU
    const sku = skuData.find((s) => s.project === pcba);
    if (!sku) continue;

    // 4. Collect unique non-empty candidates per field
    const fieldsToCheck = FIELD_DEFS.filter(
      (f) => f.behavior === 'auto' || f.behavior === 'calc'
    );

    for (const field of fieldsToCheck) {
      const candidates = new Set<string>();

      for (const row of rows) {
        const val = row.values[field.id];
        if (val && val.trim()) {
          candidates.add(val.trim());
        }
      }

      // Skip if only one unique candidate (auto-fill case)
      if (candidates.size <= 1) continue;

      // Find supply-scoped conflicts
      for (const supply of sku.supplies) {
        const currentVal = supply.values[field.id];
        if (currentVal && currentVal.trim()) continue; // Already resolved

        const cellId = `step2-cell-${sku.id}-${supply.id}-${field.id}`;
        conflicts.push({
          kind: 'cell_conflict',
          scope: 'supply',
          cellId,
          skuId: sku.id,
          supplyId: supply.id,
          fieldId: field.id,
          fieldLabel: field.label,
          pcba,
          supplyLabel: supply.label,
          candidates: [...candidates],
        });
      }
    }
  }

  return conflicts;
}
