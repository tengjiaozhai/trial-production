# Skip Storage Validation on Empty flash EMMC/DDR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `flash EMMC` or `flash DDR` is empty, the Step 4 storage validation should not produce any error. Only validate when the values are non-empty. This makes `emmc`/`ddr` empty behavior consistent with the existing `storage` empty behavior (already guarded by `App.tsx:888` `if (storage)`).

**Architecture:** Pure subtraction. Remove the `kind: 'unfilled'` branch from `validateStorageAgainstComponents`, remove the `StorageMismatchKind` type union, simplify `buildStep4StorageValidationResults` to inline the `kind === 'mismatch'` rendering. Delete the 4 unfilled test cases and the 1 unfilled card test case. Drop the `kind` field from existing mismatch test fixtures.

**Tech Stack:** React 19 + Vite 6 + TypeScript 5.8 + Vitest 4

**Parallelism:** Two independent work streams. Agent A: `step4ValidationRules.ts` + its test. Agent B: `step4StorageValidationResults.ts` + its test. No file overlap.

**Scope guard:** Do NOT touch `App.tsx`, `Sidebar.tsx`, `types.ts`, or any other lib. `App.tsx:888` already has `if (storage)` guard; `emmc`/`ddr` empty handling is entirely internal to the two lib files.

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `frontend/src/lib/step4ValidationRules.ts` | `parseStoragePair`, `extractTrailingSize`, `validateStorageAgainstComponents` — remove `StorageMismatchKind` type, drop `kind` from `StorageMismatch`, drop the `!emmcSize` / `!ddrSize` branches so empty emmc/ddr produces no mismatch |
| `frontend/src/lib/step4StorageValidationResults.ts` | `buildStep4StorageValidationResults` — remove `titleForMismatch` / `detailForMismatch` helpers, inline the mismatch rendering since `kind` is no longer a thing |
| `frontend/src/lib/step4ValidationRules.test.ts` | Drop 4 unfilled `it` blocks (lines 93-150); drop `kind: 'mismatch'` from the 3 remaining mismatch `it` blocks |
| `frontend/src/lib/step4StorageValidationResults.test.ts` | Drop 1 unfilled card `it` block (lines 157-184); drop `kind: 'mismatch'` from the 3 remaining mismatch `it` blocks |

### Files NOT Modified

- `frontend/src/App.tsx` — `if (storage)` guard at L888 already handles storage-empty; emmc/ddr empty handling is purely lib-internal
- `frontend/src/types.ts` — `ValidationResult` has no `kind` field publicly
- `frontend/src/components/Sidebar.tsx` — only reads `result.targetFieldId ?? result.fieldId`, ignores `kind`
- `frontend/src/lib/step5TableModel.ts`, `univerTrialProductionSheet.ts`, etc. — no dependency on `kind`

---

## Parallel Work Streams

### Stream A: `step4ValidationRules.ts` + its test

```ts
// step4ValidationRules.ts — replace lines 15-58 with:

export type StorageMismatch = {
  targetFieldId: 'emmc' | 'ddr';
  reason: string;
};

export function validateStorageAgainstComponents(args: {
  storage: string;
  emmc: string;
  ddr: string;
}): {
  ok: boolean;
  reasons: string[];
  mismatches: StorageMismatch[];
} {
  const pair = parseStoragePair(args.storage);
  if (!pair) return { ok: false, reasons: ['存储格式错误'], mismatches: [] };

  const reasons: string[] = [];
  const mismatches: StorageMismatch[] = [];
  const emmcSize = extractTrailingSize(args.emmc);
  const ddrSize = extractTrailingSize(args.ddr);

  if (emmcSize && emmcSize !== pair.emmc) {
    reasons.push('flash EMMC 不匹配');
    mismatches.push({ targetFieldId: 'emmc', reason: 'flash EMMC 不匹配' });
  }
  if (ddrSize && ddrSize !== pair.ddr) {
    reasons.push('flash DDR 不匹配');
    mismatches.push({ targetFieldId: 'ddr', reason: 'flash DDR 不匹配' });
  }

  return { ok: reasons.length === 0, reasons, mismatches };
}
```

