# Step 5 Preview/Export Style Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收敛 Step 5 Univer 实时预览与 xlsx 导出文件的样式差异（配色循环 / 数据列宽 / 值规范化），抽出 `step5Style.ts` 作为单一权威样式数据源。

**Architecture:** 新建 `frontend/src/lib/step5Style.ts` 装 Step 5 全部样式工具（5 色 ABCDE 调色板 / 列宽算法 / 值规范化）。`TrialProductionSheet.tsx`（Univer 预览）和 `trialProductionWorkbook.ts`（xlsx 导出）改为调用同一份样式助手，消除两处重复实现。预览端用 `w`（像素），导出端用 `wch`（字符宽），共享函数返回 px，调用方各自转换。

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6 + Vitest + XLSX + Univer

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `frontend/src/lib/step5Style.ts` | Step 5 共享样式助手：5 色调色板、列宽算法、值规范化 |
| `frontend/src/lib/step5Style.test.ts` | 共享样式助手单元测试 |

### Files to Modify

| File | Responsibility |
|------|---------------|
| `frontend/src/components/TrialProductionSheet.tsx` | Univer 预览：删除 `COLOR_SCHEME` / `BLACK_BORDER` / `getStyleForGroup`，导入共享样式 |
| `frontend/src/lib/trialProductionWorkbook.ts` | xlsx 导出：删除 `BLOCK_A` / `BLOCK_B` / `getStyleForGroup`，导入共享样式，加 `normalizeStep5CellValue` |
| `frontend/src/lib/trialProductionWorkbook.test.ts` | 6 用例：ABAB 断言 → ABCDE 断言，列宽断言从固定 22 改自适应 |
| `frontend/src/components/TrialProductionSheet.test.tsx` | 10 用例：删除本地 `calculateColumnWidths` 副本，调用共享函数 |
| `docs/dev-memory/decisions.md` | 追加 ADR-006 |

### Files NOT Modified（历史快照）

- `docs/superpowers/specs/2026-06-09-electron-univer-product-design-handoff.md`
- `docs/superpowers/plans/2026-05-28-step5-exact-excel-export.md`
- `docs/superpowers/plans/2026-06-13-step5-column-alignment.md`

历史 plan/spec 是历史实施快照，变更通过 ADR 记录。

---

## Task 1: Create `step5Style.ts` Shared Style Helpers

**Files:**
- Create: `frontend/src/lib/step5Style.ts`
- Test: `frontend/src/lib/step5Style.test.ts`

- [ ] **Step 1: Write the failing test for `getStep5GroupStyle`**

Create `frontend/src/lib/step5Style.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getStep5GroupStyle, normalizeStep5CellValue, calculateStep5ColumnWidths } from './step5Style';
import type { Step5TableModel } from './step5TableModel';
import type { FieldDefinition, SKUData } from '../types';

describe('getStep5GroupStyle', () => {
  it('returns A title style for groupIndex 0 isTitle', () => {
    const s = getStep5GroupStyle(0, true);
    expect(s.bg.rgb).toBe('EAF3FF');
    expect(s.fs).toBe(14);
    expect(s.bl).toBe(1);
  });

  it('returns A body style for groupIndex 0 isTitle=false', () => {
    const s = getStep5GroupStyle(0, false);
    expect(s.bg.rgb).toBe('F7FBFF');
    expect(s.fs).toBeUndefined();
    expect(s.bl).toBeUndefined();
  });

  it('cycles 5 colors: B/C/D/E for groupIndex 1/2/3/4', () => {
    expect(getStep5GroupStyle(1, true).bg.rgb).toBe('EAFBF7');
    expect(getStep5GroupStyle(2, true).bg.rgb).toBe('F3EEFF');
    expect(getStep5GroupStyle(3, true).bg.rgb).toBe('FFF1E6');
    expect(getStep5GroupStyle(4, true).bg.rgb).toBe('EAF8F0');
  });

  it('wraps around after 5 (groupIndex 5 → A again)', () => {
    expect(getStep5GroupStyle(5, true).bg.rgb).toBe('EAF3FF');
  });
});

describe('normalizeStep5CellValue', () => {
  it('uses normalizeBusinessValue for supply_select', () => {
    expect(normalizeStep5CellValue('supply_select', '一供')).toBe('一供');
    expect(normalizeStep5CellValue('supply_select', '')).toBe('');
  });

  it('uses normalizeFieldValue for normal fields', () => {
    expect(normalizeStep5CellValue('storage', '  4+128  ')).toBe('4+128');
  });
});

describe('calculateStep5ColumnWidths', () => {
  const model: Step5TableModel = {
    columns: [
      { skuId: 'sku1', supplyId: 's1', label: '一供' },
      { skuId: 'sku1', supplyId: 's2', label: '二供' },
    ],
    rows: [
      { kind: 'title', title: 'Basic' },
      { kind: 'field', fieldId: 'lcd', fieldLabel: 'LCD', cells: [
        { value: 'LCD_6.5寸_OLED', colSpan: 1 },
        { value: 'LCD_6.8寸', colSpan: 1 },
      ] },
    ],
  };

  const activeFields: FieldDefinition[] = [
    { id: 'lcd', label: 'LCD', group: 'Basic', behavior: 'auto' },
  ];

  const skuData: SKUData[] = [
    {
      id: 'sku1', stage: 'EVT', orderNo: '', project: 'X6728',
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { lcd: 'LCD_6.5寸_OLED' } },
        { id: 's2', supplyKey: '二供', label: '二供', values: { lcd: 'LCD_6.8寸' } },
      ],
    },
  ];

  it('returns labelPx >= 120 and content-based dataPx', () => {
    const result = calculateStep5ColumnWidths({ model });
    expect(result.labelPx).toBeGreaterThanOrEqual(120);
    expect(result.dataPx).toHaveLength(2);
    // LCD_6.5寸_OLED = 11*8 + 3*16 + 1*8 = 88+48+8 = 144; +16 = 160
    expect(result.dataPx[0]).toBe(160);
  });

  it('uses layout.supplyWidths when provided', () => {
    const result = calculateStep5ColumnWidths({
      model, layout: { supplyWidths: { s1: 200, s2: 300 } },
    });
    expect(result.dataPx[0]).toBe(200);
    expect(result.dataPx[1]).toBe(300);
  });

  it('applies min 80px to empty data columns', () => {
    const emptyModel: Step5TableModel = {
      columns: [{ skuId: 'sku1', supplyId: 's1', label: '一供' }],
      rows: [{ kind: 'field', fieldId: 'x', fieldLabel: 'X', cells: [{ value: '', colSpan: 1 }] }],
    };
    const result = calculateStep5ColumnWidths({ model: emptyModel });
    expect(result.dataPx[0]).toBe(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- step5Style.test.ts 2>&1 | tail -c 2000`
