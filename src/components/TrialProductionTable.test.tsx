// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TrialProductionTable } from './TrialProductionTable';
import type { SKUData } from '../types';
import type { Step2CellConflict } from '../lib/step2CellConflicts';

const baseSku: SKUData = {
  id: 'sku1',
  stage: 'PR1',
  orderNo: '',
  project: 'X6728',
  supplies: [
    { id: 's1', supplyKey: '一供', label: '一供', values: {} },
    { id: 's2', supplyKey: '二供', label: '二供', values: {} },
  ],
};

const baseField = {
  id: 'project',
  label: '项目',
  group: '基本信息',
  behavior: 'manual' as const,
};

const mbIdField = {
  id: 'mb_id',
  label: '主板标识',
  group: '基本信息',
  behavior: 'manual' as const,
};

describe('TrialProductionTable insert affordances', () => {
  it('renders a row-insert-after button on each visible row in step 2 and fires onInsertRowAt(afterFieldId)', () => {
    const onInsertRowAt = vi.fn();
    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku]}
        activeFields={[baseField, { id: 'storage', label: '存储', group: '基本信息', behavior: 'manual' }]}
        onUpdateValue={() => {}}
        onInsertRowAt={onInsertRowAt}
        onAddSku={() => {}}
      />
    );

    const buttons = screen.getAllByTestId('row-insert-after');
    expect(buttons.length).toBeGreaterThan(0);

    fireEvent.click(buttons[0]);
    expect(onInsertRowAt).toHaveBeenCalled();
    const [firstArg] = onInsertRowAt.mock.calls[0];
    expect(typeof firstArg).toBe('string');
    expect(firstArg).toBe('project');
  });

  it('uses per-column insert buttons in step 2 and routes them to onAddSupply', () => {
    const onAddSupply = vi.fn();
    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onAddSupply={onAddSupply}
      />
    );

    expect(screen.queryByTestId('sku-insert-after')).toBeNull();

    const buttons = screen.getAllByTestId('column-insert-after');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onAddSupply).toHaveBeenCalledWith('sku1', 1);
  });

  it('uses per-column insert buttons in step 3 and routes them to onInsertSkuAfter', () => {
    const onInsertSkuAfter = vi.fn();
    render(
      <TrialProductionTable
        currentStep={3}
        skuData={[{ ...baseSku, supplies: [{ id: 's1', supplyKey: '一供', label: '一供', values: {} }] }]}
        activeFields={[
          baseField,
          { id: 'color', label: '颜色', group: '基本信息', behavior: 'manual' },
        ]}
        onUpdateValue={() => {}}
        onInsertSkuAfter={onInsertSkuAfter}
      />
    );

    expect(screen.queryByTestId('sku-insert-after')).toBeNull();

    const buttons = screen.getAllByTestId('column-insert-after');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onInsertSkuAfter).toHaveBeenCalledWith('sku1');
  });

  it('renders a row-insert-after button in step 4 and fires onInsertRowAt(afterFieldId)', () => {
    const onInsertRowAt = vi.fn();
    render(
      <TrialProductionTable
        currentStep={4}
        skuData={[baseSku]}
        activeFields={[baseField, { id: 'storage', label: '存储', group: '基本信息', behavior: 'manual' }]}
        onUpdateValue={() => {}}
        onInsertRowAt={onInsertRowAt}
      />
    );

    const buttons = screen.getAllByTestId('row-insert-after');
    expect(buttons.length).toBeGreaterThan(0);

    fireEvent.click(buttons[0]);
    expect(onInsertRowAt).toHaveBeenCalledWith('project');
  });

  it('uses per-column insert buttons in step 4 instead of the floating sku-insert-after button', () => {
    const onInsertSkuAfter = vi.fn();
    render(
      <TrialProductionTable
        currentStep={4}
        skuData={[
          { ...baseSku, id: 'sku1', supplies: [{ id: 's1', supplyKey: '一供', label: '一供', values: {} }] },
          { ...baseSku, id: 'sku2', supplies: [{ id: 's2', supplyKey: '一供', label: '一供', values: {} }] },
        ]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onInsertSkuAfter={onInsertSkuAfter}
      />
    );

    expect(screen.queryByTestId('sku-insert-after')).toBeNull();

    const buttons = screen.getAllByTestId('column-insert-after');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onInsertSkuAfter).toHaveBeenCalledWith('sku1');
  });
});

