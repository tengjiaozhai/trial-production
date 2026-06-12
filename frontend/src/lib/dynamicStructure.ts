import type { FieldDefinition, SKUData, StepId, SupplyTag } from '../types';
import { normalizeSelectedSupplyKey } from './supplyProjection';

const SKU_SCOPED_FIELD_IDS = new Set(['project', 'stage', 'mb_id', 'storage', 'band']);

function cloneSkuScopedValues(values: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const fieldId of SKU_SCOPED_FIELD_IDS) {
    const value = values[fieldId];
    if (value) {
      next[fieldId] = value;
    }
  }
  return next;
}

export function insertDynamicSupply(args: {
  sku: SKUData;
  afterSupplyId?: string;
  currentStep: StepId | number;
  newSupplyId: string;
  newSupplyKey: SupplyTag;
}): SKUData {
  const anchorIndex = args.afterSupplyId
    ? args.sku.supplies.findIndex((supply) => supply.id === args.afterSupplyId)
    : -1;
  const fallbackIndex = args.sku.supplies.length - 1;
  const insertAfterIndex = anchorIndex >= 0 ? anchorIndex : fallbackIndex;
  const anchorSupply = args.sku.supplies[insertAfterIndex] ?? args.sku.supplies[0];
  const newSupply = {
    id: args.newSupplyId,
    supplyKey: args.newSupplyKey,
    label: args.newSupplyKey,
    values: cloneSkuScopedValues(anchorSupply?.values ?? {}),
  };

  const nextSupplies = [...args.sku.supplies];
  nextSupplies.splice(Math.max(insertAfterIndex + 1, 0), 0, newSupply);

  return normalizeSelectedSupplyKey({
    ...args.sku,
    selectedSupplyKey: args.currentStep >= 3 ? args.newSupplyKey : args.sku.selectedSupplyKey,
    supplies: nextSupplies,
  });
}

export function updateCustomFieldLabel(
  fields: FieldDefinition[],
  fieldId: string,
  nextLabel: string
): FieldDefinition[] {
  if (!fieldId.startsWith('f_')) {
    return fields;
  }

  return fields.map((field) => (field.id === fieldId ? { ...field, label: nextLabel } : field));
}

export function buildNextCustomFieldLabel(fields: FieldDefinition[]): string {
  const customCount = fields.filter((field) => field.id.startsWith('f_')).length;
  return `自定义字段${customCount + 1}`;
}