Expected: FAIL with "Cannot find module './step5Style'"

- [ ] **Step 3: Implement `step5Style.ts`**

Create `frontend/src/lib/step5Style.ts`:

```ts
import type { FieldDefinition, SKUData } from '../types';
import type { Step5TableModel } from './step5TableModel';
import { normalizeFieldValue, normalizeBusinessValue } from './skuValueNormalization';

export const STEP5_COLOR_SCHEME: ReadonlyArray<{
  title: string;
  body: string;
}> = [
  { title: 'EAF3FF', body: 'F7FBFF' }, // A: 浅蓝
  { title: 'EAFBF7', body: 'F6FFFC' }, // B: 浅青绿
  { title: 'F3EEFF', body: 'FAF8FF' }, // C: 浅紫
  { title: 'FFF1E6', body: 'FFF8F3' }, // D: 浅橙
  { title: 'EAF8F0', body: 'F6FCF8' }, // E: 浅薄荷绿
];

export const STEP5_LABEL_COL_MIN_PX = 120;
export const STEP5_DATA_COL_MIN_PX = 80;
export const STEP5_COL_PADDING_PX = 16;

function measureTextWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += ch.charCodeAt(0) > 0x7f ? 16 : 8;
  }
  return w;
}

export function getStep5GroupStyle(
  groupIndex: number | undefined,
  isTitle: boolean,
): Record<string, unknown> {
  const idx = (((groupIndex ?? 0) % STEP5_COLOR_SCHEME.length) + STEP5_COLOR_SCHEME.length) % STEP5_COLOR_SCHEME.length;
  const block = STEP5_COLOR_SCHEME[idx];
  const bg = isTitle ? block.title : block.body;
  const style: Record<string, unknown> = {
    bg: { rgb: bg },
    ht: 2,
    vt: 2,
    tb: 2,
    bd: { t: { s: 1, cl: { rgb: '000000' } }, b: { s: 1, cl: { rgb: '000000' } }, l: { s: 1, cl: { rgb: '000000' } }, r: { s: 1, cl: { rgb: '000000' } } },
  };
  if (isTitle) {
    style.fs = 14;
    style.bl = 1;
  }
  return style;
}

export function normalizeStep5CellValue(fieldId: string, value: string): string {
  if (fieldId === 'supply_select') {
    return normalizeBusinessValue(value);
  }
  return normalizeFieldValue(fieldId, value);
}

export interface Step5ColumnWidths {
  labelPx: number;
  dataPx: number[];
}

export function calculateStep5ColumnWidths(args: {
  model: Step5TableModel;
  layout?: { supplyWidths?: Record<string, number> };
}): Step5ColumnWidths {
  const { model, layout } = args;

  // Label column: longest field label in px, min 120
  const fieldLabels = model.rows
    .filter((r): r is Extract<typeof model.rows[number], { kind: 'field' }> => r.kind === 'field')
    .map((r) => r.fieldLabel);
  const longestLabel = fieldLabels.reduce((max, l) => (measureTextWidth(l) > measureTextWidth(max) ? l : max), '');
  const labelPx = Math.max(measureTextWidth(longestLabel) + STEP5_COL_PADDING_PX, STEP5_LABEL_COL_MIN_PX);

  // Data columns: per-supply max cell value width
  const maxTextsPerCol: string[] = new Array(model.columns.length).fill('');
  for (const row of model.rows) {
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

  const dataPx = model.columns.map((col, i) => {
    const layoutPx = layout?.supplyWidths?.[col.supplyId];
    if (layoutPx !== undefined) return layoutPx;
    const text = maxTextsPerCol[i] ?? '';
    return Math.max(measureTextWidth(text) + STEP5_COL_PADDING_PX, STEP5_DATA_COL_MIN_PX);
  });

  return { labelPx, dataPx };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test -- step5Style.test.ts 2>&1 | tail -c 2000`