describe('TrialProductionTable sku selection', () => {
  it('marks mb_id cells with sku targeting attributes in step 2', () => {
    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[
          { ...baseSku, id: 'sku-1', project: 'A1' },
          { ...baseSku, id: 'sku-2', project: 'B1' },
        ]}
        activeFields={[baseField, mbIdField]}
        onUpdateValue={() => {}}
      />
    );

    const cells = screen.getAllByTestId('step2-mb-id-cell');
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveAttribute('data-sku-id', 'sku-1');
    expect(cells[1]).toHaveAttribute('data-sku-id', 'sku-2');
  });

  it('keeps custom inserted rows visible in step 2 when they belong to a visible group', () => {
    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku]}
        activeFields={[
          baseField,
          { id: 'custom_step2', label: '自定义步骤2', group: '基本信息', behavior: 'manual' },
        ]}
        onUpdateValue={() => {}}
      />
    );

    expect(screen.getByText('自定义步骤2')).toBeInTheDocument();
  });

  it('keeps custom inserted rows visible in step 3 when they belong to a visible group', () => {
    render(
      <TrialProductionTable
        currentStep={3}
        skuData={[{ ...baseSku, supplies: [{ id: 's1', supplyKey: '一供', label: '一供', values: {} }] }]}
        activeFields={[
          baseField,
          { id: 'custom_step3', label: '自定义步骤3', group: '常用项', behavior: 'manual' },
        ]}
        onUpdateValue={() => {}}
      />
    );

    expect(screen.getByText('自定义步骤3')).toBeInTheDocument();
  });

  it('fills the parent height in step 2 instead of using a viewport-fixed shell', () => {
    const { container } = render(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
      />
    );

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root!.className).toMatch(/\bh-full\b/);
    expect(root!.className).not.toMatch(/100vh-280px/);
  });

  it('renders sku-header-block elements with selection targeting metadata', () => {
    const { container } = render(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku, { ...baseSku, id: 'sku2' }]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        selectedSkuId="sku2"
        onSelectSku={() => {}}
      />
    );

    const headers = container.querySelectorAll('[data-testid="sku-header-block"]');
    expect(headers.length).toBe(2);
    expect(headers[0].getAttribute('data-sku-id')).toBe('sku1');
    expect(headers[0].getAttribute('data-selected')).toBe('false');
    expect(headers[1].getAttribute('data-sku-id')).toBe('sku2');
    expect(headers[1].getAttribute('data-selected')).toBe('true');
  });

  it('fires onSelectSku with the sku id when its select button is clicked', () => {
    const onSelectSku = vi.fn();
    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku, { ...baseSku, id: 'sku2' }]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onSelectSku={onSelectSku}
      />
    );

    const selectButtons = screen.getAllByTestId('sku-select');
    expect(selectButtons).toHaveLength(2);
    fireEvent.click(selectButtons[0]);
    expect(onSelectSku).toHaveBeenCalledWith('sku1');
    fireEvent.click(selectButtons[1]);
    expect(onSelectSku).toHaveBeenCalledWith('sku2');
  });

  it('shows copy-selected-sku button only when selectedSkuId is provided', () => {
    const { rerender } = render(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onSelectSku={() => {}}
        onCopySelectedSku={() => {}}
      />
    );
    expect(screen.queryByTestId('copy-selected-sku')).toBeNull();

    rerender(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onSelectSku={() => {}}
        onCopySelectedSku={() => {}}
        selectedSkuId="sku1"
      />
    );
    expect(screen.queryByTestId('copy-selected-sku')).not.toBeNull();
  });

  it('shows paste-into-new-sku button only when both selectedSkuId and copiedSku are provided', () => {
    const onPaste = vi.fn();
    const { rerender } = render(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onSelectSku={() => {}}
        selectedSkuId="sku1"
      />
    );
    expect(screen.queryByTestId('paste-into-new-sku')).toBeNull();

    rerender(
      <TrialProductionTable
        currentStep={2}
        skuData={[baseSku]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onSelectSku={() => {}}
        selectedSkuId="sku1"
        copiedSku={{ sourceSkuId: 'sku1', supplies: [] }}
        onPasteIntoNewSku={onPaste}
      />
    );
    const pasteButton = screen.queryByTestId('paste-into-new-sku');
    expect(pasteButton).not.toBeNull();
    fireEvent.click(pasteButton!);
    expect(onPaste).toHaveBeenCalledTimes(1);
  });
});

