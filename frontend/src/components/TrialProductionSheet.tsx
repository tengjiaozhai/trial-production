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

      const disposable = api.addEvent(api.Event.SheetEditEnded, (params: any) => {
        const { row, column, value } = params;
        if (row === undefined || column === undefined) return;

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

function buildWorkbookSnapshot(
  model: ReturnType<typeof buildTrialProductionSheetModel>,
  skuData: SKUData[],
  activeFields: FieldDefinition[],
  currentStep: StepId
) {
  const centeredStyle = { ht: 2, vt: 2 };
  const cellData: Record<number, Record<number, { v?: string; s?: any }>> = {};
  const mergeData: Array<{ startRow: number; endRow: number; startColumn: number; endColumn: number }> = [];

  // For non-Step5, build from model rows and columns
  if (!model.readOnly) {
    let rowIdx = 0;
    for (const row of model.rows) {
      cellData[rowIdx] = {};

      if (row.kind === 'title' || row.kind === 'group') {
        // Group header: put group title in first column
        cellData[rowIdx][0] = { v: row.groupTitle ?? '', s: centeredStyle };
      } else if (row.kind === 'field' && row.fieldId) {
        // Field row: label in first column, values in subsequent columns
        cellData[rowIdx][0] = { v: row.fieldLabel ?? '', s: centeredStyle };

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
            cellData[rowIdx][startColumn] = { v: value, s: centeredStyle };
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
            cellData[rowIdx][ci + 1] = { v: value, s: centeredStyle };
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
        rowCount: Math.max(Object.keys(cellData).length + 10, 50),
        columnCount: Math.max(model.columns.length + 5, 20),
      },
    },
  };
}
