import { describe, expect, it } from 'vitest';
import { resolveHistoryLoadTransition } from './historyLoadTransition';

describe('resolveHistoryLoadTransition', () => {
  it('warms through step 4 before entering step 5 from step 1', () => {
    expect(resolveHistoryLoadTransition(1, 5)).toEqual({
      immediateStep: 4,
      delayedStep: 5,
      delayMs: 800,
    });
  });

  it('loads the target step immediately for non-step5 history entries', () => {
    expect(resolveHistoryLoadTransition(1, 3)).toEqual({
      immediateStep: 3,
    });
  });

  it('loads step 5 immediately when already past step 1', () => {
    expect(resolveHistoryLoadTransition(3, 5)).toEqual({
      immediateStep: 5,
    });
  });
});
