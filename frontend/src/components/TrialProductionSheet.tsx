import { useEffect, useMemo, useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationZhCN from '@univerjs/preset-sheets-data-validation/locales/zh-CN';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import { Direction, ICommandService } from '@univerjs/core';
import { FUniver } from '@univerjs/core/facade';
import { Plus } from 'lucide-react';
import type { SKUData, FieldDefinition, StepId, SupplyTag } from '../types';
import type { Step2CellConflict } from '../lib/step2CellConflicts';
import { buildTrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { hasUniverCellDataValue, mapUniverEditToBusinessEdit, normalizeUniverCellDataValue, normalizeUniverEditValue } from '../lib/univerSheetEvents';
import { buildStructureKey } from '../lib/sheetStructureKey';
import { diffSheetData } from '../lib/sheetDataDiff';
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

export interface StructureRowInsertPayload {
  position: 'before' | 'after';
  anchorRowKind: 'title' | 'group' | 'field';
  anchorFieldId?: string;
  anchorGroup?: string;
}

export interface StructureColumnInsertPayload {
  position: 'before' | 'after';
  anchorSkuId: string;
  anchorSupplyId: string;
}

const STRUCTURE_ROW_INSERT_COMMAND_IDS = new Set([
  'sheet.command.insert-row',
  'sheet.command.insert-row-before',
  'sheet.command.insert-row-after',
  'sheet.command.insert-multi-rows-above',
  'sheet.command.insert-multi-rows-after',
]);

const STRUCTURE_COLUMN_INSERT_COMMAND_IDS = new Set([
  'sheet.command.insert-col',
  'sheet.command.insert-col-before',
  'sheet.command.insert-col-after',
  'sheet.command.insert-multi-cols-before',
  'sheet.command.insert-multi-cols-right',
]);

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
  onStructureRowInsert?: (payload: StructureRowInsertPayload) => void;
  onStructureColumnInsert?: (payload: StructureColumnInsertPayload) => void;
  onFieldLabelChange?: (fieldId: string, label: string) => void;
  onStep5LayoutChange?: (layout: { supplyWidths: Record<string, number>; rowHeights: Record<string, number> }) => void;
  onAppendField?: () => void;
  onAppendSupplyToAllSkus?: () => void;
  className?: string;
}

// rendering-hoist-jsx: hoist the static style object out of the component render
// to avoid re-allocating it on every forwardRef render.
const CONTAINER_STYLE = { width: '100%', height: '100%' } as const;

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
      onStructureRowInsert,
      onStructureColumnInsert,
      onFieldLabelChange,
      onStep5LayoutChange,
      onAppendField,
      onAppendSupplyToAllSkus,
      className,
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const univerRef = useRef<ReturnType<typeof createUniver> | null>(null);
    const univerAPIRef = useRef<ReturnType<typeof createUniver>['univerAPI'] | null>(null);
    const [univerReady, setUniverReady] = useState(false);
    const cellMapRef = useRef<Record<string, import('../lib/univerTrialProductionSheet').TrialProductionCellKey>>({});
    const modelRef = useRef<ReturnType<typeof buildTrialProductionSheetModel> | null>(null);
    const lastWrittenCellValuesRef = useRef<Record<string, string>>({});
    const lastStructureKeyRef = useRef<string | null>(null);
    const pendingStructureViewportRef = useRef<SheetViewportState | null>(null);
    const pendingStructureInsertRef = useRef<
      | { type: 'row'; payload: StructureRowInsertPayload }
      | { type: 'column'; payload: StructureColumnInsertPayload }
      | null
    >(null);
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

    // Lookup indexes: O(1) sku / supply / field lookups in event handlers
    // (avoids O(N) / O(M) linear scans on every cell edit)
    const skuIndex = useMemo(() => {
      const skuMap = new Map<string, SKUData>();
      const supplyMap = new Map<string, (typeof skuData)[number]['supplies'][number]>();
      for (const sku of skuData) {
        skuMap.set(sku.id, sku);
        for (const supply of sku.supplies) {
          supplyMap.set(supply.id, supply);
        }
      }
      return { skuMap, supplyMap };
    }, [skuData]);

    const fieldIndex = useMemo(() => {
      const map = new Map<string, FieldDefinition>();
      for (const field of activeFields) {
        map.set(field.id, field);
      }
      return map;
    }, [activeFields]);

    const currentCellValues = useMemo(() => {
      const map: Record<string, string> = {};
      for (const [key, cellKey] of Object.entries(model.cellMap) as [string, import('../lib/univerTrialProductionSheet').TrialProductionCellKey][]) {
        if (!cellKey.fieldId) continue;
        const sku = skuIndex.skuMap.get(cellKey.skuId);
        if (!sku) continue;

        let raw = '';
        if (isSkuSpanningField(cellKey.fieldId)) {
          raw = sku.supplies[0]?.values[cellKey.fieldId] ?? '';
        } else {
          const supply = cellKey.supplyId ? skuIndex.supplyMap.get(cellKey.supplyId) : undefined;
          raw = supply?.values[cellKey.fieldId] ?? '';
        }
        map[key] = normalizeFieldValue(cellKey.fieldId, raw);
      }
      return map;
    }, [model, skuIndex]);

    // DRY: a single helper for clearing timer arrays (was 3 separate near-identical functions)
    const clearTimersInRef = (timersRef: { current: number[] }) => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer);
      }
      timersRef.current = [];
    };

    const getCurrentBusinessValue = (skuId: string, supplyId: string | undefined, fieldId: string): string => {
      // Defer-reads: prefer the already-normalized snapshot from currentCellValues over
      // re-scanning skuData + re-running normalizeFieldValue on the hot path.
      const cellKey = `${skuId}|${supplyId ?? ''}|${fieldId}`;
      if (Object.prototype.hasOwnProperty.call(currentCellValues, cellKey)) {
        return currentCellValues[cellKey];
      }

      const sku = skuIndex.skuMap.get(skuId);
      if (!sku) {
        return '';
      }

      const values = sku.supplies[0]?.values;
      if (isSkuSpanningField(fieldId)) {
        return normalizeFieldValue(fieldId, values?.[fieldId] ?? '');
      }

      const supply = supplyId ? skuIndex.supplyMap.get(supplyId) : undefined;
      return normalizeFieldValue(fieldId, supply?.values[fieldId] ?? '');
    };

    const getCurrentSelectedSupplyKey = (skuId: string): string => {
      const sku = skuIndex.skuMap.get(skuId);
      return sku?.selectedSupplyKey ?? sku?.supplies[0]?.supplyKey ?? '';
    };

    const getRowFieldDefinition = (fieldId: string | undefined): FieldDefinition | undefined =>
      fieldId ? fieldIndex.get(fieldId) : undefined;

    const getGroupTitleForStep5Row = (rowIndex: number): string | undefined => {
      const rows = modelRef.current?.step5Model?.rows;
      if (!rows) return undefined;

      for (let index = rowIndex; index >= 0; index -= 1) {
        const row = rows[index];
        if (!row) continue;
        if (row.kind === 'group' || row.kind === 'title') {
          return row.title;
        }
      }

      return undefined;
    };

    // js-early-exit: extract payload builders so the main function reads as a flat early-return chain
    const buildReadOnlyRowPayload = (
      position: 'before' | 'after',
      anchorRow: { kind: string; fieldId?: string; title?: string },
      row: number,
    ): StructureRowInsertPayload => {
      if (anchorRow.kind === 'field') {
        return {
          position,
          anchorRowKind: 'field',
          anchorFieldId: anchorRow.fieldId,
          anchorGroup: getGroupTitleForStep5Row(row),
        };
      }
      return {
        position,
        anchorRowKind: anchorRow.kind as 'title' | 'group',
        anchorGroup: anchorRow.title,
      };
    };

    const buildEditableRowPayload = (
      position: 'before' | 'after',
      anchorRow: { kind: string; fieldId?: string; groupTitle?: string },
    ): StructureRowInsertPayload => {
      if (anchorRow.kind === 'field') {
        return {
          position,
          anchorRowKind: 'field',
          anchorFieldId: anchorRow.fieldId,
          anchorGroup: getRowFieldDefinition(anchorRow.fieldId)?.group,
        };
      }
      return {
        position,
        anchorRowKind: anchorRow.kind as 'title' | 'group',
        anchorGroup: anchorRow.groupTitle,
      };
    };

    const resolveStructureRowInsertPayload = (
      row: number,
      position: 'before' | 'after',
    ): StructureRowInsertPayload | null => {
      const currentModel = modelRef.current;
      if (!currentModel) return null;

      if (currentModel.readOnly && currentModel.step5Model) {
        const anchorRow = currentModel.step5Model.rows[row];
        if (!anchorRow) return null;
        return buildReadOnlyRowPayload(position, anchorRow, row);
      }

      const anchorRow = currentModel.rows[row];
      if (!anchorRow) return null;
      return buildEditableRowPayload(position, anchorRow);
    };

    const resolveStructureColumnInsertPayload = (
      column: number,
      position: 'before' | 'after',
    ): StructureColumnInsertPayload | null => {
      const currentModel = modelRef.current;
      if (!currentModel) return null;

      const columns = currentModel.readOnly && currentModel.step5Model
        ? currentModel.step5Model.columns
        : currentModel.columns;
      const leadingColumns = currentModel.readOnly && currentModel.step5Model ? 2 : 1;
      const dataColumnIndex = column - leadingColumns;
      const anchorColumn = columns[dataColumnIndex];
      if (!anchorColumn) return null;

      return {
        position,
        anchorSkuId: anchorColumn.skuId,
        anchorSupplyId: anchorColumn.supplyId,
      };
    };

    const resolveStructureInsertFromActiveCell = (
      commandId: string,
      worksheet: {
        getActiveCell?: () => { _range?: { actualRow?: number; startRow?: number; actualColumn?: number; startColumn?: number } } | null;
      } | null | undefined,
    ) => {
      const activeCell = worksheet?.getActiveCell?.();
      const activeRow = activeCell?._range?.actualRow ?? activeCell?._range?.startRow;
      const activeColumn = activeCell?._range?.actualColumn ?? activeCell?._range?.startColumn;

      if (STRUCTURE_ROW_INSERT_COMMAND_IDS.has(commandId) && Number.isFinite(activeRow)) {
        const position = commandId === 'sheet.command.insert-multi-rows-after' || commandId === 'sheet.command.insert-row-after'
          ? 'after'
          : 'before';
        const payload = resolveStructureRowInsertPayload(activeRow as number, position);
        return payload ? { type: 'row' as const, payload } : null;
      }

      if (STRUCTURE_COLUMN_INSERT_COMMAND_IDS.has(commandId) && Number.isFinite(activeColumn)) {
        const position = commandId === 'sheet.command.insert-multi-cols-right' || commandId === 'sheet.command.insert-col-after'
          ? 'after'
          : 'before';
        const payload = resolveStructureColumnInsertPayload(activeColumn as number, position);
        return payload ? { type: 'column' as const, payload } : null;
      }

      return null;
    };

    // js-early-exit + js-set-map-lookups: split focusCellByBusinessKey into small
    // single-purpose helpers, and replace per-iteration `key.split('-')` with a
    // pre-parsed reverse index over cellMap.
    const findTargetCellForFocus = (
      skuId: string,
      supplyId: string | undefined,
      fieldId: string,
    ): { row: number; column: number } | null => {
      // js-early-exit: scan the cellMap once; prefer exact supplyId match over sku-scope match
      let fallback: { row: number; column: number } | null = null;
      for (const [key, cellKey] of Object.entries(cellMapRef.current) as [string, import('../lib/univerTrialProductionSheet').TrialProductionCellKey][]) {
        if (cellKey.fieldId !== fieldId || cellKey.skuId !== skuId) continue;

        const sep = key.indexOf('-');
        if (sep < 0) continue;
        const row = Number(key.slice(0, sep));
        const column = Number(key.slice(sep + 1));
        if (!Number.isFinite(row) || !Number.isFinite(column)) continue;

        if (!fallback) {
          fallback = { row, column };
        }

        if (cellKey.scope === 'sku' || cellKey.supplyId === supplyId) {
          fallback = { row, column };
          break;
        }
      }
      return fallback;
    };

    const activateCell = (worksheet: any, row: number, column: number) => {
      if (!worksheet) return;
      const mergedRange = worksheet.getCellMergeData?.(row, column);
      const targetRange = mergedRange ?? worksheet.getRange(row, column);
      try {
        if (typeof targetRange.activateAsCurrentCell === 'function') {
          targetRange.activateAsCurrentCell();
        } else {
          targetRange.activate();
        }
        worksheet.scrollToCell(row, column, 0);
      } catch {
        try {
          targetRange.activate();
          worksheet.scrollToCell(row, column, 0);
        } catch {
          // ignore focus errors
        }
      }
    };

    const detectWindows = (): boolean => {
      if (typeof navigator === 'undefined') return false;
      return /win/i.test(`${navigator.userAgent ?? ''} ${navigator.platform ?? ''}`);
    };

    const focusCellByBusinessKey = (skuId: string, supplyId: string | undefined, fieldId: string) => {
      const api = univerAPIRef.current;
      if (!api) return;

      const target = findTargetCellForFocus(skuId, supplyId, fieldId);
      if (!target) return;

      const worksheet = api.getActiveWorkbook()?.getActiveSheet();
      const focusOnce = () => activateCell(worksheet, target.row, target.column);

      clearTimersInRef(focusRetryTimersRef);
      focusOnce();

      if (!detectWindows()) return;

      // Windows-specific: retry focus 3 times to ride out Univer's slower activation pipeline
      for (const delay of [0, 180, 1200]) {
        const timer = window.setTimeout(focusOnce, delay);
        focusRetryTimersRef.current.push(timer);
      }
    };

    const restoreSheetViewportState = (viewportState: SheetViewportState | null) => {
      const api = univerAPIRef.current;
      if (!api || !viewportState) return;

      const restoreOnce = () => {
        const worksheet = api.getActiveWorkbook()?.getActiveSheet();
        if (!worksheet) return;
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

      clearTimersInRef(viewportRestoreTimersRef);
      restoreOnce();

      if (!detectWindows()) return;
      for (const delay of [0, 180, 1200]) {
        const timer = window.setTimeout(restoreOnce, delay);
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
        clearTimersInRef(focusRetryTimersRef);
        clearTimersInRef(viewportRestoreTimersRef);
        clearTimersInRef(univerReadyTimersRef);
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

    // Structure fingerprint: only changes when step / fields / efuse config change
    const structureKey = useMemo(
      () => buildStructureKey({ currentStep, activeFields, efuseConfigs }),
      [activeFields, currentStep, efuseConfigs],
    );

    // Effect 1: rebuild workbook ONLY when structure changes
    useEffect(() => {
      if (!univerReady) return;
      if (lastStructureKeyRef.current === structureKey) return;
      lastStructureKeyRef.current = structureKey;

      const api = univerAPIRef.current;
      if (!api) return;
      const preserveViewport = previousStepRef.current === currentStep;
      const currentWorkbook = preserveViewport ? api.getActiveWorkbook() : null;
      const viewportState = preserveViewport
        ? pendingStructureViewportRef.current ?? captureSheetViewportState(currentWorkbook?.getActiveSheet())
        : null;
      pendingStructureViewportRef.current = null;
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

      // Reset data diff baseline after rebuild
      lastWrittenCellValuesRef.current = currentCellValues;

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
        clearTimersInRef(viewportRestoreTimersRef);
      };
    }, [structureKey, univerReady]);

    // Effect 2: sync incremental cell changes via setValue (no workbook rebuild)
    useEffect(() => {
      if (!univerReady) return;
      const api = univerAPIRef.current;
      const worksheet = api?.getActiveWorkbook()?.getActiveSheet() as
        | { getRange: (row: number, column: number) => { setValue: (v: string) => void } }
        | null
        | undefined;
      if (!worksheet) return;

      const diff = diffSheetData({
        cellMap: cellMapRef.current,
        cellValues: currentCellValues,
        previousCellValues: lastWrittenCellValuesRef.current,
      });
      if (diff.length === 0) return;

      for (const entry of diff) {
        try {
          worksheet.getRange(entry.row, entry.column).setValue(entry.value);
        } catch {
          // ignore per-cell write errors
        }
      }
      lastWrittenCellValuesRef.current = currentCellValues;
    }, [currentCellValues, univerReady]);

    useEffect(() => {
      if (!univerReady) return;
      const commandService = univerRef.current?.univer?.__getInjector?.().get?.(ICommandService);
      if (!commandService) return;
      const isStructureCommand = (command: any) =>
        STRUCTURE_ROW_INSERT_COMMAND_IDS.has(command?.id) || STRUCTURE_COLUMN_INSERT_COMMAND_IDS.has(command?.id);

      const beforeDisposable = commandService.beforeCommandExecuted((command: any) => {
        if (!isStructureCommand(command)) return;
        const worksheet = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet();
        pendingStructureViewportRef.current = captureSheetViewportState(worksheet);
        pendingStructureInsertRef.current = resolveStructureInsertFromActiveCell(command.id, worksheet);
      });

      const disposable = commandService.onCommandExecuted((command: any) => {
        if (!isStructureCommand(command)) return;
        if (command.id === 'sheet.command.insert-row' || command.id === 'sheet.command.insert-col') {
          if (!command?.params?.range) return;

          if (command.id === 'sheet.command.insert-row' && onStructureRowInsert) {
            const position = command.params.direction === Direction.UP ? 'before' : 'after';
            const anchorRowIndex = command.params.direction === Direction.UP
              ? command.params.range.startRow
              : command.params.range.startRow - 1;
            const payload = resolveStructureRowInsertPayload(anchorRowIndex, position);
            if (payload) {
              onStructureRowInsert(payload);
            }
            pendingStructureInsertRef.current = null;
            return;
          }

          if (command.id === 'sheet.command.insert-col' && onStructureColumnInsert) {
            const position = command.params.direction === Direction.LEFT ? 'before' : 'after';
            const anchorColumnIndex = command.params.direction === Direction.LEFT
              ? command.params.range.startColumn
              : command.params.range.startColumn - 1;
            const payload = resolveStructureColumnInsertPayload(anchorColumnIndex, position);
            if (payload) {
              onStructureColumnInsert(payload);
            }
            pendingStructureInsertRef.current = null;
          }
          return;
        }

        const pendingInsert = pendingStructureInsertRef.current;
        pendingStructureInsertRef.current = null;
        if (!pendingInsert) return;

        if (pendingInsert.type === 'row' && onStructureRowInsert) {
          onStructureRowInsert(pendingInsert.payload);
          return;
        }

        if (pendingInsert.type === 'column' && onStructureColumnInsert) {
          onStructureColumnInsert(pendingInsert.payload);
        }
      });

      return () => {
        beforeDisposable?.dispose?.();
        disposable?.dispose?.();
      };
    }, [univerReady, onStructureRowInsert, onStructureColumnInsert, fieldIndex]);

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
        if (column === 0 && rowObj?.kind === 'field' && rowObj.fieldId && onFieldLabelChange) {
          const fieldDefinition = getRowFieldDefinition(rowObj.fieldId);
          if (fieldDefinition?.behavior === 'manual') {
            const nextLabel = normalizeUniverEditValue(value);
            onFieldLabelChange(rowObj.fieldId, nextLabel);
          }
          return;
        }

        if (rowObj?.fieldId === 'supply_select' || rowObj?.fieldId === 'prod_loc') {
          // Drop-down values flow through SheetValueChanged, not direct update
        } else {
          handleBusinessCellUpdate(row, column, value);
        }

        // Advance active cell to the next column (wrap to next row at row end).
        // Skip the field-label column (column 0) — label edits don't flow horizontally.
        if (column > 0) {
          const currentModel = modelRef.current;
          const lastCol = Math.max(currentModel?.columns.length ?? 0, 1);
          const lastRow = Math.max((currentModel?.rows.length ?? 1) - 1, 0);
          const nextColumn = column + 1 > lastCol ? 1 : column + 1;
          const nextRow = column + 1 > lastCol ? Math.min(row + 1, lastRow) : row;
          try {
            api.executeCommand('sheet.operation.set-active-cell', {
              row: nextRow,
              column: nextColumn,
            });
          } catch {
            try {
              api.executeCommand('sheet.command.set-active-cell', {
                row: nextRow,
                column: nextColumn,
              });
            } catch {
              // ignore move-active failures
            }
          }
        }
      });

      const valueChangedDisposable = api.addEvent(api.Event.SheetValueChanged, (params: any) => {
        const cellValue = params?.payload?.params?.cellValue;
        if (!cellValue) return;

        const model = modelRef.current;
        if (!model) return;

        // js-combine-iterations: walk a single for-in over the cellValue dict and resolve
        // row / column / rowObj in one pass — avoids the double Object.entries allocation.
        for (const rowKey in cellValue) {
          const row = Number(rowKey);
          if (!Number.isFinite(row)) continue;

          const rowObj = model.rows[row];
          if (rowObj?.fieldId !== 'supply_select' && rowObj?.fieldId !== 'prod_loc') {
            continue;
          }

          const rowValues = (cellValue as Record<string, Record<string, unknown>>)[rowKey];
          for (const columnKey in rowValues) {
            const column = Number(columnKey);
            if (!Number.isFinite(column) || column <= 0) continue;
            const cellData = rowValues[columnKey];
            if (!hasUniverCellDataValue(cellData)) continue;

            if (rowObj.fieldId === 'supply_select') {
              const col = model.columns[column - 1];
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
    }, [univerReady, onUpdateValue, onSelectedSupplyChange, onFieldLabelChange, fieldIndex]);

    return (
      <div
        className="flex flex-col h-full"
        data-testid="trial-production-sheet-wrapper"
      >
        {(onAppendField || onAppendSupplyToAllSkus) && (
          <div
            className="flex items-center gap-2 px-3 py-2 border-b border-[#DDE7F3] bg-[#F6F9FF]"
            data-testid="trial-production-sheet-toolbar"
          >
            {onAppendSupplyToAllSkus && (
              <button
                type="button"
                data-testid="append-supply-button"
                onClick={onAppendSupplyToAllSkus}
                className="flex items-center gap-1 px-2 py-1 text-[12px] font-bold text-[#2563EB] hover:bg-white rounded transition-colors"
              >
                <Plus size={12} /> 新增供位
              </button>
            )}
            {onAppendField && (
              <button
                type="button"
                data-testid="append-field-button"
                onClick={onAppendField}
                className="flex items-center gap-1 px-2 py-1 text-[12px] font-bold text-[#2563EB] hover:bg-white rounded transition-colors"
              >
                <Plus size={12} /> 新增字段
              </button>
            )}
          </div>
        )}
        <div
          ref={containerRef}
          className={`${className ?? ''} flex-1 min-h-0`.trim()}
          data-testid="trial-production-sheet"
          style={CONTAINER_STYLE}
        />
      </div>
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
