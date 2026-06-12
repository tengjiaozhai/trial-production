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
  groupIndex?: number;
}

export interface TrialProductionSheetModel {
  columns: Array<{ skuId: string; supplyId: string; label: string }>;
  rows: SheetRow[];
  cellMap: Record<string, TrialProductionCellKey>;
  conflictCellKeys: Set<string>;
  readOnly: boolean;
  step5Model?: ReturnType<typeof buildStep5TableModel>;
}

/**
 * 根据当前步骤过滤字段：
 * - Step1 类字段：始终显示
 * - Auto 类字段：Step2 显示，Step3 隐藏
 * - Manual 类字段：Step2 隐藏，Step3 显示
 * - Step4/5：全部显示
 */
export function filterFieldsByStep(fields: FieldDefinition[], step: StepId): FieldDefinition[] {
  if (step === 4 || step === 5) return fields;
  return fields.filter((f) => {
    if (f.fieldCategory === 'auto') return step === 2;
    if (f.fieldCategory === 'manual') return step === 3;
    return true; // step1 和未标注的默认显示
  });
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

  // Filter fields by current step
  const visibleFields = filterFieldsByStep(activeFields, currentStep);

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

  const groups = Array.from(new Set(visibleFields.map((f) => f.group)));

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const groupFields = visibleFields.filter((f) => f.group === group);
    if (groupFields.length === 0) continue;

    // Add group header row
    rows.push({
      kind: gi === 0 ? 'title' : 'group',
      rowIndex,
      groupTitle: group,
      groupIndex: gi,
    });
    rowIndex++;

    // Add field rows
    for (const field of groupFields) {
      rows.push({
        kind: 'field',
        rowIndex,
        fieldId: field.id,
        fieldLabel: field.label,
        groupIndex: gi,
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