Expected: All `step5Style.test.ts` tests pass.

- [ ] **Step 5: Run lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/step5Style.ts frontend/src/lib/step5Style.test.ts
git commit -m "feat(step5): add shared step5Style module (5-color, content-based widths, value normalize)"
```

---

## Task 2: Migrate xlsx Export to Use `step5Style.ts`

**Files:**
- Modify: `frontend/src/lib/trialProductionWorkbook.ts:1-23, 25-55, 77-122, 130-144, 147-158`

- [ ] **Step 1: Update imports**

Edit `frontend/src/lib/trialProductionWorkbook.ts` line 1-3.

Change from:
```ts
import * as XLSX from 'xlsx';
import type { FieldDefinition, SKUData } from '../types';
import { buildStep5TableModel, isSkuSpanningField } from './step5TableModel';
```

To:
```ts
import * as XLSX from 'xlsx';
import type { FieldDefinition, SKUData } from '../types';
import { buildStep5TableModel, isSkuSpanningField } from './step5TableModel';
import { getStep5GroupStyle, normalizeStep5CellValue, calculateStep5ColumnWidths } from './step5Style';
```

- [ ] **Step 2: Remove `BLOCK_A` / `BLOCK_B` / `getStyleForGroup` (lines 10-23)**

Edit `frontend/src/lib/trialProductionWorkbook.ts` lines 10-23.

Change from:
```ts
// ABAB color scheme - same as main table
const BLOCK_A = {
  title: { bg: 'EAF3FF', ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 },
  body: { bg: 'F7FBFF', ht: 2, vt: 2, tb: 2 },
};
const BLOCK_B = {
  title: { bg: 'EAFBF7', ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 },
  body: { bg: 'F6FFFC', ht: 2, vt: 2, tb: 2 },
};

function getStyleForGroup(groupIndex: number | undefined, isTitle: boolean) {
  const block = (groupIndex ?? 0) % 2 === 0 ? BLOCK_A : BLOCK_B;
  return isTitle ? block.title : block.body;
}

function createCellStyle(style: { bg?: string; ht?: number; vt?: number; tb?: number; bl?: number; fs?: number }) {
```

To:
```ts
function createCellStyle(style: { bg?: string | { rgb: string }; ht?: number; vt?: number; tb?: number; bl?: number; fs?: number }) {
```

- [ ] **Step 3: Update `createCellStyle` to handle `bg` as object shape and always build xlsx border (line 25-55)**

Edit `frontend/src/lib/trialProductionWorkbook.ts` lines 25-55.

Change from:
```ts
function createCellStyle(style: { bg?: string; ht?: number; vt?: number; tb?: number; bl?: number; fs?: number }) {
  const cellStyle: Record<string, any> = {};

  // Background color
  if (style.bg) {
    cellStyle.fill = { fgColor: { rgb: style.bg } };
  }

  // Font
  if (style.bl || style.fs) {
    cellStyle.font = {};
    if (style.bl) cellStyle.font.bold = true;
    if (style.fs) cellStyle.font.sz = style.fs;
  }

  // Alignment
  cellStyle.alignment = {};
  if (style.ht !== undefined) cellStyle.alignment.horizontal = style.ht === 0 ? 'left' : style.ht === 1 ? 'center' : 'right';
  if (style.vt !== undefined) cellStyle.alignment.vertical = style.vt === 0 ? 'top' : style.vt === 1 ? 'center' : 'bottom';
  if (style.tb !== undefined) cellStyle.alignment.wrapText = style.tb === 2;

  // Border - thin black on all sides
  cellStyle.border = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  return cellStyle;
}
```

To:
```ts
function createCellStyle(style: { bg?: string | { rgb: string }; ht?: number; vt?: number; tb?: number; bl?: number; fs?: number }) {
  const cellStyle: Record<string, any> = {};

  // Background color (handle both string and { rgb: string } shapes;
  // shared step5Style returns the object form to match Univer conventions)
  if (style.bg) {
    const rgb = typeof style.bg === 'string' ? style.bg : style.bg.rgb;
    cellStyle.fill = { fgColor: { rgb } };
  }

  // Font
  if (style.bl || style.fs) {
    cellStyle.font = {};
    if (style.bl) cellStyle.font.bold = true;
    if (style.fs) cellStyle.font.sz = style.fs;
  }

  // Alignment
  cellStyle.alignment = {};
  if (style.ht !== undefined) cellStyle.alignment.horizontal = style.ht === 0 ? 'left' : style.ht === 1 ? 'center' : 'right';
  if (style.vt !== undefined) cellStyle.alignment.vertical = style.vt === 0 ? 'top' : style.vt === 1 ? 'center' : 'bottom';
  if (style.tb !== undefined) cellStyle.alignment.wrapText = style.tb === 2;

  // Border - always build xlsx-format thin black border.
  // (shared step5Style's `bd` field is Univer-format `t/b/l/r` with `s:1, cl:{rgb}`,
  //  which is incompatible with the xlsx library's `top/bottom/left/right` + `style:'thin'`
  //  format. The border is xlsx-specific, so we build it here rather than reuse the shared one.)
  cellStyle.border = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  return cellStyle;
}
```

- [ ] **Step 4: Replace `getStyleForGroup` call sites in row writer (lines 77-122)**

Edit `frontend/src/lib/trialProductionWorkbook.ts` lines 77-122.

Change from:
```ts
  let rowIdx = 0; // 0-based row index
  let groupIndex = -1; // Track group index for ABAB coloring

  for (const row of model.rows) {
    if (row.kind === 'title' || row.kind === 'group') {
      // Track group index for coloring
      if (row.kind === 'title') {
        groupIndex = 0;
      } else {
        groupIndex++;
      }

      const style = getStyleForGroup(groupIndex, true);
      const cellStyle = createCellStyle(style);

      // Write title/group cell in column A (c=0)
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
      ws[addr] = { v: row.title, t: 's', s: cellStyle };
      // Merge across all columns
      if (totalCols > 1) {
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 1 } });
      }
    } else {
      // field row
      const style = getStyleForGroup(groupIndex, false);
      const cellStyle = createCellStyle(style);

      // Col A: field label
      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: row.fieldLabel, t: 's', s: cellStyle };

      // Value cells starting at col B (c=1)
      let colCursor = 1;
      for (const cell of row.cells) {
        ws[XLSX.utils.encode_cell({ r: rowIdx, c: colCursor })] = {
          v: cell.value,
          t: 's',
          s: cellStyle,
        };
        if (cell.colSpan > 1) {
          merges.push({
            s: { r: rowIdx, c: colCursor },
            e: { r: rowIdx, c: colCursor + cell.colSpan - 1 },
          });
        }
        colCursor += cell.colSpan;
      }
    }
    rowIdx++;
  }
