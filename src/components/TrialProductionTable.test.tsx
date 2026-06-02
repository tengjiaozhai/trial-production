// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TrialProductionTable } from './TrialProductionTable';
import type { SKUData } from '../types';

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

  it('shows a blue ring/border on the selected sku header when isSelected is true', () => {
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
    const selectedHeader = headers[1];
    expect(selectedHeader.className).toMatch(/ring-2/);
    expect(selectedHeader.className).toMatch(/border-blue-500/);

    const unselectedHeader = headers[0];
    expect(unselectedHeader.className).not.toMatch(/ring-2/);
    expect(unselectedHeader.className).not.toMatch(/border-blue-500/);
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
