import * as XLSX from 'xlsx';
import type { FieldDefinition, SKUData } from '../types';
import { buildStep5TableModel } from './step5TableModel';

export interface Step5LayoutSnapshot {
  supplyWidths?: Record<string, number>;
  rowHeights?: Record<string, number>;
}

export function buildTrialProductionWorkbook(args: {
  projectName: string;
  activeFields: FieldDefinition[];
  skuData: SKUData[];
  layout?: Step5LayoutSnapshot;
}): XLSX.WorkBook {
  const model = buildStep5TableModel({ activeFields: args.activeFields, skuData: args.skuData });

  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  const totalValueCols = model.columns.length;
  // Total columns: 1 (index) + 1 (label) + totalValueCols
  const totalCols = 2 + totalValueCols;

  let rowIdx = 0; // 0-based row index

  for (const row of model.rows) {
    if (row.kind === 'title' || row.kind === 'group') {
      // Write title/group cell in column A (c=0)
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
      ws[addr] = { v: row.title, t: 's' };
      // Merge across all columns
      if (totalCols > 1) {
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 1 } });
      }
    } else {
      // field row
      // Col A: index label
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: row.indexLabel, t: 's' };
      // Col B: field label
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })] = { v: row.fieldLabel, t: 's' };

      // Value cells starting at col C (c=2)
      let colCursor = 2;
      for (const cell of row.cells) {
        ws[XLSX.utils.encode_cell({ r: rowIdx, c: colCursor })] = {
          v: cell.value,
          t: 's',
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
