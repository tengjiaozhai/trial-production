// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { TrialProductionSheet } from './TrialProductionSheet';
import type { TrialProductionSheetHandle } from './TrialProductionSheet';
import type { FieldDefinition, SKUData } from '../types';
import { RichTextValue } from '@univerjs/core';

const { createUniverMock, newAPIMock } = vi.hoisted(() => ({
  createUniverMock: vi.fn(),
  newAPIMock: vi.fn(),
}));

vi.mock('@univerjs/presets', () => ({
  createUniver: createUniverMock,
  LocaleType: { ZH_CN: 'zh-CN' },
  mergeLocales: (...locales: Array<Record<string, unknown>>) => Object.assign({}, ...locales),
}));

vi.mock('@univerjs/preset-sheets-core', () => ({
  UniverSheetsCorePreset: vi.fn(() => ({})),
}));

vi.mock('@univerjs/preset-sheets-core/locales/zh-CN', () => ({
  default: {},
}));

vi.mock('@univerjs/preset-sheets-data-validation', () => ({
  UniverSheetsDataValidationPreset: vi.fn(() => ({})),
}));

vi.mock('@univerjs/preset-sheets-data-validation/locales/zh-CN', () => ({
  default: {},
}));

vi.mock('@univerjs/core/facade', () => ({
  FUniver: {
    newAPI: newAPIMock,
  },
}));

function createValidationBuilder() {
  return {
    requireValueInList: vi.fn().mockReturnThis(),
    setOptions: vi.fn().mockReturnThis(),
    build: vi.fn(() => ({ rule: 'validation-rule' })),
  };
}

const activeFields: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
  { id: 'stage', label: '试产阶段', group: '基础信息', behavior: 'auto' },
  { id: 'supply_select', label: '一供/二供', group: '基础信息', behavior: 'manual' },
  { id: 'prod_loc', label: '试产地点', group: '基础信息', behavior: 'manual' },
  { id: 'mb_id', label: '主板标识', group: '产品规格', behavior: 'manual' },
  { id: 'band', label: '频段', group: '产品规格', behavior: 'auto' },
  { id: 'storage', label: '存储', group: '产品规格', behavior: 'auto' },
];

const step2SkuData: SKUData[] = [
  {
    id: 'sku-a1',
    stage: 'PR1',
    orderNo: '',
    project: 'A1',
    selectedSupplyKey: '二供',
    supplies: [
      { id: 'a1-s1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', mb_id: 'A1', band: '拉美', storage: '4+128' } },
      { id: 'a1-s2', supplyKey: '二供', label: '二供', values: { project: 'X6728', stage: 'PR1', mb_id: 'A1', band: '拉美', storage: '4+128' } },
      { id: 'a1-s3', supplyKey: '三供', label: '三供', values: { project: 'X6728', stage: 'PR1', mb_id: 'A1', band: '拉美', storage: '4+128' } },
      { id: 'a1-s4', supplyKey: '四供', label: '四供', values: { project: 'X6728', stage: 'PR1', mb_id: 'A1', band: '拉美', storage: '4+128' } },
    ],
  },
  {
    id: 'sku-b1',
    stage: 'PR1',
    orderNo: '',
    project: 'B1',
    selectedSupplyKey: '一供',
    supplies: [
      { id: 'b1-s1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', mb_id: 'B1', band: '欧洲', storage: '6+128' } },
    ],
  },
];

const step3VisibleSkuData: SKUData[] = [
  {
    ...step2SkuData[0],
    supplies: [step2SkuData[0].supplies[1]],
  },
  {
    ...step2SkuData[1],
    supplies: [step2SkuData[1].supplies[0]],
  },
];

