import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationZhCN from '@univerjs/preset-sheets-data-validation/locales/zh-CN';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import { FUniver } from '@univerjs/core/facade';
import type { SKUData, FieldDefinition, StepId, SupplyTag } from '../types';
import type { Step2CellConflict } from '../lib/step2CellConflicts';
import { buildTrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { hasUniverCellDataValue, mapUniverEditToBusinessEdit, normalizeUniverCellDataValue, normalizeUniverEditValue } from '../lib/univerSheetEvents';
import { isSkuSpanningField } from '../lib/step5TableModel';
import { normalizeBusinessValue, normalizeFieldValue, PROD_LOC_OPTIONS } from '../lib/skuValueNormalization';

export interface TrialProductionSheetHandle {
  focusCellByBusinessKey: (skuId: string, supplyId: string | undefined, fieldId: string) => void;
}

interface SheetViewportState {
  activeRow: number;
  activeColumn: number;
  viewStartRow: number;
  viewStartColumn: number;
}

function captureSheetViewportState(worksheet: {
  getActiveCell?: () => { _range?: { actualRow?: number; startRow?: number; actualColumn?: number; startColumn?: number } } | null;
  getScrollState?: () => { sheetViewStartRow?: number; sheetViewStartColumn?: number } | null;
} | null | undefined): SheetViewportState | null {
  if (!worksheet) {
    return null;
  }

  const activeCell = worksheet.getActiveCell?.();
  const scrollState = worksheet.getScrollState?.();
  const activeRow = activeCell?._range?.actualRow ?? activeCell?._range?.startRow;
  const activeColumn = activeCell?._range?.actualColumn ?? activeCell?._range?.startColumn;
  const viewStartRow = scrollState?.sheetViewStartRow;
  const viewStartColumn = scrollState?.sheetViewStartColumn;

  if (
    !Number.isFinite(activeRow) ||
    !Number.isFinite(activeColumn) ||
    !Number.isFinite(viewStartRow) ||
    !Number.isFinite(viewStartColumn)
  ) {
    return null;
  }

  return {
    activeRow,
    activeColumn,
    viewStartRow,
    viewStartColumn,
  };
}

interface TrialProductionSheetProps {
  currentStep: StepId;
  skuData: SKUData[];
  activeFields: FieldDefinition[];
  efuseConfigs?: Record<string, string>;
  step2Conflicts?: Step2CellConflict[];
  skuSupplyKeys?: Record<string, SupplyTag[]>;
  onUpdateValue: (skuId: string, supplyId: string, fieldId: string, value: string) => void;
  onSelectedSupplyChange?: (skuId: string, supplyKey: string) => void;
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
      skuSupplyKeys,
      onUpdateValue,
      onSelectedSupplyChange,
      onStep5LayoutChange,
      className,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const univerRef = useRef<ReturnType<typeof createUniver> | null>(null);
    const univerAPIRef = useRef<ReturnType<typeof createUniver>['univerAPI'] | null>(null);
    const [univerReady, setUniverReady] = useState(false);
    const cellMapRef = useRef<Record<string, import('../lib/univerTrialProductionSheet').TrialProductionCellKey>>({});
    const modelRef = useRef<ReturnType<typeof buildTrialProductionSheetModel> | null>(null);
    const focusRetryTimersRef = useRef<number[]>([]);
    const viewportRestoreTimersRef = useRef<number[]>([]);
    const univerReadyTimersRef = useRef<number[]>([]);
    const previousStepRef = useRef<StepId | null>(null);

    // Build the sheet model
    const model = useMemo(() => buildTrialProductionSheetModel({
      activeFields,
      skuData,
      currentStep,
      step2Conflicts,
      efuseConfigs,
    }), [activeFields, currentStep, efuseConfigs, skuData, step2Conflicts]);
    modelRef.current = model;
    cellMapRef.current = model.cellMap;

    const clearFocusRetryTimers = () => {
      for (const timer of focusRetryTimersRef.current) {
        window.clearTimeout(timer);
      }
      focusRetryTimersRef.current = [];
    };

    const clearViewportRestoreTimers = () => {
      for (const timer of viewportRestoreTimersRef.current) {
        window.clearTimeout(timer);
      }
      viewportRestoreTimersRef.current = [];
    };

    const clearUniverReadyTimers = () => {
      for (const timer of univerReadyTimersRef.current) {
        window.clearTimeout(timer);
      }
      univerReadyTimersRef.current = [];
    };

    const getCurrentBusinessValue = (skuId: string, supplyId: string | undefined, fieldId: string): string => {
      const sku = skuData.find((item) => item.id === skuId);
      if (!sku) {
        return '';
      }

      if (isSkuSpanningField(fieldId)) {
        return normalizeFieldValue(fieldId, sku.supplies[0]?.values[fieldId] ?? '');
      }

      const supply = sku.supplies.find((item) => item.id === supplyId);
      return normalizeFieldValue(fieldId, supply?.values[fieldId] ?? '');
    };

    const getCurrentSelectedSupplyKey = (skuId: string): string => {
      const sku = skuData.find((item) => item.id === skuId);
      return sku?.selectedSupplyKey ?? sku?.supplies[0]?.supplyKey ?? '';
    };

    const focusCellByBusinessKey = (skuId: string, supplyId: string | undefined, fieldId: string) => {
      const api = univerAPIRef.current;
      if (!api) return;

      let fallbackRow: number | null = null;
      let fallbackCol: number | null = null;

      for (const [key, cellKey] of Object.entries(cellMapRef.current) as [string, import('../lib/univerTrialProductionSheet').TrialProductionCellKey][]) {
        if (cellKey.fieldId !== fieldId || cellKey.skuId !== skuId) {
          continue;
        }

        const [rowStr, colStr] = key.split('-');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);

        if (fallbackRow === null || fallbackCol === null) {
          fallbackRow = row;
          fallbackCol = col;
        }

        if (cellKey.scope === 'sku' || cellKey.supplyId === supplyId) {
          fallbackRow = row;
          fallbackCol = col;
          break;
        }
      }

      if (fallbackRow === null || fallbackCol === null) {
        return;
      }

      const row = fallbackRow;
      const col = fallbackCol;
      const isWindows = typeof navigator !== 'undefined'
        ? /win/i.test(`${navigator.userAgent ?? ''} ${navigator.platform ?? ''}`)
        : false;

      const focusCell = () => {
        const workbook = api.getActiveWorkbook();
        const worksheet = workbook?.getActiveSheet();
        if (!worksheet) return;

        const mergedRange = worksheet.getCellMergeData(row, col);
        const targetRange = mergedRange ?? worksheet.getRange(row, col);

        try {
          if (typeof targetRange.activateAsCurrentCell === 'function') {
            targetRange.activateAsCurrentCell();
          } else {
            targetRange.activate();
          }
          worksheet.scrollToCell(row, col, 0);
        } catch {
          try {
            targetRange.activate();
            worksheet.scrollToCell(row, col, 0);
          } catch {
            // ignore focus errors
          }
        }
      };

      clearFocusRetryTimers();
      focusCell();

      if (!isWindows) {
        return;
      }

      for (const delay of [0, 180, 1200]) {
        const timer = window.setTimeout(() => {
          focusCell();
        }, delay);
        focusRetryTimersRef.current.push(timer);
      }
    };

    const restoreSheetViewportState = (viewportState: SheetViewportState | null) => {
      const api = univerAPIRef.current;
      if (!api || !viewportState) {
        return;
      }

      const isWindows = typeof navigator !== 'undefined'
        ? /win/i.test(`${navigator.userAgent ?? ''} ${navigator.platform ?? ''}`)
        : false;

      const restoreViewport = () => {
        const worksheet = api.getActiveWorkbook()?.getActiveSheet();
        if (!worksheet) {
          return;
        }

        try {
          const activeRange = worksheet.getCellMergeData(viewportState.activeRow, viewportState.activeColumn)
            ?? worksheet.getRange(viewportState.activeRow, viewportState.activeColumn);
          if (typeof activeRange.activateAsCurrentCell === 'function') {
            activeRange.activateAsCurrentCell();
          } else {
            activeRange.activate();
          }
        } catch {
          // ignore active-cell restore errors
        }

        try {
          worksheet.scrollToCell(viewportState.viewStartRow, viewportState.viewStartColumn, 0);
        } catch {
          // ignore viewport restore errors
        }
      };

      clearViewportRestoreTimers();
      restoreViewport();

      if (!isWindows) {
        return;
      }

      for (const delay of [0, 180, 1200]) {
        const timer = window.setTimeout(() => {
          restoreViewport();
        }, delay);
        viewportRestoreTimersRef.current.push(timer);
      }
    };

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
      focusCellByBusinessKey,
    }));

    // Initialize Univer once
    useEffect(() => {
      const container = containerRef.current;
      if (!container || univerRef.current) return;

      const univerInstance = createUniver({
        locale: LocaleType.ZH_CN,
        locales: {
          [LocaleType.ZH_CN]: mergeLocales(
            UniverPresetSheetsCoreZhCN,
            UniverPresetSheetsDataValidationZhCN,
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current,
          }),
          UniverSheetsDataValidationPreset(),
        ],
      });

      univerRef.current = univerInstance;
      univerAPIRef.current = univerInstance.univerAPI;
      const readyTimer = window.setTimeout(() => {
        setUniverReady(true);
      }, 0);
      univerReadyTimersRef.current.push(readyTimer);

      return () => {
        clearFocusRetryTimers();
        clearViewportRestoreTimers();
        clearUniverReadyTimers();
        univerInstance.univer.dispose();
        setUniverReady(false);
        univerRef.current = null;
        univerAPIRef.current = null;
        try {
          univerInstance.univer.dispose();
        } catch {
          // ignore dispose errors during unmount
        }
      };
    }, []);

    // Load workbook snapshot when model changes
    useEffect(() => {
      if (!univerReady) return;
      const api = univerAPIRef.current;
      if (!api) return;
      const preserveViewport = previousStepRef.current === currentStep;
      const currentWorkbook = preserveViewport ? api.getActiveWorkbook() : null;
      const viewportState = preserveViewport
        ? captureSheetViewportState(currentWorkbook?.getActiveSheet())
        : null;
      previousStepRef.current = currentStep;

      // Build Univer workbook snapshot from model
      const snapshot = buildWorkbookSnapshot(model, skuData, activeFields, currentStep);

      // Synchronously create the workbook.
      // (Was wrapped in setTimeout(0) to "avoid React unmount race condition", but with
      //  React 19 + unstable prop references (visibleSkuData re-created each render),
      //  useEffect re-runs frequently and clearTimeout would cancel workbook creation
      //  before it completed, leaving cellData written but the scene never rendered.)
      try {
        const existingWorkbook = api.getActiveWorkbook();
        if (existingWorkbook) {
          api.disposeUnit(existingWorkbook.getId());
        }
        api.createWorkbook(snapshot);
      } catch {
        // ignore workbook recreation errors
      }

      // Freeze first 4 rows in Step 2, cancel for other steps
      try {
        const freezeWb = api.getActiveWorkbook();
        if (freezeWb) {
          const freezeWs = freezeWb.getActiveSheet();
          if (freezeWs) {
            if (currentStep === 2) {
              freezeWs.setFrozenRows(4);
            } else {
              freezeWs.cancelFreeze();
            }
          }
        }
      } catch {
        // ignore freeze errors
      }

      // Apply borders to all data cells
      try {
        const borderWb = api.getActiveWorkbook();
        const borderWs = borderWb?.getActiveSheet();
        if (borderWs) {
          const bounds = getSheetDataBounds(model);
          if (bounds.lastRow >= 0 && bounds.lastCol >= 0) {
            borderWs
              .getRange(0, 0, bounds.lastRow + 1, bounds.lastCol + 1)
              .setBorder(
                api.Enum.BorderType.ALL,
                api.Enum.BorderStyleTypes.THIN,
                SHEET_BORDER_COLOR,
              );
          }
        }
      } catch {
        // ignore border errors
      }

      // Apply Data Validation immediately after workbook creation
      if (!model.readOnly) {
        const workbook = api.getActiveWorkbook();
        if (workbook) {
          const worksheet = workbook.getActiveSheet();
          if (worksheet) {
            // supply_select dropdown
            const supplySelectRow = model.rows.find(
              (r) => r.kind === 'field' && r.fieldId === 'supply_select'
            );

            if (supplySelectRow && skuSupplyKeys) {
              for (let ci = 0; ci < model.columns.length; ci++) {
                const col = model.columns[ci];
                const keys = skuSupplyKeys[col.skuId];
                if (!keys || keys.length < 2) continue;

                const rule = api.newDataValidation()
                  .requireValueInList(keys.filter(k => k !== ''), false, true)
                  .setOptions({
                    allowBlank: false,
                    showErrorMessage: true,
                    error: '请选择供应标签',
                  })
                  .build();

                try {
                  worksheet.getRange(supplySelectRow.rowIndex, ci + 1).setDataValidation(rule);
                } catch {
                  // ignore
                }
              }
            }

            // prod_loc dropdown
            const prodLocRow = model.rows.find(
              (r) => r.kind === 'field' && r.fieldId === 'prod_loc'
            );

            if (prodLocRow) {
              for (let ci = 0; ci < model.columns.length; ci++) {
                const rule = api.newDataValidation()
                  .requireValueInList([...PROD_LOC_OPTIONS], false, true)
                  .setOptions({
                    allowBlank: true,
                    showErrorMessage: true,
                    error: '请选择试产地点',
                  })
                  .build();

                try {
                  worksheet.getRange(prodLocRow.rowIndex, ci + 1).setDataValidation(rule);
                } catch {
                  // ignore
                }
              }
            }
          }
        }
      }

      restoreSheetViewportState(viewportState);

      return () => {
        clearViewportRestoreTimers();
      };
    }, [model, skuData, activeFields, currentStep, skuSupplyKeys, univerReady]);

    // Listen for cell edit events
    useEffect(() => {
      if (!univerReady) return;
      const api = univerAPIRef.current;
      if (!api) return;

      const handleBusinessCellUpdate = (row: number, column: number, value: unknown) => {
        const edit = mapUniverEditToBusinessEdit({
          row,
          column,
          value,
          cellMap: cellMapRef.current,
        });

        if (edit) {
          const nextValue = normalizeFieldValue(edit.key.fieldId, edit.value);
          const currentValue = getCurrentBusinessValue(edit.key.skuId, edit.key.supplyId, edit.key.fieldId);
          if (currentValue === nextValue) {
            return;
          }

          onUpdateValue(
            edit.key.skuId,
            edit.key.supplyId ?? '',
            edit.key.fieldId,
            nextValue,
          );
        }
      };

      const disposable = api.addEvent(api.Event.BeforeSheetEditEnd, (params: any) => {
        const { row, column, value, isConfirm } = params;
        if (row === undefined || column === undefined) return;
        if (!isConfirm) return;

        const rowObj = modelRef.current?.rows[row];
        if (rowObj?.fieldId === 'supply_select' || rowObj?.fieldId === 'prod_loc') {
          return;
        }

        handleBusinessCellUpdate(row, column, value);
      });

      const valueChangedDisposable = api.addEvent(api.Event.SheetValueChanged, (params: any) => {
        const cellValue = params?.payload?.params?.cellValue;
        if (!cellValue) return;

        for (const [rowKey, rowValues] of Object.entries(cellValue)) {
          const row = Number(rowKey);
          if (!Number.isFinite(row)) continue;

          const rowObj = modelRef.current?.rows[row];
          if (rowObj?.fieldId !== 'supply_select' && rowObj?.fieldId !== 'prod_loc') {
            continue;
          }

          for (const [columnKey, cellData] of Object.entries(rowValues as Record<string, unknown>)) {
            const column = Number(columnKey);
            if (!Number.isFinite(column) || column <= 0) continue;
            if (!hasUniverCellDataValue(cellData)) {
              continue;
            }

            if (rowObj.fieldId === 'supply_select') {
              const col = modelRef.current?.columns[column - 1];
              if (col && onSelectedSupplyChange) {
                const nextSupplyKey = normalizeUniverCellDataValue(cellData);
                if (getCurrentSelectedSupplyKey(col.skuId) !== nextSupplyKey) {
                  onSelectedSupplyChange(col.skuId, nextSupplyKey);
                }
              }
              continue;
            }

            handleBusinessCellUpdate(row, column, normalizeUniverCellDataValue(cellData));
          }
        }
      });

      return () => {
        disposable?.dispose?.();
        valueChangedDisposable?.dispose?.();
      };
    }, [univerReady, onUpdateValue, onSelectedSupplyChange]);

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
  const isStep5Preview = model.readOnly && Boolean(model.step5Model);

  const measureWidth = (text: string): number => {
    let w = 0;
    for (const ch of text) {
      w += ch.charCodeAt(0) > 0x7f ? 16 : 8;
    }
    return w;
  };

  if (isStep5Preview) {
    const step5Model = model.step5Model!;
    const maxLabelLength = Math.max(
      ...step5Model.rows
        .filter((row): row is Extract<(typeof step5Model.rows)[number], { kind: 'field' }> => row.kind === 'field')
        .map((row) => row.fieldLabel.length),
      6
    );

    // Step 5 renders an index column and a field-label column before values.
    widths[0] = { w: 48 };
    widths[1] = { w: Math.max(maxLabelLength * 16, 120) };

    const maxTextsPerCol: string[] = new Array(step5Model.columns.length).fill('');
    for (const row of step5Model.rows) {
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

    for (let i = 0; i < step5Model.columns.length; i++) {
      const width = Math.max(measureWidth(maxTextsPerCol[i]) + 16, 80); // +16 padding, min 80px
      widths[i + 2] = { w: width };
    }

    return widths;
  }

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
        const value = normalizeFieldValue(fieldId, sku?.supplies[0]?.values[fieldId] ?? '');
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
        const value = normalizeFieldValue(fieldId, supply?.values[fieldId] ?? '');
        if (value.length > maxTextsPerCol[ci].length) maxTextsPerCol[ci] = value;
      }
    }
  }

  for (let i = 0; i < model.columns.length; i++) {
    const maxText = maxTextsPerCol[i];
    const width = Math.max(measureWidth(maxText) + 16, 80); // +16 padding, min 80px
    widths[i + 1] = { w: width };
  }

  return widths;
}

