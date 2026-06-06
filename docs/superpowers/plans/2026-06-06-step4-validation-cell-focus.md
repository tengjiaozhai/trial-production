# 第四步校验结果单元格定位与红框圈选

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将第二步的冲突定位和红框圈选逻辑复刻到第四步的左侧 Sidebar 规则校验中，点击校验结果可以定位到具体单元格并高亮显示。

**Architecture:** 
1. 扩展 `ValidationResult` 接口，添加 `skuId` 和 `supplyId` 用于定位
2. 在表格单元格上添加 `data-step4-cell-id` 属性
3. 在 Sidebar 中添加 `focusStep4Validation` 函数，复用第二步的定位逻辑

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/types.ts:174-181` | Modify | 扩展 ValidationResult 接口 |
| `src/App.tsx:669-768` | Modify | runValidation 添加 skuId/supplyId |
| `src/components/TrialProductionTable.tsx:477-520` | Modify | 添加 data-step4-cell-id 属性 |
| `src/components/Sidebar.tsx:40-60` | Modify | 添加 focusStep4Validation 函数 |
| `src/components/Sidebar.tsx:206-210` | Modify | 修改校验结果点击事件 |

---

## Task 1: 扩展 ValidationResult 接口

**Files:**
- Modify: `src/types.ts:174-181`

- [ ] **Step 1: 扩展 ValidationResult 接口**

```typescript
// src/types.ts:174-181
export interface ValidationResult {
  id: string;
  title: string;
  detail: string;
  amReference: string;
  level: ValidationLevel;
  fieldId?: string;
  skuId?: string;      // 新增：用于定位到具体 SKU
  supplyId?: string;   // 新增：用于定位到具体供应列
}
```

- [ ] **Step 2: 运行类型检查**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
git add src/types.ts
git commit -m "feat: extend ValidationResult with skuId and supplyId for cell targeting"
```

---

## Task 2: 修改 runValidation 添加定位信息

**Files:**
- Modify: `src/App.tsx:669-768`

- [ ] **Step 1: 修改 runValidation 函数**

在 `results.push()` 调用中添加 `skuId` 和 `supplyId`：

```typescript
// src/App.tsx:685-694 - Rule 1: Color
results.push({
  id: `RULE-COLOR-${sku.id}-${sup.id}`,
  title: colorCheck.ok ? '颜色一致性核验通过' : '颜色不一致',
  amReference: 'Rule-1',
  detail: colorCheck.ok
    ? `${prefix}颜色与 MBOM/PBOM 任一描述匹配。`
    : `${prefix}颜色(${color})与 MBOM/PBOM 均不匹配。`,
  level: colorCheck.ok ? 'pass' : 'error',
  fieldId: 'color',
  skuId: sku.id,        // 新增
  supplyId: sup.id,     // 新增
});

// src/App.tsx:703-712 - Rule 2: Storage
results.push({
  id: `RULE-STORAGE-${sku.id}-${sup.id}`,
  title: storageCheck.ok ? '存储核验通过' : '存储配置冲突',
  amReference: 'Rule-2',
  detail: storageCheck.ok
    ? `${prefix}存储与 flash EMMC/flash DDR 匹配。`
    : `${prefix}存储(${storage})与${storageCheck.reasons.join('、')}冲突。`,
  level: storageCheck.ok ? 'pass' : 'error',
  fieldId: 'storage',
  skuId: sku.id,        // 新增
  supplyId: sup.id,     // 新增
});

// src/App.tsx:720-729 - Rule 3: unit_id
results.push({
  id: `RULE-SUFFIX-${sku.id}-${sup.id}`,
  title: idCheck.ok ? '整机标识核验通过' : '整机标识冲突',
  amReference: 'Rule-3',
  detail: idCheck.ok
    ? `${prefix}整机标识(${unitId})包含主板标识(${mbId})。`
    : `${prefix}整机标识(${unitId})不包含主板标识(${mbId})。`,
  level: idCheck.ok ? 'pass' : 'error',
  fieldId: 'unit_id',
  skuId: sku.id,        // 新增
  supplyId: sup.id,     // 新增
});

// src/App.tsx:743-750 - Rule R-EBOM-STORAGE-001 (error case)
results.push({
  id: `RULE-EBOM-STORAGE-${sku.id}-${sup.id}`,
  title: 'EBOM描述存储不匹配',
  amReference: 'R-EBOM-STORAGE-001',
  detail: `${prefix}EBOM描述存储(${ebomToken})与存储字段(${storageFld})不一致。`,
  level: 'error',
  fieldId: 'ebom_desc',
  skuId: sku.id,        // 新增
  supplyId: sup.id,     // 新增
});

// src/App.tsx:752-759 - Rule R-EBOM-STORAGE-001 (pass case)
results.push({
  id: `RULE-EBOM-STORAGE-${sku.id}-${sup.id}`,
  title: 'EBOM存储核验通过',
  amReference: 'R-EBOM-STORAGE-001',
  detail: `${prefix}EBOM描述存储与存储字段匹配。`,
  level: 'pass',
  fieldId: 'ebom_desc',
  skuId: sku.id,        // 新增
  supplyId: sup.id,     // 新增
});
```

