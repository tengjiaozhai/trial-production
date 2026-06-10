import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { FUniver } from '@univerjs/core/facade';
import type { SKUData, FieldDefinition, StepId } from '../types';
import type { Step2CellConflict } from '../lib/step2CellConflicts';
import { buildTrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { mapUniverEditToBusinessEdit } from '../lib/univerSheetEvents';
import { isSkuSpanningField } from '../lib/step5TableModel';

export interface TrialProductionSheetHandle {
  focusCellByBusinessKey: (skuId: string, supplyId: string | undefined, fieldId: string) => void;
}

interface TrialProductionSheetProps {
  currentStep: StepId;
  skuData: SKUData[];
  activeFields: FieldDefinition[];
  efuseConfigs?: Record<string, string>;
  step2Conflicts?: Step2CellConflict[];
  onUpdateValue: (skuId: string, supplyId: string, fieldId: string, value: string) => void;
  onStep5LayoutChange?: (layout: { supplyWidths: Record<string, number>; rowHeights: Record<string, number> }) => void;
  className?: string;
}

export const TrialProductionSheet = forwardRef<TrialProductionSheetHandle, TrialProductionSheetProps>(
  function TrialProductionSheet(props, ref) {
    const {
      currentStep,
      skuData,
      activeFields,
      efuseConfigs,
      step2Conflicts,
      onUpdateValue,
      onStep5LayoutChange,
      className,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const univerRef = useRef<ReturnType<typeof createUniver> | null>(null);
    const univerAPIRef = useRef<ReturnType<typeof FUniver.newAPI> | null>(null);
    const cellMapRef = useRef<Record<string, import('../lib/univerTrialProductionSheet').TrialProductionCellKey>>({});
    const modelRef = useRef<ReturnType<typeof buildTrialProductionSheetModel> | null>(null);

    // Build the sheet model
    const model = buildTrialProductionSheetModel({
      activeFields,
      skuData,
      currentStep,
      step2Conflicts,
      efuseConfigs,
    });
    modelRef.current = model;
    cellMapRef.current = model.cellMap;

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
      focusCellByBusinessKey: (skuId: string, supplyId: string | undefined, fieldId: string) => {
        const api = univerAPIRef.current;
        if (!api) return;

        // Find the cell position from cellMap
        for (const [key, cellKey] of Object.entries(cellMapRef.current) as [string, import('../lib/univerTrialProductionSheet').TrialProductionCellKey][]) {
          const match =
            cellKey.fieldId === fieldId &&
            cellKey.skuId === skuId &&
            (cellKey.scope === 'sku' || cellKey.supplyId === supplyId);
          if (match) {
            const [rowStr, colStr] = key.split('-');
            const row = parseInt(rowStr, 10);
            const col = parseInt(colStr, 10);
            try {
              const workbook = api.getActiveWorkbook();
              if (!workbook) return;
              const worksheet = workbook.getActiveSheet();
              const targetRange = worksheet.getCellMergeData(row, col) ?? worksheet.getRange(row, col);
              targetRange.activate();
              worksheet.scrollToCell(row, col);
            } catch {
              try {
                const workbook = api.getActiveWorkbook();
                const worksheet = workbook?.getActiveSheet();
                const targetRange = worksheet?.getCellMergeData(row, col) ?? worksheet?.getRange(row, col);
                targetRange?.activate();
                worksheet?.scrollToCell(row, col);
              } catch {
                // ignore focus errors
              }
            }
            return;
          }
        }
      },
    }));

    // Initialize Univer once
    useEffect(() => {
      if (!containerRef.current || univerRef.current) return;

      const univerInstance = createUniver({
        locale: LocaleType.ZH_CN,
        locales: {
          [LocaleType.ZH_CN]: mergeLocales(UniverPresetSheetsCoreZhCN),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current,
          }),
        ],
      });

      univerRef.current = univerInstance;
      univerAPIRef.current = FUniver.newAPI(univerInstance.univer);

      return () => {
        univerInstance.univer.dispose();
        univerRef.current = null;
        univerAPIRef.current = null;
      };
    }, []);

    // Load workbook snapshot when model changes
    useEffect(() => {
      const api = univerAPIRef.current;
      if (!api) return;

      // Build Univer workbook snapshot from model
      const snapshot = buildWorkbookSnapshot(model, skuData, activeFields, currentStep);

      try {
        // Create or update the workbook
        api.createWorkbook(snapshot);
      } catch {
        // If createWorkbook fails, try disposing and recreating
        try {
          const workbook = api.getActiveWorkbook();
          if (workbook) {
            // Update via command
            api.executeCommand('sheet.command.set-range-values', {
              value: snapshot.sheets?.['sheet1']?.cellData ?? {},
              range: { startRow: 0, startColumn: 0, endRow: 999, endColumn: 999 },
            });
          }
        } catch {
          // ignore
        }
      }
    }, [model, skuData, activeFields, currentStep]);

    // Listen for cell edit events
    useEffect(() => {
      const api = univerAPIRef.current;
      if (!api) return;

      const disposable = api.addEvent(api.Event.BeforeSheetEditEnd, (params: any) => {
        const { row, column, value, isConfirm } = params;
        if (row === undefined || column === undefined) return;
        if (!isConfirm) return;

        const edit = mapUniverEditToBusinessEdit({
          row,
          column,
          value,
          cellMap: cellMapRef.current,
        });

        if (edit) {
          onUpdateValue(edit.key.skuId, edit.key.supplyId ?? '', edit.key.fieldId, edit.value);
        }
      });

      return () => {
        disposable?.dispose?.();
      };
    }, [onUpdateValue]);

    return (
      <div
        ref={containerRef}
        className={className}
        data-testid="trial-production-sheet"
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
);

