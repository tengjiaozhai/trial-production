// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedCallback } from './useDebouncedCallback';

describe('useDebouncedCallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalesces rapid calls into one', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 250));
    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });
    expect(fn).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(250); });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('uses latest callback after it changes', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const { result, rerender } = renderHook(
      ({ fn }: { fn: () => void }) => useDebouncedCallback(fn, 250),
      { initialProps: { fn: fn1 } },
    );
    act(() => { result.current(); });
    rerender({ fn: fn2 });
    act(() => { vi.advanceTimersByTime(250); });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});