```

To:
```ts
  let rowIdx = 0; // 0-based row index
  let groupIndex = -1; // Track group index for 5-color cycling

  for (const row of model.rows) {
    if (row.kind === 'title' || row.kind === 'group') {
      if (row.kind === 'title') {
        groupIndex = 0;
      } else {
        groupIndex++;
      }

      const cellStyle = createCellStyle(getStep5GroupStyle(groupIndex, true));

      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
      ws[addr] = { v: row.title, t: 's', s: cellStyle };
      if (totalCols > 1) {
        merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: totalCols - 1 } });
      }
    } else {
      const cellStyle = createCellStyle(getStep5GroupStyle(groupIndex, false));

      ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: row.fieldLabel, t: 's', s: cellStyle };

      let colCursor = 1;
      for (const cell of row.cells) {
        const normalized = normalizeStep5CellValue(row.fieldId, cell.value);
        ws[XLSX.utils.encode_cell({ r: rowIdx, c: colCursor })] = {
          v: normalized,
          t: 's',
          s: cellStyle,
        };
        if (cell.colSpan > 1) {
          merges.push({
            s: { r: rowIdx, c: colCursor },
            e: { r: rowIdx, c: colCursor + cell.colSpan - 1 },
          });
        }
        colCursor += cell.colSpan;
      }
    }
    rowIdx++;
  }
```

- [ ] **Step 5: Replace column width calculation with shared helper (lines 130-144)**

Edit `frontend/src/lib/trialProductionWorkbook.ts` lines 130-144.

Change from:
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

To:
```ts
  // Set column widths (shared with Univer preview)
  const { labelPx, dataPx } = calculateStep5ColumnWidths({
    model,
    layout: args.layout,
  });
  ws['!cols'] = [
    { wch: Math.round(labelPx / 6) },
    ...dataPx.map((px) => ({ wch: Math.round(px / 6) })),
  ];
```

- [ ] **Step 6: Run type check**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Run xlsx export tests (expect some to fail — fix in next task)**

Run: `cd frontend && npm run test -- trialProductionWorkbook.test.ts 2>&1 | tail -c 3000`
Expected: Some tests fail (ABAB-specific assertions). Will be updated in Task 4.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/trialProductionWorkbook.ts
git commit -m "refactor(step5): migrate xlsx export to step5Style shared helpers"
```

---

## Task 3: Migrate Univer Preview to Use `step5Style.ts`

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx:947-1047, 1078-1094`

- [ ] **Step 1: Add import for shared helpers**

Edit `frontend/src/components/TrialProductionSheet.tsx` line 1-10 (imports).

Add this line after the existing imports:
```ts
import { getStep5GroupStyle, calculateStep5ColumnWidths, normalizeStep5CellValue } from '../lib/step5Style';
import type { Step5CellStyle } from '../lib/step5Style';
```

- [ ] **Step 1.5: Add `withUniverHashRgb` helper at top of file (above `buildWorkbookSnapshot`)**

The shared function returns rgb values WITHOUT the `#` prefix (suitable for xlsx). Univer's cell style format requires WITH the `#` prefix. Add this helper to transform the shared function's return into Univer format:

