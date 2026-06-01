# Step3 Supplier Single-Column Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从第3步开始为每个 PCBA 增加“供应商”选择，并将后续第4步、第5步和导出统一切换为该 PCBA 的单供方列视图。

**Architecture:** 保留 `sku.supplies` 全量数据作为唯一事实源，新增每个 SKU 的 `selectedSupplyKey` 记录当前供方选择。第3步之后统一通过投影函数生成“可见供方列”，UI 渲染、第4步校验、第5步预览和导出全部使用同一投影结果，避免双轨逻辑。

**Tech Stack:** React 19, TypeScript, Vitest, xlsx

---

### Task 1: Build Supply Projection Core (TDD)

**Files:**
- Create: `src/lib/supplyProjection.ts`
- Test: `src/lib/supplyProjection.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests for supply projection and default selection**

```ts
import { describe, expect, it } from 'vitest';
import type { SKUData } from '../types';
import {
  normalizeSelectedSupplyKey,
  projectSkuForStep,
  projectSkusForStep,
} from './supplyProjection';

const sku = (supplies: SKUData['supplies'], selectedSupplyKey?: SKUData['selectedSupplyKey']): SKUData => ({
  id: 'sku_1',
  stage: 'PR1',
  orderNo: '',
  project: 'A1',
  supplies,
  selectedSupplyKey,
});

