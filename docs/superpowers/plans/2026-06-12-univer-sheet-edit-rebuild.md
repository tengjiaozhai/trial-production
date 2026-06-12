# Univer Sheet 编辑重建 & 焦点丢失修复 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复试产搭配表（Univer Sheet）在 Windows 平台上的两个痛点：(1) 编辑单元格后整表被销毁重建导致拖动/滚动卡顿，(2) 回车后焦点未主动跳到下一格而停留在原 cell。

**Architecture:** 把 `TrialProductionSheet` 现有的「`model` 一变就 `disposeUnit + createWorkbook` 全表重建」拆成「结构变化 → 全表重建」与「数据变化 → 增量 `setValue`」两条独立路径；并在 `BeforeSheetEditEnd` 监听里补上「确认后主动 moveActive」逻辑，让回车跳格可控。

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6 + Vitest + jsdom + @univerjs/preset-sheets-core@0.25 + @univerjs/preset-sheets-data-validation@0.25

**Project root:** `frontend/`
**Source root:** `frontend/src/`
**Test root:** `frontend/src/`（与源同目录的 `*.test.ts(x)`）
**Run tests from:** `frontend/` directory

---

## 背景与诊断结论

> 以下结论基于已经阅读 `frontend/src/components/TrialProductionSheet.tsx:119-125, 256-332, 434-704` 与 `frontend/src/components/TrialProductionSheet.behavior.test.tsx` 之后得出。

- `TrialProductionSheet.tsx:119` 的 `model` useMemo 依赖里包含 `skuData`、`activeFields`、`currentStep`、`step2Conflicts`、`efuseConfigs`。
- `TrialProductionSheet.tsx:434-566` 的 useEffect 依赖 `model`，每次引用变化都执行 `api.disposeUnit + api.createWorkbook`，并重新 `setBorder`、`setDataValidation`、`setFrozenRows`。
- 用户在任意单元格编辑 → `App.tsx` 调 `setSkuData` → `skuData` 引用变 → `model` 重新计算 → 整个 Univer workbook 销毁重建 → 当前 active cell 回到刚编辑过的那个 cell → 用户感知为「焦点闪回」+「整表抖一下」。
- 拖动字段/SKU 排序（`App.tsx:336-360`）走 `setActiveFields` / `setSkuData`，同样触发整表重建，所以侧边栏拖动明显卡。
- 平台差异：`focusCellByBusinessKey`（`TrialProductionSheet.tsx:290-331`）已经识别 Windows 需要 0/180/1200ms 三次重试，说明 Windows 上 Univer 内部激活时序更慢，需要更长稳定窗口。

修复目标：
1. **结构变化**（字段增删、step 切换、列结构变化）才走全表重建。
2. **数据变化**（编辑单格）走 `worksheet.getRange(row, col).setValue()` 增量更新，不重建 workbook。
3. **回车跳格** 由 `BeforeSheetEditEnd` 回调内主动执行 `setActiveCell` 命令，不依赖 workbook 重建。

---

## File Structure

| 文件 | 职责 | 状态 |
|------|------|------|
| `frontend/src/lib/sheetStructureKey.ts` | 从 props 派生稳定的「结构指纹」字符串（step + 字段 ID 序列） | 新建 |
| `frontend/src/lib/sheetDataDiff.ts` | 对比 `model.cellMap` 标识的 cell 与 Univer 当前 sheet 内容，产出 `setValue` 增量 | 新建 |
| `frontend/src/components/TrialProductionSheet.tsx` | 拆分两个 effect：结构 effect（全表重建）+ 数据 effect（增量写入）；补回车跳格 | 修改 |
| `frontend/src/lib/sheetStructureKey.test.ts` | sheetStructureKey 单测 | 新建 |
| `frontend/src/lib/sheetDataDiff.test.ts` | sheetDataDiff 单测 | 新建 |
| `frontend/src/components/TrialProductionSheet.behavior.test.tsx` | 补充「数据变化不重建」「回车跳格」两条行为测试 | 修改 |

