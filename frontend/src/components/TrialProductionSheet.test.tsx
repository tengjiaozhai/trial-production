// @vitest-environment jsdom
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TrialProductionSheet } from './TrialProductionSheet';
import type { TrialProductionSheetHandle } from './TrialProductionSheet';
import type { FieldDefinition } from '../types';

const activateAsCurrentCell = vi.fn();
const scrollTo = vi.fn();
const activateRange = vi.fn();
const scrollToCell = vi.fn();
const getCellMergeData = vi.fn(() => null);
const getRange = vi.fn((row: number, column: number) => ({
  activateAsCurrentCell,
  scrollTo,
  activate: activateRange,
  getRange: vi.fn(() => ({
    startRow: row,
    startColumn: column,
    endRow: row,
    endColumn: column,
    sheetId: 'sheet1',
    unitId: 'trial-production-sheet',
  })),
}));
const getActiveSheet = vi.fn(() => ({
  getRange,
  getCellMergeData,
  scrollToCell,
  getSheetId: vi.fn(() => 'sheet1'),
}));
const getActiveWorkbook = vi.fn(() => ({
  getActiveSheet,
  getUnitId: vi.fn(() => 'trial-production-sheet'),
}));
const createWorkbook = vi.fn(() => ({
  getActiveSheet,
}));

vi.mock('@univerjs/presets', () => ({
  createUniver: vi.fn(() => ({
    univer: { dispose: vi.fn() },
    univerAPI: {},
  })),
  LocaleType: { ZH_CN: 'zh-CN' },
  mergeLocales: vi.fn((...args: unknown[]) => Object.assign({}, ...args)),
}));

vi.mock('@univerjs/preset-sheets-core', () => ({
  UniverSheetsCorePreset: vi.fn(() => ({})),
}));

vi.mock('@univerjs/preset-sheets-core/locales/zh-CN', () => ({
  default: { ui: {} },
}));

vi.mock('@univerjs/core/facade', () => ({
  FUniver: {
    newAPI: vi.fn(() => ({
      Event: { SheetEditEnded: 'SheetEditEnded' },
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      getActiveWorkbook,
      createWorkbook,
    })),
  },
}));

const baseFields: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基本信息', behavior: 'auto' },
];

describe('TrialProductionSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a sheet host container', () => {
    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={[]}
        activeFields={baseFields}
        onUpdateValue={vi.fn()}
      />
    );
    const container = screen.getByTestId('trial-production-sheet');
    expect(container).toBeInTheDocument();
    expect(container.tagName).toBe('DIV');
  });

  it('applies custom className', () => {
    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={[]}
        activeFields={baseFields}
        onUpdateValue={vi.fn()}
        className="custom-class"
      />
    );
    const container = screen.getByTestId('trial-production-sheet');
    expect(container).toHaveClass('custom-class');
  });

  it('sets full width and height styles', () => {
    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={[]}
        activeFields={baseFields}
        onUpdateValue={vi.fn()}
      />
    );
    const container = screen.getByTestId('trial-production-sheet');
    expect(container.style.width).toBe('100%');
    expect(container.style.height).toBe('100%');
  });

  it('focuses the mapped cell using Univer sheet coordinates', async () => {
    const ref = createRef<TrialProductionSheetHandle>();

    render(
      <TrialProductionSheet
        ref={ref}
        currentStep={3}
        skuData={[
          {
            id: 'sku1',
            stage: 'PR1',
            orderNo: '',
            project: 'X6728',
            supplies: [
              { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', band: 'SSA', storage: '4+128', lcd: 'BOE' } },
              { id: 's2', supplyKey: '二供', label: '二供', values: { project: 'X6728', stage: 'PR1', band: 'SSA', storage: '4+128', lcd: 'CSOT' } },
            ],
          },
        ]}
        activeFields={[
          { id: 'project', label: '项目名称', group: '基本信息', behavior: 'auto' },
          { id: 'band', label: '频段', group: '常用项', behavior: 'auto' },
        ]}
        onUpdateValue={vi.fn()}
      />
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());

    ref.current?.focusCellByBusinessKey('sku1', undefined, 'project');

    expect(getActiveWorkbook).toHaveBeenCalled();
    expect(getActiveSheet).toHaveBeenCalled();
    expect(getRange).toHaveBeenCalledWith(1, 1);
    expect(getCellMergeData).toHaveBeenCalledWith(1, 1);
    expect(activateRange).toHaveBeenCalledTimes(1);
    expect(scrollToCell).toHaveBeenCalledWith(1, 1);
    expect(activateAsCurrentCell).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('merges SKU-scoped field cells into a single visible workbook cell', async () => {
    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={[
          {
            id: 'sku1',
            stage: 'PR1',
            orderNo: '',
            project: 'X6728',
            supplies: [
              { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'PR1', band: 'SSA' } },
              { id: 's2', supplyKey: '二供', label: '二供', values: { project: 'X6728', stage: 'PR1', band: 'SSA' } },
              { id: 's3', supplyKey: '三供', label: '三供', values: { project: 'X6728', stage: 'PR1', band: 'SSA' } },
            ],
          },
        ]}
        activeFields={[
          { id: 'project', label: '项目名称', group: '基本信息', behavior: 'auto' },
          { id: 'band', label: '频段', group: '常用项', behavior: 'auto' },
        ]}
        onUpdateValue={vi.fn()}
      />
    );

    await waitFor(() => expect(createWorkbook).toHaveBeenCalled());

    const snapshot = (createWorkbook.mock.calls as unknown as Array<[any]>).at(-1)?.[0];
    expect(snapshot).toBeDefined();
    expect(snapshot.sheets.sheet1.mergeData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startRow: 1, endRow: 1, startColumn: 1, endColumn: 3 }),
        expect.objectContaining({ startRow: 3, endRow: 3, startColumn: 1, endColumn: 3 }),
      ])
    );
    expect(snapshot.sheets.sheet1.cellData[1][1]).toEqual({ v: 'X6728' });
    expect(snapshot.sheets.sheet1.cellData[1][2]).toBeUndefined();
    expect(snapshot.sheets.sheet1.cellData[3][1]).toEqual({ v: 'SSA' });
    expect(snapshot.sheets.sheet1.cellData[3][2]).toBeUndefined();
  });
});
