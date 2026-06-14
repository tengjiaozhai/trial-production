# Step 5 Column Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Step 5 的列结构从 `A=序号 + B=字段名 + C..=数据`（2+N 列）改为 `A=字段名 + B..=数据`（1+N 列），与 Step 2-4 列结构对齐。

**Architecture:** 单一数据源收敛。从 `Step5TableModel` 移除 `indexLabel` 字段和序号计数；Univer 渲染层和 Excel 导出层同步收敛到 `1+N` 列结构；`leadingColumns` 统一为 1。删除 indexLabel 后 TypeScript 编译会自动暴露所有遗漏的访问点，作为安全网。

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6 + Vitest + XLSX + Univer

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `frontend/src/lib/step5TableModel.ts` | Step 5 数据模型；删除 `indexLabel` 字段和 `visibleIndex` 计数 |
| `frontend/src/lib/trialProductionWorkbook.ts` | Excel 导出；A 列写 `fieldLabel`、删 B 列、列宽自适应 |
| `frontend/src/components/TrialProductionSheet.tsx` | Univer 渲染；`leadingColumns` 1→1、`lastCol` 公式减 1、A 列渲染 `fieldLabel`、A 列宽度自适应 |
| `frontend/src/components/TrialProductionSheet.test.tsx` | 测试断言；`lastCol` 公式减 1 |
| `docs/dev-memory/decisions.md` | ADR 记录本次结构变更 |

### Files NOT Modified (历史 plan/spec)

- `docs/superpowers/specs/2026-06-09-electron-univer-product-design-handoff.md`
- `docs/superpowers/plans/2026-05-28-step5-exact-excel-export.md`
- `docs/superpowers/plans/2026-06-03-efuse-label-export-plan.md`
- `docs/superpowers/plans/2026-06-01-step3-supplier-single-column.md`
- `artifacts/visual/visual-review.md`

历史实施计划/spec 不修改（它们是历史快照），变更通过 ADR 记录。

---

## Task 1: Remove `indexLabel` from Step 5 Data Model

**Files:**
- Modify: `frontend/src/lib/step5TableModel.ts:9-15, 55, 85, 94, 100, 108`

- [ ] **Step 1: Remove `indexLabel` field from `Step5FieldRow` interface**

Edit `frontend/src/lib/step5TableModel.ts` lines 9-15.

Change from:
```ts
export interface Step5FieldRow {
  kind: 'field';
  indexLabel: string;
  fieldId: string;
  fieldLabel: string;
  cells: Step5Cell[];
}
```

To:
```ts
export interface Step5FieldRow {
  kind: 'field';
  fieldId: string;
  fieldLabel: string;
  cells: Step5Cell[];
}
```

- [ ] **Step 2: Remove `visibleIndex` declaration**

Edit `frontend/src/lib/step5TableModel.ts` line 55.

Change from:
```ts
  const rows: Step5Row[] = [];
  let visibleIndex = 1;
```

To:
```ts
  const rows: Step5Row[] = [];
```

- [ ] **Step 3: Remove first `indexLabel` assignment in field row builder (line 83-93)**

Edit `frontend/src/lib/step5TableModel.ts` lines 83-94.

Change from:
```ts
      rows.push({
        kind: 'field',
        indexLabel: String(visibleIndex).padStart(2, '0'),
        fieldId: field.id,
        fieldLabel: formatFieldLabelWithEfuse({
          fieldId: field.id,
          fieldLabel: field.label,
          efuseConfigs: args.efuseConfigs,
        }),
        cells,
      });
      visibleIndex += 1;
    }
```

To:
```ts
      rows.push({
        kind: 'field',
        fieldId: field.id,
        fieldLabel: formatFieldLabelWithEfuse({
          fieldId: field.id,
          fieldLabel: field.label,
          efuseConfigs: args.efuseConfigs,
        }),
        cells,
      });
    }
```

- [ ] **Step 4: Remove second `indexLabel` assignment in supplier row builder (line 97-109)**

Edit `frontend/src/lib/step5TableModel.ts` lines 97-109.

Change from:
```ts
    if (args.includeSupplierRow && gi === 0) {
      rows.push({
        kind: 'field',
        indexLabel: String(visibleIndex).padStart(2, '0'),
        fieldId: '__supplier__',
        fieldLabel: '一供/二供',
        cells: args.skuData.map((sku) => ({
          value: sku.selectedSupplyKey || '',
          colSpan: 1,
        })),
      });
      visibleIndex += 1;
    }
```