describe('TrialProductionTable horizontal slider', () => {
  const wideSku: SKUData = {
    id: 'sku1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    supplies: Array.from({ length: 30 }, (_, i) => ({
      id: `s${i}`,
      supplyKey: '一供',
      label: `一供${i}`,
      values: {},
    })),
  };

  it('renders a range input in step 2 with the throttled step size', () => {
    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[wideSku]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onSelectSku={() => {}}
      />
    );
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.type).toBe('range');
    expect(Number(slider.step)).toBe(8);
  });

  it('keeps the slider disabled when the table has no horizontal overflow', () => {
    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[wideSku]}
        activeFields={[baseField]}
        onUpdateValue={() => {}}
        onSelectSku={() => {}}
      />
    );
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.disabled).toBe(true);
  });
});

describe('TrialProductionTable step5 efuse labels', () => {
  it('renders efuse suffixes in Step 5 preview labels', () => {
    render(
      <TrialProductionTable
        currentStep={5}
        skuData={[
          {
            id: 'sku1',
            stage: 'PR1',
            orderNo: '',
            project: 'X6728',
            supplies: [
              { id: 's1', supplyKey: '一供', label: '一供', values: { hw_eng: '8' } },
            ],
          },
        ]}
        efuseConfigs={{ hw_eng: 'no efuse' }}
        activeFields={[
          { id: 'hw_eng', label: '硬件', group: '内部样机需求', behavior: 'manual' },
        ]}
        onUpdateValue={() => {}}
      />
    );

    expect(screen.getByText('硬件(no efuse)')).toBeInTheDocument();
  });
});

describe('TrialProductionTable step2 cell conflicts', () => {
  it('renders an unresolved conflict cell as a blank red input with candidate chips', () => {
    const onUpdateValue = vi.fn();

    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[
          {
            id: 'sku-1',
            stage: 'PR1',
            orderNo: '',
            project: 'A1',
            supplies: [
              {
                id: 'sup-1',
                supplyKey: '一供',
                label: '一供',
                values: { lcd: '' },
              },
            ],
          },
        ]}
        step2Conflicts={[
          {
            kind: 'cell_conflict',
            scope: 'supply',
            cellId: 'step2-cell-sku-1-sup-1-lcd',
            skuId: 'sku-1',
            supplyId: 'sup-1',
            fieldId: 'lcd',
            fieldLabel: 'LCD',
            pcba: 'A1',
            supplyLabel: '一供',
            candidates: ['BOE', 'CSOT'],
          } as Step2CellConflict,
        ]}
        onUpdateValue={onUpdateValue}
        activeFields={[
          { id: 'lcd', label: 'LCD', group: '常规器件', behavior: 'calc' },
        ]}
      />
    );

    expect(screen.getByTestId('step2-cell-sku-1-sup-1-lcd')).toHaveClass('border-rose-500');
    expect(screen.getByPlaceholderText('-')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'BOE' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSOT' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'BOE' }));
    expect(onUpdateValue).toHaveBeenCalledWith('sku-1', 'sup-1', 'lcd', 'BOE');
  });

  it('renders a sku-spanned band conflict with candidate chips and applies updates to all supplies', () => {
    const onUpdateValue = vi.fn();

    render(
      <TrialProductionTable
        currentStep={2}
        skuData={[
          {
            id: 'sku-1',
            stage: 'PR1',
            orderNo: '',
            project: 'D1',
            supplies: [
              { id: 'sup-1', supplyKey: '一供', label: '一供', values: { band: '' } },
              { id: 'sup-2', supplyKey: '二供', label: '二供', values: { band: '' } },
              { id: 'sup-3', supplyKey: '三供', label: '三供', values: { band: '' } },
            ],
          },
        ]}
        step2Conflicts={[
          {
            kind: 'cell_conflict',
            scope: 'sku',
            cellId: 'step2-cell-sku-1-band',
            skuId: 'sku-1',
            fieldId: 'band',
            fieldLabel: '频段',
            pcba: 'D1',
            supplyLabel: '整列',
            candidates: ['拉美', '沙特（艾为PD IC）'],
          } as Step2CellConflict,
        ]}
        onUpdateValue={onUpdateValue}
        activeFields={[
          { id: 'band', label: '频段', group: '常用项', behavior: 'auto' },
        ]}
      />
    );

    expect(screen.getByTestId('step2-cell-sku-1-band')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '拉美' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '沙特（艾为PD IC）' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '拉美' }));
    expect(onUpdateValue).toHaveBeenNthCalledWith(1, 'sku-1', 'sup-1', 'band', '拉美');
    expect(onUpdateValue).toHaveBeenNthCalledWith(2, 'sku-1', 'sup-2', 'band', '拉美');
    expect(onUpdateValue).toHaveBeenNthCalledWith(3, 'sku-1', 'sup-3', 'band', '拉美');
  });
});
