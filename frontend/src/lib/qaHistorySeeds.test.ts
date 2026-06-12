import { describe, expect, it } from 'vitest';
import { getQaSeedEntries, shouldAllowQaSeed } from './qaHistorySeeds';

describe('qaHistorySeeds', () => {
  it('allows localhost-style hosts only', () => {
    expect(shouldAllowQaSeed('127.0.0.1')).toBe(true);
    expect(shouldAllowQaSeed('localhost')).toBe(true);
    expect(shouldAllowQaSeed('::1')).toBe(true);
    expect(shouldAllowQaSeed('172.22.48.106')).toBe(false);
  });

  it('returns a step3 seed entry', () => {
    const entries = getQaSeedEntries('?qaSeed=step3');
    expect(entries).toHaveLength(1);
    expect(entries?.[0].currentStep).toBe(3);
    expect(entries?.[0].isFlowComplete).toBe(false);
    expect(entries?.[0].activeFields.some((field) => field.id === 'f_custom_seed')).toBe(true);
    expect(entries?.[0].skuData[0].selectedSupplyKey).toBe('二供');
  });

  it('returns a step5 seed entry', () => {
    const entries = getQaSeedEntries('?qaSeed=step5');
    expect(entries).toHaveLength(1);
    expect(entries?.[0].currentStep).toBe(5);
    expect(entries?.[0].isFlowComplete).toBe(true);
    expect(entries?.[0].isArchived).toBe(true);
  });

  it('returns null when the query parameter is absent or unknown', () => {
    expect(getQaSeedEntries('')).toBeNull();
    expect(getQaSeedEntries('?qaSeed=unknown')).toBeNull();
  });
});