To:
```ts
    if (args.includeSupplierRow && gi === 0) {
      rows.push({
        kind: 'field',
        fieldId: '__supplier__',
        fieldLabel: '一供/二供',
        cells: args.skuData.map((sku) => ({
          value: sku.selectedSupplyKey || '',
          colSpan: 1,
        })),
      });
    }
```

- [ ] **Step 5: Run type check to find downstream consumers**

Run: `cd frontend && npm run lint`
Expected: TypeScript errors pointing to all places that read `row.indexLabel` (will be 2: `trialProductionWorkbook.ts:102` and `TrialProductionSheet.tsx:1119`). These are fixed in Tasks 2 and 3.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/step5TableModel.ts
git commit -m "refactor(step5): remove indexLabel field from table model"
```

---

## Task 2: Update Excel Export to Write `fieldLabel` in Column A

**Files:**
- Modify: `frontend/src/lib/trialProductionWorkbook.ts:72, 102, 104, 107, 134-141`

- [ ] **Step 1: Update `totalCols` formula**

Edit `frontend/src/lib/trialProductionWorkbook.ts` line 72.

Change from:
```ts
  // Total columns: 1 (index) + 1 (label) + totalValueCols
  const totalCols = 2 + totalValueCols;
```

To:
```ts
  // Total columns: 1 (label) + totalValueCols
  const totalCols = 1 + totalValueCols;
```

- [ ] **Step 2: Update field row writer — Column A writes `fieldLabel`, remove Column B, change `colCursor` start**

Edit `frontend/src/lib/trialProductionWorkbook.ts` lines 101-107.

Change from:
```ts
      // Col A: index label
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: row.indexLabel, t: 's', s: cellStyle };
      // Col B: field label
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })] = { v: row.fieldLabel, t: 's', s: cellStyle };

      // Value cells starting at col C (c=2)
      let colCursor = 2;
```

To:
```ts
      // Col A: field label
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: row.fieldLabel, t: 's', s: cellStyle };

      // Value cells starting at col B (c=1)
      let colCursor = 1;
```

- [ ] **Step 3: Update column widths — A 列自适应 fieldLabel 长度**

Edit `frontend/src/lib/trialProductionWorkbook.ts` lines 132-141.

Change from:
```ts
  // Set column widths
  const defaultSupplyWidth = 22;
  ws['!cols'] = [
    { wch: 4 },   // index col
    { wch: 18 },  // label col
    ...model.columns.map((col) => {
      const px = args.layout?.supplyWidths?.[col.supplyId] ?? defaultSupplyWidth * 6;
      return { wch: Math.round(px / 6) };
    }),
  ];
```

To:
```ts
  // Set column widths
  const defaultSupplyWidth = 22;
  const maxLabelLength = Math.max(
    ...model.rows
      .filter((r): r is Extract<(typeof model.rows)[number], { kind: 'field' }> => r.kind === 'field')
      .map((r) => r.fieldLabel.length),
    6
  );
  ws['!cols'] = [
    { wch: Math.max(maxLabelLength, 18) },  // label col (width based on longest field label)
    ...model.columns.map((col) => {
      const px = args.layout?.supplyWidths?.[col.supplyId] ?? defaultSupplyWidth * 6;
      return { wch: Math.round(px / 6) };
    }),
  ];
```

- [ ] **Step 4: Run type check**

Run: `cd frontend && npm run lint`
Expected: 0 errors (no more consumers of `indexLabel` in lib code).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/trialProductionWorkbook.ts
git commit -m "refactor(step5): align excel export column structure to 1+N"
```

---

## Task 3: Update Univer Rendering in `TrialProductionSheet.tsx`

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx:326, 1052-1053, 1090, 1119-1123, 954-965`

- [ ] **Step 1: Update `leadingColumns` constant (L326)**

Edit `frontend/src/components/TrialProductionSheet.tsx` line 326.

Change from:
```ts
      const leadingColumns = currentModel.readOnly && currentModel.step5Model ? 2 : 1;
```

To:
```ts
      const leadingColumns = 1;