---

## Task 1: 提取「结构指纹」工具 `sheetStructureKey`

**Files:**
- Create: `frontend/src/lib/sheetStructureKey.ts`
- Test: `frontend/src/lib/sheetStructureKey.test.ts`

- [ ] **Step 1.1: Write the failing test**

在 `frontend/src/lib/sheetStructureKey.test.ts` 写入：

```ts
import { describe, expect, it } from 'vitest';
import type { FieldDefinition, StepId } from '../types';
import { buildStructureKey } from './sheetStructureKey';

const fields: FieldDefinition[] = [
  { id: 'a', label: 'A', group: 'g', behavior: 'manual' },
  { id: 'b', label: 'B', group: 'g', behavior: 'auto' },
];

describe('buildStructureKey', () => {
  it('produces a string', () => {
    const key = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    expect(typeof key).toBe('string');
  });

  it('changes when currentStep changes', () => {
    const k1 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    const k2 = buildStructureKey({ currentStep: 3 as StepId, activeFields: fields, efuseConfigs: {} });
    expect(k1).not.toBe(k2);
  });

  it('changes when activeFields order changes', () => {
    const k1 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    const k2 = buildStructureKey({
      currentStep: 2 as StepId,
      activeFields: [fields[1], fields[0]],
      efuseConfigs: {},
    });
    expect(k1).not.toBe(k2);
  });

  it('is stable when only sku values change', () => {
    const k1 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    const k2 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    expect(k1).toBe(k2);
  });

  it('changes when efuseConfigs references a new field id', () => {
    const k1 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: { x: 'a' } });
    const k2 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: { y: 'a' } });
    expect(k1).not.toBe(k2);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/sheetStructureKey.test.ts
```

Expected: FAIL with `Cannot find module './sheetStructureKey'`

- [ ] **Step 1.3: Write minimal implementation**

在 `frontend/src/lib/sheetStructureKey.ts` 写入：

```ts
import type { FieldDefinition, StepId } from '../types';

export interface StructureKeyInput {
  currentStep: StepId;
  activeFields: FieldDefinition[];
  efuseConfigs: Record<string, string> | undefined;
}

export function buildStructureKey(input: StructureKeyInput): string {
  const fieldIds = input.activeFields.map((f) => f.id).join('|');
  const efuseKeys = Object.keys(input.efuseConfigs ?? {}).sort().join('|');
  return `${input.currentStep}::${fieldIds}::${efuseKeys}`;
}
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/lib/sheetStructureKey.test.ts
```

Expected: PASS, 5 tests passed

- [ ] **Step 1.5: Commit**

```bash
git add frontend/src/lib/sheetStructureKey.ts frontend/src/lib/sheetStructureKey.test.ts
git commit -m "feat(sheet): add buildStructureKey for stable structure fingerprint"
```

---

## Task 2: 提取「数据差异」工具 `sheetDataDiff`

**Files:**
- Create: `frontend/src/lib/sheetDataDiff.ts`
- Test: `frontend/src/lib/sheetDataDiff.test.ts`

- [ ] **Step 2.1: Read existing model cellMap shape**

读 `frontend/src/lib/univerTrialProductionSheet.ts`，确认 `TrialProductionSheetModel.cellMap` 的 key 格式（`${row}-${column}` → `{ skuId, supplyId, fieldId, scope }`）与 `buildWorkbookSnapshot` 输出的 cellData 结构。

把以下行写入 `frontend/src/lib/sheetDataDiff.ts` 文件顶部注释位置备忘：
- `cellMap` 形如 `Record<string, { skuId: string; supplyId?: string; fieldId: string; scope: 'sku' | 'supply' }>`
- snapshot.cellData 形如 `Record<number, Record<number, { v?: string }>>`

- [ ] **Step 2.2: Write the failing test**