function calculateColumnWidths(
  model: ReturnType<typeof buildTrialProductionSheetModel>,
  activeFields: FieldDefinition[],
  skuData: SKUData[]
): Record<number, { w: number }> {
  const widths: Record<number, { w: number }> = {};

  // Column 0: label column — width based on longest field label
  const maxLabelLength = Math.max(
    ...activeFields.map(f => f.label.length),
    6
  );
  widths[0] = { w: Math.max(maxLabelLength * 16, 120) };

  // Data columns: scan actual cell values to find max text width per column
  const maxTextsPerCol: string[] = new Array(model.columns.length).fill('');

  for (const row of model.rows) {
    if (row.kind !== 'field' || !row.fieldId) continue;
    const fieldId = row.fieldId;

    if (isSkuSpanningField(fieldId)) {
      // Spanning field: value spans all supplies of the same SKU
      let ci = 0;
      while (ci < model.columns.length) {
        const skuId = model.columns[ci].skuId;
        const sku = skuData.find(s => s.id === skuId);
        const value = String(sku?.supplies[0]?.values[fieldId] ?? '');
        // Apply to all columns spanned by this SKU
        let end = ci;
        while (end + 1 < model.columns.length && model.columns[end + 1].skuId === skuId) end++;
        for (let k = ci; k <= end; k++) {
          if (value.length > maxTextsPerCol[k].length) maxTextsPerCol[k] = value;
        }
        ci = end + 1;
      }
    } else {
      // Normal field: each column has its own value
      for (let ci = 0; ci < model.columns.length; ci++) {
        const col = model.columns[ci];
        const sku = skuData.find(s => s.id === col.skuId);
        const supply = sku?.supplies.find(s => s.id === col.supplyId);
        const value = String(supply?.values[fieldId] ?? '');
        if (value.length > maxTextsPerCol[ci].length) maxTextsPerCol[ci] = value;
      }
    }
  }

  // Convert max character count to pixel width (CJK chars ~16px, ASCII ~8px)
  const measureWidth = (text: string): number => {
    let w = 0;
    for (const ch of text) {
      w += ch.charCodeAt(0) > 0x7f ? 16 : 8;
    }
    return w;
  };

  for (let i = 0; i < model.columns.length; i++) {
    const maxText = maxTextsPerCol[i];
    const width = Math.max(measureWidth(maxText) + 16, 80); // +16 padding, min 80px
    widths[i + 1] = { w: width };
  }

  return widths;
}

