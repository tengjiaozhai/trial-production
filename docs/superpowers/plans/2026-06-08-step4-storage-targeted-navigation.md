# Step 4 Storage Targeted Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让第 4 步的 Rule-2 存储冲突按目标单元格定向跳转：flash EMMC 冲突跳到 `emmc`，flash DDR 冲突跳到 `ddr`，两者同时冲突时拆成两条卡。

**Architecture:** 保留 `validateStorageAgainstComponents()` 作为唯一的存储判定入口，只在返回值里补充结构化 mismatch 元数据；再用一个纯函数把 mismatch 转成 `ValidationResult` 卡片。`App.tsx` 只负责调用这个纯函数，`Sidebar` 只负责按 `targetFieldId ?? fieldId` 定位，避免在 UI 层解析字符串。现有表格单元格的 `data-step4-cell-id` 已经存在，不需要改表格结构。

**Tech Stack:** React 19, TypeScript, Vitest

---

## 文件结构

- Modify: `src/lib/step4ValidationRules.ts`
- Modify: `src/lib/step4ValidationRules.test.ts`
- Modify: `src/types.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Sidebar.test.tsx`
- Create: `src/lib/step4StorageValidationResults.ts`
- Create: `src/lib/step4StorageValidationResults.test.ts`
- Modify: `src/App.tsx`

### Task 1: 给存储判定返回结构化 mismatch

**Files:**
- Modify: `src/lib/step4ValidationRules.ts:1-35`
- Modify: `src/lib/step4ValidationRules.test.ts:1-90`

- [ ] **Step 1: 先写会失败的测试，锁定 `mismatches` 输出**

```ts
describe('validateStorageAgainstComponents', () => {
  it('returns emmc mismatch metadata when only flash EMMC is wrong', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇64G',
        ddr: '14201579一供三星4G',
      })
    ).toEqual({
      ok: false,
      reasons: ['flash EMMC不匹配'],
      mismatches: [{ targetFieldId: 'emmc', reason: 'flash EMMC不匹配' }],
    });
  });

  it('returns ddr mismatch metadata when only flash DDR is wrong', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇128G',
        ddr: '14201579一供三星6G',
      })
    ).toEqual({
      ok: false,
      reasons: ['flash DDR不匹配'],
      mismatches: [{ targetFieldId: 'ddr', reason: 'flash DDR不匹配' }],
    });
  });

  it('returns both mismatches in emmc then ddr order', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇64G',
        ddr: '14201579一供三星6G',
      })
    ).toEqual({
      ok: false,
      reasons: ['flash EMMC不匹配', 'flash DDR不匹配'],
      mismatches: [
        { targetFieldId: 'emmc', reason: 'flash EMMC不匹配' },
        { targetFieldId: 'ddr', reason: 'flash DDR不匹配' },
      ],
    });
  });

  it('returns no mismatches for a storage format error', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '128G',
        emmc: '14201661一供宏芯宇128G',
        ddr: '14201579一供三星4G',
      })
    ).toEqual({
      ok: false,
      reasons: ['存储格式错误'],
      mismatches: [],
    });
  });
});
```

- [ ] **Step 2: 运行测试，确认它们先失败**

Run:
```bash
npm test -- src/lib/step4ValidationRules.test.ts 2>&1 | head -c 4000
```

Expected:
```text
FAIL: deep-equality mismatch because validateStorageAgainstComponents still only returns { ok, reasons }
```

- [ ] **Step 3: 最小实现，补上 mismatch 元数据**

```ts
export function validateStorageAgainstComponents(args: {
  storage: string;
  emmc: string;
  ddr: string;
}): {
  ok: boolean;
  reasons: string[];
  mismatches: Array<{ targetFieldId: 'emmc' | 'ddr'; reason: string }>;
} {
  const pair = parseStoragePair(args.storage);
  if (!pair) return { ok: false, reasons: ['存储格式错误'], mismatches: [] };

  const reasons: string[] = [];
  const mismatches: Array<{ targetFieldId: 'emmc' | 'ddr'; reason: string }> = [];
  const emmcSize = extractTrailingSize(args.emmc);
  const ddrSize = extractTrailingSize(args.ddr);

  if (!emmcSize || emmcSize !== pair.emmc) {
    reasons.push('flash EMMC不匹配');
    mismatches.push({ targetFieldId: 'emmc', reason: 'flash EMMC不匹配' });
  }

  if (!ddrSize || ddrSize !== pair.ddr) {
    reasons.push('flash DDR不匹配');
    mismatches.push({ targetFieldId: 'ddr', reason: 'flash DDR不匹配' });
  }

  return { ok: reasons.length === 0, reasons, mismatches };
}
```

- [ ] **Step 4: 重新运行该测试文件，确认通过**

Run:
```bash
npm test -- src/lib/step4ValidationRules.test.ts
```

Expected:
```text
PASS
```

- [ ] **Step 5: 提交这一层的规则基线**

```bash
git add src/lib/step4ValidationRules.ts src/lib/step4ValidationRules.test.ts
git commit -m "test: structure step4 storage mismatch output"
```

### Task 2: 让 Step 4 卡片能跳到目标单元格