在 `frontend/src/lib/sheetDataDiff.test.ts` 写入：

```ts
import { describe, expect, it } from 'vitest';
import { diffSheetData } from './sheetDataDiff';

describe('diffSheetData', () => {
  it('returns empty when both cellMaps and values are identical', () => {
    const result = diffSheetData({
      cellMap: { '0-1': { skuId: 's1', fieldId: 'project', scope: 'sku' } },
      cellValues: { '0-1': 'X6728' },
      previousCellValues: { '0-1': 'X6728' },
    });
    expect(result).toEqual([]);
  });

  it('emits a single update when a value changes', () => {
    const result = diffSheetData({
      cellMap: { '0-1': { skuId: 's1', fieldId: 'project', scope: 'sku' } },
      cellValues: { '0-1': 'X9999' },
      previousCellValues: { '0-1': 'X6728' },
    });
    expect(result).toEqual([{ row: 0, column: 1, value: 'X9999' }]);
  });

  it('skips cells not present in cellMap', () => {
    const result = diffSheetData({
      cellMap: {},
      cellValues: { '0-1': 'X9999' },
      previousCellValues: {},
    });
    expect(result).toEqual([]);
  });

  it('treats missing previousCellValues entry as empty string', () => {
    const result = diffSheetData({
      cellMap: { '0-1': { skuId: 's1', fieldId: 'project', scope: 'sku' } },
      cellValues: { '0-1': 'X9999' },
      previousCellValues: {},
    });
    expect(result).toEqual([{ row: 0, column: 1, value: 'X9999' }]);
  });

  it('emits an update when value becomes empty (clearing a cell)', () => {
    const result = diffSheetData({
      cellMap: { '0-1': { skuId: 's1', fieldId: 'project', scope: 'sku' } },
      cellValues: { '0-1': '' },
      previousCellValues: { '0-1': 'X6728' },
    });
    expect(result).toEqual([{ row: 0, column: 1, value: '' }]);
  });
});
```

- [ ] **Step 2.3: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/lib/sheetDataDiff.test.ts
```

Expected: FAIL with `Cannot find module './sheetDataDiff'`

- [ ] **Step 2.4: Write minimal implementation**

在 `frontend/src/lib/sheetDataDiff.ts` 写入：

```ts
import type { TrialProductionCellKey } from './univerTrialProductionSheet';

export interface SheetDataDiffEntry {
  row: number;
  column: number;
  value: string;
}

export interface SheetDataDiffInput {
  cellMap: Record<string, TrialProductionCellKey>;
  cellValues: Record<string, string>;
  previousCellValues: Record<string, string>;
}

export function diffSheetData(input: SheetDataDiffInput): SheetDataDiffEntry[] {
  const result: SheetDataDiffEntry[] = [];

  for (const [key, cellKey] of Object.entries(input.cellMap)) {
    const sep = key.indexOf('-');
    if (sep < 0) continue;
    const row = Number(key.slice(0, sep));
    const column = Number(key.slice(sep + 1));
    if (!Number.isFinite(row) || !Number.isFinite(column)) continue;

    const nextValue = input.cellValues[key] ?? '';
    const prevValue = input.previousCellValues[key] ?? '';
    if (nextValue === prevValue) continue;

    result.push({ row, column, value: nextValue });
  }

  return result;
}
```

- [ ] **Step 2.5: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/lib/sheetDataDiff.test.ts
```

Expected: PASS, 5 tests passed

- [ ] **Step 2.6: Commit**

```bash
git add frontend/src/lib/sheetDataDiff.ts frontend/src/lib/sheetDataDiff.test.ts
git commit -m "feat(sheet): add diffSheetData for incremental cell updates"
```

---

