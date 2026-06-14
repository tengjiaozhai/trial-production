# Step 3-5 Insert-Supply: Stop Auto-Switching `selectedSupplyKey`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 "Step 3 选中 B1 → 在 B1 左侧新增一列 → 切到 Step 4 后 B1 丢失" 的 bug。根因是 `insertDynamicSupply` 在 Step 3+ 下自动把 `selectedSupplyKey` 切到新插入的 supply，导致 Step 4 投影时 anchor 被过滤。

**Architecture:** 单一职责拆分。`insertDynamicSupply` 只做"插入新 supply 到指定位置"，不再附带 "切 selectedSupplyKey" 副作用；`App.tsx` 的 `handleStructureColumnInsert` 不需要任何变更，因为函数不切 selectedSupplyKey，自然保持 anchor 选中。

**Tech Stack:** React 19 + TypeScript 5.8 + Vitest

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `frontend/src/lib/dynamicStructure.ts:40-44` | `insertDynamicSupply` 函数；删除 `selectedSupplyKey` 自动切换那一行 |
| `frontend/src/lib/dynamicStructure.test.ts:79-91` | 反转 Step 3+ 测试断言（bug 行为 → 正确行为） |

### Files NOT Modified

- `frontend/src/App.tsx:1066` — `handleStructureColumnInsert` 不需要改（依赖 `insertDynamicSupply` 的副作用已移除）
- `frontend/src/components/TrialProductionSheet.tsx` — Univer 端不动
- 所有 e2e / 行为测试 — 与 `selectedSupplyKey` 切换无关

---

## Task 1: Write Failing Test (Red)

**Files:**
- Modify: `frontend/src/lib/dynamicStructure.test.ts`

- [ ] **Step 1: Read the current test to confirm exact line numbers**

Run: `grep -n "switches selectedSupplyKey\|keeps the current selectedSupplyKey" frontend/src/lib/dynamicStructure.test.ts`
Expected: shows L79 and L93.

- [ ] **Step 2: Update L79-91 to assert the CORRECT behavior (no auto-switch in Step 3+)**

Edit `frontend/src/lib/dynamicStructure.test.ts` lines 79-91.

Change from:
```ts
  it('switches selectedSupplyKey to the inserted supply from step 3 onward', () => {
    const sku = makeSku();

    const result = insertDynamicSupply({
      sku,
      afterSupplyId: 'sup-2',
      currentStep: 4,
      newSupplyId: 'sup-3',
      newSupplyKey: '三供',
    });

    expect(result.selectedSupplyKey).toBe('三供');
  });
```

To:
```ts
  it('keeps the current selectedSupplyKey when inserting a new supply from step 3 onward', () => {
    const sku = makeSku();

    const result = insertDynamicSupply({
      sku,
      afterSupplyId: 'sup-2',
      currentStep: 4,
      newSupplyId: 'sup-3',
      newSupplyKey: '三供',
    });

    expect(result.selectedSupplyKey).toBe('一供');
  });
```

- [ ] **Step 3: Run the test to verify it FAILS (red)**

Run: `cd frontend && npm run test -- src/lib/dynamicStructure.test.ts 2>&1 | tail -15`
Expected: `switches selectedSupplyKey to the inserted supply from step 3 onward` fails (since we renamed the test to assert the opposite). The new test `keeps the current selectedSupplyKey when inserting a new supply from step 3 onward` also fails because the current implementation DOES switch.

- [ ] **Step 4: Commit (TDD red)**

```bash
git add frontend/src/lib/dynamicStructure.test.ts
git commit -m "test(dynamicStructure): assert insert does not auto-switch selectedSupplyKey"
```

---

## Task 2: Remove the Auto-Switch (Green)

**Files:**
- Modify: `frontend/src/lib/dynamicStructure.ts:40-44`

- [ ] **Step 1: Read the function to confirm exact line numbers**

Run: `grep -n "selectedSupplyKey\|return normalizeSelectedSupplyKey" frontend/src/lib/dynamicStructure.ts`
Expected: shows L40-44.

- [ ] **Step 2: Remove the `selectedSupplyKey` override line**

Edit `frontend/src/lib/dynamicStructure.ts` lines 40-44.

Change from:
```ts
  return normalizeSelectedSupplyKey({
    ...args.sku,
    selectedSupplyKey: args.currentStep >= 3 ? args.newSupplyKey : args.sku.selectedSupplyKey,
    supplies: nextSupplies,
  });
```

To:
```ts
  return normalizeSelectedSupplyKey({
    ...args.sku,
    supplies: nextSupplies,
  });
```

The `selectedSupplyKey` now flows through `...args.sku` (unchanged from input), so anchor selection is preserved.

