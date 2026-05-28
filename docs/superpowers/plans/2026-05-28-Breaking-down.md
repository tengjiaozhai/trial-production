# Split Supply Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复“已拆列与新拆列冲突”问题：列按 `一供/二供/三供` 对齐，字段按对应供方填值，匹配不到则留空。  
**Architecture:** 在数据层引入 `supplyKey` 作为唯一匹配键，`label` 仅作“方案名称”展示。列来源改为所有拆列字段供方并集；表格渲染不再展示“整组 options”，而是仅展示当前列的值。旧历史草稿不做迁移，按 fail-fast 处理。  
**Tech Stack:** React 19, TypeScript, Vitest, Vite.

---

### Task 1: 先写失败用例并收敛拆列核心逻辑

**Files:**
- Modify: [src/lib/step4SampleCalc.test.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/step4SampleCalc.test.ts)
- Modify: [src/lib/step4SampleCalc.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/step4SampleCalc.ts)

- [ ] **Step 1: 新增失败测试，锁定目标行为**

```ts
import { describe, expect, it } from 'vitest';
import {
  deriveSupplyColumnsFromFieldOptions,
  buildSupplyValuesForSupplyKey,
} from './step4SampleCalc';

describe('deriveSupplyColumnsFromFieldOptions', () => {
  it('derives columns from all split fields union', () => {
    const columns = deriveSupplyColumnsFromFieldOptions({
      emmc: [
        { supply: '一供', text: 'E1', sourceCategory2: 'EMMC' },
        { supply: '三供', text: 'E3', sourceCategory2: 'EMMC' },
      ],
      battery: [{ supply: '二供', text: 'B2', sourceCategory2: '电池' }],
    } as any);

    expect(columns.map((c) => c.label)).toEqual(['一供', '二供', '三供']);
    expect(columns.map((c) => c.supplyKey)).toEqual(['一供', '二供', '三供']);
  });

  it('falls back to 主供 when no supply tags exist', () => {
    const columns = deriveSupplyColumnsFromFieldOptions({
      pcb: [{ supply: '', text: 'qualcomm', sourceCategory2: 'PCB' }],
    } as any);

    expect(columns).toEqual([{ supplyKey: '', label: '主供' }]);
  });
});

describe('buildSupplyValuesForSupplyKey', () => {
  it('fills only matched supply and leaves unmatched field absent', () => {
    const values = buildSupplyValuesForSupplyKey(
      {
        emmc: [
          { supply: '一供', text: 'E1', sourceCategory2: 'EMMC' },
          { supply: '二供', text: 'E2', sourceCategory2: 'EMMC' },
        ],
        ddr: [{ supply: '一供', text: 'D1', sourceCategory2: 'DDR' }],
      } as any,
      '二供'
    );

    expect(values).toEqual({ emmc: 'E2' });
    expect(values.ddr).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑定向测试，确认失败**

Run:
```bash
npm test -- src/lib/step4SampleCalc.test.ts 2>&1 | head -c 4000
```

Expected: FAIL（旧逻辑仍依赖内部字段，且缺少 `buildSupplyValuesForSupplyKey`）。

- [ ] **Step 3: 最小实现通过测试**

```ts
import type { SplitFieldOption, SupplyTag } from '../types';

const SUPPLY_ORDER: SupplyTag[] = ['一供', '二供', '三供'];

export interface SupplyColumn {
  supplyKey: SupplyTag | '';
  label: string;
}

export function deriveSupplyColumnsFromFieldOptions(
  fieldOptions: Partial<Record<string, SplitFieldOption[]>>
): SupplyColumn[] {
  const supplySet = new Set<SupplyTag>();

  for (const options of Object.values(fieldOptions)) {
    for (const opt of options ?? []) {
      if (opt.supply) supplySet.add(opt.supply);
    }
  }

  const ordered = SUPPLY_ORDER.filter((s) => supplySet.has(s));
  if (ordered.length === 0) return [{ supplyKey: '', label: '主供' }];

  return ordered.map((s) => ({ supplyKey: s, label: s }));
}

