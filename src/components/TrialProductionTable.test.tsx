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

  it('does not render column-insert-after buttons in step 2 (column header row removed)', () => {
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
    expect(screen.queryByTestId('column-insert-after')).toBeNull();
    expect(onAddSupply).not.toHaveBeenCalled();
  });

  it('does not render column-insert-after buttons in step 3 (column header row removed)', () => {
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
    expect(screen.queryByTestId('column-insert-after')).toBeNull();
    expect(onInsertSkuAfter).not.toHaveBeenCalled();
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

  it('does not render column-insert-after buttons in step 4 (column header row removed)', () => {
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
    expect(screen.queryByTestId('column-insert-after')).toBeNull();
    expect(onInsertSkuAfter).not.toHaveBeenCalled();
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

  it('does not render sku-header-block elements (column header row removed)', () => {
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

    expect(container.querySelectorAll('[data-testid="sku-header-block"]').length).toBe(0);
  });

  it('does not render sku-select buttons (column header row removed)', () => {
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

    expect(screen.queryAllByTestId('sku-select')).toHaveLength(0);
    expect(onSelectSku).not.toHaveBeenCalled();
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
