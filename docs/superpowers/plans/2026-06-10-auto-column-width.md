# 自适应列宽实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 TrialProductionSheet 组件添加预计算列宽功能，解决文字过长时的重影问题

**Architecture:** 在 `buildWorkbookSnapshot` 函数中预计算列宽并写入 snapshot，同时为所有单元格添加 `tb: 2` 截断样式

**Tech Stack:** React 19, TypeScript 5.8, Univer Sheets

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/src/components/TrialProductionSheet.tsx` | 修改 | 添加 `calculateColumnWidths` 函数，修改 `buildWorkbookSnapshot` |
| `frontend/src/components/TrialProductionSheet.test.tsx` | 创建 | 单元测试 |

---

### Task 1: 修改 centeredStyle 添加截断样式

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx:194`

- [ ] **Step 1: 修改 centeredStyle 添加 tb: 2**

```typescript
// 修改前
const centeredStyle = { ht: 2, vt: 2 };

// 修改后
const centeredStyle = { ht: 2, vt: 2, tb: 2 }; // tb: 2 = 截断溢出
```

- [ ] **Step 2: 运行类型检查验证无错误**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 4000`
Expected: 无类型错误

- [ ] **Step 3: 提交改动**

```bash
git add frontend/src/components/TrialProductionSheet.tsx
git commit -m "feat: add tb:2 truncation style to prevent text overflow"
```

---

### Task 2: 添加 calculateColumnWidths 函数

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx:188-268`

- [ ] **Step 1: 添加 calculateColumnWidths 函数**

在 `buildWorkbookSnapshot` 函数之前添加：

```typescript
function calculateColumnWidths(
  model: ReturnType<typeof buildTrialProductionSheetModel>,
  activeFields: FieldDefinition[]
): Record<number, number> {
  const widths: Record<number, number> = {};
  
  // 第0列（标签列）：根据最长的字段标签计算
  const maxLabelLength = Math.max(
    ...activeFields.map(f => f.label.length),
    6 // 最小宽度
  );
  widths[0] = Math.max(maxLabelLength * 16, 120); // 16px per Chinese char
  
  // 数据列：固定宽度
  for (let i = 0; i < model.columns.length; i++) {
    widths[i + 1] = 120; // 默认数据列宽度
  }
  
  return widths;
}
```

- [ ] **Step 2: 运行类型检查验证无错误**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 4000`
Expected: 无类型错误

- [ ] **Step 3: 提交改动**

```bash
git add frontend/src/components/TrialProductionSheet.tsx
git commit -m "feat: add calculateColumnWidths function"
```

---

### Task 3: 应用列宽到 snapshot

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx:254-267`

- [ ] **Step 1: 修改 buildWorkbookSnapshot 返回值**

```typescript
// 修改前
return {
  id: 'trial-production-sheet',
  sheetCount: 1,
  sheets: {
    sheet1: {
      id: 'sheet1',
      name: '搭配表',
      cellData,
      mergeData,
      rowCount: Math.max(Object.keys(cellData).length + 10, 50),
      columnCount: Math.max(model.columns.length + 5, 20),
    },
  },
};

// 修改后
return {
  id: 'trial-production-sheet',
  sheetCount: 1,
  sheets: {
    sheet1: {
      id: 'sheet1',
      name: '搭配表',
      cellData,
      mergeData,
      columnData: calculateColumnWidths(model, activeFields),
      rowCount: Math.max(Object.keys(cellData).length + 10, 50),
      columnCount: Math.max(model.columns.length + 5, 20),
    },
  },
};
```

- [ ] **Step 2: 运行类型检查验证无错误**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 4000`
Expected: 无类型错误

- [ ] **Step 3: 提交改动**

```bash
git add frontend/src/components/TrialProductionSheet.tsx
git commit -m "feat: apply column widths to workbook snapshot"
```

---

### Task 4: 添加单元测试

**Files:**
- Create: `frontend/src/components/TrialProductionSheet.test.tsx`

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect } from 'vitest';
import type { FieldDefinition } from '../types';
import type { TrialProductionSheetModel } from '../lib/univerTrialProductionSheet';

// 提取 calculateColumnWidths 函数进行测试
function calculateColumnWidths(
  model: TrialProductionSheetModel,
  activeFields: FieldDefinition[]
): Record<number, number> {
  const widths: Record<number, number> = {};
  
  const maxLabelLength = Math.max(
    ...activeFields.map(f => f.label.length),
    6
  );
  widths[0] = Math.max(maxLabelLength * 16, 120);
  
  for (let i = 0; i < model.columns.length; i++) {
    widths[i + 1] = 120;
  }
  
  return widths;
}

describe('calculateColumnWidths', () => {
  const mockModel: TrialProductionSheetModel = {
    columns: [
      { skuId: 'sku1', supplyId: 'supply1', label: '一供' },
      { skuId: 'sku1', supplyId: 'supply2', label: '二供' },
    ],
    rows: [],
    cellMap: {},
    conflictCellKeys: new Set(),
    readOnly: false,
  };

  it('标签列宽度应 >= 120px', () => {
    const fields: FieldDefinition[] = [
      { id: 'field1', label: '短标签', group: '基本信息', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields);
    expect(widths[0]).toBeGreaterThanOrEqual(120);
  });

  it('标签列宽度应根据最长标签自适应', () => {
    const fields: FieldDefinition[] = [
      { id: 'field1', label: '短', group: '基本信息', behavior: 'auto' },
      { id: 'field2', label: '这是一个很长的标签名', group: '基本信息', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields);
    expect(widths[0]).toBe(21 * 16); // 21 chars * 16px
  });

  it('数据列宽度应为 120px', () => {
    const fields: FieldDefinition[] = [
      { id: 'field1', label: '标签', group: '基本信息', behavior: 'auto' },
    ];
    const widths = calculateColumnWidths(mockModel, fields);
    expect(widths[1]).toBe(120);
    expect(widths[2]).toBe(120);
  });
});
```

- [ ] **Step 2: 运行测试验证通过**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 4000`
Expected: 3 tests passed

- [ ] **Step 3: 提交改动**

```bash
git add frontend/src/components/TrialProductionSheet.test.tsx
git commit -m "test: add unit tests for calculateColumnWidths"
```

---

### Task 5: 最终验证

- [ ] **Step 1: 运行完整测试套件**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 4000`
Expected: All tests passed

- [ ] **Step 2: 运行类型检查**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 4000`
Expected: 无类型错误

- [ ] **Step 3: 提交最终改动**

```bash
git add -A
git commit -m "feat: implement auto column width with text truncation"
```

---

## 验证清单

- [ ] 所有单元格设置了 `tb: 2` 截断样式
- [ ] 标签列宽度 ≥ 120px
- [ ] 标签列宽度根据最长标签自适应
- [ ] 数据列宽度为 120px
- [ ] 现有功能不受影响
- [ ] 所有测试通过
