import type { SKUData, FieldDefinition, StepId } from '../types';
import type { Step2CellConflict } from './step2CellConflicts';
import { buildStep5TableModel, isSkuSpanningField } from './step5TableModel';

export interface TrialProductionCellKey {
  skuId: string;
  supplyId?: string;
  fieldId: string;
  scope: 'sku' | 'supply' | 'field';
}

export interface SheetRow {
  kind: 'title' | 'group' | 'field';
  rowIndex: number;
  fieldId?: string;
  fieldLabel?: string;
  groupTitle?: string;
}

export interface TrialProductionSheetModel {
  columns: Array<{ skuId: string; supplyId: string; label: string }>;
  rows: SheetRow[];
  cellMap: Record<string, TrialProductionCellKey>;
  conflictCellKeys: Set<string>;
  readOnly: boolean;
  step5Model?: ReturnType<typeof buildStep5TableModel>;
}

export function buildTrialProductionSheetModel(args: {
  activeFields: FieldDefinition[];
  skuData: SKUData[];
  currentStep: StepId;
  step2Conflicts?: Step2CellConflict[];
  efuseConfigs?: Record<string, string>;
}): TrialProductionSheetModel {
  const { activeFields, skuData, currentStep, step2Conflicts, efuseConfigs } = args;

  // Step 5 uses the existing Step5TableModel
  if (currentStep === 5) {
    const step5Model = buildStep5TableModel({
      activeFields,
      skuData,
      efuseConfigs,
    });

    return {
      columns: step5Model.columns,
      rows: [],
      cellMap: {},
      conflictCellKeys: new Set(),
      readOnly: true,
      step5Model,
    };
  }

  // Build columns from skuData
  const columns = skuData.flatMap((sku) =>
    sku.supplies.map((supply) => ({
      skuId: sku.id,
      supplyId: supply.id,
      label: supply.label,
    }))
  );

  // Build rows grouped by field group
  const rows: SheetRow[] = [];
  const cellMap: Record<string, TrialProductionCellKey> = {};
  let rowIndex = 0;

  const groups = Array.from(new Set(activeFields.map((f) => f.group)));

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const groupFields = activeFields.filter((f) => f.group === group);
    if (groupFields.length === 0) continue;

    // Add group header row
    rows.push({
      kind: gi === 0 ? 'title' : 'group',
      rowIndex,
      groupTitle: group,
    });
    rowIndex++;

    // Add field rows
    for (const field of groupFields) {
      rows.push({
        kind: 'field',
        rowIndex,
        fieldId: field.id,
        fieldLabel: field.label,
      });

      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        const key = `${rowIndex}-${ci + 1}`;

        cellMap[key] = isSkuSpanningField(field.id)
          ? {
              skuId: col.skuId,
              fieldId: field.id,
              scope: 'sku',
            }
          : {
              skuId: col.skuId,
              supplyId: col.supplyId,
              fieldId: field.id,
              scope: 'supply',
            };
      }

      rowIndex++;
    }
  }

  // Build conflict cell key set
  const conflictCellKeys = new Set<string>();
  if (step2Conflicts) {
    for (const conflict of step2Conflicts) {
      // Find the row index for this field
      const fieldRowIndex = rows.findIndex(
        (r) => r.kind === 'field' && r.fieldId === conflict.fieldId
      );
      if (fieldRowIndex < 0) continue;

      const row = rows[fieldRowIndex];
      if (conflict.scope === 'sku') {
        for (let ci = 0; ci < columns.length; ci++) {
          const col = columns[ci];
          if (col.skuId === conflict.skuId) {
            conflictCellKeys.add(`${row.rowIndex}-${ci + 1}`);
          }
        }
      } else if (conflict.supplyId) {
        const colIndex = columns.findIndex(
          (c) => c.skuId === conflict.skuId && c.supplyId === conflict.supplyId
        );
        if (colIndex >= 0) {
          conflictCellKeys.add(`${row.rowIndex}-${colIndex + 1}`);
        }
      }
    }
  }

  return {
    columns,
    rows,
    cellMap,
    conflictCellKeys,
    readOnly: false,
  };
}