export function buildWorkbookSnapshot(
  model: ReturnType<typeof buildTrialProductionSheetModel>,
  skuData: SKUData[],
  activeFields: FieldDefinition[],
  currentStep: StepId
) {
  // ABCDE color scheme
  const COLOR_SCHEME = [
    { title: { bg: { rgb: '#EAF3FF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#F7FBFF' }, ht: 2, vt: 2, tb: 2 } }, // A: 浅蓝
    { title: { bg: { rgb: '#EAFBF7' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#F6FFFC' }, ht: 2, vt: 2, tb: 2 } }, // B: 浅青绿
    { title: { bg: { rgb: '#F3EEFF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#FAF8FF' }, ht: 2, vt: 2, tb: 2 } }, // C: 浅紫
    { title: { bg: { rgb: '#FFF1E6' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#FFF8F3' }, ht: 2, vt: 2, tb: 2 } }, // D: 浅橙
    { title: { bg: { rgb: '#EAF8F0' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#F6FCF8' }, ht: 2, vt: 2, tb: 2 } }, // E: 浅薄荷绿
  ];

  const getStyleForGroup = (groupIndex: number | undefined, isTitle: boolean) => {
    const colorIndex = (groupIndex ?? 0) % COLOR_SCHEME.length;
    const block = COLOR_SCHEME[colorIndex];
    return isTitle ? block.title : block.body;
  };

  const centeredStyle = { ht: 2, vt: 2, tb: 2 };
  const cellData: Record<number, Record<number, { v?: string; s?: any }>> = {};
  const mergeData: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> = [];

  // For non-Step5, build from model rows and columns
  if (!model.readOnly) {
    let rowIdx = 0;
    for (const row of model.rows) {
      cellData[rowIdx] = {};
      const groupStyle = getStyleForGroup(row.groupIndex, row.kind === 'title' || row.kind === 'group');

      if (row.kind === 'title' || row.kind === 'group') {
        // Group header: put group title in first column with merge across all columns
        const lastColumn = model.columns.length;
        cellData[rowIdx][0] = { v: row.groupTitle ?? '', s: groupStyle };
        // Merge from column 0 to last column
        if (lastColumn > 0) {
          mergeData.push({
            startRow: rowIdx,
            endRow: rowIdx,
            startColumn: 0,
            endColumn: lastColumn,
          });
        }
      } else if (row.kind === 'field' && row.fieldId) {
        // Field row: label in first column, values in subsequent columns
        cellData[rowIdx][0] = { v: row.fieldLabel ?? '', s: groupStyle };

        if (isSkuSpanningField(row.fieldId)) {
          let ci = 0;
          while (ci < model.columns.length) {
            const startColumn = ci + 1;
            const skuId = model.columns[ci].skuId;
            let endColumn = startColumn;

            while (ci + 1 < model.columns.length && model.columns[ci + 1].skuId === skuId) {
              ci += 1;
              endColumn = ci + 1;
            }

            const sku = skuData.find((s) => s.id === skuId);
            const value = sku?.supplies[0]?.values[row.fieldId] ?? '';
            cellData[rowIdx][startColumn] = { v: value, s: groupStyle };
            if (endColumn > startColumn) {
              mergeData.push({
                startRow: rowIdx,
                endRow: rowIdx,
                startColumn,
                endColumn,
              });
            }
            ci += 1;
          }
        } else {
          for (let ci = 0; ci < model.columns.length; ci++) {
            const col = model.columns[ci];
            const sku = skuData.find((s) => s.id === col.skuId);
            if (!sku) continue;
            const supply = sku.supplies.find((s) => s.id === col.supplyId);
            if (!supply) continue;

            const value = supply.values[row.fieldId] ?? '';
            cellData[rowIdx][ci + 1] = { v: value, s: groupStyle };
          }
        }
      }

      rowIdx++;
    }
  }

  return {
    id: 'trial-production-sheet',
    sheetCount: 1,
    sheets: {
      sheet1: {
        id: 'sheet1',
        name: '搭配表',
        cellData,
        mergeData,
        columnData: calculateColumnWidths(model, activeFields, skuData),
        rowCount: Math.max(Object.keys(cellData).length + 10, 50),
        columnCount: Math.max(model.columns.length + 5, 20),
      },
    },
  };
}