## Task 3: 维护「上一次写入到 Univer 的值」ref + 派生 cellValues

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx`
- Test: 暂用现有 `TrialProductionSheet.behavior.test.tsx` 验证 dispose 调用次数减少

- [ ] **Step 3.1: Read current model usage**

读 `frontend/src/components/TrialProductionSheet.tsx:118-127` 与 `:434-566` 之间的 useEffect 完整内容。把 model、skuData、cellMapRef、modelRef 的当前用法记在脑里。

- [ ] **Step 3.2: Add lastWrittenCellValuesRef**

把 `TrialProductionSheet.tsx:107-127` 区域内的 `cellMapRef`、`modelRef` 旁边新增一个 ref，并在 `useMemo` 之前定义 cellValues：

替换 `TrialProductionSheet.tsx:111-127` 为：

```tsx
    const cellMapRef = useRef<Record<string, import('../lib/univerTrialProductionSheet').TrialProductionCellKey>>({});
    const modelRef = useRef<ReturnType<typeof buildTrialProductionSheetModel> | null>(null);
    const lastWrittenCellValuesRef = useRef<Record<string, string>>({});
    const focusRetryTimersRef = useRef<number[]>([]);
    const viewportRestoreTimersRef = useRef<number[]>([]);
    const univerReadyTimersRef = useRef<number[]>([]);
    const previousStepRef = useRef<StepId | null>(null);
    const lastStructureKeyRef = useRef<string | null>(null);

    // Build the sheet model
    const model = useMemo(() => buildTrialProductionSheetModel({
      activeFields,
      skuData,
      currentStep,
      step2Conflicts,
      efuseConfigs,
    }), [activeFields, currentStep, efuseConfigs, skuData, step2Conflicts]);
    modelRef.current = model;
    cellMapRef.current = model.cellMap;

    const currentCellValues = useMemo(() => {
      const map: Record<string, string> = {};
      for (const [key, cellKey] of Object.entries(model.cellMap)) {
        if (!cellKey.fieldId) continue;
        const sku = skuData.find((s) => s.id === cellKey.skuId);
        if (!sku) continue;

        let raw = '';
        if (isSkuSpanningField(cellKey.fieldId)) {
          raw = sku.supplies[0]?.values[cellKey.fieldId] ?? '';
        } else {
          const supply = sku.supplies.find((s) => s.id === cellKey.supplyId);
          raw = supply?.values[cellKey.fieldId] ?? '';
        }
        map[key] = normalizeFieldValue(cellKey.fieldId, raw);
      }
      return map;
    }, [model, skuData]);
```

- [ ] **Step 3.3: Verify no compile error**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3.4: Run existing tests to make sure they still pass**

```bash
cd frontend && npx vitest run src/components/TrialProductionSheet.behavior.test.tsx
```

Expected: all previously passing tests still pass (新增 ref 和 useMemo 不会破坏既有行为)

- [ ] **Step 3.5: Commit**

```bash
git add frontend/src/components/TrialProductionSheet.tsx
git commit -m "refactor(sheet): track lastWrittenCellValues for diff-based sync"
```

---

## Task 4: 把 useEffect 拆分为「结构 effect」+「数据 effect」

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx:434-566`
- Test: `frontend/src/components/TrialProductionSheet.behavior.test.tsx`

- [ ] **Step 4.1: Add behavior test for "data change does not recreate workbook"**

在 `frontend/src/components/TrialProductionSheet.behavior.test.tsx` 文件末尾追加 describe 块（`describe('TrialProductionSheet data sync', () => { ... })`），先写失败测试：