```

- [ ] **Step 2: Update `getSheetDataBounds` for Step 5 (L1046-1061)**

Edit `frontend/src/components/TrialProductionSheet.tsx` lines 1046-1061.

Change from:
```ts
  if (isStep5Preview) {
    const step5Model = model.step5Model!;
    return {
      lastRow: Math.max(step5Model.rows.length - 1, 0),
      // Step5 layout: col 0 = index, col 1 = label, cols 2..N+1 = value columns
      lastCol: Math.max(1 + step5Model.columns.length, 0),
    };
  }
```

To:
```ts
  if (isStep5Preview) {
    const step5Model = model.step5Model!;
    return {
      lastRow: Math.max(step5Model.rows.length - 1, 0),
      // Step5 layout: col 0 = label, cols 1..N = value columns
      lastCol: Math.max(step5Model.columns.length, 0),
    };
  }
```

- [ ] **Step 3: Update `totalCols` formula in `buildWorkbookSnapshot` (L1090)**

Edit `frontend/src/components/TrialProductionSheet.tsx` line 1090.

Change from:
```ts
  const totalCols = isStep5Preview ? 2 + totalValueCols : 1 + totalValueCols;
```

To:
```ts
  const totalCols = 1 + totalValueCols;
```

- [ ] **Step 4: Update Step 5 field row rendering — A 列写 `fieldLabel`, 删 B 列, `colCursor` 从 1 起 (L1117-1143)**

Edit `frontend/src/components/TrialProductionSheet.tsx` lines 1117-1143.

Change from:
```ts
      } else {
        const groupStyle = getStyleForGroup(groupIndex, false);
        cellData[rowIdx][0] = { v: row.indexLabel, s: groupStyle };
        cellData[rowIdx][1] = { v: row.fieldLabel, s: groupStyle };

        const step5Cols = model.step5Model!.columns;
        let colCursor = 2;
        let colIdx = 0;
        for (const cell of row.cells) {
          let value = cell.value;
          if (row.fieldId === 'supply_select' && !value) {
            const skuId = step5Cols[colIdx]?.skuId;
            const sku = skuId ? skuData.find((s) => s.id === skuId) : undefined;
            value = normalizeBusinessValue(sku?.selectedSupplyKey ?? '');
          }
          cellData[rowIdx][colCursor] = { v: normalizeFieldValue(row.fieldId, value), s: groupStyle };
          if (cell.colSpan > 1) {
            mergeData.push({
              startRow: rowIdx,
              endRow: rowIdx,
              startColumn: colCursor,
              endColumn: colCursor + cell.colSpan - 1,
            });
          }
          colCursor += cell.colSpan;
          colIdx += cell.colSpan;
        }
      }
```

To:
```ts
      } else {
        const groupStyle = getStyleForGroup(groupIndex, false);
        cellData[rowIdx][0] = { v: row.fieldLabel, s: groupStyle };

        const step5Cols = model.step5Model!.columns;
        let colCursor = 1;
        let colIdx = 0;
        for (const cell of row.cells) {
          let value = cell.value;
          if (row.fieldId === 'supply_select' && !value) {
            const skuId = step5Cols[colIdx]?.skuId;
            const sku = skuId ? skuData.find((s) => s.id === skuId) : undefined;
            value = normalizeBusinessValue(sku?.selectedSupplyKey ?? '');
          }
          cellData[rowIdx][colCursor] = { v: normalizeFieldValue(row.fieldId, value), s: groupStyle };
          if (cell.colSpan > 1) {
            mergeData.push({
              startRow: rowIdx,
              endRow: rowIdx,
              startColumn: colCursor,
              endColumn: colCursor + cell.colSpan - 1,
            });
          }
          colCursor += cell.colSpan;
          colIdx += cell.colSpan;
        }
      }
