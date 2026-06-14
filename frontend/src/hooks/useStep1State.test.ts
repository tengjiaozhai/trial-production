// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStep1State } from './useStep1State';

describe('useStep1State', () => {
  it('initial values are empty defaults', () => {
    const { result } = renderHook(() => useStep1State());
    expect(result.current.name).toBe('');
    expect(result.current.customer).toBe('');
    expect(result.current.stage).toBe('');
    expect(result.current.files).toEqual([]);
    expect(result.current.step1Errors).toEqual({});
    expect(result.current.manualPcbaInput).toBe('');
  });

  it('updates name', () => {
    const { result } = renderHook(() => useStep1State());
    act(() => result.current.setName('X6728'));
    expect(result.current.name).toBe('X6728');
  });
});