describe('TrialProductionSheet workbook lifecycle', () => {
  beforeEach(() => {
    createUniverMock.mockReset();
    newAPIMock.mockReset();
  });

  it('replaces the active workbook when the projected Step3 layout changes', async () => {
    const setDataValidation = vi.fn();
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi
        .fn()
        .mockReturnValueOnce(null)
        .mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
      },
    };

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    const { rerender } = render(
      <TrialProductionSheet
        currentStep={2}
        skuData={step2SkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
      />
    );

    // Flush setTimeout in useEffect
    await vi.advanceTimersByTimeAsync(0);

    rerender(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
        onSelectedSupplyChange={vi.fn()}
      />
    );

    // Flush setTimeout in useEffect
    await vi.advanceTimersByTimeAsync(0);

    expect(apiMock.disposeUnit).toHaveBeenCalledWith('trial-production-sheet');
    expect(apiMock.createWorkbook).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('applies data validation to the prod_loc row in step 3', async () => {
    const setDataValidation = vi.fn();
    const validationBuilders: ReturnType<typeof createValidationBuilder>[] = [];
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn().mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => {
        const builder = createValidationBuilder();
        validationBuilders.push(builder);
        return builder;
      }),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
      },
    };

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
        onSelectedSupplyChange={vi.fn()}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(worksheetMock.getRange).toHaveBeenCalledWith(4, 1);
    expect(worksheetMock.getRange).toHaveBeenCalledWith(4, 2);
    expect(setDataValidation).toHaveBeenCalled();
    expect(apiMock.newDataValidation).toHaveBeenCalledTimes(3);
    expect(validationBuilders[1]?.requireValueInList).toHaveBeenCalledWith(
      ['宜宾', '南昌', '河源', '越南', '自定义'],
      false,
      true,
    );
    expect(validationBuilders[2]?.requireValueInList).toHaveBeenCalledWith(
      ['宜宾', '南昌', '河源', '越南', '自定义'],
      false,
      true,
    );

    vi.useRealTimers();
  });

  it('does not recreate the workbook when the parent rerenders with identical props', async () => {
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation: vi.fn() })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi
        .fn()
        .mockReturnValueOnce(null)
        .mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
        SheetValueChanged: 'SheetValueChanged',
      },
    };
    const onUpdateValue = vi.fn();
    const onSelectedSupplyChange = vi.fn();
    const skuSupplyKeys = { 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] } as const;

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    const { rerender } = render(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={skuSupplyKeys}
        onUpdateValue={onUpdateValue}
        onSelectedSupplyChange={onSelectedSupplyChange}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    rerender(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={skuSupplyKeys}
        onUpdateValue={onUpdateValue}
        onSelectedSupplyChange={onSelectedSupplyChange}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(apiMock.createWorkbook).toHaveBeenCalledTimes(1);
    expect(apiMock.disposeUnit).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('normalizes standard cell edits before notifying the parent', async () => {
    let beforeEditEndHandler: ((params: any) => void) | undefined;
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation: vi.fn() })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const onUpdateValue = vi.fn();
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn().mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn((eventName: string, handler: (params: any) => void) => {
        if (eventName === 'BeforeSheetEditEnd') {
          beforeEditEndHandler = handler;
        }
        return { dispose: vi.fn() };
      }),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
        SheetValueChanged: 'SheetValueChanged',
      },
    };

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={onUpdateValue}
        onSelectedSupplyChange={vi.fn()}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(beforeEditEndHandler).toBeDefined();

    beforeEditEndHandler?.({
      row: 6,
      column: 1,
      value: RichTextValue.createByBody({ dataStream: 'B99\r\n' }),
      isConfirm: true,
    });

    expect(onUpdateValue).toHaveBeenCalledWith('sku-a1', '', 'mb_id', 'B99');

    vi.useRealTimers();
  });

  it('reacts to supply_select dropdown changes from SheetValueChanged', async () => {
    let sheetValueChangedHandler: ((params: any) => void) | undefined;
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation: vi.fn() })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const onSelectedSupplyChange = vi.fn();
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn().mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn((eventName: string, handler: (params: any) => void) => {
        if (eventName === 'SheetValueChanged') {
          sheetValueChangedHandler = handler;
        }
        return { dispose: vi.fn() };
      }),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
        SheetValueChanged: 'SheetValueChanged',
      },
    };

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
        onSelectedSupplyChange={onSelectedSupplyChange}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(sheetValueChangedHandler).toBeDefined();

    sheetValueChangedHandler?.({
      payload: {
        id: 'sheet.mutation.set-range-values',
        params: {
          cellValue: {
            3: {
              1: { v: '三供' },
            },
          },
        },
      },
    });

    expect(onSelectedSupplyChange).toHaveBeenCalledWith('sku-a1', '三供');

    vi.useRealTimers();
  });

  it('ignores supply_select SheetValueChanged events when the selected supply key is unchanged', async () => {
    let sheetValueChangedHandler: ((params: any) => void) | undefined;
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation: vi.fn() })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const onSelectedSupplyChange = vi.fn();
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn().mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn((eventName: string, handler: (params: any) => void) => {
        if (eventName === 'SheetValueChanged') {
          sheetValueChangedHandler = handler;
        }
        return { dispose: vi.fn() };
      }),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
        SheetValueChanged: 'SheetValueChanged',
      },
    };

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
        onSelectedSupplyChange={onSelectedSupplyChange}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(sheetValueChangedHandler).toBeDefined();

    sheetValueChangedHandler?.({
      payload: {
        id: 'sheet.mutation.set-range-values',
        params: {
          cellValue: {
            3: {
              1: { v: '二供' },
            },
          },
        },
      },
    });

    expect(onSelectedSupplyChange).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('reacts to prod_loc dropdown changes from SheetValueChanged', async () => {
    let sheetValueChangedHandler: ((params: any) => void) | undefined;
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation: vi.fn() })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const onUpdateValue = vi.fn();
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn().mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn((eventName: string, handler: (params: any) => void) => {
        if (eventName === 'SheetValueChanged') {
          sheetValueChangedHandler = handler;
        }
        return { dispose: vi.fn() };
      }),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
        SheetValueChanged: 'SheetValueChanged',
      },
    };

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={onUpdateValue}
        onSelectedSupplyChange={vi.fn()}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(sheetValueChangedHandler).toBeDefined();

    sheetValueChangedHandler?.({
      payload: {
        id: 'sheet.mutation.set-range-values',
        params: {
          cellValue: {
            4: {
              1: { v: '宜宾' },
            },
          },
        },
      },
    });

    expect(onUpdateValue).toHaveBeenCalledWith('sku-a1', 'a1-s2', 'prod_loc', '宜宾');

    vi.useRealTimers();
  });

  it('ignores prod_loc SheetValueChanged events when the cell value is unchanged', async () => {
    let sheetValueChangedHandler: ((params: any) => void) | undefined;
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation: vi.fn() })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const onUpdateValue = vi.fn();
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn().mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn((eventName: string, handler: (params: any) => void) => {
        if (eventName === 'SheetValueChanged') {
          sheetValueChangedHandler = handler;
        }
        return { dispose: vi.fn() };
      }),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
        SheetValueChanged: 'SheetValueChanged',
      },
    };

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    const skuDataWithProdLoc: SKUData[] = [
      {
        ...step3VisibleSkuData[0],
        supplies: [
          {
            ...step3VisibleSkuData[0].supplies[0],
            values: {
              ...step3VisibleSkuData[0].supplies[0].values,
              prod_loc: '宜宾',
            },
          },
        ],
      },
      step3VisibleSkuData[1],
    ];

    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={skuDataWithProdLoc}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={onUpdateValue}
        onSelectedSupplyChange={vi.fn()}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    expect(sheetValueChangedHandler).toBeDefined();

    sheetValueChangedHandler?.({
      payload: {
        id: 'sheet.mutation.set-range-values',
        params: {
          cellValue: {
            4: {
              1: { v: '宜宾' },
            },
          },
        },
      },
    });

    expect(onUpdateValue).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('focuses the matched business cell with current-cell activation', async () => {
    const focusRangeMock = {
      activate: vi.fn(),
      activateAsCurrentCell: vi.fn(),
      setDataValidation: vi.fn(),
    };
    const worksheetMock = {
      getRange: vi.fn((row?: number, column?: number) => {
        if (row === 4 && column === 1) {
          return focusRangeMock;
        }
        return { setDataValidation: vi.fn() };
      }),
      getCellMergeData: vi.fn(() => undefined),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn().mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
        SheetValueChanged: 'SheetValueChanged',
      },
    };
    const sheetRef = createRef<TrialProductionSheetHandle>();

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    render(
      <TrialProductionSheet
        ref={sheetRef}
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供', '三供', '四供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
        onSelectedSupplyChange={vi.fn()}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    sheetRef.current?.focusCellByBusinessKey('sku-a1', 'a1-s2', 'prod_loc');

    expect(focusRangeMock.activateAsCurrentCell).toHaveBeenCalledTimes(1);
    expect(worksheetMock.scrollToCell).toHaveBeenCalledWith(4, 1, 0);

    vi.useRealTimers();
  });

  it('falls back to the visible sku cell when the original supply id is no longer present', async () => {
    const focusRangeMock = {
      activate: vi.fn(),
      activateAsCurrentCell: vi.fn(),
      setDataValidation: vi.fn(),
    };
    const worksheetMock = {
      getRange: vi.fn((row?: number, column?: number) => {
        if (row === 4 && column === 1) {
          return focusRangeMock;
        }
        return { setDataValidation: vi.fn() };
      }),
      getCellMergeData: vi.fn(() => undefined),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn().mockReturnValue(workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: {
        BeforeSheetEditEnd: 'BeforeSheetEditEnd',
        SheetValueChanged: 'SheetValueChanged',
      },
    };
    const sheetRef = createRef<TrialProductionSheetHandle>();

    createUniverMock.mockReturnValue({
      univer: {
        dispose: vi.fn(),
      },
    });
    newAPIMock.mockReturnValue(apiMock);

    vi.useFakeTimers();

    render(
      <TrialProductionSheet
        ref={sheetRef}
        currentStep={4}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        onUpdateValue={vi.fn()}
      />
    );

    await vi.advanceTimersByTimeAsync(0);

    sheetRef.current?.focusCellByBusinessKey('sku-a1', 'a1-s1', 'prod_loc');

    expect(focusRangeMock.activateAsCurrentCell).toHaveBeenCalledTimes(1);
    expect(worksheetMock.scrollToCell).toHaveBeenCalledWith(4, 1, 0);

    vi.useRealTimers();
  });
});
