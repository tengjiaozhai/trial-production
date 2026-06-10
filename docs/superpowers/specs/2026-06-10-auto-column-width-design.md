# 自适应列宽设计规格

## 概述

为 TrialProductionSheet 组件添加预计算列宽功能，解决文字过长时的重影问题。

## 目标

1. 所有单元格文字过长时截断显示，不与其他单元格重叠
2. 标签列（第0列）宽度根据字段标签长度自适应
3. 数据列宽度保持合理固定值

## 技术方案

### 方案选择

**选择方案 A：在 snapshot 中预计算列宽**

理由：
- 列宽在渲染时就确定，无闪烁
- 不依赖 Univer 内部 API 调用时机
- 可精确控制最小/最大列宽

### 实现细节

#### 1. 列宽计算函数

**文件**：`frontend/src/components/TrialProductionSheet.tsx`

新增 `calculateColumnWidths` 函数：

```typescript
function calculateColumnWidths(
  model: TrialProductionSheetModel,
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

#### 2. 应用列宽到 snapshot

修改 `buildWorkbookSnapshot` 函数返回值，添加 `columnData` 字段：

```typescript
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

#### 3. 防止重影的样式

修改 `centeredStyle`，添加 `tb: 2`（截断溢出）：

```typescript
const centeredStyle = { ht: 2, vt: 2, tb: 2 }; // tb: 2 = 截断溢出
```

### 数据结构

#### columnData 格式

```typescript
interface IWorksheetData {
  columnData: {
    [columnIndex: number]: {
      w?: number; // 列宽（像素）
    }
  }
}
```

#### Univer 样式 - tb 属性

| 值 | 含义 |
|---|------|
| 1 | 溢出（默认） |
| 2 | 截断 |
| 3 | 自动换行 |

## 测试计划

### 单元测试

**新增测试文件**：`frontend/src/components/TrialProductionSheet.test.tsx`

测试用例：

1. **标签列宽度计算**
   - 验证标签列宽度 ≥ 120px
   - 验证宽度根据最长标签自适应

2. **数据列宽度**
   - 验证所有数据列宽度为 120px

3. **截断样式**
   - 验证所有单元格设置了 `tb: 2`

### 验证命令

```bash
cd frontend && npm run test -- src/components/TrialProductionSheet.test.tsx
```

## 实现步骤

1. 修改 `buildWorkbookSnapshot` 函数
   - 添加 `calculateColumnWidths` 函数
   - 修改 `centeredStyle` 添加 `tb: 2`
   - 在返回值中添加 `columnData`

2. 添加单元测试

3. 运行测试验证

## 依赖项

- 无新增依赖

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 列宽计算不准确 | 设置最小宽度 120px 兜底 |
| 中文字符宽度估算偏差 | 使用 16px per char 估算 |

## 成功标准

1. 文字过长时显示截断，不与其他单元格重叠
2. 标签列能完整显示中文字段名
3. 现有功能不受影响
4. 所有测试通过
