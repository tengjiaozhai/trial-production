import type { FieldDefinition, SkuSupply, SKUData, SupplyTag } from '../types';

export function buildNewFieldId(): string {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildNewSupplyId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildNewSkuId(): string {
  return `sku_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function insertFieldAfter(
  fields: FieldDefinition[],
  afterFieldId: string,
  newField: FieldDefinition,
): FieldDefinition[] {
  const idx = fields.findIndex(f => f.id === afterFieldId);
  if (idx === -1) {
    return [...fields, newField];
  }
  return [...fields.slice(0, idx + 1), newField, ...fields.slice(idx + 1)];
}

export function createInsertedField(
  afterFieldId: string,
  fields: FieldDefinition[],
  label: string,
): FieldDefinition {
  const anchor = fields.find(f => f.id === afterFieldId);
  return {
    id: buildNewFieldId(),
    label,
    group: anchor?.group ?? '基本信息',
    behavior: 'manual',
  };
}

export function createBlankSkuFromTemplate(
  template: SKUData,
  newId: string,
): SKUData {
  return {
    id: newId,
    stage: template.stage,
    orderNo: template.orderNo,
    project: template.project,
    selectedSupplyKey: template.selectedSupplyKey,
    supplies: template.supplies.map(sup => ({
      id: buildNewSupplyId(),
      supplyKey: sup.supplyKey,
      label: sup.label,
      values: {},
    })),
  };
}

export interface CopiedSkuSupply {
  supplyKey: SupplyTag;
  label: string;
  values: Record<string, string>;
}

export interface CopiedSku {
  sourceSkuId: string;
  supplies: CopiedSkuSupply[];
}

export function captureCopyFromSku(sku: SKUData): CopiedSku {
  return {
    sourceSkuId: sku.id,
    supplies: sku.supplies.map(sup => ({
      supplyKey: sup.supplyKey,
      label: sup.label,
      values: pickNonEmptyValues(sup.values),
    })),
  };
}

function pickNonEmptyValues(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== '' && value != null) {
      out[key] = value;
    }
  }
  return out;
}

export function pasteCopiedIntoTarget(
  target: SKUData,
  copy: CopiedSku,
  newSkuId: string,
  supplyIdBuilder: () => string,
): SKUData {
  const supplies: SkuSupply[] = target.supplies.map((targetSup, index) => {
    const fromCopy = copy.supplies[index];
    return {
      id: supplyIdBuilder(),
      supplyKey: fromCopy?.supplyKey ?? targetSup.supplyKey,
      label: fromCopy?.label ?? targetSup.label,
      values: fromCopy ? { ...fromCopy.values } : {},
    };
  });
  return {
    ...target,
    id: newSkuId,
    supplies,
  };
}
