# Step 3-5 Insert-Column "After-Anchor" Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Step 3-5 的"插入列"操作在业务层统一为"总是插入到 anchor 之后"（忽略 Univer `Direction.LEFT/RIGHT` 差异），Step 2 保持现状（`Direction.LEFT`=挤占 anchor 左侧、`Direction.RIGHT`=anchor 之后）。

**Architecture:** 单一职责、源头区分。在 `App.tsx:handleStructureColumnInsert` 的 `afterSupplyId` 映射处加 `currentStep >= 3` 三元判断。`insertDynamicSupply` 函数、`TrialProductionSheet.tsx` Univer 端、所有现有测试均不动。

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6 + Vitest

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `frontend/src/App.tsx:1075-1079` | `handleStructureColumnInsert` callback；在 `afterSupplyId` 计算处加 step 区分 |
| `docs/dev-memory/decisions.md` | 新增 ADR 条目记录本决策 |

### Files NOT Modified

- `frontend/src/components/TrialProductionSheet.tsx` — Univer 端保持 step-agnostic
- `frontend/src/lib/dynamicStructure.ts` — `insertDynamicSupply` 签名/行为不变
- `frontend/src/lib/dynamicStructure.test.ts` — 4 个现有用例继续保护 Step 2 行为
- `frontend/src/components/TrialProductionSheet.behavior.test.tsx` — 现有 `currentStep: 3` + `position: 'after'` 链路测试继续保护
- `frontend/src/components/TrialProductionSheet.test.tsx` — 不动
- `frontend/src/lib/step5ColumnAlignment.e2e.test.ts` — 不动

### Test Strategy

**策略 A（默认）：0 新增测试**。理由：
- `insertDynamicSupply` 函数行为不变，4 个 `dynamicStructure.test.ts` 用例继续保护 Step 2/4 行为
- `behavior.test.tsx` 现有 `currentStep: 3` + `position: 'after'` 测试继续保护 Step 3+ `after` 链路
- 改动面最小、回归风险低、与现有 step-aware 模式（`handleUpdateSelectedSupply` 守卫）一致
- 唯一缺口是 "Step 3 + position=before" 无直接断言，但 `currentStep >= 3` 三元表达式极简单（一行），代码 review 即可保证

---

## Task 1: Modify `afterSupplyId` Mapping in `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx:1075-1079`

- [ ] **Step 1: Read the current `handleStructureColumnInsert` callback to confirm exact lines**

Run: `grep -n "afterSupplyId" frontend/src/App.tsx`
Expected: shows the exact lines around 1075-1079. Confirm we're editing the right block.

- [ ] **Step 2: Apply the edit**

Edit `frontend/src/App.tsx` lines 1075-1079.

Change from:
```ts
        const afterSupplyId =
          payload.position === 'before'
            ? (anchorIndex > 0 ? sku.supplies[anchorIndex - 1]?.id : undefined)
            : payload.anchorSupplyId;
```

To:
```ts
        const afterSupplyId =
          currentStep >= 3
            ? payload.anchorSupplyId
            : payload.position === 'before'
              ? (anchorIndex > 0 ? sku.supplies[anchorIndex - 1]?.id : undefined)
              : payload.anchorSupplyId;
```

The new structure: outer ternary is `currentStep >= 3` (Step 3-5 always uses `anchor` itself → splice to `insertAfterIndex + 1` = after anchor). The inner ternary (Step 2 branch) preserves the original before/after mapping.

- [ ] **Step 3: Verify the file diff is exactly as expected**

Run: `git diff frontend/src/App.tsx`
Expected: 1 block changed, +4 -1 lines (the new ternary adds 3 new lines, replaces 2 existing ones with 4).

The final code in context should look like:
```ts
      setSkuData((prev) =>
        prev.map((sku) => {
          if (sku.id !== payload.anchorSkuId) return sku;

          const anchorIndex = sku.supplies.findIndex((supply) => supply.id === payload.anchorSupplyId);
          const afterSupplyId =
            currentStep >= 3
              ? payload.anchorSupplyId
              : payload.position === 'before'
                ? (anchorIndex > 0 ? sku.supplies[anchorIndex - 1]?.id : undefined)
                : payload.anchorSupplyId;
          // ... rest unchanged
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "refactor(insert-column): step 3-5 always insert after anchor"
```

---

## Task 2: Run All Tests (Verify Zero Regressions)

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd frontend && npm run test 2>&1 | tail -10`
Expected:
```
 Test Files  31 passed (31)
      Tests  335 passed (335)
