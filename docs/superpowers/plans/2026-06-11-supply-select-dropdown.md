# 供应选择下拉列表 + 试产地点下拉实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Step3 表格中添加一供/二供供应选择下拉列表和试产地点下拉列表

**Architecture:** 使用 Univer Data Validation preset 实现表格内下拉列表；复用已有的 `handleUpdateSelectedSupply` 和 `skuSupplyKeys`

**Tech Stack:** React 19, TypeScript 5.8, Univer Sheets Data Validation

---

## Task 1: 加载 Univer Data Validation preset

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx`

1. 添加 import：
   - `UniverSheetsDataValidationPreset` from `@univerjs/preset-sheets-data-validation`
   - `UniverPresetSheetsDataValidationZhCN` from `@univerjs/preset-sheets-data-validation/locales/zh-CN`
   - `@univerjs/preset-sheets-data-validation/lib/index.css`

2. 修改 `createUniver` 初始化：
   - 在 `mergeLocales` 中添加 `UniverPresetSheetsDataValidationZhCN`
   - 在 `presets` 数组中添加 `UniverSheetsDataValidationPreset()`

3. 运行 lint 验证

---

## Task 2: 新增 supply_select 字段定义

**Files:**
- Modify: `frontend/src/constants.ts`

在基础信息组（`project` 之后）新增字段：

```typescript
{ id: 'supply_select', label: '一供/二供', group: '基础信息', behavior: 'manual' },
```

注意：这个字段不在 `SplitOptionFieldId` 中（不属于物料选项），是表格级的 UI 选择器。

---

## Task 3: 为 TrialProductionSheet 添加 supplySelectKeys prop

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx`

1. 在 `TrialProductionSheetProps` 接口中新增：
```typescript
skuSupplyKeys?: Record<string, ('一供' | '二供' | '三供' | '四供')[]>;
onSelectedSupplyChange?: (skuId: string, supplyKey: string) => void;
```

2. 在组件中解构并使用

---

## Task 4: 在 buildWorkbookSnapshot 中渲染 supply_select 行

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx`

在 buildWorkbookSnapshot 中，当字段为 `supply_select` 时：
1. 渲染当前 `selectedSupplyKey` 值（如"一供"）
2. 为每个 SKU 的基础信息行中，根据 `model.columns` 中 SKU 的供应键数量动态决定下拉显示

在 buildWorkbookSnapshot 中，当字段为 `prod_loc`（试产地点）时：
1. 渲染当前值（从 sku.supplies[0].values['prod_loc'] 获取）

---

## Task 5: 添加 Data Validation 下拉列表

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx`

在 `useEffect` 中，workbook 创建/更新后：

1. 获取 worksheet 的 DataValidationManager
2. 对 supply_select 行的每个单元格：
   - 使用 `requireValueInList` 添加下拉列表
   - 选项为该 SKU 实际拥有的供应键列表（从 cellMap 查找 skuId，然后在 model.columns 中收集该 SKU 的所有供应键）
3. 对 prod_loc 行的每个单元格：
   - 使用 `requireValueInList` 添加下拉列表
   - 选项为 `['宜宾', '南昌', '河源', '越南', '自定义']`

---

## Task 6: 监听 supply_select 下拉选择事件

**Files:**
- Modify: `frontend/src/lib/univerSheetEvents.ts`

在 `mapUniverEditToBusinessEdit` 中处理 `supply_select` 字段：
- 当 fieldId 为 `supply_select` 时，从 value 中提取供应键
- 返回特殊的编辑事件，触发 `onSelectedSupplyChange`

在 `TrialProductionSheet.tsx` 的 `SheetEditEnded` 事件监听中：
- 检测到 `supply_select` 编辑时，调用 `onSelectedSupplyChange`

---

## Task 7: App.tsx 传递 props

**Files:**
- Modify: `frontend/src/App.tsx`

在 TrialProductionSheet 组件调用处传递：
```typescript
skuSupplyKeys={currentStep === 3 ? skuSupplyKeys : undefined}
onSelectedSupplyChange={currentStep === 3 ? handleUpdateSelectedSupply : undefined}
```

---

## Task 8: 运行完整测试和验证

```bash
cd frontend && npm run test
cd frontend && npm run lint
```

---

## 执行顺序

**可并行：**
- Task 1 (加载 Data Validation preset)
- Task 2 (新增字段定义)

**依赖 Task 1+3：**
- Task 3 (添加 props) → Task 4 (渲染 supply_select 行) → Task 5 (添加 Data Validation 下拉)

**依赖 Task 5+6：**
- Task 6 (监听事件) → Task 7 (App.tsx 传递 props)

**最后：**
- Task 8 (验证)

```
Task 1 ──┐
           ├──> Task 3 ──> Task 4 ──> Task 5 ──> Task 6 ──> Task 7 ──> Task 8
Task 2 ──┘
```
