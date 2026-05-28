# 第4步样机总计联动与客户需求分列 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当样机收集表把 `硬件-产品` 拆成多供方列时，Step4 自动按内部字段计算 `天珑研发样机总计`，并在手填 `客户样机需求` 后按列自动计算 `总计 = 天珑研发样机总计 + 客户样机需求`。

**Architecture:** 只保留一条权威路径：`sku.supplies` 是 UI 列结构与列级值的唯一数据源。样机收集表解析出的 `fieldOptions` 仅用于初始化列与自动回填值，不引入第二套列状态。第4步计算抽离为纯函数，在“初始化”和“用户编辑”两处统一调用，避免 `App.tsx` 中散落重复计算分支。

**Tech Stack:** TypeScript, React 19, Vitest, xlsx

---

## 锁定约束

- 阶段匹配必须严格相等，不做任何别名/映射。
- `reliability_eng` 文案改为 `可靠性（内部）`，`reliability` 文案改为 `可靠性（客户）`。
- 本需求只改 `可靠性（内部）` 参与内部总计的逻辑；`可靠性（客户）` 仅作为客户样机需求侧字段存在。
- `客户样机需求` 改为手工输入，不再由 `reliability/field_test/fan_sample/ce_cert` 自动求和回填。
- 若样机收集表未命中可拆供方列，回退单列 `主供`，不保留兼容双轨。

## 文件结构

- Create: `src/lib/step4SampleCalc.ts`
- Create: `src/lib/step4SampleCalc.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/constants.ts`
- Modify: `src/lib/sampleCollectionWorkbook.ts`

### Task 1: 先写失败测试（计算与分列）

**Files:**
- Create: `src/lib/step4SampleCalc.test.ts`

- [ ] **Step 1: 为内部总计与总计联动写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { recomputeStep4Values } from './step4SampleCalc';

describe('recomputeStep4Values', () => {
  it('computes t_long_rd_total from internal fields only', () => {
    const result = recomputeStep4Values({
      hw_eng: '2',
      hw_test: '3',
      sw_eng: '4',
      sw_test: '1',
      struct_eng: '5',
      reliability_eng: '2',
      pressure_test: '1',
      image_eng: '1',
      npm: '1',
      ux: '2',
      parts: '3',
      pm: '4',
      customer_sample_req: '',
    });
    expect(result.t_long_rd_total).toBe('29');
    expect(result.total_qty).toBe('29');
  });

  it('keeps customer_sample_req manual and adds into total_qty', () => {
    const result = recomputeStep4Values({
      hw_eng: '10',
      customer_sample_req: '7',
    });
    expect(result.customer_sample_req).toBe('7');
    expect(result.t_long_rd_total).toBe('10');
    expect(result.total_qty).toBe('17');
  });
});
```

- [ ] **Step 2: 为供方列推导写失败测试**

```ts
import { deriveSupplyColumnsFromFieldOptions } from './step4SampleCalc';

it('derives supply columns from internal field options', () => {
  const columns = deriveSupplyColumnsFromFieldOptions({
    hw_eng: [
      { supply: '一供', text: '12', sourceCategory2: '硬件' },
      { supply: '二供', text: '8', sourceCategory2: '硬件' },
    ],
  } as any);
  expect(columns.map((c) => c.label)).toEqual(['一供', '二供']);
});
```

- [ ] **Step 3: 运行测试确认当前失败**

Run: `npm run test -- src/lib/step4SampleCalc.test.ts`  
Expected: FAIL（`step4SampleCalc.ts` 尚未实现）

### Task 2: 实现第4步纯函数与供方列推导

**Files:**
- Create: `src/lib/step4SampleCalc.ts`

- [ ] **Step 1: 实现列级重算函数**

```ts
const INTERNAL_IDS = [
  'hw_eng',
  'hw_test',
  'sw_eng',
  'sw_test',
  'struct_eng',
  'reliability_eng',
  'pressure_test',
  'image_eng',
  'npm',
  'ux',
  'parts',
  'pm',
] as const;

function toNumber(v: string | undefined): number {
  const n = Number(v ?? '');
  return Number.isFinite(n) ? n : 0;
}