**Files:**
- Modify: `src/types.ts:172-183`
- Modify: `src/components/Sidebar.tsx:50-60, 208-236`
- Modify: `src/components/Sidebar.test.tsx:148-210`

- [ ] **Step 1: 先写一个会失败的定位测试，覆盖 `targetFieldId`**

```ts
it('scrolls to the emmc cell when targetFieldId is present', () => {
  const target = document.createElement('div');
  target.setAttribute('data-step4-cell-id', 'step4-cell-sku_1-s_1-emmc');
  target.scrollIntoView = vi.fn();
  document.body.appendChild(target);

  const validationResults: ValidationResult[] = [
    {
      id: 'RULE-STORAGE-sku_1-s_1-emmc',
      title: '存储与 flash EMMC 冲突',
      detail: '[X6728 · 一供] 存储(4+128)与flash EMMC不匹配冲突。',
      amReference: 'Rule-2',
      level: 'error',
      fieldId: 'storage',
      targetFieldId: 'emmc',
      skuId: 'sku_1',
      supplyId: 's_1',
    },
  ];

  render(
    <Sidebar
      currentStep={4}
      projectInfo={{ name: 'X6728', customer: '标准', stage: 'EVT', files: [] }}
      skuData={[]}
      validationResults={validationResults}
      onGoBack={() => {}}
      isFlowComplete={false}
      setIsFlowComplete={() => {}}
      onRunValidation={() => {}}
    />
  );

  fireEvent.click(screen.getByText('存储与 flash EMMC 冲突'));

  expect(target.scrollIntoView).toHaveBeenCalledWith({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center',
  });
});
```

Keep the existing fieldId-only step 4 test in the file so fallback behavior stays covered.

- [ ] **Step 2: 运行 Sidebar 测试，确认它先失败**

Run:
```bash
npm test -- src/components/Sidebar.test.tsx 2>&1 | head -c 4000
```

Expected:
```text
FAIL: Sidebar still scrolls by fieldId only, and ValidationResult does not yet accept targetFieldId
```

- [ ] **Step 3: 最小实现，优先使用 `targetFieldId` 做定位**

```ts
export interface ValidationResult {
  id: string;
  title: string;
  detail: string;
  amReference: string;
  level: ValidationLevel;
  fieldId?: string;
  targetFieldId?: SplitOptionFieldId;
  skuId?: string;
  supplyId?: string;
}
```

```ts
const focusFieldId = result.targetFieldId ?? result.fieldId;
if (!focusFieldId || !result.skuId || !result.supplyId) return;

const cellId = `step4-cell-${result.skuId}-${result.supplyId}-${focusFieldId}`;
const cell = document.querySelector<HTMLElement>(`[data-step4-cell-id="${cellId}"]`);
```

Keep the current `fieldId`-based click label condition unless you remove `fieldId` from the emitted cards later; the cards in this plan keep `fieldId: 'storage'`, so the CTA still appears.

- [ ] **Step 4: 重新运行 Sidebar 测试和类型检查**

Run:
```bash
npm test -- src/components/Sidebar.test.tsx
npm run lint
```

Expected:
```text
PASS
```

- [ ] **Step 5: 提交定位模型改动**

```bash
git add src/types.ts src/components/Sidebar.tsx src/components/Sidebar.test.tsx
git commit -m "feat: let step4 validation cards target flash cells"
```

### Task 3: 把 Rule-2 存储冲突拆成单卡或双卡

**Files:**
- Create: `src/lib/step4StorageValidationResults.ts`
- Create: `src/lib/step4StorageValidationResults.test.ts`
- Modify: `src/App.tsx:700-720`

- [ ] **Step 1: 先写 helper 测试，锁定单卡、双卡和格式错误行为**

