import type { FieldDefinition, SKUData } from '../types';

export interface Step5Cell {
  value: string;
  colSpan: number;
}

export interface Step5FieldRow {
  kind: 'field';
  indexLabel: string;
  fieldId: string;
  fieldLabel: string;
  cells: Step5Cell[];
}

export interface Step5GroupRow {
  kind: 'group';
  title: string;
}

export interface Step5TitleRow {
  kind: 'title';
  title: string;
}

export type Step5Row = Step5TitleRow | Step5GroupRow | Step5FieldRow;

export interface Step5TableModel {
  columns: Array<{ skuId: string; supplyId: string; label: string }>;
  rows: Step5Row[];
}

const SKU_SPANNING_FIELD_IDS = new Set(['project', 'stage', 'mb_id', 'storage', 'band']);

export function isSkuSpanningField(fieldId: string): boolean {
  return SKU_SPANNING_FIELD_IDS.has(fieldId);
}

export function buildStep5TableModel(args: {
  activeFields: FieldDefinition[];
  skuData: SKUData[];
}): Step5TableModel {
  const columns = args.skuData.flatMap((sku) =>
    sku.supplies.map((supply) => ({
      skuId: sku.id,
      supplyId: supply.id,
      label: supply.label,
    }))
  );

  const rows: Step5Row[] = [];
  let visibleIndex = 1;

  const groups = Array.from(new Set(args.activeFields.map((f) => f.group)));

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const groupFields = args.activeFields.filter((f) => f.group === group);
    if (groupFields.length === 0) continue;

    if (gi === 0) {
      rows.push({ kind: 'title', title: group });
    } else {
      rows.push({ kind: 'group', title: group });
    }

    for (const field of groupFields) {
      const cells: Step5Cell[] = [];
      for (const sku of args.skuData) {
        if (isSkuSpanningField(field.id)) {
          const value = sku.supplies[0]?.values[field.id] ?? '';
          cells.push({ value, colSpan: Math.max(1, sku.supplies.length) });
        } else {
          for (const supply of sku.supplies) {
            cells.push({ value: supply.values[field.id] ?? '', colSpan: 1 });
          }
        }
      }

      rows.push({
        kind: 'field',
        indexLabel: String(visibleIndex).padStart(2, '0'),
        fieldId: field.id,
        fieldLabel: field.label,
        cells,
      });
      visibleIndex += 1;
    }
  }

  return { columns, rows };
}