```

The 335 count is unchanged from the post-step5-column-alignment state. No regressions expected because:
- `dynamicStructure.test.ts` 4 cases test `insertDynamicSupply` which is **not modified**
- `behavior.test.tsx` `currentStep: 3` + `position: 'after'` test still uses the same `after` mapping in App.tsx
- Step 2 behavior tests still pass (the new `currentStep >= 3 ? : payload.position === 'before' ? : ...` falls through to the original logic when `currentStep === 2`)

- [ ] **Step 2: Run type check**

Run: `cd frontend && npm run lint 2>&1 | tail -3`
Expected: no output (0 errors). The change is a pure addition of nested ternary; no type signatures changed.

- [ ] **Step 3: Commit (only if any test or type error was found and fixed)**

If any issue, fix it and amend. If clean (expected), skip — there's nothing to commit.

---

## Task 3: Write ADR for the Decision

**Files:**
- Modify: `docs/dev-memory/decisions.md` (append a new ADR)

- [ ] **Step 1: Read the end of `decisions.md` to confirm format**

Run: `tail -10 docs/dev-memory/decisions.md`
Expected: shows the last ADR (the step5 column alignment one from earlier today) following the date-prefixed bullet format.

- [ ] **Step 2: Append the new ADR entry**

Append this block to `docs/dev-memory/decisions.md`:

```markdown
## 2026-06-13 - Step 3-5 新增列"单独成列"语义
- 现状：所有 step 共用同一段 before/after 位置逻辑（`App.tsx:handleStructureColumnInsert` 的 `afterSupplyId` 计算）
- 决策：Step 2 保持 `before=挤占 anchor 左侧`、`after=anchor 之后`；Step 3-5 统一为"所有插入都到 anchor 之后"（`before` 与 `after` 业务层等价）
- 实现：`App.tsx` 的 `afterSupplyId` 映射加 `currentStep >= 3` 三元判断
- Univer 端不动：`TrialProductionSheet.tsx` 仍 step-agnostic，方向（`Direction.LEFT/RIGHT`）由 Univer 命令层区分，业务层统一映射
- 函数 invariant：`insertDynamicSupply` 签名/行为不变；`dynamicStructure.test.ts` 4 个用例不变
- 测试策略 A：0 新增测试；靠 `dynamicStructure.test.ts`（Step 2 行为）+ `behavior.test.tsx`（Step 3+`after` 链路）守护
- 业务影响：Step 3-5 用户点"左侧插入列"现在等价于"右侧插入列"，新列永远追加在 anchor 之后；anchor 保持原位
```

- [ ] **Step 3: Commit**

```bash
git add docs/dev-memory/decisions.md
git commit -m "docs: add ADR for step 3-5 insert-column after-anchor semantics"
```

---

## Task 4: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint + tests one more time**

Run: `cd frontend && npm run lint 2>&1 | tail -3 && echo "===" && npm run test 2>&1 | tail -6`
Expected:
- Lint: no output (0 errors)
- Tests: `31 passed`, `335 passed`

- [ ] **Step 2: View the full diff summary**

Run: `git diff 0b255c5..HEAD --stat 2>&1 | tail -15` (or whichever commit was the base of the post-step5 work)
Expected: shows the post-step5 work + the new 3 commits (this plan's 3 commits: refactor App.tsx, maybe amend, ADR).

- [ ] **Step 3: Verify no unintended files changed**

Run: `git status`
Expected: clean working tree, no untracked files (except possibly the untracked `docs/superpowers/plans/2026-06-13-step5-column-alignment.md` and `runtime-perf-fixes.md` from earlier work, which are fine to leave as untracked).

- [ ] **Step 4: Report completion**

The plan is complete. Report to the user:
- 3 commits added (Task 1 refactor + Task 3 ADR; Task 2 only commits if a fix was needed)
- 2 files changed: `frontend/src/App.tsx` (+3 net lines), `docs/dev-memory/decisions.md` (+10 lines)
- 335/335 tests still pass
- 0 lint errors
- 0 new tests added (Strategy A)

---

## Self-Review

**1. Spec coverage:**
- ✅ Step 2 behavior preserved — covered by `dynamicStructure.test.ts` existing tests
- ✅ Step 3-5 "insert after anchor" implemented — covered by the new ternary
- ✅ `insertDynamicSupply` function invariant maintained — not touched
- ✅ Univer endpoint unchanged — not touched
- ✅ ADR documents the decision — Task 3

**2. Placeholder scan:** No "TBD" / "TODO" / "similar to Task N" patterns. Every step has concrete code or commands.

**3. Type consistency:** No type changes; `afterSupplyId` is still `string | undefined`, same as before. `currentStep` is already in the `useCallback` dependency array (`}, [currentStep]);`), so no dep change needed.

**4. Boundary cases considered:**
- `anchorIndex === 0` (anchor is first supply) + Step 3 + `position: 'before'`: `afterSupplyId = anchor` (supplies[0]), splice to index 1 → new supply at index 1, anchor at 0. ✓
- `anchorIndex === supplies.length - 1` (anchor is last) + Step 3 + `position: 'before'`: `afterSupplyId = anchor` (last), splice to last+1 = length → new supply appended at end. ✓
- Step 2 + `anchorIndex === 0` + `position: 'before'`: `afterSupplyId = undefined`, fallbackIndex = length-1, splice to length → new supply appended at end (preserves original behavior). ✓
- Step 5 + insert command: `currentStep=5 >= 3` → goes through the new branch. Read-only mode normally prevents this trigger, but if invoked, behavior is consistent with Step 3-4. ✓

**5. Risk assessment:** Low. Pure addition of a ternary in one location. No interface changes, no type changes, no dependency array changes. Existing 335 tests must continue to pass.
