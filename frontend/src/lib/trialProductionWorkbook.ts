import * as XLSX from 'xlsx-js-style';
import type { FieldDefinition, SKUData } from '../types';
import { buildStep5TableModel, isSkuSpanningField } from './step5TableModel';
import { getStep5GroupStyle, normalizeStep5CellValue, calculateStep5ColumnWidths } from './step5Style';

export interface Step5LayoutSnapshot {
  supplyWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
}

function createCellStyle(style: { bg?: string | { rgb: string }; ht?: number; vt?: number; tb?: number; bl?: number; fs?: number }) {
  const cellStyle: Record<string, any> = {};

  // Background color (handle both string and { rgb: string } shapes;
  // shared step5Style returns the object form to match Univer conventions)
  if (style.bg) {
    const rgb = typeof style.bg === 'string' ? style.bg : style.bg.rgb;
    cellStyle.fill = { fgColor: { rgb } };
  }

  // Font
  if (style.bl || style.fs) {
    cellStyle.font = {};
    if (style.bl) cellStyle.font.bold = true;
    if (style.fs) cellStyle.font.sz = style.fs;
  }

  // Alignment
  cellStyle.alignment = {};
  if (style.ht !== undefined) cellStyle.alignment.horizontal = style.ht === 0 ? 'left' : style.ht === 1 ? 'center' : 'right';
  if (style.vt !== undefined) cellStyle.alignment.vertical = style.vt === 0 ? 'top' : style.vt === 1 ? 'center' : 'bottom';
  if (style.tb !== undefined) cellStyle.alignment.wrapText = style.tb === 2;

  // Border - always build xlsx-format thin black border.
  // (shared step5Style's `bd` field is Univer-format `t/b/l/r` with `s:1, cl:{rgb}`,
  //  which is incompatible with the xlsx library's `top/bottom/left/right` + `style:'thin'`
  //  format. The border is xlsx-specific, so we build it here rather than reuse the shared one.)
  cellStyle.border = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  return cellStyle;
}

export function buildTrialProductionWorkbook(args: {
  projectName: string;
  activeFields: FieldDefinition[];
  skuData: SKUData[];
  layout?: Step5LayoutSnapshot;
  efuseConfigs?: Record<string, string>;
}): XLSX.WorkBook {
  const model = buildStep5TableModel({ activeFields: args.activeFields, skuData: args.skuData, includeSupplierRow: true, efuseConfigs: args.efuseConfigs });

  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  const totalValueCols = model.columns.length;
  // Total columns: 1 (label) + totalValueCols
  const totalCols = 1 + totalValueCols;

  let rowIdx = 0; // 0-based row index
  let groupIndex = -1; // Track group index for 5-color cycling

  for (const row of model.rows) {
    if (row.kind === 'title' || row.kind === 'group') {
      if (row.kind === 'title') {
        groupIndex = 0;
      } else {
        groupIndex++;
      }

      const cellStyle = createCellStyle(getStep5GroupStyle(groupIndex, true));

      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
      ws[addr] = { v: row.title, t: 's', s: cellStyle };
      if (totalCols > 1) {
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 1 } });
      }
    } else {
      const cellStyle = createCellStyle(getStep5GroupStyle(groupIndex, false));

      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: row.fieldLabel, t: 's', s: cellStyle };

      let colCursor = 1;
      for (const cell of row.cells) {
        const normalized = normalizeStep5CellValue(row.fieldId, cell.value);
        ws[XLSX.utils.encode_cell({ r: rowIdx, c: colCursor })] = {
          v: normalized,
          t: 's',
          s: cellStyle,
        };
        if (cell.colSpan > 1) {
          merges.push({
            s: { r: rowIdx, c: colCursor },
            e: { r: rowIdx, c: colCursor + cell.colSpan - 1 },
          });
        }
        colCursor += cell.colSpan;
      }
    }
    rowIdx++;
  }

  // Set sheet range
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIdx - 1, c: totalCols - 1 } });

  // Set merges
  if (merges.length > 0) ws['!merges'] = merges;

  // Set column widths (shared with Univer preview)
  const { labelPx, dataPx } = calculateStep5ColumnWidths({
    model,
    layout: args.layout,
  });
  ws['!cols'] = [
    { wch: Math.round(labelPx / 6) },
    ...dataPx.map((px) => ({ wch: Math.round(px / 6) })),
  ];

  // Set row heights (optional)
  if (args.layout?.rowHeights) {
    const rowHeightArr: XLSX.RowInfo[] = [];
    let ri = 0;
    for (const row of model.rows) {
      if (row.kind === 'field') {
        const px = args.layout.rowHeights[row.fieldId];
        if (px) rowHeightArr[ri] = { hpt: Math.round(px * 0.75) };
      }
      ri++;
    }
    if (rowHeightArr.length > 0) ws['!rows'] = rowHeightArr;
  }

  XLSX.utils.book_append_sheet(wb, ws, '搭配表');
  return wb;
}
