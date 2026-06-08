// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import type { Step2CellConflict } from '../lib/step2CellConflicts';
import type { ValidationResult } from '../types';

describe('Sidebar step 2 duplicate PCBA conflicts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('scrolls to the mb_id cell and highlights it when a cell_conflict card is clicked', () => {
    const target = document.createElement('div');
    target.dataset.step2CellId = 'step2-cell-sku-1-sup-1-mb_id';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    render(
      <Sidebar
        currentStep={2}
        projectInfo={{ name: '', customer: '', stage: '', files: [] }}
        skuData={[]}
        validationResults={[]}
        onGoBack={() => {}}
        isFlowComplete={false}
        setIsFlowComplete={() => {}}
        onRunValidation={() => {}}
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

    fireEvent.click(screen.getByText('点击定位'));

    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(target.className).toMatch(/\bbg-rose-50\b/);

    act(() => {
      vi.runAllTimers();
    });

    expect(target.className).not.toMatch(/\bbg-rose-50\b/);
  });

  it('scrolls the target cell into horizontal view when a cell_conflict card is clicked', () => {
    const target = document.createElement('div');
    target.dataset.step2CellId = 'step2-cell-sku-1-sup-1-lcd';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    render(
      <Sidebar
        currentStep={2}
        projectInfo={{ name: '', customer: '', stage: '', files: [] }}
        skuData={[]}
        validationResults={[]}
        onGoBack={() => {}}
        isFlowComplete={false}
        setIsFlowComplete={() => {}}
        onRunValidation={() => {}}
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

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  });
});

describe('Sidebar step2 cell_conflict targeting', () => {
  it('scrolls to the exact conflict cell by data-step2-cell-id', () => {
    const target = document.createElement('div');
    target.dataset.step2CellId = 'step2-cell-sku-1-sup-1-lcd';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    render(
      <Sidebar
        currentStep={2}
        projectInfo={{ name: '', customer: '', stage: '', files: [] }}
        skuData={[]}
        validationResults={[]}
        onGoBack={vi.fn()}
        isFlowComplete={false}
        setIsFlowComplete={vi.fn()}
        onRunValidation={vi.fn()}
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
      />
    );

    fireEvent.click(screen.getByText('点击定位'));
    expect(target.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ inline: 'center' })
    );
  });
});

describe('Sidebar step4 validation cell targeting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scrolls to targetFieldId when present instead of fieldId', () => {
    const fallbackTarget = document.createElement('div');
    fallbackTarget.scrollIntoView = vi.fn();

    const target = document.createElement('div');
    target.scrollIntoView = vi.fn();

    const querySelectorSpy = vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '[data-step4-cell-id="step4-cell-sku_1-s_1-lcd"]') {
        return target;
      }
      if (selector === '[data-step4-cell-id="step4-cell-sku_1-s_1-color"]') {
        return fallbackTarget;
      }
      return null;
    });

    const validationResults: ValidationResult[] = [
      {
        id: 'RULE-DISPLAY-sku_1-s_1',
        title: '展示字段不一致',
        detail: '[X6728 · 一供] display_name 与目标字段不匹配。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'color',
        targetFieldId: 'lcd',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ];

    render(
      <Sidebar
        currentStep={4}
        projectInfo={{ name: 'X6728', customer: '标准', stage: 'EVT', files: [] }}
        skuData={[]}
        validationResults={validationResults}
        onGoBack={() => {}}
        isFlowComplete={false}
        setIsFlowComplete={() => {}}
        onRunValidation={() => {}}
      />
    );

    fireEvent.click(screen.getByText('点击定位'));

    expect(querySelectorSpy).toHaveBeenCalledWith(
      '[data-step4-cell-id="step4-cell-sku_1-s_1-lcd"]'
    );
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
    expect(fallbackTarget.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls to the validation cell and highlights it when an error card is clicked', () => {
    const target = document.createElement('div');
    target.scrollIntoView = vi.fn();

    const querySelectorSpy = vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
      if (selector === '[data-step4-cell-id="step4-cell-sku_1-s_1-color"]') {
        return target;
      }
      return null;
    });

    const validationResults: ValidationResult[] = [
      {
        id: 'RULE-COLOR-sku_1-s_1',
        title: '颜色不一致',
        detail: '[X6728 · 一供] 颜色(color)与 MBOM/PBOM 均不匹配。',
        amReference: 'Rule-1',
        level: 'error',
        fieldId: 'color',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ];

    render(
      <Sidebar
        currentStep={4}
        projectInfo={{ name: 'X6728', customer: '标准', stage: 'EVT', files: [] }}
        skuData={[]}
        validationResults={validationResults}
        onGoBack={() => {}}
        isFlowComplete={false}
        setIsFlowComplete={() => {}}
        onRunValidation={() => {}}
      />
    );

    fireEvent.click(screen.getByText('点击定位'));

    expect(querySelectorSpy).toHaveBeenCalledWith(
      '[data-step4-cell-id="step4-cell-sku_1-s_1-color"]'
    );
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  });
});
