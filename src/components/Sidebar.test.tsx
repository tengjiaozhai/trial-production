// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

describe('Sidebar step 2 duplicate PCBA conflicts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('scrolls to row-mb_id and highlights the matching mb_id cell when a duplicate PCBA card is clicked', () => {
    const mainEl = document.createElement('main');
    mainEl.className = 'overflow-y-auto';
    mainEl.scrollTo = vi.fn();
    Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(mainEl, 'offsetTop', { value: 0 });
    document.body.appendChild(mainEl);

    const row = document.createElement('div');
    row.id = 'row-mb_id';
    row.scrollIntoView = vi.fn();
    row.getBoundingClientRect = vi.fn(() => ({ top: 100, bottom: 120, left: 0, right: 100, width: 100, height: 20, x: 0, y: 100 } as DOMRect));
    mainEl.appendChild(row);

    const cell = document.createElement('div');
    cell.setAttribute('data-testid', 'step2-mb-id-cell');
    cell.setAttribute('data-sku-id', 'sku-1');
    cell.textContent = 'MB-001';
    row.appendChild(cell);
    document.body.appendChild(row);

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
            kind: 'duplicate_pcba',
            pcba: 'MB-001',
            duplicateCount: 2,
            skuId: 'sku-1',
            detail: '主板 MB-001 在配置表中重复 2 次',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText('主板 MB-001 在配置表中重复 2 次'));

    expect(mainEl.scrollTo).toHaveBeenCalled();
    expect(cell.className).toMatch(/\bbg-rose-50\b/);
    expect(cell.className).toMatch(/\bborder-rose-500\b/);

    act(() => {
      vi.runAllTimers();
    });

    expect(cell.className).not.toMatch(/\bbg-rose-50\b/);
    expect(cell.className).not.toMatch(/\bborder-rose-500\b/);
  });
});