```

- [ ] **Step 5: Update column width calculation for Step 5 (L954-988)**

Edit `frontend/src/components/TrialProductionSheet.tsx` lines 954-988.

Change from:
```ts
  if (isStep5Preview) {
    const step5Model = model.step5Model!;
    const maxLabelLength = Math.max(
      ...step5Model.rows
        .filter((row): row is Extract<(typeof step5Model.rows)[number], { kind: 'field' }> => row.kind === 'field')
        .map((row) => row.fieldLabel.length),
      6
    );

    // Step 5 renders an index column and a field-label column before values.
    widths[0] = { w: 48 };
    widths[1] = { w: Math.max(maxLabelLength * 16, 120) };

    const maxTextsPerCol: string[] = new Array(step5Model.columns.length).fill('');
    for (const row of step5Model.rows) {
      if (row.kind !== 'field') continue;

      let colCursor = 0;
      for (const cell of row.cells) {
        const span = Math.max(1, cell.colSpan);
        for (let offset = 0; offset < span && colCursor + offset < maxTextsPerCol.length; offset++) {
          if (cell.value.length > maxTextsPerCol[colCursor + offset].length) {
            maxTextsPerCol[colCursor + offset] = cell.value;
          }
        }
        colCursor += span;
      }
    }

    for (let i = 0; i < step5Model.columns.length; i++) {
      const width = Math.max(measureWidth(maxTextsPerCol[i]) + 16, 80); // +16 padding, min 80px
      widths[i + 2] = { w: width };
    }

    return widths;
  }
```

To:
```ts
  if (isStep5Preview) {
    const step5Model = model.step5Model!;
    const maxLabelLength = Math.max(
      ...step5Model.rows
        .filter((row): row is Extract<(typeof step5Model.rows)[number], { kind: 'field' }> => row.kind === 'field')
        .map((row) => row.fieldLabel.length),
      6
    );

    // Step 5 renders a single field-label column (col 0) before value columns.
    widths[0] = { w: Math.max(maxLabelLength * 16, 120) };

    const maxTextsPerCol: string[] = new Array(step5Model.columns.length).fill('');
    for (const row of step5Model.rows) {
      if (row.kind !== 'field') continue;

      let colCursor = 0;
      for (const cell of row.cells) {
        const span = Math.max(1, cell.colSpan);
        for (let offset = 0; offset < span && colCursor + offset < maxTextsPerCol.length; offset++) {
          if (cell.value.length > maxTextsPerCol[colCursor + offset].length) {
            maxTextsPerCol[colCursor + offset] = cell.value;
          }
        }
        colCursor += span;
      }
    }

    for (let i = 0; i < step5Model.columns.length; i++) {
      const width = Math.max(measureWidth(maxTextsPerCol[i]) + 16, 80); // +16 padding, min 80px
      widths[i + 1] = { w: width };
    }

    return widths;
  }
```

- [ ] **Step 6: Run type check**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/TrialProductionSheet.tsx
git commit -m "refactor(step5): align univer rendering to 1+N column structure"
```

---

## Task 4: Update Test Assertions

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.test.tsx:227`

- [ ] **Step 1: Update `lastCol` assertion in `getSheetDataBounds` test**

Edit `frontend/src/components/TrialProductionSheet.test.tsx` line 227.

Change from:
```ts
    expect(bounds.lastCol).toBe(1 + model.step5Model!.columns.length);
```

To:
```ts
    expect(bounds.lastCol).toBe(model.step5Model!.columns.length);
```

- [ ] **Step 2: Run all tests**

Run: `cd frontend && npm run test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TrialProductionSheet.test.tsx
git commit -m "test(step5): update lastCol assertion for 1+N column layout"
```

---

## Task 5: Write ADR for Column Structure Change

**Files:**
- Modify: `docs/dev-memory/decisions.md` (append a new ADR)

- [ ] **Step 1: Read existing `decisions.md` to find ADR format**

Run: `cat docs/dev-memory/decisions.md | head -40`

Expected: existing ADR entries with date / status / context / decision / consequences format.

- [ ] **Step 2: Append new ADR entry**

Append the following block to `docs/dev-memory/decisions.md`:

```markdown
## ADR-005: Step 5 列结构对齐 Step 2-4

- **日期**: 2026-06-13
- **状态**: 已实施
- **背景**:
  - Step 5 导出的列结构历史上是 `A=序号(01/02) + B=字段名 + C..=数据`（2+N 列）。
  - Step 2-4 的列结构是 `A=字段名 + B..=数据`（1+N 列）。
  - 这种差异导致 Univer 坐标映射、Excel 导出、列宽计算都需要为 Step 5 单独维护 `leadingColumns=2` 与 `colCursor=2` 的分支。
  - 序号列在导出 Excel 中冗余（用户最终看的是字段名）；视觉上序号与字段名同行也易读性差。