```ts
describe('buildStorageValidationResults', () => {
  it('returns a pass card when storage matches both components', () => {
    expect(
      buildStorageValidationResults({
        prefix: '[X6728 · 一供] ',
        skuId: 'sku_1',
        supplyId: 's_1',
        storage: '4+128',
        storageCheck: { ok: true, reasons: [], mismatches: [] },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1',
        title: '存储核验通过',
        detail: '[X6728 · 一供] 存储与 flash EMMC/flash DDR 匹配。',
        amReference: 'Rule-2',
        level: 'pass',
        fieldId: 'storage',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('returns one emmc-targeted card when only flash EMMC mismatches', () => {
    expect(
      buildStorageValidationResults({
        prefix: '[X6728 · 一供] ',
        skuId: 'sku_1',
        supplyId: 's_1',
        storage: '4+128',
        storageCheck: {
          ok: false,
          reasons: ['flash EMMC不匹配'],
          mismatches: [{ targetFieldId: 'emmc', reason: 'flash EMMC不匹配' }],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1-emmc',
        title: '存储与 flash EMMC 冲突',
        detail: '[X6728 · 一供] 存储(4+128)与flash EMMC不匹配冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'emmc',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('returns one ddr-targeted card when only flash DDR mismatches', () => {
    expect(
      buildStorageValidationResults({
        prefix: '[X6728 · 一供] ',
        skuId: 'sku_1',
        supplyId: 's_1',
        storage: '4+128',
        storageCheck: {
          ok: false,
          reasons: ['flash DDR不匹配'],
          mismatches: [{ targetFieldId: 'ddr', reason: 'flash DDR不匹配' }],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1-ddr',
        title: '存储与 flash DDR 冲突',
        detail: '[X6728 · 一供] 存储(4+128)与flash DDR不匹配冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'ddr',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('returns emmc then ddr cards when both mismatches exist', () => {
    expect(
      buildStorageValidationResults({
        prefix: '[X6728 · 一供] ',
        skuId: 'sku_1',
        supplyId: 's_1',
        storage: '4+128',
        storageCheck: {
          ok: false,
          reasons: ['flash EMMC不匹配', 'flash DDR不匹配'],
          mismatches: [
            { targetFieldId: 'emmc', reason: 'flash EMMC不匹配' },
            { targetFieldId: 'ddr', reason: 'flash DDR不匹配' },
          ],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1-emmc',
        title: '存储与 flash EMMC 冲突',
        detail: '[X6728 · 一供] 存储(4+128)与flash EMMC不匹配冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'emmc',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
      {
        id: 'RULE-STORAGE-sku_1-s_1-ddr',
        title: '存储与 flash DDR 冲突',
        detail: '[X6728 · 一供] 存储(4+128)与flash DDR不匹配冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'ddr',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('keeps format errors on the storage cell', () => {
    expect(
      buildStorageValidationResults({
        prefix: '[X6728 · 一供] ',
        skuId: 'sku_1',
        supplyId: 's_1',
        storage: '128G',
        storageCheck: {
          ok: false,
          reasons: ['存储格式错误'],
          mismatches: [],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1',
        title: '存储配置冲突',
        detail: '[X6728 · 一供] 存储(128G)与存储格式错误冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });
});
```

- [ ] **Step 2: 运行 helper 测试，确认它先失败**

Run:
```bash
npm test -- src/lib/step4StorageValidationResults.test.ts 2>&1 | head -c 4000
```

Expected:
```text
FAIL: helper module missing or cards still come from the old single-card Rule-2 path
```

- [ ] **Step 3: 最小实现 helper，并把 App 的 Rule-2 分支切过去**

```ts
// src/lib/step4StorageValidationResults.ts
export function buildStorageValidationResults(args: {
  prefix: string;
  skuId: string;
  supplyId: string;
  storage: string;
  storageCheck: ReturnType<typeof validateStorageAgainstComponents>;
}): ValidationResult[] {
  if (args.storageCheck.ok) {
    return [{
      id: `RULE-STORAGE-${args.skuId}-${args.supplyId}`,
      title: '存储核验通过',
      detail: `${args.prefix}存储与 flash EMMC/flash DDR 匹配。`,
      amReference: 'Rule-2',
      level: 'pass',
      fieldId: 'storage',
      skuId: args.skuId,
      supplyId: args.supplyId,
    }];
  }

  if (args.storageCheck.mismatches.length > 0) {
    return args.storageCheck.mismatches.map((mismatch) => ({
      id: `RULE-STORAGE-${args.skuId}-${args.supplyId}-${mismatch.targetFieldId}`,
      title: mismatch.targetFieldId === 'emmc'
        ? '存储与 flash EMMC 冲突'
        : '存储与 flash DDR 冲突',
      detail: `${args.prefix}存储(${args.storage})与${mismatch.reason}冲突。`,
      amReference: 'Rule-2',
      level: 'error',
      fieldId: 'storage',
      targetFieldId: mismatch.targetFieldId,
      skuId: args.skuId,
      supplyId: args.supplyId,
    }));
  }

  return [{
    id: `RULE-STORAGE-${args.skuId}-${args.supplyId}`,
    title: '存储配置冲突',
    detail: `${args.prefix}存储(${args.storage})与${args.storageCheck.reasons.join('、')}冲突。`,
    amReference: 'Rule-2',
    level: 'error',
    fieldId: 'storage',
    skuId: args.skuId,
    supplyId: args.supplyId,
  }];
}
```

```ts
// src/App.tsx
const storageCheck = validateStorageAgainstComponents({ storage, emmc, ddr });
results.push(
  ...buildStorageValidationResults({
    prefix,
    skuId: sku.id,
    supplyId: sup.id,
    storage,
    storageCheck,
  })
);
```

- [ ] **Step 4: 重新运行 helper、Sidebar 和全量检查**

Run:
```bash
npm test -- src/lib/step4StorageValidationResults.test.ts src/components/Sidebar.test.tsx
npm run lint
```

Expected:
```text
PASS
```

If the repo stays green after that, run the full suite once:

```bash
npm test
```

- [ ] **Step 5: 提交最终改动**

```bash
git add src/lib/step4ValidationRules.ts src/lib/step4ValidationRules.test.ts src/types.ts src/components/Sidebar.tsx src/components/Sidebar.test.tsx src/lib/step4StorageValidationResults.ts src/lib/step4StorageValidationResults.test.ts src/App.tsx
git commit -m "feat: split step4 storage conflicts by flash cell"
```

