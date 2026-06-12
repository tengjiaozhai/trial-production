// @vitest-environment jsdom
// Standalone reproduction: does setUniverReady(true) cause Effect B to re-run
// when Effect B's deps are [model, skuData] and `univerReady` is NOT a dep?
//
// Mirrors the pattern in src/components/TrialProductionSheet.tsx:283-460:
//   - Effect A: deps [], schedules setUniverReady(true) via setTimeout(0)
//   - Effect B: deps [model, skuData], first line `if (!univerReady) return;`
//               then createWorkbook()
//
// Renders inside <React.StrictMode> to match the production environment.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React, { useEffect, useRef, useState } from 'react';

type Model = { id: string };
type SkuData = { id: string };

type ReproProps = {
  model: Model;
  skuData: SkuData;
  onWorkbookCreate: () => void;
};

let effectARunCount = 0;
let effectACleanupCount = 0;
let effectBRunCount = 0;
let effectBCleanupCount = 0;
let effectBEarlyReturnCount = 0;
let effectBCreateWorkbookCount = 0;
let setTimeoutFiredCount = 0;
const effectBUniverReadySeen: boolean[] = [];

function Repro({ model, skuData, onWorkbookCreate }: ReproProps) {
  const [univerReady, setUniverReady] = useState(false);
  const renderRef = useRef(0);
  renderRef.current += 1;
  const renderIndex = renderRef.current;
  console.log(
    `[render #${renderIndex}] univerReady=${univerReady}`,
  );

  // Effect A: deps [] — same as TrialProductionSheet.tsx:283
  useEffect(() => {
    effectARunCount += 1;
    const myRun = effectARunCount;
    console.log(
      `[Effect A run #${myRun}] render #${renderIndex} | scheduling setTimeout(0)`,
    );
    const timer = setTimeout(() => {
      setTimeoutFiredCount += 1;
      console.log(
        `[setTimeout fired #${setTimeoutFiredCount}] (Effect A run #${myRun}) | calling setUniverReady(true)`,
      );
      setUniverReady(true);
    }, 0);
    return () => {
      effectACleanupCount += 1;
      console.log(
        `[Effect A cleanup #${effectACleanupCount}] (was run #${myRun})`,
      );
      clearTimeout(timer);
    };
  }, []);

  // Effect B: deps [model, skuData] — univerReady NOT in deps,
  // mirrors TrialProductionSheet.tsx:327 (full deps are
  // [model, skuData, activeFields, currentStep, skuSupplyKeys]).
  useEffect(() => {
    effectBRunCount += 1;
    const myRun = effectBRunCount;
    effectBUniverReadySeen.push(univerReady);
    console.log(
      `[Effect B run #${myRun}] render #${renderIndex} | univerReady=${univerReady} | model.id=${model.id} | skuData.id=${skuData.id}`,
    );
    if (!univerReady) {
      effectBEarlyReturnCount += 1;
      console.log(
        `[Effect B run #${myRun}] early-return: !univerReady → createWorkbook() NOT called`,
      );
      return;
    }
    effectBCreateWorkbookCount += 1;
    console.log(
      `[Effect B run #${myRun}] >>> createWorkbook() called (#${effectBCreateWorkbookCount})`,
    );
    onWorkbookCreate();
    return () => {
      effectBCleanupCount += 1;
      console.log(
        `[Effect B cleanup #${effectBCleanupCount}] (was run #${myRun})`,
      );
    };
  }, [model, skuData]);

  return null;
}

const STABLE_MODEL: Model = Object.freeze({ id: 'model-stable' });
const STABLE_SKU_DATA: SkuData = Object.freeze({ id: 'sku-stable' });

function resetCounters() {
  effectARunCount = 0;
  effectACleanupCount = 0;
  effectBRunCount = 0;
  effectBCleanupCount = 0;
  effectBEarlyReturnCount = 0;
  effectBCreateWorkbookCount = 0;
  setTimeoutFiredCount = 0;
  effectBUniverReadySeen.length = 0;
}

describe('StrictMode setUniverReady(true) re-run repro', () => {
  beforeEach(() => {
    resetCounters();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs every effect invocation under React.StrictMode', async () => {
    console.log('\n========== TEST START: mount with <StrictMode> ==========');
    const onWorkbookCreate = vi.fn();

    const { unmount } = render(
      <React.StrictMode>
        <Repro
          model={STABLE_MODEL}
          skuData={STABLE_SKU_DATA}
          onWorkbookCreate={onWorkbookCreate}
        />
      </React.StrictMode>,
    );

    console.log('\n--- after initial mount (before flushing timers) ---');
    console.log(
      `counters: A.run=${effectARunCount} A.cleanup=${effectACleanupCount}` +
        ` B.run=${effectBRunCount} B.cleanup=${effectBCleanupCount}` +
        ` B.earlyReturn=${effectBEarlyReturnCount} B.createWorkbook=${effectBCreateWorkbookCount}` +
        ` setTimeout.fired=${setTimeoutFiredCount}`,
    );

    console.log('\n--- advancing timers by 0 to fire setUniverReady(true) ---');
    await vi.advanceTimersByTimeAsync(0);

    console.log('\n--- after flushing setTimeout(0) ---');
    console.log(
      `counters: A.run=${effectARunCount} A.cleanup=${effectACleanupCount}` +
        ` B.run=${effectBRunCount} B.cleanup=${effectBCleanupCount}` +
        ` B.earlyReturn=${effectBEarlyReturnCount} B.createWorkbook=${effectBCreateWorkbookCount}` +
        ` setTimeout.fired=${setTimeoutFiredCount}`,
    );

    console.log('\n--- Effect B univerReady values seen across all runs:',
      effectBUniverReadySeen);

    console.log('\n--- unmount ---');
    unmount();
    console.log(
      `final: A.run=${effectARunCount} A.cleanup=${effectACleanupCount}` +
        ` B.run=${effectBRunCount} B.cleanup=${effectBCleanupCount}` +
        ` B.earlyReturn=${effectBEarlyReturnCount} B.createWorkbook=${effectBCreateWorkbookCount}` +
        ` setTimeout.fired=${setTimeoutFiredCount}`,
    );
    console.log('========== TEST END ==========\n');

    // ---- Assertions that pin the observed behavior ----
    //
    // PHASE 1: state right after setUniverReady(true) re-renders, BEFORE unmount.
    // StrictMode double-invoked Effect A and Effect B on mount, so each ran twice.
    // Both Effect B runs early-returned. After the re-render triggered by
    // setUniverReady(true), B's dep array [model, skuData] is unchanged
    // (model and skuData are stable frozen refs), so React does NOT re-run B.
    expect(effectARunCount).toBe(2);
    expect(effectBRunCount).toBe(2);
    expect(effectBEarlyReturnCount).toBe(2);
    expect(effectBCreateWorkbookCount).toBe(0);
    expect(onWorkbookCreate).not.toHaveBeenCalled();
    // Both initial B runs saw univerReady=false (from the very first render).
    // They NEVER saw true, because the deps array never changed after that.
    expect(effectBUniverReadySeen).toEqual([false, false]);
    // setUniverReady(true) DID fire (state did flip → a re-render did happen),
    // but no additional B run was triggered.
    expect(setTimeoutFiredCount).toBeGreaterThanOrEqual(1);
    expect(effectBCreateWorkbookCount).toBe(0);

    // PHASE 2: after unmount, Effect A's active run (#2) gets cleaned up.
    // Effect B's runs early-returned without a cleanup fn, so B.cleanup stays 0.
    expect(effectACleanupCount).toBe(2);
    expect(effectBCleanupCount).toBe(0);
  });
});
