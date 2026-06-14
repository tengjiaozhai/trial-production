// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryState } from '../../hooks/useHistoryState';

const STORAGE_KEY = 'trial_production_history';

const entry = (id: string, timestamp: number) =>
  ({
    id,
    timestamp,
    name: id,
    skuData: [{ id: 's1', supplies: [{ id: 'p1', supplyKey: 'A' as any, values: {} }] }],
  } as any);

describe('useHistoryState debounce + dedup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces multiple setHistory calls into one localStorage write', () => {
    const { result } = renderHook(() => useHistoryState());
    act(() => {
      result.current.setHistory([entry('1', 1)]);
      result.current.setHistory([entry('2', 2)]);
      result.current.setHistory([entry('3', 3)]);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => { vi.advanceTimersByTime(250); });
    const written = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(written).toHaveLength(1);
    expect(written[0].id).toBe('3');
  });

  it('does not write when history did not change', () => {
    const { result } = renderHook(() => useHistoryState());
    act(() => {
      result.current.setHistory([entry('1', 1)]);
    });
    act(() => { vi.advanceTimersByTime(250); });
    const before = localStorage.getItem(STORAGE_KEY);
    act(() => {
      result.current.setHistory([entry('1', 1)]);
    });
    act(() => { vi.advanceTimersByTime(250); });
    const after = localStorage.getItem(STORAGE_KEY);
    expect(before).toBe(after);
  });
});