- [ ] **Step 2: 运行类型检查**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
git add src/App.tsx
git commit -m "feat: add skuId and supplyId to validation results"
```

---

## Task 3: 添加单元格 data 属性

**Files:**
- Modify: `src/components/TrialProductionTable.tsx:477-520`

- [ ] **Step 1: 查看当前单元格渲染代码**

```tsx
// src/components/TrialProductionTable.tsx:477-520
return (
<td
  key={supply.id}
  style={{ width: colWidths[supply.id], minWidth: colWidths[supply.id] }}
  className={cn(
    "border-b border-r border-[#DDE7F3] p-2 align-top transition-colors",
    field.behavior === 'calc' ? "bg-[#f8fafc]" : "bg-white"
  )}
>
  {/* ... input 渲染 ... */}
</td>
);
```

- [ ] **Step 2: 添加 data-step4-cell-id 属性**

```tsx
// src/components/TrialProductionTable.tsx:477-520
return (
<td
  key={supply.id}
  data-step4-cell-id={`step4-cell-${sku.id}-${supply.id}-${field.id}`}
  style={{ width: colWidths[supply.id], minWidth: colWidths[supply.id] }}
  className={cn(
    "border-b border-r border-[#DDE7F3] p-2 align-top transition-colors",
    field.behavior === 'calc' ? "bg-[#f8fafc]" : "bg-white"
  )}
>
  {/* ... input 渲染 ... */}
</td>
);
```

- [ ] **Step 3: 运行测试**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/components/TrialProductionTable.test.tsx`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
git add src/components/TrialProductionTable.tsx
git commit -m "feat: add data-step4-cell-id attribute to table cells"
```

---

## Task 4: 添加 focusStep4Validation 函数

**Files:**
- Modify: `src/components/Sidebar.tsx:40-60`

- [ ] **Step 1: 添加 focusStep4Validation 函数**

```tsx
// src/components/Sidebar.tsx:40-60
const scrollToField = (id: string) => {
  const el = document.getElementById(`row-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('bg-rose-50');
    setTimeout(() => el.classList.remove('bg-rose-50'), 2000);
  }
};

const focusStep2CellConflict = (conflict: Step2CellConflict) => {
  const cell = document.querySelector<HTMLElement>(
    `[data-step2-cell-id="${conflict.cellId}"]`
  );
  if (!cell) return;

  cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  STEP2_MB_ID_HIGHLIGHT_CLASSES.forEach((className) => cell.classList.add(className));
  setTimeout(() => {
    STEP2_MB_ID_HIGHLIGHT_CLASSES.forEach((className) => cell.classList.remove(className));
  }, 1200);
};

// 新增：第四步校验结果定位函数
const focusStep4Validation = (result: ValidationResult) => {
  if (!result.fieldId || !result.skuId || !result.supplyId) return;
  
  const cellId = `step4-cell-${result.skuId}-${result.supplyId}-${result.fieldId}`;
  const cell = document.querySelector<HTMLElement>(
    `[data-step4-cell-id="${cellId}"]`
  );
  if (!cell) return;

  cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  STEP2_MB_ID_HIGHLIGHT_CLASSES.forEach((className) => cell.classList.add(className));
  setTimeout(() => {
    STEP2_MB_ID_HIGHLIGHT_CLASSES.forEach((className) => cell.classList.remove(className));
  }, 1200);
};
```

- [ ] **Step 2: 运行类型检查**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
git add src/components/Sidebar.tsx
git commit -m "feat: add focusStep4Validation function for cell targeting"
```

---

## Task 5: 修改校验结果点击事件

**Files:**
- Modify: `src/components/Sidebar.tsx:206-210`

- [ ] **Step 1: 修改校验结果点击事件**

```tsx
// src/components/Sidebar.tsx:206-210
<div 
  key={idx} 
  onClick={() => {
    if (result.level === 'error' || result.level === 'warn') {
      focusStep4Validation(result);
    }
  }}
  className={cn(
    "p-4 rounded border-l-4 space-y-1 transition-all cursor-pointer hover:shadow-sm",
    result.level === 'error' ? "bg-rose-50 border-rose-500" :
    result.level === 'warn' ? "bg-amber-50 border-amber-500" :
    result.level === 'skip' ? "bg-[#F6F9FF] border-slate-300" :
    "bg-[#EEF6FF]/50 border-[#06B6D4]"
  )}
>
```

- [ ] **Step 2: 更新定位提示文案**

```tsx
// src/components/Sidebar.tsx:220
{result.fieldId && result.skuId && result.supplyId && result.level !== 'pass' && 
  <span className="text-[10px] font-bold text-[#2563EB] underline">点击定位</span>
}
```

- [ ] **Step 3: 运行测试**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/components/Sidebar.test.tsx`
Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
git add src/components/Sidebar.tsx
git commit -m "feat: enable click-to-focus for step4 validation results"
```

---

## Task 6: 添加测试用例

**Files:**
- Modify: `src/components/Sidebar.test.tsx`

- [ ] **Step 1: 添加第四步定位测试**

```tsx
// src/components/Sidebar.test.tsx
describe('Sidebar step4 validation cell targeting', () => {
  it('scrolls to the validation cell and highlights it when an error card is clicked', () => {
    const target = document.createElement('div');
    target.setAttribute('data-step4-cell-id', 'step4-cell-sku_1-s_1-color');
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);

    const validationResults: ValidationResult[] = [
      {
        id: 'RULE-COLOR-sku_1-s_1',
        title: '颜色不一致',
        detail: '[X6728 · 一供] 颜色(color)与 MBOM/PBOM 均不匹配。',
        amReference: 'Rule-1',
        level: 'error',
        fieldId: 'color',
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

    const card = screen.getByText('颜色不一致').closest('div[class*="cursor-pointer"]');
    fireEvent.click(card!);

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });

    document.body.removeChild(target);
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/components/Sidebar.test.tsx`
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
git add src/components/Sidebar.test.tsx
git commit -m "test: add step4 validation cell targeting tests"
```

---

## Task 7: 运行完整测试套件

- [ ] **Step 1: 运行所有测试**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run`
Expected: 所有测试通过

- [ ] **Step 2: 运行类型检查**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx tsc --noEmit`
Expected: 无错误输出

- [ ] **Step 3: 最终 Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
git add -A
git commit -m "feat: complete step4 validation cell focus and highlight feature"
```

---

## 验证清单

- [ ] 点击第四步 Sidebar 中的错误校验结果，表格滚动到对应单元格
- [ ] 目标单元格显示红框高亮效果
- [ ] 高亮效果在 1.2 秒后自动消失
- [ ] 通过校验的结果点击无反应
- [ ] 所有测试通过
- [ ] TypeScript 类型检查通过
