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
    cell.scrollIntoView = vi.fn();
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

  it('scrolls the inner topTableRef so row-mb_id is visible when it sits below the 200px viewport', () => {
    // 真实布局: row-mb_id 嵌在 topTableRef (200px, overflow:auto) 内。
    // 当 basic info 行数较多时，mb_id 会被挤出 topTableRef 的 200px 视口，
    // 此时只滚外层 main 容器，mb_id 仍然不可见。
    const mainEl = document.createElement('main');
    mainEl.className = 'overflow-y-auto';
    mainEl.scrollTo = vi.fn();
    Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(mainEl, 'offsetTop', { value: 0 });

    // 模拟 topTableRef (200px, overflow:auto, 内含 row-mb_id)
    const topTableRef = document.createElement('div');
    topTableRef.className = 'shrink-0 z-20 shadow-sm min-w-0 overflow-auto [scrollbar-width:none]';
    Object.defineProperty(topTableRef, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(topTableRef, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(topTableRef, 'clientHeight', { value: 200, configurable: true });
    topTableRef.scrollTo = vi.fn();
    topTableRef.getBoundingClientRect = vi.fn(() => ({ top: 0, bottom: 200, left: 0, right: 100, width: 100, height: 200, x: 0, y: 0 } as DOMRect));
    mainEl.appendChild(topTableRef);

    // row-mb_id 在 topTableRef 内部 y=350 (在 200px 视口之外)
    const row = document.createElement('div');
    row.id = 'row-mb_id';
    row.scrollIntoView = vi.fn();
    row.getBoundingClientRect = vi.fn(() => ({ top: 350, bottom: 400, left: 0, right: 100, width: 100, height: 50, x: 0, y: 350 } as DOMRect));
    topTableRef.appendChild(row);
    document.body.appendChild(mainEl);

    // 实际定位的单元格 (在 row 内部)
    const cell = document.createElement('div');
    cell.setAttribute('data-testid', 'step2-mb-id-cell');
    cell.setAttribute('data-sku-id', 'sku-1');
    cell.textContent = 'MB-001';
    cell.scrollIntoView = vi.fn();
    row.appendChild(cell);

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

    // 核心断言: topTableRef 内部必须被滚动才能让 mb_id 可见
    expect(topTableRef.scrollTo).toHaveBeenCalled();
    const scrollCall = (topTableRef.scrollTo as any).mock.calls[0][0];
    expect(scrollCall.top).toBeGreaterThan(0);  // 滚动距离必须 > 0
    expect(cell.className).toMatch(/\bbg-rose-50\b/);

    act(() => {
      vi.runAllTimers();
    });

    expect(cell.className).not.toMatch(/\bbg-rose-50\b/);
  });

  it('scrolls the target mb_id cell into horizontal view when a duplicate card is clicked', () => {
    const mainEl = document.createElement('main');
    mainEl.className = 'overflow-y-auto';
    mainEl.scrollTo = vi.fn();
    Object.defineProperty(mainEl, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(mainEl, 'offsetTop', { value: 0 });
    document.body.appendChild(mainEl);

    const topTableRef = document.createElement('div');
    topTableRef.className = 'shrink-0 z-20 shadow-sm min-w-0 overflow-auto [scrollbar-width:none]';
    Object.defineProperty(topTableRef, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(topTableRef, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(topTableRef, 'clientHeight', { value: 200, configurable: true });
    topTableRef.scrollTo = vi.fn();
    topTableRef.getBoundingClientRect = vi.fn(() => ({ top: 0, bottom: 200, left: 0, right: 100, width: 100, height: 200, x: 0, y: 0 } as DOMRect));
    mainEl.appendChild(topTableRef);

    const row = document.createElement('div');
    row.id = 'row-mb_id';
    row.getBoundingClientRect = vi.fn(() => ({ top: 120, bottom: 170, left: 0, right: 100, width: 100, height: 50, x: 0, y: 120 } as DOMRect));
    topTableRef.appendChild(row);

    const cell = document.createElement('div');
    cell.setAttribute('data-testid', 'step2-mb-id-cell');
    cell.setAttribute('data-sku-id', 'sku-1');
    cell.textContent = 'D1';
    cell.scrollIntoView = vi.fn();
    row.appendChild(cell);

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
            pcba: 'D1',
            duplicateCount: 2,
            skuId: 'sku-1',
            detail: '主板标识 D1 在配置表中出现 2 次，请人工确认。',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText('主板标识 D1 在配置表中出现 2 次，请人工确认。'));

    expect(cell.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  });
});