export function buildSupplyValuesForSupplyKey(
  fieldOptions: Partial<Record<string, SplitFieldOption[]>>,
  supplyKey: SupplyTag | ''
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [fieldId, options] of Object.entries(fieldOptions)) {
    const hit = (options ?? []).find((o) => o.supply === supplyKey);
    if (hit?.text) values[fieldId] = hit.text;
  }

  return values;
}
```

- [ ] **Step 4: 重跑定向测试，确认通过**

Run:
```bash
npm test -- src/lib/step4SampleCalc.test.ts 2>&1 | head -c 4000
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/lib/step4SampleCalc.ts src/lib/step4SampleCalc.test.ts
git commit -m "test+feat: derive supply columns by split-field union"
```

---

### Task 2: 引入 `supplyKey` 并修正 App 数据流

**Files:**
- Modify: [src/types.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/types.ts)
- Modify: [src/constants.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/constants.ts)
- Modify: [src/App.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/App.tsx)

- [ ] **Step 1: 收紧类型，先制造编译失败**

```ts
// src/types.ts
export interface SkuSupply {
  id: string;
  supplyKey: SupplyTag | '';
  label: string;
  values: Record<string, string>;
}

export interface SKUData {
  id: string;
  stage: string;
  orderNo: string;
  project: string;
  fieldOptions?: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>>;
  supplies: SkuSupply[];
}
```

- [ ] **Step 2: 跑类型检查，确认失败定位到所有 supply 构造点**

Run:
```bash
npm run lint 2>&1 | head -c 4000
```

Expected: FAIL（缺少 `supplyKey`）。

- [ ] **Step 3: 修复全部构造点与匹配逻辑**

```ts
// src/App.tsx (核心改动)
import {
  deriveSupplyColumnsFromFieldOptions,
  buildSupplyValuesForSupplyKey,
  recomputeStep4Values,
} from './lib/step4SampleCalc';

const supplyColumns = deriveSupplyColumnsFromFieldOptions(fieldOptions);
const supplies = supplyColumns.map((col, colIndex) => {
  const values: Record<string, string> = {
    storage: storageValue,
    band: bandValue,
    ...buildSupplyValuesForSupplyKey(fieldOptions, col.supplyKey),
  };
  if (!values.customer_sample_req) values.customer_sample_req = '';
  return {
    id: `s_${Date.now()}_${idx}_${colIndex + 1}`,
    supplyKey: col.supplyKey,
    label: col.label,
    values: recomputeStep4Values(values),
  };
});

const handleUpdateSupplyLabel = (skuId: string, supplyId: string, val: string) => {
  setSkuData((prev) =>
    prev.map((sku) =>
      sku.id !== skuId
        ? sku
        : {
            ...sku,
            supplies: sku.supplies.map((s) =>
              s.id === supplyId ? { ...s, label: val } : s
            ),
          }
    )
  );
};

// 手动新增列固定 supplyKey: ''
const newSup = { id: `s_${Date.now()}`, supplyKey: '', label: '新供应', values: {} };
```

```ts
// src/constants.ts (MOCK_COLUMNS)
supplies: [
  { id: 's1', supplyKey: '一供', label: '一供', values: { ... } },
  { id: 's2', supplyKey: '二供', label: '二供', values: { ... } },
]
```

```ts
// src/App.tsx 传参修复
<TrialProductionTable
  ...
  onUpdateSupplyLabel={handleUpdateSupplyLabel}