```ts
// Add `#` prefix to all rgb values so the shared style is compatible with Univer's cell style format.
// (xlsx export does not need this — it strips the prefix via the typeof check in createCellStyle.)
function withUniverHashRgb(style: Step5CellStyle): Step5CellStyle {
  return {
    ...style,
    bg: { rgb: `#${style.bg.rgb}` },
    bd: {
      t: { s: style.bd.t.s, cl: { rgb: `#${style.bd.t.cl.rgb}` } },
      b: { s: style.bd.b.s, cl: { rgb: `#${style.bd.b.cl.rgb}` } },
      l: { s: style.bd.l.s, cl: { rgb: `#${style.bd.l.cl.rgb}` } },
      r: { s: style.bd.r.s, cl: { rgb: `#${style.bd.r.cl.rgb}` } },
    },
  };
}
```

This helper is local to `TrialProductionSheet.tsx` because only Univer needs `#`-prefixed rgb; xlsx strips it in `createCellStyle` (Task 2).

- [ ] **Step 2: Update `calculateColumnWidths` step5 branch to use shared helper (lines 962-996)**

Edit `frontend/src/components/TrialProductionSheet.tsx` lines 962-996.

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

To:
```ts
  if (isStep5Preview) {
    const step5Model = model.step5Model!;
    const { labelPx, dataPx } = calculateStep5ColumnWidths({
      model: step5Model,
    });
    widths[0] = { w: labelPx };
    for (let i = 0; i < dataPx.length; i++) {
      widths[i + 1] = { w: dataPx[i] };
    }
    return widths;
  }
```

- [ ] **Step 3: Remove `BLACK_BORDER` / `COLOR_SCHEME` / `getStyleForGroup` from `buildWorkbookSnapshot` (lines 1078-1094)**

Edit `frontend/src/components/TrialProductionSheet.tsx` lines 1078-1094.

Change from:
```ts
export function buildWorkbookSnapshot(
  model: ReturnType<typeof buildTrialProductionSheetModel>,
  skuData: SKUData[],
  activeFields: FieldDefinition[],
  currentStep: StepId
) {
  // ABCDE color scheme
  const BLACK_BORDER = { t: { s: 1, cl: { rgb: '#000000' } }, b: { s: 1, cl: { rgb: '#000000' } }, l: { s: 1, cl: { rgb: '#000000' } }, r: { s: 1, cl: { rgb: '#000000' } } };

  const COLOR_SCHEME = [
    { title: { bg: { rgb: '#EAF3FF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#F7FBFF' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // A: 浅蓝
    { title: { bg: { rgb: '#EAFBF7' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#F6FFFC' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // B: 浅青绿
    { title: { bg: { rgb: '#F3EEFF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#FAF8FF' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // C: 浅紫
    { title: { bg: { rgb: '#FFF1E6' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#FFF8F3' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // D: 浅橙
    { title: { bg: { rgb: '#EAF8F0' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14, bd: BLACK_BORDER }, body: { bg: { rgb: '#F6FCF8' }, ht: 2, vt: 2, tb: 2, bd: BLACK_BORDER } }, // E: 浅薄荷绿
  ];

  const getStyleForGroup = (groupIndex: number | undefined, isTitle: boolean) => {
    const colorIndex = (groupIndex ?? 0) % COLOR_SCHEME.length;
    const block = COLOR_SCHEME[colorIndex];
    return isTitle ? block.title : block.body;
  };

  const cellData: Record<number, Record<number, { v?: string; s?: any }>> = {};
```

To:
```ts
export function buildWorkbookSnapshot(
  model: ReturnType<typeof buildTrialProductionSheetModel>,
  skuData: SKUData[],
  activeFields: FieldDefinition[],
  currentStep: StepId
) {
  const cellData: Record<number, Record<number, { v?: string; s?: any }>> = {};
```

- [ ] **Step 4: Replace `getStyleForGroup` call sites in step5 branch (lines 1117, 1128)**

Edit `frontend/src/components/TrialProductionSheet.tsx` lines 1117 and 1128.

Change from (line 1117):
```ts
        const groupStyle = getStyleForGroup(groupIndex, true);
```

To:
```ts
        const groupStyle = withUniverHashRgb(getStep5GroupStyle(groupIndex, true));
```

Change from (line 1128):
```ts
        const groupStyle = getStyleForGroup(groupIndex, false);
```

To:
```ts
        const groupStyle = withUniverHashRgb(getStep5GroupStyle(groupIndex, false));
```

- [ ] **Step 5: Replace `getStyleForGroup` call in non-step5 branch (line 1161)**

Edit `frontend/src/components/TrialProductionSheet.tsx` line 1161.

Change from:
```ts
      const groupStyle = getStyleForGroup(row.groupIndex, row.kind === 'title' || row.kind === 'group');
```

To:
```ts
      const groupStyle = withUniverHashRgb(getStep5GroupStyle(row.groupIndex, row.kind === 'title' || row.kind === 'group'));
```

- [ ] **Step 6: Replace value normalization in step5 branch (line 1141)**

Edit `frontend/src/components/TrialProductionSheet.tsx` line 1141.

Change from:
```ts
          cellData[rowIdx][colCursor] = { v: normalizeFieldValue(row.fieldId, value), s: groupStyle };
```

To:
```ts
          cellData[rowIdx][colCursor] = { v: normalizeStep5CellValue(row.fieldId, value), s: groupStyle };
```

- [ ] **Step 7: Update column width call in `buildWorkbookSnapshot` (line 1266)**