export const SHEET_BORDER_COLOR = '#DDE7F3';

export function getSheetDataBounds(
  model: ReturnType<typeof buildTrialProductionSheetModel>,
): { lastRow: number; lastCol: number } {
  const isStep5Preview = model.readOnly && Boolean(model.step5Model);

  if (isStep5Preview) {
    const step5Model = model.step5Model!;
    return {
      lastRow: Math.max(step5Model.rows.length - 1, 0),
      // Step5 layout: col 0 = index, col 1 = label, cols 2..N+1 = value columns
      lastCol: Math.max(1 + step5Model.columns.length, 0),
    };
  }

  return {
    lastRow: Math.max(model.rows.length - 1, 0),
    lastCol: Math.max(model.columns.length, 0),
  };
}

export function buildWorkbookSnapshot(
  model: ReturnType<typeof buildTrialProductionSheetModel>,
  skuData: SKUData[],
  activeFields: FieldDefinition[],
  currentStep: StepId
) {
  // ABCDE color scheme
  const BLACK_BORDER = { t: { s: 1, cl: { rgb: '#000000' } }, b: { s: 1, cl: { rgb: '#000000' } }, l: { s: 1, cl: { rgb: '#000000' } }, r: { s: 1, cl: { rgb: '#000000' } } };

  const COLOR_SCHEME = [
    { title: { bg: { rgb: '#EAF3FF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#F7FBFF' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // A: 浅蓝
    { title: { bg: { rgb: '#EAFBF7' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#F6FFFC' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // B: 浅青绿
    { title: { bg: { rgb: '#F3EEFF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#FAF8FF' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // C: 浅紫
    { title: { bg: { rgb: '#FFF1E6' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#FFF8F3' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // D: 浅橙
    { title: { bg: { rgb: '#EAF8F0' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#F6FCF8' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // E: 浅薄荷绿
  ];

  const getStyleForGroup = (groupIndex: number | undefined, isTitle: boolean) => {
    const colorIndex = (groupIndex ?? 0) % COLOR_SCHEME.length;
    const block = COLOR_SCHEME[colorIndex];
    return isTitle ? block.title : block.body;
  };

  const cellData: Record<number, Record<number, { v?: string; s?: any }>> = {};
  const mergeData: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> = [];
  const isStep5Preview = model.readOnly && Boolean(model.step5Model);
  const totalValueCols = isStep5Preview ? model.step5Model!.columns.length : model.columns.length;
  const totalCols = isStep5Preview ? 2 + totalValueCols : 1 + totalValueCols;

  // For non-Step5, build from model rows and columns
  if (isStep5Preview) {
    let rowIdx = 0;
    let groupIndex = -1;

    for (const row of model.step5Model!.rows) {
      cellData[rowIdx] = {};

      if (row.kind === 'title' || row.kind === 'group') {
        if (row.kind === 'title') {
          groupIndex = 0;
        } else {
          groupIndex++;
        }

        const groupStyle = getStyleForGroup(groupIndex, true);
        cellData[rowIdx][0] = { v: row.title, s: groupStyle };
        if (totalCols > 1) {
          mergeData.push({
            startRow: rowIdx,
            endRow: rowIdx,
            startColumn: 0,
            endColumn: totalCols - 1,
          });
        }
      } else {
        const groupStyle = getStyleForGroup(groupIndex, false);
        cellData[rowIdx][0] = { v: row.indexLabel, s: groupStyle };
        cellData[rowIdx][1] = { v: row.fieldLabel, s: groupStyle };

        const step5Cols = model.step5Model!.columns;
        let colCursor = 2;
        let colIdx = 0;
        for (const cell of row.cells) {
          let value = cell.value;
          if (row.fieldId === 'supply_select' && !value) {
            const skuId = step5Cols[colIdx]?.skuId;
            const sku = skuId ? skuData.find((s) => s.id === skuId) : undefined;
            value = normalizeBusinessValue(sku?.selectedSupplyKey ?? '');
          }
          cellData[rowIdx][colCursor] = { v: normalizeFieldValue(row.fieldId, value), s: groupStyle };
          if (cell.colSpan > 1) {
            mergeData.push({
              startRow: rowIdx,
              endRow: rowIdx,
              startColumn: colCursor,
              endColumn: colCursor + cell.colSpan - 1,
            });
          }
          colCursor += cell.colSpan;
          colIdx += cell.colSpan;
        }
      }

      rowIdx++;
    }
  } else {
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
            const value = normalizeFieldValue(row.fieldId, sku?.supplies[0]?.values[row.fieldId] ?? '');
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
        } else if (row.fieldId === 'supply_select') {
          if (currentStep === 2) {
            // Step2: render each supply label individually (no merge)
            for (let ci = 0; ci < model.columns.length; ci++) {
              const col = model.columns[ci];
              cellData[rowIdx][ci + 1] = { v: normalizeBusinessValue(col.label), s: groupStyle };
            }
          } else {
            // Step3/4: render selectedSupplyKey with merge across SKU columns
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
              const value = normalizeBusinessValue(sku?.selectedSupplyKey ?? sku?.supplies[0]?.supplyKey ?? '');
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
          }
        } else {
          for (let ci = 0; ci < model.columns.length; ci++) {
            const col = model.columns[ci];
            const sku = skuData.find((s) => s.id === col.skuId);
            if (!sku) continue;
            const supply = sku.supplies.find((s) => s.id === col.supplyId);
            if (!supply) continue;

            const value = normalizeFieldValue(row.fieldId, supply.values[row.fieldId] ?? '');
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
        columnCount: Math.max(totalCols + 5, 20),
      },
    },
  };
}