/>
```

- [ ] **Step 4: 旧历史 fail-fast（不做迁移）**

```ts
// src/App.tsx 历史加载时过滤不兼容草稿
const parsed = JSON.parse(savedHistory) as HistoryEntry[];
const compatible = parsed.filter((h) =>
  h.skuData.every((sku) => sku.supplies.every((s) => typeof s.supplyKey === 'string'))
);
setHistory(compatible);
```

- [ ] **Step 5: 跑 lint 并提交**

Run:
```bash
npm run lint 2>&1 | head -c 4000
```

Expected: PASS。

```bash
git add src/types.ts src/constants.ts src/App.tsx
git commit -m "feat: add supplyKey as canonical split-column key"
```

---

### Task 3: 修正表格渲染，按当前列展示，不再全量铺开

**Files:**
- Modify: [src/components/TrialProductionTable.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/components/TrialProductionTable.tsx)

- [ ] **Step 1: 删除“options 网格展示”分支，统一用当前列值**

```tsx
// 原逻辑中 fieldOptions 分支整块移除，保留单值输入
<input
  style={{ height: rowHeight ? rowHeight - 20 : 34 }}
  className={cn(
    "flex-1 min-w-0 px-3 focus:outline-none transition-all text-[13px] leading-none",
    "bg-transparent text-slate-700",
    field.behavior === 'calc' && "font-bold text-slate-500 cursor-default",
    hasConflict && currentStep !== 5 && "text-rose-600 placeholder:text-rose-400 placeholder:font-bold"
  )}
  placeholder={hasConflict && currentStep !== 5 ? `⚠️ ${field.label}存在冲突` : "-"}
  value={supply.values[field.id] !== undefined ? supply.values[field.id] : ''}
  onChange={(e) => onUpdateValue(sku.id, supply.id, field.id, e.target.value)}
  readOnly={field.behavior === 'calc' || currentStep === 5}
  disabled={currentStep === 5}
/>
```

- [ ] **Step 2: 跑全量测试与类型检查**

Run:
```bash
npm test 2>&1 | head -c 4000
npm run lint 2>&1 | head -c 4000
```

Expected: 全部 PASS。

- [ ] **Step 3: 手工验收 localhost:3000**

Run:
```bash
npm run dev 2>&1 | head -c 4000
```

Manual checks:
```text
1) flash EMMC 存在一/二/三供时，方案名称出现三列。
2) 一供列只显示一供值，二供列只显示二供值，三供列只显示三供值。
3) 某字段缺三供时，三供列该单元格为空。
4) 修改方案名称显示文案，不影响自动匹配结果。
```

- [ ] **Step 4: 提交**

```bash
git add src/components/TrialProductionTable.tsx
git commit -m "fix: render split fields by column supply key only"
```

---

### Task 4: 最终回归与交付验收

**Files:**
- Modify: [docs/superpowers/plans/2026-05-28-supply-key-split-column-fix.md](/Users/shenmingjie/tinno/trial-production/trial-production/docs/superpowers/plans/2026-05-28-supply-key-split-column-fix.md)

- [ ] **Step 1: 记录最终行为与验收证据**

```md
- 列生成规则：所有拆列字段供方并集，顺序固定一供/二供/三供。
- 匹配规则：supplyKey 匹配；label 仅展示。
- 缺失规则：字段无对应供方时留空，不回退、不拼接。
- 兼容策略：旧历史草稿不迁移，加载时过滤。
```

- [ ] **Step 2: 运行最终检查命令**

Run:
```bash
npm test 2>&1 | head -c 4000
npm run lint 2>&1 | head -c 4000
git status --short 2>&1 | head -c 4000
```

Expected:
```text
- test/lint 全通过
- 仅包含本计划涉及文件改动
```

- [ ] **Step 3: 最终提交**

```bash
git add docs/superpowers/plans/2026-05-28-supply-key-split-column-fix.md
git commit -m "docs: capture split-column supply-key migration behavior"
```

---

## Acceptance Criteria
- 方案列按拆列字段供方并集生成，`flash EMMC` 有三供时必有三列。
- 每列只显示对应供方值，不再出现“一列里同时展示一/二/三供”的冲突。
- 对不上供方的字段留空，不做 fallback、兼容分支或双路径。
- `supplyKey` 为唯一匹配键，`label` 只用于展示。
- 全量 `npm test` 与 `npm run lint` 通过。

## Assumptions
- 固定供方顺序：`一供 -> 二供 -> 三供`。
- 旧本地历史数据不做迁移；不兼容即过滤（fail-fast）。
- 不引入新的兼容层、旧 schema 读写路径或过渡命名。