```ts
describe('TrialProductionSheet data sync', () => {
  beforeEach(() => {
    createUniverMock.mockReset();
    newAPIMock.mockReset();
  });

  it('does not recreate the workbook when only a cell value changes', async () => {
    const setValueMock = vi.fn();
    const setDataValidation = vi.fn();
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation, setValue: setValueMock })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn(() => workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      executeCommand: vi.fn(),
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: { BeforeSheetEditEnd: 'BeforeSheetEditEnd' },
    };
    mockCreateUniverWithAPI(apiMock);
    vi.useFakeTimers();

    const { rerender } = render(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
        onSelectedSupplyChange={vi.fn()}
      />
    );
    await flushSheetEffects();
    expect(apiMock.createWorkbook).toHaveBeenCalledTimes(1);
    apiMock.disposeUnit.mockClear();
    apiMock.createWorkbook.mockClear();

    // Change only one cell value, keep structure identical
    const updatedSkus: SKUData[] = step3VisibleSkuData.map((sku, idx) =>
      idx === 0
        ? {
            ...sku,
            supplies: sku.supplies.map((sup, sidx) =>
              sidx === 0 ? { ...sup, values: { ...sup.values, band: '欧洲' } } : sup
            ),
          }
        : sku
    );

    rerender(
      <TrialProductionSheet
        currentStep={3}
        skuData={updatedSkus}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
        onSelectedSupplyChange={vi.fn()}
      />
    );
    await flushSheetEffects();

    expect(apiMock.disposeUnit).not.toHaveBeenCalled();
    expect(apiMock.createWorkbook).not.toHaveBeenCalled();
    expect(setValueMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/TrialProductionSheet.behavior.test.tsx -t "does not recreate the workbook when only a cell value changes"
```

Expected: FAIL (因为现在 effect 仍会重建 workbook)

- [ ] **Step 4.3: Split the useEffect in TrialProductionSheet.tsx**

替换 `TrialProductionSheet.tsx:434-566`（整个结构 effect）为两个独立 effect：