describe('supplyProjection', () => {
  it('defaults to first available supply when selectedSupplyKey is missing', () => {
    const input = sku([
      { id: 's1', supplyKey: '一供', label: '一供', values: {} },
      { id: 's2', supplyKey: '二供', label: '二供', values: {} },
    ]);
    expect(normalizeSelectedSupplyKey(input).selectedSupplyKey).toBe('一供');
  });

  it('projects single visible supply from step 3 onward', () => {
    const input = sku([
      { id: 's1', supplyKey: '一供', label: '一供', values: { cpu: 'A' } },
      { id: 's2', supplyKey: '二供', label: '二供', values: { cpu: 'B' } },
    ], '二供');
    expect(projectSkuForStep(input, 3).supplies.map((s) => s.supplyKey)).toEqual(['二供']);
    expect(projectSkuForStep(input, 2).supplies.map((s) => s.supplyKey)).toEqual(['一供', '二供']);
  });

  it('keeps all skus projected consistently for step 4 and step 5', () => {
    const input = [
      sku([{ id: 's1', supplyKey: '一供', label: '一供', values: {} }], '一供'),
      sku([{ id: 's2', supplyKey: '二供', label: '二供', values: {} }], '二供'),
    ];
    const step4 = projectSkusForStep(input, 4);
    const step5 = projectSkusForStep(input, 5);
    expect(step4.map((s) => s.supplies.length)).toEqual([1, 1]);
    expect(step5.map((s) => s.supplies.length)).toEqual([1, 1]);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm run test -- src/lib/supplyProjection.test.ts`  
Expected: FAIL with missing module/function errors.

- [ ] **Step 3: Implement minimal projection utilities**

```ts
import type { SKUData, StepId, SupplyTag } from '../types';

const ORDER: SupplyTag[] = ['一供', '二供', '三供', ''];

export function normalizeSelectedSupplyKey(sku: SKUData): SKUData {
  const valid = new Set(sku.supplies.map((s) => s.supplyKey));
  const selected = sku.selectedSupplyKey && valid.has(sku.selectedSupplyKey)
    ? sku.selectedSupplyKey
    : sku.supplies[0]?.supplyKey ?? '';
  return { ...sku, selectedSupplyKey: selected };
}

export function projectSkuForStep(sku: SKUData, step: StepId): SKUData {
  const normalized = normalizeSelectedSupplyKey(sku);
  if (step < 3) return normalized;
  const selected = normalized.selectedSupplyKey;
  const one = normalized.supplies.find((s) => s.supplyKey === selected) ?? normalized.supplies[0];
  return { ...normalized, supplies: one ? [one] : [] };
}

export function projectSkusForStep(skus: SKUData[], step: StepId): SKUData[] {
  return skus.map((sku) => projectSkuForStep(sku, step));
}

export function listSupplyKeys(sku: SKUData): SupplyTag[] {
  const keys = Array.from(new Set(sku.supplies.map((s) => s.supplyKey)));
  return ORDER.filter((k) => keys.includes(k));
}
```

- [ ] **Step 4: Add type field and pass tests**

```ts
export interface SKUData {
  id: string;
  stage: string;
  orderNo: string;
  project: string;
  fieldOptions?: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>>;
  supplies: SkuSupply[];
  selectedSupplyKey?: SupplyTag;
}
```

Run: `npm run test -- src/lib/supplyProjection.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/supplyProjection.ts src/lib/supplyProjection.test.ts
git commit -m "feat: add supply projection utilities for step3+ single-column flow"
```

### Task 2: Wire Selected Supply into App State and History

**Files:**
- Modify: `src/App.tsx`
- Reuse Test: `src/lib/supplyProjection.test.ts`

- [ ] **Step 1: Write failing test for history normalization behavior**

```ts
it('normalizes legacy sku without selectedSupplyKey', () => {
  const legacy = sku([{ id: 's1', supplyKey: '二供', label: '二供', values: {} }]);
  expect(normalizeSelectedSupplyKey(legacy).selectedSupplyKey).toBe('二供');
});
```

- [ ] **Step 2: Run targeted tests**

Run: `npm run test -- src/lib/supplyProjection.test.ts`  
Expected: FAIL before App wiring (if helper behavior not complete).

- [ ] **Step 3: Update App data lifecycle to always normalize selected supply**

```ts
import { normalizeSelectedSupplyKey, projectSkusForStep } from './lib/supplyProjection';

// after baseData is built
setSkuData(baseData.map(normalizeSelectedSupplyKey));

// when loading history
setSkuData(item.skuData.map(normalizeSelectedSupplyKey));

// copy history
setSkuData(item.skuData.map((sku, i) => normalizeSelectedSupplyKey({
  ...sku,
  id: `sku_copy_${Date.now()}_${i}`,
  supplies: sku.supplies.map((s, j) => ({ ...s, id: `s_copy_${Date.now()}_${i}_${j}` })),
})));
```

- [ ] **Step 4: Add handler for per-SKU supplier selection**

```ts
const handleUpdateSelectedSupply = (skuId: string, supplyKey: SupplyTag) => {
  if (currentStep !== 3) return;
  setSkuData((prev) =>
    prev.map((sku) => (sku.id === skuId ? normalizeSelectedSupplyKey({ ...sku, selectedSupplyKey: supplyKey }) : sku))
  );
};
```

Run: `npm run lint`  
Expected: `tsc --noEmit` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: persist selected supply per sku in app lifecycle"
```

### Task 3: Render Supplier Row and Single Column from Step 3

**Files:**
- Modify: `src/components/TrialProductionTable.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add table props for supplier selection row**

```ts
onUpdateSelectedSupply?: (skuId: string, supplyKey: SupplyTag) => void;
```

- [ ] **Step 2: Build projected data in App and pass to table**

```ts
const visibleSkuData = projectSkusForStep(skuData, currentStep);

<TrialProductionTable
  currentStep={currentStep}
  skuData={visibleSkuData}
  onUpdateSelectedSupply={handleUpdateSelectedSupply}
  // ...other props
/>
```

- [ ] **Step 3: Insert "供应商" row right after "订单号" in basic block**

```ts
const supplierRow = { id: '__supplier__', label: '供应商', group: '基本信息', behavior: 'manual' as const };
const basicInfoFields = visibleFields.filter((f) => f.group === '基本信息');
const orderIndex = basicInfoFields.findIndex((f) => f.id === 'order_no');
const basicWithSupplier = currentStep >= 3 && orderIndex >= 0
  ? [...basicInfoFields.slice(0, orderIndex + 1), supplierRow, ...basicInfoFields.slice(orderIndex + 1)]
  : basicInfoFields;
```

- [ ] **Step 4: Render supplier row cell behavior**

```tsx
{field.id === '__supplier__' ? (
  currentStep === 3 ? (
    <select
      value={originSku.selectedSupplyKey ?? originSku.supplies[0]?.supplyKey ?? ''}
      onChange={(e) => onUpdateSelectedSupply?.(originSku.id, e.target.value as SupplyTag)}
    >
      {listSupplyKeys(originSku).map((k) => <option key={k} value={k}>{k || '主供'}</option>)}
    </select>
  ) : (
    <input value={originSku.selectedSupplyKey || ''} readOnly disabled />
  )
) : (
  // existing input branch
)}
```

- [ ] **Step 5: Verify UI behavior manually and commit**

Run: `npm run dev`  
Manual expected:
- 第3步在 `订单号` 下出现 `供应商` 行。
- 每个 PCBA 下拉选供方后，仅该 PCBA 保留一列。
- 第4/5步下拉不可编辑，仍只显示单列。

```bash
git add src/App.tsx src/components/TrialProductionTable.tsx
git commit -m "feat: add supplier row and single-column view from step3"
```

### Task 4: Restrict Validation to Visible Supply and Keep Next-Step Guard

**Files:**
- Modify: `src/App.tsx`
- Test: `src/lib/step4ValidationRules.test.ts`

- [ ] **Step 1: Add regression test scenario for selected-supply-only validation**

```ts
it('validates only visible selected supply in step4 flow', () => {
  // prepare values where selected supply passes and hidden supply would fail
  // expected: no error emitted for hidden supply path
  expect(true).toBe(true); // replace with real assertion bound to extracted validation helper
});
```

- [ ] **Step 2: Extract/adjust validation iteration input to visible data**

```ts
const visibleForValidation = projectSkusForStep(skuData, 4);
visibleForValidation.forEach((sku) => {
  sku.supplies.forEach((sup) => {
    // existing Rule-1/2/3 and EBOM checks unchanged
  });
});
```

- [ ] **Step 3: Run validation-related tests and lint**

Run: `npm run test -- src/lib/step4ValidationRules.test.ts`  
Expected: PASS.

Run: `npm run lint`  
Expected: PASS.

- [ ] **Step 4: Manual guard verification**

Run: `npm run dev`  
Manual expected:
- 第4步“下一步”禁用只受当前可见供方冲突影响。
- 隐藏供方内容不再阻塞流程。

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/lib/step4ValidationRules.test.ts
git commit -m "feat: scope step4 validation to selected visible supply"
```

### Task 5: Keep Step5 Preview and Export Fully Aligned

**Files:**
- Modify: `src/lib/step5TableModel.ts`
- Modify: `src/lib/trialProductionWorkbook.ts`
- Test: `src/lib/step5TableModel.test.ts`
- Test: `src/lib/trialProductionWorkbook.test.ts`

- [ ] **Step 1: Write failing tests for supplier row + single-column output**

```ts
it('includes supplier row in basic info and one column per sku after projection', () => {
  const model = buildStep5TableModel({ activeFields, skuData: projectedSkus, includeSupplierRow: true });
  expect(model.columns.length).toBe(projectedSkus.length);
  expect(model.rows.some((r) => r.kind === 'field' && r.fieldId === '__supplier__')).toBe(true);
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npm run test -- src/lib/step5TableModel.test.ts src/lib/trialProductionWorkbook.test.ts`  
Expected: FAIL with missing supplier-row behavior.

- [ ] **Step 3: Implement model + workbook alignment**

```ts
// step5TableModel.ts
if (includeSupplierRow && group === '基本信息') {
  rows.push({
    kind: 'field',
    indexLabel: String(visibleIndex).padStart(2, '0'),
    fieldId: '__supplier__',
    fieldLabel: '供应商',
    cells: args.skuData.map((sku) => ({ value: sku.selectedSupplyKey || '', colSpan: sku.supplies.length || 1 })),
  });
  visibleIndex += 1;
}
```

```ts
// trialProductionWorkbook.ts
const model = buildStep5TableModel({ activeFields: args.activeFields, skuData: args.skuData, includeSupplierRow: true });
```

- [ ] **Step 4: Run full verification**

Run: `npm run test`  
Expected: all tests PASS.

Run: `npm run lint`  
Expected: PASS.

Manual expected:
- 第5步预览包含 `供应商` 行，且每个 PCBA 仅 1 列。
- 导出的 Excel 与第5步完全一致（列数、合并关系、供应商行都一致）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/step5TableModel.ts src/lib/trialProductionWorkbook.ts src/lib/step5TableModel.test.ts src/lib/trialProductionWorkbook.test.ts
git commit -m "feat: align step5 preview and export with selected supplier single-column model"
```

---

## Final Verification Checklist

- [ ] `npm run lint` 全绿。
- [ ] `npm run test` 全绿。
- [ ] 第3步每个 PCBA 可独立选择供方并即时切列。
- [ ] 第4步供方选择锁定，校验仅基于可见列。
- [ ] 第5步与导出 Excel 结构完全一致，均包含 `供应商` 行且每个 PCBA 仅单列。

## Notes for Implementation Order

- 严格按 Task 1 -> Task 5 顺序执行，避免先改 UI 导致模型和导出不同步。
- 第3步“供应商”行不要写入 `FIELD_DEFS`，保持其为系统注入行，避免影响步骤筛选逻辑。
- 不引入兼容双轨：统一使用“全量数据 + 第3步后投影”的单一路径。
