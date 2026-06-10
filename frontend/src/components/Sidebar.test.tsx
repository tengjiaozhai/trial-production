// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import type { Step2CellConflict } from '../lib/step2CellConflicts';
import type { ValidationResult } from '../types';

const baseProjectInfo = { name: 'X6728', customer: '标准' as const, stage: 'EVT', files: [{ id: 'f1', name: 'test.xlsx', type: 'config' }] };

describe('Sidebar step 2 duplicate PCBA conflicts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('calls onFocusCell with correct args when a cell_conflict card is clicked', () => {
    const onFocusCell = vi.fn();

    render(
      <Sidebar
        currentStep={2}
        projectInfo={baseProjectInfo}
        skuData={[]}
        validationResults={[]}
        onGoBack={() => {}}
        isFlowComplete={false}
        setIsFlowComplete={() => {}}
        onRunValidation={() => {}}
        onFocusCell={onFocusCell}
        step2Conflicts={[
          {
            kind: 'cell_conflict',
            scope: 'supply',
            cellId: 'step2-cell-sku-1-sup-1-mb_id',
            skuId: 'sku-1',
            supplyId: 'sup-1',
            fieldId: 'mb_id',
            fieldLabel: '主板标识',
            pcba: 'MB-001',
            supplyLabel: '一供',
            candidates: ['MB-001', 'MB-002'],
          } as Step2CellConflict,
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '点击定位' }));

    expect(onFocusCell).toHaveBeenCalledWith('sku-1', 'sup-1', 'mb_id');
  });

  it('calls onResolveStep2Conflict when a candidate value is clicked', () => {
    const onResolveStep2Conflict = vi.fn();

    render(
      <Sidebar
        currentStep={2}
        projectInfo={baseProjectInfo}
        skuData={[]}
        validationResults={[]}
        onGoBack={() => {}}
        isFlowComplete={false}
        setIsFlowComplete={() => {}}
        onRunValidation={() => {}}
        onResolveStep2Conflict={onResolveStep2Conflict}
        step2Conflicts={[
          {
            kind: 'cell_conflict',
            scope: 'supply',
            cellId: 'step2-cell-sku-1-sup-1-mb_id',
            skuId: 'sku-1',
            supplyId: 'sup-1',
            fieldId: 'mb_id',
            fieldLabel: '主板标识',
            pcba: 'MB-001',
            supplyLabel: '一供',
            candidates: ['MB-001', 'MB-002'],
          } as Step2CellConflict,
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'MB-001' }));

    expect(onResolveStep2Conflict).toHaveBeenCalledWith(
      expect.objectContaining({
        skuId: 'sku-1',
        supplyId: 'sup-1',
        fieldId: 'mb_id',
      }),
      'MB-001'
    );
  });

  it('calls onFocusCell for LCD conflict card', () => {
    const onFocusCell = vi.fn();

    render(
      <Sidebar
        currentStep={2}
        projectInfo={baseProjectInfo}
        skuData={[]}
        validationResults={[]}
        onGoBack={() => {}}
        isFlowComplete={false}
        setIsFlowComplete={() => {}}
        onRunValidation={() => {}}
        onFocusCell={onFocusCell}
        step2Conflicts={[
          {
            kind: 'cell_conflict',
            scope: 'supply',
            cellId: 'step2-cell-sku-1-sup-1-lcd',
            skuId: 'sku-1',
            supplyId: 'sup-1',
            fieldId: 'lcd',
            fieldLabel: 'LCD',
            pcba: 'D1',
            supplyLabel: '一供',
            candidates: ['BOE', 'CSOT'],
          } as Step2CellConflict,
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '点击定位' }));

    expect(onFocusCell).toHaveBeenCalledWith('sku-1', 'sup-1', 'lcd');
  });
});

describe('Sidebar step2 cell_conflict targeting', () => {
  it('calls onFocusCell with skuId, supplyId, and fieldId', () => {
    const onFocusCell = vi.fn();

    render(
      <Sidebar
        currentStep={2}
        projectInfo={baseProjectInfo}
        skuData={[]}
        validationResults={[]}
        onGoBack={vi.fn()}
        isFlowComplete={false}
        setIsFlowComplete={vi.fn()}
        onRunValidation={vi.fn()}
        onFocusCell={onFocusCell}
        step2Conflicts={[
          {
            kind: 'cell_conflict',
            scope: 'supply',
            cellId: 'step2-cell-sku-1-sup-1-lcd',
            skuId: 'sku-1',
            supplyId: 'sup-1',
            fieldId: 'lcd',
            fieldLabel: 'LCD',
            pcba: 'D1',
            supplyLabel: '一供',
            candidates: ['BOE', 'CSOT'],
          } as Step2CellConflict,
        ]}
      />
    );

    fireEvent.click(screen.getByText('点击定位'));
    expect(onFocusCell).toHaveBeenCalledWith('sku-1', 'sup-1', 'lcd');
  });
});

describe('Sidebar step4 validation cell targeting', () => {
  it('calls onFocusCell with targetFieldId when present', () => {
    const onFocusCell = vi.fn();

    render(
      <Sidebar
        currentStep={4}
        projectInfo={baseProjectInfo}
        skuData={[]}
        validationResults={[
          {
            id: 'v1',
            title: '颜色不一致',
            detail: 'xxx',
            amReference: '',
            level: 'error',
            fieldId: 'color',
            targetFieldId: 'unit_id' as any,
            skuId: 'sku-1',
            supplyId: 'sup-1',
          },
        ]}
        onGoBack={vi.fn()}
        isFlowComplete={false}
        setIsFlowComplete={vi.fn()}
        onRunValidation={vi.fn()}
        onFocusCell={onFocusCell}
      />
    );

    fireEvent.click(screen.getByText('点击定位'));
    expect(onFocusCell).toHaveBeenCalledWith('sku-1', 'sup-1', 'unit_id');
  });

  it('calls onFocusCell with fieldId when targetFieldId is absent', () => {
    const onFocusCell = vi.fn();

    render(
      <Sidebar
        currentStep={4}
        projectInfo={baseProjectInfo}
        skuData={[]}
        validationResults={[
          {
            id: 'v1',
            title: '颜色不一致',
            detail: 'xxx',
            amReference: '',
            level: 'error',
            fieldId: 'color',
            skuId: 'sku-1',
            supplyId: 'sup-1',
          },
        ]}
        onGoBack={vi.fn()}
        isFlowComplete={false}
        setIsFlowComplete={vi.fn()}
        onRunValidation={vi.fn()}
        onFocusCell={onFocusCell}
      />
    );

    fireEvent.click(screen.getByText('点击定位'));
    expect(onFocusCell).toHaveBeenCalledWith('sku-1', 'sup-1', 'color');
  });
});