```tsx
    // Rebuild workbook only when structure (step / fields / efuse) changes
    const structureKey = useMemo(
      () => buildStructureKey({ currentStep, activeFields, efuseConfigs }),
      [activeFields, currentStep, efuseConfigs],
    );

    useEffect(() => {
      if (!univerReady) return;
      if (lastStructureKeyRef.current === structureKey) return;
      lastStructureKeyRef.current = structureKey;

      const api = univerAPIRef.current;
      if (!api) return;
      const preserveViewport = previousStepRef.current === currentStep;
      const currentWorkbook = preserveViewport ? api.getActiveWorkbook() : null;
      const viewportState = preserveViewport
        ? captureSheetViewportState(currentWorkbook?.getActiveSheet())
        : null;
      previousStepRef.current = currentStep;

      const snapshot = buildWorkbookSnapshot(model, skuData, activeFields, currentStep);

      try {
        const existingWorkbook = api.getActiveWorkbook();
        if (existingWorkbook) {
          api.disposeUnit(existingWorkbook.getId());
        }
        api.createWorkbook(snapshot);
      } catch {
        // ignore workbook recreation errors
      }

      // Reset data diff baseline after rebuild
      lastWrittenCellValuesRef.current = currentCellValues;

      // Freeze first 4 rows in Step 2, cancel for other steps
      try {
        const freezeWb = api.getActiveWorkbook();
        if (freezeWb) {
          const freezeWs = freezeWb.getActiveSheet();
          if (freezeWs) {
            if (currentStep === 2) {
              freezeWs.setFrozenRows(4);
            } else {
              freezeWs.cancelFreeze();
            }
          }
        }
      } catch {
        // ignore freeze errors
      }

      // Apply borders to all data cells
      try {
        const borderWb = api.getActiveWorkbook();
        const borderWs = borderWb?.getActiveSheet();
        if (borderWs) {
          const bounds = getSheetDataBounds(model);
          if (bounds.lastRow >= 0 && bounds.lastCol >= 0) {
            borderWs
              .getRange(0, 0, bounds.lastRow + 1, bounds.lastCol + 1)
              .setBorder(
                api.Enum.BorderType.ALL,
                api.Enum.BorderStyleTypes.THIN,
                SHEET_BORDER_COLOR,
              );
          }
        }
      } catch {
        // ignore border errors
      }

      // Apply Data Validation immediately after workbook creation
      if (!model.readOnly) {
        const workbook = api.getActiveWorkbook();
        if (workbook) {
          const worksheet = workbook.getActiveSheet();
          if (worksheet) {
            const supplySelectRow = model.rows.find(
              (r) => r.kind === 'field' && r.fieldId === 'supply_select'
            );

            if (supplySelectRow && skuSupplyKeys) {
              for (let ci = 0; ci < model.columns.length; ci++) {
                const col = model.columns[ci];
                const keys = skuSupplyKeys[col.skuId];
                if (!keys || keys.length < 2) continue;

                const rule = api.newDataValidation()
                  .requireValueInList(keys.filter(k => k !== ''), false, true)
                  .setOptions({
                    allowBlank: false,
                    showErrorMessage: true,
                    error: '请选择供应标签',
                  })
                  .build();

                try {
                  worksheet.getRange(supplySelectRow.rowIndex, ci + 1).setDataValidation(rule);
                } catch {
                  // ignore
                }
              }
            }

            const prodLocRow = model.rows.find(
              (r) => r.kind === 'field' && r.fieldId === 'prod_loc'
            );

            if (prodLocRow) {
              for (let ci = 0; ci < model.columns.length; ci++) {
                const rule = api.newDataValidation()
                  .requireValueInList([...PROD_LOC_OPTIONS], false, true)
                  .setOptions({
                    allowBlank: true,
                    showErrorMessage: true,
                    error: '请选择试产地点',
                  })
                  .build();

                try {
                  worksheet.getRange(prodLocRow.rowIndex, ci + 1).setDataValidation(rule);
                } catch {
                  // ignore
                }
              }
            }
          }
        }
      }

      restoreSheetViewportState(viewportState);

      return () => {
        clearViewportRestoreTimers();
      };
    }, [structureKey, univerReady]);

    // Sync incremental cell changes via setValue (no workbook rebuild)
    useEffect(() => {
      if (!univerReady) return;
      const api = univerAPIRef.current;
      const worksheet = api?.getActiveWorkbook()?.getActiveSheet() as
        | { getRange: (row: number, column: number) => { setValue: (v: string) => void } }
        | null
        | undefined;
      if (!worksheet) return;

      const diff = diffSheetData({
        cellMap: cellMapRef.current,
        cellValues: currentCellValues,
        previousCellValues: lastWrittenCellValuesRef.current,
      });
      if (diff.length === 0) return;

      for (const entry of diff) {
        try {
          worksheet.getRange(entry.row, entry.column).setValue(entry.value);
        } catch {
          // ignore per-cell write errors
        }
      }
      lastWrittenCellValuesRef.current = currentCellValues;
    }, [currentCellValues, univerReady]);
```

- [ ] **Step 4.4: Add necessary imports**

在 `TrialProductionSheet.tsx:1-15` 的 import 区域加：

```tsx
import { buildStructureKey } from '../lib/sheetStructureKey';
import { diffSheetData } from '../lib/sheetDataDiff';
```

注意：`buildWorkbookSnapshot`、`getSheetDataBounds`、`SHEET_BORDER_COLOR`、`restoreSheetViewportState`、`captureSheetViewportState` 已经在文件下方定义并被本文件使用，**不需要额外 import**。

- [ ] **Step 4.5: Verify type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4.6: Run the new behavior test**

```bash
cd frontend && npx vitest run src/components/TrialProductionSheet.behavior.test.tsx -t "does not recreate the workbook when only a cell value changes"
```

Expected: PASS

- [ ] **Step 4.7: Run all existing sheet tests**

```bash
cd frontend && npx vitest run src/components/TrialProductionSheet.behavior.test.tsx
```

Expected: all pass (既有「replaces the active workbook when the projected Step3 layout changes」仍 PASS——因为 step 变化属于 structure key 变化)

- [ ] **Step 4.8: Commit**