Edit `frontend/src/components/TrialProductionSheet.tsx` line 1266.

Change from:
```ts
        columnData: calculateColumnWidths(model, activeFields, skuData, currentStep),
```

To:
```ts
        columnData: calculateColumnWidths(model, activeFields, skuData, currentStep),
```

(No change — the step1-4 branches still use `calculateColumnWidths` for backward compat. Step 5 branch now calls `calculateStep5ColumnWidths` internally.)

- [ ] **Step 8: Run type check**

Run: `cd frontend && npm run lint`
Expected: 0 errors. (If unused-import errors for `normalizeFieldValue` or `normalizeBusinessValue`, remove them from imports in `TrialProductionSheet.tsx` line 9.)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/TrialProductionSheet.tsx
git commit -m "refactor(step5): migrate univer preview to step5Style shared helpers"
```

---

## Task 4: Update Tests

**Files:**
- Modify: `frontend/src/lib/trialProductionWorkbook.test.ts`
- Modify: `frontend/src/components/TrialProductionSheet.test.tsx`

- [ ] **Step 1: Update `trialProductionWorkbook.test.ts` — ABAB → ABCDE assertion**

Edit `frontend/src/lib/trialProductionWorkbook.test.ts` lines 86-104.

Change from:
```ts
  it('applies ABAB color scheme to title rows', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    const ws = wb.Sheets['搭配表'];
    
    // First group title should have BLOCK_A color (EAF3FF)
    const a1 = ws['A1'];
    expect(a1?.s?.fill?.fgColor?.rgb).toBe('EAF3FF');
    expect(a1?.s?.font?.bold).toBe(true);
    expect(a1?.s?.font?.sz).toBe(14);
  });

  it('applies alternating body row colors', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    const ws = wb.Sheets['搭配表'];
    
    // Field rows should have body styles
    const a2 = ws['A2']; // First field row
    expect(a2?.s?.fill?.fgColor?.rgb).toBe('F7FBFF'); // BLOCK_A body
  });
```

To:
```ts
  it('applies ABCDE 5-color scheme to title rows', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    const ws = wb.Sheets['搭配表'];
    
    // First group title (groupIndex 0) → A: EAF3FF
    const a1 = ws['A1'];
    expect(a1?.s?.fill?.fgColor?.rgb).toBe('EAF3FF');
    expect(a1?.s?.font?.bold).toBe(true);
    expect(a1?.s?.font?.sz).toBe(14);
  });

  it('applies ABCDE 5-color body row colors', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    const ws = wb.Sheets['搭配表'];
    
    // First field row (groupIndex 0) → A body: F7FBFF
    const a2 = ws['A2'];
    expect(a2?.s?.fill?.fgColor?.rgb).toBe('F7FBFF');
  });

  it('cycles 5 colors across 6+ groups (A→B→C→D→E→A)', () => {
    const sixGroupFields: FieldDefinition[] = [
      { id: 'p', label: 'P', group: 'G1', behavior: 'manual' },
      { id: 'q', label: 'Q', group: 'G2', behavior: 'manual' },
      { id: 'r', label: 'R', group: 'G3', behavior: 'manual' },
      { id: 's', label: 'S', group: 'G4', behavior: 'manual' },
      { id: 't', label: 'T', group: 'G5', behavior: 'manual' },
      { id: 'u', label: 'U', group: 'G6', behavior: 'manual' },
    ];
    const wb = buildTrialProductionWorkbook({ projectName: 'X', activeFields: sixGroupFields, skuData });
    const ws = wb.Sheets['搭配表'];
    
    // Each group starts with a title row. With 6 groups, expect 5 distinct title colors.
    const titleAddresses = ['A1', 'A3', 'A5', 'A7', 'A9', 'A11'];
    const titleColors = titleAddresses.map((a) => ws[a]?.s?.fill?.fgColor?.rgb);
    expect(titleColors).toEqual(['EAF3FF', 'EAFBF7', 'F3EEFF', 'FFF1E6', 'EAF8F0', 'EAF3FF']);
  });