- **决策**:
  - 删除 `Step5FieldRow.indexLabel` 字段与 `visibleIndex` 计数逻辑。
  - Step 5 改为 `A=字段名 + B..=数据`（1+N 列），与 Step 2-4 完全对齐。
  - `leadingColumns` 统一为 `1`，Univer 列号 → 业务列号换算统一。
  - A 列宽度复用 Step 2-4 公式 `Math.max(maxLabelLength * 16, 120)`。
- **影响**:
  - **代码**:
    - `frontend/src/lib/step5TableModel.ts`: 移除 `indexLabel` 字段与 `visibleIndex` 计数
    - `frontend/src/lib/trialProductionWorkbook.ts`: A 列写 `fieldLabel`、删除 B 列写入、`colCursor` 1 起、列宽自适应
    - `frontend/src/components/TrialProductionSheet.tsx`: `leadingColumns` 1→1、`lastCol` 公式减 1、A 列渲染 `fieldLabel`、列宽自适应
    - `frontend/src/components/TrialProductionSheet.test.tsx`: `lastCol` 断言 `1+N` → `N`
  - **类型系统安全网**: 移除 `indexLabel` 字段后 TypeScript 编译会暴露所有遗漏的访问点。
  - **未修改**: 历史 plan/spec 文档保持原状（`2026-05-28-step5-exact-excel-export.md` 等），它们是历史实施记录。
- **回退**: 不需要。`git revert` 即可回到 2+N 结构。
```

- [ ] **Step 3: Commit**

```bash
git add docs/dev-memory/decisions.md
git commit -m "docs: add ADR-005 for step5 column alignment"
```

---

## Task 6: Verify Implementation

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd frontend && npm run test 2>&1 | head -c 4000`
Expected: All tests pass.

- [ ] **Step 2: Run type check**

Run: `cd frontend && npm run lint 2>&1 | head -c 2000`
Expected: 0 errors.

- [ ] **Step 3: Verify no leftover references to `indexLabel`**

Run: `cd frontend && grep -r "indexLabel" src/ 2>&1 || true`
Expected: No matches.

- [ ] **Step 4: Verify no leftover `visibleIndex`**

Run: `cd frontend && grep -r "visibleIndex" src/ 2>&1 || true`
Expected: No matches.

- [ ] **Step 5: Manual smoke test (5 scenarios)**

Start dev server:

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` and verify:

1. **Step 5 A 列显示字段名**: 切到 Step 5，A 列应该是"项目名称"/"阶段"/"一供/二供"等字段名（不是 "01"/"02"）。
2. **Step 2-4 A 列保持原样**: 切回 Step 2/3/4，A 列仍显示字段名（结构一致）。
3. **Step 5 插入列 anchor 正确**: 在 Step 5 选中某个供位列插入列，新列 anchor 取到正确的 `skuId`/`supplyId`（手动核对 UI 显示）。
4. **Step 5 插入行 anchor 正确**: 在 Step 5 选中某字段行插入行，新行 anchor 取到正确的 `fieldId` 与所属 group。
5. **导出 Excel**: 点 Step 5 的"导出 .xlsx"，打开 Excel 验证：A 列是字段名、B 列起是数据、跨 SKU 字段（`project`/`stage`/`mb_id`/`storage`/`band`）横向合并正确。

- [ ] **Step 6: Stop dev server**

```bash
# kill the dev server process
```

---

## Self-Review

- ✅ Spec coverage: 列结构变更所有触点都已映射到 Task（数据模型 / Excel 导出 / Univer 渲染 / 测试 / ADR / 验证）。
- ✅ Placeholder scan: 所有 Step 都有具体代码块和命令。
- ✅ Type consistency: `Step5FieldRow` 移除 `indexLabel` 后，下游消费者（`trialProductionWorkbook.ts:102`、`TrialProductionSheet.tsx:1119`）在 Task 2/3 中改为读取 `row.fieldLabel`，签名一致。
- ✅ 坐标映射: `leadingColumns` 在 Task 3 Step 1 改为 `1`，与 `colCursor=1` 配套。
- ✅ 列宽公式: Task 2 Step 3（Excel 导出）和 Task 3 Step 5（Univer 渲染）都使用 `Math.max(maxLabelLength * 16, 120)`，与 Step 2-4 一致。
