import type { Step5TableModel } from './step5TableModel';
import { normalizeFieldValue, normalizeBusinessValue } from './skuValueNormalization';

export const STEP5_COLOR_SCHEME: ReadonlyArray<{
  title: string;
  body: string;
}> = [
  { title: 'EAF3FF', body: 'F7FBFF' }, // A: 浅蓝
  { title: 'EAFBF7', body: 'F6FFFC' }, // B: 浅青绿
  { title: 'F3EEFF', body: 'FAF8FF' }, // C: 浅紫
  { title: 'FFF1E6', body: 'FFF8F3' }, // D: 浅橙
  { title: 'EAF8F0', body: 'F6FCF8' }, // E: 浅薄荷绿
];

export const STEP5_LABEL_COL_MIN_PX = 120;
export const STEP5_DATA_COL_MIN_PX = 80;
export const STEP5_COL_PADDING_PX = 16;

function measureTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x7f ? 16 : 8;
  }
  return w;
}

export interface Step5CellStyle {
  bg: { rgb: string };
  ht: number;
  vt: number;
  tb: number;
  bd: { t: { s: number; cl: { rgb: string } }; b: { s: number; cl: { rgb: string } }; l: { s: number; cl: { rgb: string } }; r: { s: number; cl: { rgb: string } } };
  fs?: number;
  bl?: number;
}

export function getStep5GroupStyle(
  groupIndex: number | undefined,
  isTitle: boolean,
): Step5CellStyle {
  const idx = (((groupIndex ?? 0) % STEP5_COLOR_SCHEME.length) + STEP5_COLOR_SCHEME.length) % STEP5_COLOR_SCHEME.length;
  const block = STEP5_COLOR_SCHEME[idx];
  const bg = isTitle ? block.title : block.body;
  const style: Step5CellStyle = {
    bg: { rgb: bg },
    ht: 2,
    vt: 2,
    tb: 2,
    bd: { t: { s: 1, cl: { rgb: '000000' } }, b: { s: 1, cl: { rgb: '000000' } }, l: { s: 1, cl: { rgb: '000000' } }, r: { s: 1, cl: { rgb: '000000' } } },
  };
  if (isTitle) {
    style.fs = 14;
    style.bl = 1;
  }
  return style;
}

export function normalizeStep5CellValue(fieldId: string, value: string): string {
  if (fieldId === 'supply_select') {
    return normalizeBusinessValue(value);
  }
  return normalizeFieldValue(fieldId, value);
}

export interface Step5ColumnWidths {
  labelPx: number;
  dataPx: number[];
}

export function calculateStep5ColumnWidths(args: {
  model: Step5TableModel;
  layout?: { supplyWidths?: Record<string, number> };
}): Step5ColumnWidths {
  const { model, layout } = args;

  // Label column: longest field label in px, min 120
  const fieldLabels = model.rows
    .filter((r): r is Extract<typeof model.rows[number], { kind: 'field' }> => r.kind === 'field')
    .map((r) => r.fieldLabel);
  const longestLabel = fieldLabels.reduce((max, l) => (measureTextWidth(l) > measureTextWidth(max) ? l : max), '');
  const labelPx = Math.max(measureTextWidth(longestLabel) + STEP5_COL_PADDING_PX, STEP5_LABEL_COL_MIN_PX);

  // Data columns: per-supply max cell value width
  const maxTextsPerCol: string[] = new Array(model.columns.length).fill('');
  for (const row of model.rows) {
    if (row.kind !== 'field') continue;
    let colCursor = 0;
    for (const cell of row.cells) {
      const span = Math.max(1, cell.colSpan);
      for (let offset = 0; offset < span && colCursor + offset < maxTextsPerCol.length; offset++) {
        if (cell.value.length > maxTextsPerCol[colCursor + offset].length) {
          maxTextsPerCol[colCursor + offset] = cell.value;
        }
      }
      colCursor += span;
    }
  }

  const dataPx = model.columns.map((col, i) => {
    const layoutPx = layout?.supplyWidths?.[col.supplyId];
    if (layoutPx !== undefined) return layoutPx;
    const text = maxTextsPerCol[i] ?? '';
    return Math.max(measureTextWidth(text) + STEP5_COL_PADDING_PX, STEP5_DATA_COL_MIN_PX);
  });

  return { labelPx, dataPx };
}