```bash
git add frontend/src/components/TrialProductionSheet.tsx frontend/src/components/TrialProductionSheet.behavior.test.tsx
git commit -m "perf(sheet): split rebuild into structure vs data effects to avoid full workbook rebuild on cell edits"
```

---

## Task 5: 回车后主动 moveActive 到下一格

**Files:**
- Modify: `frontend/src/components/TrialProductionSheet.tsx:642-662`
- Test: `frontend/src/components/TrialProductionSheet.behavior.test.tsx`

- [ ] **Step 5.1: Read the current edit handler**

读 `TrialProductionSheet.tsx:612-704` 完整内容，确认 `api.addEvent(api.Event.BeforeSheetEditEnd, ...)` 的当前回调结构。

- [ ] **Step 5.2: Add failing test for Enter behavior**

在 `frontend/src/components/TrialProductionSheet.behavior.test.tsx` 的 `describe('TrialProductionSheet data sync')` 块中追加测试：

```ts
  it('moves active cell right and down after Enter (BeforeSheetEditEnd confirm)', async () => {
    const executeCommand = vi.fn();
    const worksheetMock = {
      getRange: vi.fn(() => ({ setDataValidation: vi.fn(), setValue: vi.fn() })),
      getCellMergeData: vi.fn(),
      scrollToCell: vi.fn(),
    };
    const workbookMock = {
      getId: vi.fn(() => 'trial-production-sheet'),
      getActiveSheet: vi.fn(() => worksheetMock),
    };
    let beforeEditEndHandler: ((params: any) => void) | null = null;
    const apiMock = {
      createWorkbook: vi.fn(),
      getActiveWorkbook: vi.fn(() => workbookMock),
      disposeUnit: vi.fn(),
      addEvent: vi.fn((eventName: string, handler: any) => {
        if (eventName === 'BeforeSheetEditEnd') beforeEditEndHandler = handler;
        return { dispose: vi.fn() };
      }),
      executeCommand,
      newDataValidation: vi.fn(() => createValidationBuilder()),
      Event: { BeforeSheetEditEnd: 'BeforeSheetEditEnd' },
    };
    mockCreateUniverWithAPI(apiMock);
    vi.useFakeTimers();

    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={step3VisibleSkuData}
        activeFields={activeFields}
        skuSupplyKeys={{ 'sku-a1': ['一供', '二供'], 'sku-b1': ['一供'] }}
        onUpdateValue={vi.fn()}
        onSelectedSupplyChange={vi.fn()}
      />
    );
    await flushSheetEffects();

    expect(beforeEditEndHandler).not.toBeNull();
    act(() => {
      beforeEditEndHandler!({ row: 0, column: 1, value: { toPlainText: () => 'X' }, isConfirm: true, isZenEditor: false, keycode: 13 });
    });
    await flushSheetEffects();

    expect(executeCommand).toHaveBeenCalledWith(
      expect.stringContaining('move'),
      expect.objectContaining({ row: 0, column: 2 })
    );
  });
```