export function recomputeStep4Values(values: Record<string, string>): Record<string, string> {
  const next = { ...values };
  const tLongTotal = INTERNAL_IDS.reduce((sum, id) => sum + toNumber(next[id]), 0);
  const customer = toNumber(next.customer_sample_req);
  const total = tLongTotal + customer;

  if (tLongTotal > 0) next.t_long_rd_total = String(tLongTotal);
  else delete next.t_long_rd_total;

  if (total > 0) next.total_qty = String(total);
  else delete next.total_qty;

  return next;
}
```

- [ ] **Step 2: 实现从 fieldOptions 推导供方列函数**

```ts
const SUPPLY_ORDER = ['一供', '二供', '三供'] as const;
const INTERNAL_IDS_FOR_SPLIT = [
  'hw_eng',
  'hw_test',
  'sw_eng',
  'sw_test',
  'struct_eng',
  'reliability_eng',
  'pressure_test',
  'image_eng',
  'npm',
  'ux',
  'parts',
  'pm',
] as const;
```

实现目标：
- 仅从内部字段 `fieldOptions` 提取供方标签。
- 按 `SUPPLY_ORDER` 固定排序。
- 无命中时返回单列 `主供`。

- [ ] **Step 3: 回跑单测确认通过**

Run: `npm run test -- src/lib/step4SampleCalc.test.ts`  
Expected: PASS

### Task 3: 接入 Step2 初始化列结构

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在上传解析成功后按供方初始化 `sku.supplies`**

替换固定单列初始化逻辑：

```ts
const supplyColumns = deriveSupplyColumnsFromFieldOptions(fieldOptions);
const supplies = supplyColumns.map((col, colIndex) => {
  const values: Record<string, string> = { storage: storageValue, band: bandValue };
  for (const [fieldId, options] of Object.entries(fieldOptions)) {
    const hit = (options ?? []).find((o) => (o.supply || '') === col.supply);
    if (hit?.text) values[fieldId] = hit.text;
  }
  if (!values.customer_sample_req) values.customer_sample_req = '';
  return {
    id: `s_${Date.now()}_${skuIndex}_${colIndex + 1}`,
    label: col.label,
    values,
  };
});
```

- [ ] **Step 2: 初始化后立即执行列级重算**

在生成每列 `values` 后调用 `recomputeStep4Values(values)`，保证页面初次渲染就有正确的 `t_long_rd_total` 与 `total_qty`。

- [ ] **Step 3: 验证“无拆列”回退**

手工验证：
- 样机收集表无一供/二供时，Step2/Step4 仅展示单列 `主供`。
- 不出现空白重复列。

### Task 4: 接入 Step4 编辑联动

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 用纯函数替换旧散落计算块**

在 `handleUpdateValue` 中将更新收敛为：

```ts
const withInput = { ...sup.values, [fieldId]: value };
const newValues = recomputeStep4Values(withInput);
return { ...sup, values: newValues };
```

- [ ] **Step 2: 删除旧客户样机需求自动求和逻辑**

删除这类逻辑：

```ts
const customerSampleReq =
  getNum('reliability') + getNum('field_test') + getNum('fan_sample') + getNum('ce_cert');
```

并确保 `customer_sample_req` 只由用户输入驱动。

- [ ] **Step 3: 验证新增/删除供方仍走同一路径**

检查 `handleAddSupply`、`handleDeleteSupply` 后的每列值更新仍通过 `recomputeStep4Values`，不创建第二套状态。

- [ ] **Step 4: 回归测试**

Run: `npm run test -- src/lib/step4SampleCalc.test.ts`  
Expected: PASS  

Run: `npm run test -- src/lib/sampleCollectionWorkbook.test.ts`  
Expected: PASS

### Task 5: 标签与解析边界收敛

**Files:**
- Modify: `src/constants.ts`
- Modify: `src/lib/sampleCollectionWorkbook.ts`

- [ ] **Step 1: 更新标签文案**

在字段定义中修改：

```ts
reliability_eng -> 可靠性（内部）
reliability -> 可靠性（客户）
```

- [ ] **Step 2: 保持阶段精确匹配**

确认并保持：
- `buildSampleCollectionFieldOptions(data, stage, pcba)` 使用严格相等 `h.stage === stage`。
- 不新增阶段别名映射。

- [ ] **Step 3: 解析边界测试**

Run: `npm run test -- src/lib/sampleCollectionWorkbook.test.ts -t "stage"`  
Expected: PASS（阶段不一致时不命中）

---

## 验收标准

1. 上传样机收集表后，若 `硬件-产品` 存在一供/二供两列，Step2 和 Step4 同一 SKU 都展示两列；列标签顺序为 `一供`、`二供`。
2. `天珑研发样机总计` 只由内部字段求和：`hw_eng/hw_test/sw_eng/sw_test/struct_eng/reliability_eng/pressure_test/image_eng/npm/ux/parts/pm`。
3. `客户样机需求` 不再被自动回填，默认空值，用户可逐列手填。
4. 任意列手填 `客户样机需求` 后，仅该列 `总计` 立即更新为 `天珑研发样机总计 + 客户样机需求`，其他列不受影响。
5. 当解析结果无供方拆列时，系统回退为单列 `主供`，且不出现重复空列。
6. 界面文案已区分为 `可靠性（内部）` 与 `可靠性（客户）`，本需求只影响前者的计算路径。
7. 阶段不匹配或主板标识不匹配时不自动填充，不产生误匹配数据。
8. 相关测试与检查通过：
   - `npm run test -- src/lib/step4SampleCalc.test.ts`
   - `npm run test -- src/lib/sampleCollectionWorkbook.test.ts`
   - `npm run lint`
