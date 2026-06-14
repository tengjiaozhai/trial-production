// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSkuState } from './useSkuState';
import { FIELD_DEFS } from '../constants';

describe('useSkuState', () => {
  it('initial values include FIELD_DEFS as activeFields', () => {
    const { result } = renderHook(() => useSkuState());
    expect(result.current.activeFields).toBe(FIELD_DEFS);
    expect(result.current.skuData).toEqual([]);
    expect(result.current.selectedRows).toEqual([]);
    expect(result.current.isFlowComplete).toBe(false);
    expect(result.current.validationResults).toEqual([]);
    expect(result.current.isExportDisabled).toBe(true);
    expect(result.current.step5Layout).toBeNull();
    expect(result.current.selectedSkuId).toBeNull();
    expect(result.current.copiedSku).toBeNull();
  });

  it('updates skuData independently', () => {
    const { result } = renderHook(() => useSkuState());
    const skus = [{ id: 's1' } as any];
    act(() => result.current.setSkuData(skus));
    expect(result.current.skuData).toBe(skus);
  });
});