```

- [ ] **Step 2: Run xlsx export tests**

Run: `cd frontend && npm run test -- trialProductionWorkbook.test.ts 2>&1 | tail -c 3000`
Expected: All 7 tests pass (5 original + 2 new for the unified scheme).

- [ ] **Step 3: Remove local `calculateColumnWidths` from `TrialProductionSheet.test.tsx` and use shared**

Edit `frontend/src/components/TrialProductionSheet.test.tsx` lines 1-50.

Change from:
```ts
import { describe, it, expect } from 'vitest';
import type { FieldDefinition, SKUData } from '../types';
import type { TrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { buildTrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { buildWorkbookSnapshot, getSheetDataBounds } from './TrialProductionSheet';

function calculateColumnWidths(
  model: TrialProductionSheetModel,
  activeFields: FieldDefinition[],
  skuData: SKUData[],
  currentStep?: number
): Record<number, { w: number }> {
  const widths: Record<number, { w: number }> = {};
  // ... (51 lines of duplicated logic)
}

describe('calculateColumnWidths', () => {
  // ... (80 lines of test)
});
```

To:
```ts
import { describe, it, expect } from 'vitest';
import type { FieldDefinition, SKUData } from '../types';
import type { TrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { buildTrialProductionSheetModel } from '../lib/univerTrialProductionSheet';
import { buildWorkbookSnapshot, getSheetDataBounds } from './TrialProductionSheet';
import { calculateStep5ColumnWidths } from '../lib/step5Style';

describe('calculateStep5ColumnWidths', () => {
  const mockModel: TrialProductionSheetModel = {
    columns: [
      { skuId: 'sku1', supplyId: 'supply1', label: '一供' },
      { skuId: 'sku1', supplyId: 'supply2', label: '二供' },
    ],
    rows: [
      { kind: 'field', rowIndex: 0, fieldId: 'lcd', fieldLabel: 'LCD' },
      { kind: 'field', rowIndex: 1, fieldId: 'band', fieldLabel: '频段' },
    ],
    cellMap: {},
    conflictCellKeys: new Set(),
    readOnly: false,
  };
  const mockStep5Model = {
    columns: mockModel.columns,
    rows: [
      { kind: 'title' as const, title: 'Basic' },
      { kind: 'field' as const, fieldId: 'lcd', fieldLabel: 'LCD', cells: [
        { value: 'LCD_6.5寸_OLED', colSpan: 1 },
        { value: 'LCD_6.8寸', colSpan: 1 },
      ] },
    ],
  };
  const mockSkuData: SKUData[] = [
    {
      id: 'sku1', stage: 'EVT', orderNo: '', project: 'X6728',
      supplies: [
        { id: 'supply1', supplyKey: '一供', label: '一供', values: { lcd: 'LCD_6.5寸_OLED', band: 'B1/B3/B5' } },
        { id: 'supply2', supplyKey: '二供', label: '二供', values: { lcd: 'LCD_6.8寸', band: 'B1/B3' } },
      ],
    },
  ];
  const fields: FieldDefinition[] = [
    { id: 'lcd', label: 'LCD', group: '屏幕', behavior: 'auto' },
    { id: 'band', label: '频段', group: '通信', behavior: 'auto' },
  ];

  it('labelPx >= 120', () => {
    const result = calculateStep5ColumnWidths({ model: mockStep5Model });
    expect(result.labelPx).toBeGreaterThanOrEqual(120);
  });

  it('empty data column uses min 80px', () => {
    const emptyModel = {
      columns: [{ skuId: 'sku1', supplyId: 'supply1', label: '一供' }],
      rows: [{ kind: 'field' as const, fieldId: 'lcd', fieldLabel: 'LCD', cells: [{ value: '', colSpan: 1 }] }],
    };
    const result = calculateStep5ColumnWidths({ model: emptyModel });
    expect(result.dataPx[0]).toBe(80);
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `cd frontend && npm run test 2>&1 | tail -c 4000`
Expected: All tests pass (current 350 + 1 new for `step5Style.test.ts` cycle = 351+).

- [ ] **Step 5: Run lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/trialProductionWorkbook.test.ts frontend/src/components/TrialProductionSheet.test.tsx
git commit -m "test(step5): update tests for shared step5Style helpers (5-color + content widths)"
```

---

## Task 5: Add ADR for Style Unification

**Files:**
- Modify: `docs/dev-memory/decisions.md`

- [ ] **Step 1: Append new ADR entry to `decisions.md`**

Append the following block to `docs/dev-memory/decisions.md`:

```markdown

## 2026-06-17 - Step 5 Univer 预览与 xlsx 导出样式收敛

- **背景**:
  - 之前 step 5 的 Univer 实时预览（`TrialProductionSheet.tsx:buildWorkbookSnapshot`）与 xlsx 文件导出（`trialProductionWorkbook.ts:buildTrialProductionWorkbook`）维护两套独立的样式逻辑，长期出现 4 类差异：
    - 配色：预览 5 色 ABCDE 循环，导出 2 色 ABAB 循环
    - 数据列宽：预览内容自适应（min 80px），导出固定 132px（除非传 layout）
    - 值规范化：预览跑 `normalizeFieldValue` / `normalizeBusinessValue`，导出直接写 `cell.value`
    - 行高：预览走 Univer 默认，导出走 `layout.rowHeights`
  - 两套实现分散在两个文件，测试也分别覆盖，每次改一边都得手动同步另一边。
- **决策**:
  - 新建 `frontend/src/lib/step5Style.ts` 统一以下 4 个 API：
    - `getStep5GroupStyle(groupIndex, isTitle)`：5 色 ABCDE 循环（与 `index.css` 设计系统一致）
    - `calculateStep5ColumnWidths({ model, layout? })`：返回 `{ labelPx, dataPx[] }`，预览端直接用 `w`、导出端转换 `wch = round(px / 6)`
    - `normalizeStep5CellValue(fieldId, value)`：包装 `normalizeFieldValue` + `normalizeBusinessValue` 兜底
  - 边框统一在 `getStep5GroupStyle` 内部 `bd` 字段定义（黑 `s:1`），不再依赖 `SHEET_BORDER_COLOR`。
  - 两个 caller 改为单点调用，删除各自的 `COLOR_SCHEME` / `BLOCK_A` / `BLOCK_B` / `getStyleForGroup`。
  - 行高暂不抽公共（差异小、且 step5 预览无 rowHeights 可读），后续按需收敛。
- **影响**:
  - **代码**:
    - `frontend/src/lib/step5Style.ts` 新建
    - `frontend/src/lib/trialProductionWorkbook.ts` 减 ~25 行（删除 BLOCK_A/B、createCellStyle 改造支持 bd、宽度计算简化）
    - `frontend/src/components/TrialProductionSheet.tsx` 减 ~20 行（删除 BLACK_BORDER、COLOR_SCHEME、getStyleForGroup、step5 列宽计算）
  - **测试**:
    - `frontend/src/lib/step5Style.test.ts` 新建（5 用例覆盖 getStep5GroupStyle / normalizeStep5CellValue / calculateStep5ColumnWidths）
    - `trialProductionWorkbook.test.ts` ABAB 断言改为 ABCDE（6 组循环测试）
    - `TrialProductionSheet.test.tsx` 删除 50 行本地 `calculateColumnWidths` 副本，改为调用 `calculateStep5ColumnWidths`
  - **业务变化**:
    - xlsx 导出现在用 5 色（之前是 2 色），与 Univer 预览 / `index.css` 设计系统一致
    - xlsx 数据列宽随内容自适应（短值列变窄）
    - xlsx 单元格值经过规范化（`storage` / `band` / `supply_select` 格式统一）
  - **类型系统安全网**: 抽公共后 `trialProductionWorkbook.ts` 和 `TrialProductionSheet.tsx` 的样式字段从 `inline` 改为 `import`，TypeScript 编译会暴露遗漏的访问点。
- **未修改**:
  - 历史 plan/spec 文档保持原状（`2026-05-28-step5-exact-excel-export.md` / `2026-06-13-step5-column-alignment.md` 等），是历史快照。
  - `index.css` 的 block 颜色变量与本 ADR 一致，无需改动。
- **回退**: 不需要。`git revert` 单 commit 即可恢复两套独立实现。
```

- [ ] **Step 2: Commit**

```bash
git add docs/dev-memory/decisions.md
git commit -m "docs: add ADR for step5 preview/export style unification"
```

---

## Task 6: Verify Implementation

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd frontend && npm run test 2>&1 | tail -c 4000`
Expected: All tests pass (350+ total).

- [ ] **Step 2: Run type check**

Run: `cd frontend && npm run lint 2>&1 | tail -c 2000`
Expected: 0 errors.

- [ ] **Step 3: Verify no leftover `BLOCK_A` / `BLOCK_B` / `COLOR_SCHEME` / `BLACK_BORDER` (in buildWorkbookSnapshot)**

Run: `cd frontend && grep -rn "BLOCK_A\|BLOCK_B" src/ 2>&1 || true`
Expected: No matches.

Run: `cd frontend && grep -n "BLACK_BORDER\|COLOR_SCHEME" src/components/TrialProductionSheet.tsx 2>&1 || true`
Expected: No matches (only in CSS / index.css if any).

- [ ] **Step 4: Manual smoke test (3 scenarios)**

Start dev server:

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000` and verify:

1. **Step 5 预览样式**: 切到 Step 5，确认色块为 5 色循环（A 浅蓝 / B 浅青绿 / C 浅紫 / D 浅橙 / E 浅薄荷绿），边框为黑色，标题加粗。
2. **xlsx 导出**: 点 Step 5 的"导出 .xlsx"，打开 Excel 验证：
   - 色块与预览一致（5 色循环）
   - 边框为黑色 thin
   - 数据列宽随内容自适应（短值列窄，长值列宽）
   - 标签列宽 ≥ 120px
   - `storage` / `band` 字段值经规范化（无前后空格等）
3. **回归 Step 1-4**: 切回 Step 1/2/3/4，样式与改动前一致（色块、边框、列宽）。

- [ ] **Step 5: Stop dev server**

```bash
# kill the dev server process
```

---

## Self-Review

- ✅ Spec coverage: 4 类差异（配色 / 列宽 / 规范化 / 边框）全部映射到 Task（Task 1 建公共、Task 2/3 改 caller、Task 4 改测试、Task 5 写 ADR、Task 6 验证）。
- ✅ Placeholder scan: 所有 Step 都有具体代码块和命令，无 TBD / "fill in details"。
- ✅ Type consistency: `getStep5GroupStyle` / `calculateStep5ColumnWidths` / `normalizeStep5CellValue` 在 Task 1 定义，Task 2/3 引用，签名一致。
- ✅ 配色循环: 5 色 ABCDE 与 `index.css` 设计系统块色板一致（`--block-a-title: #EAF3FF` 等）。
- ✅ 列宽: 预览走 `w` 像素，导出走 `wch` 字符宽（`Math.round(px / 6)`），共享函数返回 px。
- ✅ 边框: 已在 Task 1 的 `bd` 字段中统一黑 `s:1`，`SHEET_BORDER_COLOR` 仍存在（用于 step1-4 Univer `setBorder` 调用），但 step5 不再依赖。
- ✅ 测试策略: 新建 `step5Style.test.ts` + 更新原测试，按 dev memory 的"红 → 绿 → 改 caller"顺序。
- ✅ 兼容性: 行高暂不抽公共，差异小且 preview 无 rowHeights 来源；后续按需收敛。