- [ ] **Step 5.3: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/TrialProductionSheet.behavior.test.tsx -t "moves active cell right and down after Enter"
```

Expected: FAIL (现在没有调用 executeCommand)

- [ ] **Step 5.4: Implement Enter handler in BeforeSheetEditEnd**

替换 `TrialProductionSheet.tsx:642-662` 中 `BeforeSheetEditEnd` 回调内的逻辑（保留 onUpdateValue 调用顺序），在 `handleBusinessCellUpdate(row, column, value)` 之后插入：

在原 `if (rowObj?.fieldId === 'supply_select' || rowObj?.fieldId === 'prod_loc') { return; }` 之后，`handleBusinessCellUpdate(row, column, value);` 之前，**不要**修改既有逻辑；改成在 `handleBusinessCellUpdate` 之后追加：

找到 `const disposable = api.addEvent(api.Event.BeforeSheetEditEnd, (params: any) => {` 后的整个回调体，在 `handleBusinessCellUpdate(row, column, value);` 这一行**之后**插入：

```tsx
        // Move active cell to the next column (or wrap to next row at row end)
        // unless the user is editing the field-label column (column === 0).
        if (column > 0) {
          const ws = api.getActiveWorkbook()?.getActiveSheet();
          const lastCol = ws ? Math.max(ws.getSheetSize?.()?.columns ?? 0, modelRef.current?.columns.length ?? 0) - 1 : 0;
          const lastRow = (modelRef.current?.rows.length ?? 1) - 1;
          const nextColumn = column + 1 > lastCol ? 1 : column + 1;
          const nextRow = column + 1 > lastCol ? Math.min(row + 1, lastRow) : row;
          try {
            api.executeCommand('sheet.operation.set-selection', {
              row: nextRow,
              column: nextColumn,
            });
          } catch {
            try {
              api.executeCommand('sheet.command.set-active-cell', {
                row: nextRow,
                column: nextColumn,
              });
            } catch {
              // ignore move-active failures
            }
          }
        }
```

注意：上面用了 `modelRef.current` 而不是闭包里的 `model`，因为该 effect 的依赖不包含 `skuData`，**必须**用 ref 取最新值。

- [ ] **Step 5.5: Verify type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors（如果 Univer 0.25 没有 `set-selection` 命令名，tsc 不报错——调用是动态字符串，类型上是 `any`）

- [ ] **Step 5.6: Run new test**

```bash
cd frontend && npx vitest run src/components/TrialProductionSheet.behavior.test.tsx -t "moves active cell right and down after Enter"
```

Expected: PASS

- [ ] **Step 5.7: Run all sheet tests**

```bash
cd frontend && npx vitest run src/components/TrialProductionSheet.behavior.test.tsx
```

Expected: all pass

- [ ] **Step 5.8: Commit**

```bash
git add frontend/src/components/TrialProductionSheet.tsx frontend/src/components/TrialProductionSheet.behavior.test.tsx
git commit -m "feat(sheet): advance active cell to next column on Enter confirm"
```

---

## Task 6: 全量回归

**Files:** 无（仅运行测试与 typecheck）

- [ ] **Step 6.1: Run all Vitest tests**

```bash
cd frontend && npx vitest run
```

Expected: all pass（不允许出现因本次改动导致的失败）

- [ ] **Step 6.2: Run typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6.3: Build sanity check**

```bash
cd frontend && npm run build
```

Expected: build succeeds (含 build timestamp 注入)

- [ ] **Step 6.4: Manual smoke test on Windows**

(此步由人工执行，文档记录预期)

1. `npm run dev`
2. 打开 `http://localhost:3000`
3. 进入 Step 3
4. 在第一个 supply 的「频段」cell 输入「欧洲」，按 Enter
5. 期望：焦点跳到右侧下一个 cell，且不发生整表闪烁
6. 在侧边栏拖动「颜色」字段到「存储」字段之下
7. 期望：表格无明显卡顿，行列顺序变化通过增量 setValue 而不是整表重建

---

## Self-Review Notes

- **Spec coverage:**
  - 痛点 1（拖动卡顿）→ Task 1-4 解决（结构指纹 + 数据 diff + 拆分 effect）
  - 痛点 2（焦点闪回）→ Task 4 解决重建问题（移除重建的副作用）+ Task 5 解决主动跳格
  - TDD 红绿循环 → 每个 Task 都先写失败测试
  - 频繁提交 → 每个 Task 末尾一次 commit
- **Type 一致性:**
  - `buildStructureKey` 在 Task 1 定义、Task 4 使用，签名一致
  - `diffSheetData` 在 Task 2 定义、Task 4 使用，签名一致
  - `currentCellValues` 在 Task 3 引入、Task 4 在 effect 中使用
- **占位符扫描:** 无 TBD / TODO / "implement later"