Test changes (step4ValidationRules.test.ts):
- Delete the 4 unfilled `it` blocks: `treats empty emmc as unfilled`, `treats empty ddr as unfilled`, `treats whitespace-only emmc as unfilled`, `reports both emmc and ddr as unfilled when both are empty` (lines 93-150)
- In the 3 remaining mismatch `it` blocks (emmc-only / ddr-only / both), drop `kind: 'mismatch'` from the expected `mismatches` array
- Add **1 new test**: `skips emmc when empty, only reports ddr mismatch` — confirms the new empty-skip behavior with a real mismatch
- Add **1 new test**: `returns no mismatches when both emmc and ddr are empty` — confirms silent skip

### Stream B: `step4StorageValidationResults.ts` + its test

```ts
// step4StorageValidationResults.ts — replace the entire file content with:

import type { ValidationResult } from '../types';
import type { StorageMismatch } from './step4ValidationRules';

type StorageValidationResult = {
  ok: boolean;
  reasons: string[];
  mismatches: StorageMismatch[];
};

export function buildStep4StorageValidationResults(args: {
  skuId: string;
  supplyId: string;
  prefix: string;
  storage: string;
  validationResult: StorageValidationResult;
}): ValidationResult[] {
  const { skuId, supplyId, prefix, storage, validationResult } = args;

  if (validationResult.ok) {
    return [
      {
        id: `RULE-STORAGE-${skuId}-${supplyId}`,
        title: '存储核验通过',
        detail: `${prefix}存储与 flash EMMC/flash DDR 匹配。`,
        amReference: 'Rule-2',
        level: 'pass',
        fieldId: 'storage',
        skuId,
        supplyId,
      },
    ];
  }

  if (validationResult.mismatches.length === 0) {
    return [
      {
        id: `RULE-STORAGE-${skuId}-${supplyId}`,
        title: '存储配置冲突',
        detail: `${prefix}存储(${storage})与${validationResult.reasons.join('、')}冲突。`,
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        skuId,
        supplyId,
      },
    ];
  }

  return validationResult.mismatches.map((mismatch) => ({
    id: `RULE-STORAGE-${skuId}-${supplyId}-${mismatch.targetFieldId}`,
    title: mismatch.targetFieldId === 'emmc' ? '存储与 flash EMMC 冲突' : '存储与 flash DDR 冲突',
    detail: `${prefix}存储(${storage})与${mismatch.reason}冲突。`,
    amReference: 'Rule-2',
    level: 'error',
    fieldId: 'storage',
    targetFieldId: mismatch.targetFieldId,
    skuId,
    supplyId,
  }));
}
```

Test changes (step4StorageValidationResults.test.ts):
- Delete the 1 unfilled card `it` block `returns an unfilled card for emmc kind=unfilled` (lines 157-184)
- In the 3 remaining mismatch `it` blocks (emmc-only / ddr-only / both), drop `kind: 'mismatch'` from the input `validationResult.mismatches` fixture

---

## Self-Review

### Coverage
- [x] empty emmc → no error (skipped) — covered by new test
- [x] empty ddr → no error (skipped) — covered by new test
- [x] both empty → no error — covered by new test
- [x] emmc mismatch (non-empty) → error — kept existing 1 test
- [x] ddr mismatch (non-empty) → error — kept existing 1 test
- [x] both mismatch (non-empty) → 2 errors — kept existing 1 test
- [x] storage format error → "存储格式错误" — kept existing 1 test
- [x] all match → pass card — kept existing 1 test

### Placeholder scan
- No "TBD" / "TODO" / "fill in details"
- Each task has concrete code blocks
- Each task has verification step (test / lint / build)

### Type consistency
- `StorageMismatch` shape: `{ targetFieldId, reason }` — no `kind`
- `validateStorageAgainstComponents` return type: `mismatches: StorageMismatch[]`
- `buildStep4StorageValidationResults` input: `validationResult.mismatches: StorageMismatch[]` (now without `kind`)
- `App.tsx` continues to call `buildStep4StorageValidationResults` with the same shape it returns from `validateStorageAgainstComponents` — no change in App.tsx

### Known risks
- None: pure subtraction, every deleted line lives in git history
- App.tsx / Sidebar / types never read `kind`, so removing the type has no downstream effect