- [ ] **Step 3: Run the test to verify it PASSES (green)**

Run: `cd frontend && npm run test -- src/lib/dynamicStructure.test.ts 2>&1 | tail -10`
Expected: All 7 tests pass (4 original + 2 from the new test name + 1 other).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/dynamicStructure.ts
git commit -m "fix(dynamicStructure): stop auto-switching selectedSupplyKey on insert"
```

---

## Task 3: Full Test Suite + Lint

**Files:** None

- [ ] **Step 1: Run full test suite**

Run: `cd frontend && npm run test 2>&1 | tail -5`
Expected: `341/341 passed` (same as before, no regressions).

- [ ] **Step 2: Run type check**

Run: `cd frontend && npm run lint 2>&1 | tail -3`
Expected: 0 errors.

---

## Task 4: Write ADR

**Files:**
- Modify: `docs/dev-memory/decisions.md`

- [ ] **Step 1: Append the ADR entry**

Append this block to `docs/dev-memory/decisions.md`:

```markdown
## 2026-06-13 - 修复 Step 3+ 插入新 supply 时 selectedSupplyKey 自动丢失 anchor
- 背景：Step 3 选中 B1 → 在 B1 左侧新增一列 aa1 → 切到 Step 4 后 B1 丢失，只剩 aa1
- 根因：`dynamicStructure.ts:insertDynamicSupply` 在 Step 3+ 下自动把 `selectedSupplyKey` 切到新插入的 supply；Step 4 投影（`supplyProjection.ts:projectSkuForStep`）按 selectedSupplyKey 过滤，导致 anchor 被丢弃
- 决策：`insertDynamicSupply` 改为单一职责 — 只做"插入新 supply"，不再附带 selectedSupplyKey 切换副作用；调用方按需显式控制切换
- 函数 invariant：`insertDynamicSupply` 不再修改 `selectedSupplyKey`，新 supply 插入后 anchor 仍保持选中
- 测试：`dynamicStructure.test.ts` "switches selectedSupplyKey to the inserted supply from step 3 onward" 反转为 "keeps the current selectedSupplyKey when inserting a new supply from step 3 onward"
- 业务影响：用户在 Step 3+ 选中 anchor 后点"插入列"，anchor 保持选中；切到 Step 4 看到 anchor 而不是新列；新列需要用户主动切到才能编辑
- 兼容性：与 `App.tsx:handleStructureColumnInsert` 的现有调用无冲突；现有 `dynamicStructure.test.ts` 7 个用例全过
```

- [ ] **Step 2: Commit**

```bash
git add docs/dev-memory/decisions.md
git commit -m "docs: add ADR for step 3-5 insert-supply selectedSupplyKey fix"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Run lint + tests one more time**

Run: `cd frontend && npm run lint 2>&1 | tail -3 && echo "===" && npm run test 2>&1 | tail -5`
Expected: lint 0 errors; tests 341/341 passed.

- [ ] **Step 2: View the diff summary**

Run: `git log --oneline -3 && echo "---" && git diff 267310d..HEAD --stat`
Expected: shows 2 commits (Task 1 + Task 4) on top of `267310d`, plus 1 commit for ADR.

---

## Self-Review

**1. Spec coverage:**
- ✅ Bug 根因（`insertDynamicSupply` 自动切 selectedSupplyKey）— 修复
- ✅ Step 4 投影行为不变（`projectSkuForStep` 不动）— 不需改
- ✅ Step 2 行为不变（原本就 `currentStep < 3` 不切，删后无差异）— 测试不需改
- ✅ 反向测试断言更新（"switches" → "keeps"）— 1 个测试

**2. Placeholder scan:** No "TBD" / "TODO" / placeholders.

**3. Type consistency:** `normalizeSelectedSupplyKey` 的输入类型 `args.sku` 已有 `selectedSupplyKey` 字段，spread 时透传，类型不变。

**4. Boundary cases:**
- `currentStep < 3` (Step 2): `...args.sku.selectedSupplyKey` 保持原值 — 与原行为一致
- `currentStep >= 3` (Step 3+): `...args.sku.selectedSupplyKey` 保持原值 — **修复**（原行为自动切到新 supply）
- `selectedSupplyKey` 在新 supply 列表中不存在：`normalizeSelectedSupplyKey` 已有兜底逻辑（fallback to `supplies[0]?.supplyKey ?? ''`）— 不变

**5. Risk assessment:** **Low**. Single-line removal + 1 test reversal. No signature change. No downstream impact on `App.tsx` (it was passing `currentStep` parameter which is now unused — but TS will still accept it; the parameter remains in the signature for future use).
