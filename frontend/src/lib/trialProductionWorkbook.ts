import * as XLSX from 'xlsx';
import type { FieldDefinition, SKUData } from '../types';
import { buildStep5TableModel, isSkuSpanningField } from './step5TableModel';

export interface Step5LayoutSnapshot {
  supplyWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
}

// ABAB color scheme - same as main table
const BLOCK_A = {
  title: { bg: 'EAF3FF', ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 },
  body: { bg: 'F7FBFF', ht: 2, vt: 2, tb: 2 },
};
const BLOCK_B = {
  title: { bg: 'EAFBF7', ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 },
  body: { bg: 'F6FFFC', ht: 2, vt: 2, tb: 2 },
};

function getStyleForGroup(groupIndex: number | undefined, isTitle: boolean) {
  const block = (groupIndex ?? 0) % 2 === 0 ? BLOCK_A : BLOCK_B;
  return isTitle ? block.title : block.body;
}

function createCellStyle(style: { bg?: string; ht?: number; vt?: number; tb?: number; bl?: number; fs?: number }) {
  const cellStyle: Record<string, any> = {};

  // Background color
  if (style.bg) {
    cellStyle.fill = { fgColor: { rgb: style.bg } };
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
  // Total columns: 1 (index) + 1 (label) + totalValueCols
  const totalCols = 2 + totalValueCols;

  let rowIdx = 0; // 0-based row index
  let groupIndex = -1; // Track group index for ABAB coloring

  for (const row of model.rows) {
    if (row.kind === 'title' || row.kind === 'group') {
      // Track group index for coloring
      if (row.kind === 'title') {
        groupIndex = 0;
      } else {
        groupIndex++;
      }

      const style = getStyleForGroup(groupIndex, true);
      const cellStyle = createCellStyle(style);

      // Write title/group cell in column A (c=0)
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
      ws[addr] = { v: row.title, t: 's', s: cellStyle };
      // Merge across all columns
      if (totalCols > 1) {
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 1 } });
      }
    } else {
      // field row
      const style = getStyleForGroup(groupIndex, false);
      const cellStyle = createCellStyle(style);

      // Col A: index label
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: row.indexLabel, t: 's', s: cellStyle };
      // Col B: field label
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })] = { v: row.fieldLabel, t: 's', s: cellStyle };

      // Value cells starting at col C (c=2)
      let colCursor = 2;
      for (const cell of row.cells) {
        ws[XLSX.utils.encode_cell({ r: rowIdx, c: colCursor })] = {
          v: cell.value,
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

  // Set column widths
  const defaultSupplyWidth = 22;
  ws['!cols'] = [
    { wch: 4 },   // index col
    { wch: 18 },  // label col
    ...model.columns.map((col) => {
      const px = args.layout?.supplyWidths?.[col.supplyId] ?? defaultSupplyWidth * 6;
      return { wch: Math.round(px / 6) };
    }),
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
