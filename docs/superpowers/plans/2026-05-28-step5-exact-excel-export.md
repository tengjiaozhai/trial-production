# Step 5 Preview-Exact Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 最后一步导出的 Excel 完整复刻第 5 步预览表格的结构、合并项、列顺序和主要样式，并且导出结果只保留预览里真正看得到的内容。  
**Architecture:** 把第 5 步预览抽成一个纯表格模型，预览和导出都从同一份模型生成。`TrialProductionTable.tsx` 只负责渲染这个模型，`trialProductionWorkbook.ts` 只负责把同一模型写成 `xlsx` 工作簿，不再维护两套表格规则。  
**Tech Stack:** React 19, TypeScript, Vitest, `xlsx`

---

## 文件结构

- Create: `src/lib/step5TableModel.ts`
- Create: `src/lib/step5TableModel.test.ts`
- Create: `src/lib/trialProductionWorkbook.ts`
- Create: `src/lib/trialProductionWorkbook.test.ts`
- Modify: `src/components/TrialProductionTable.tsx`
- Modify: `src/App.tsx`

## 任务拆分

### Task 1: 先写失败测试，锁定第 5 步表格结构和导出结构

**Files:**
- Create: `src/lib/step5TableModel.test.ts`
- Create: `src/lib/trialProductionWorkbook.test.ts`

- [ ] **Step 1: 写 Step 5 表格模型测试，锁定合并项和列顺序**

```ts
import { describe, expect, it } from 'vitest';
import { buildStep5TableModel } from './step5TableModel';
import type { FieldDefinition, SKUData } from '../types';

const activeFields: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基本信息', behavior: 'manual' },
  { id: 'stage', label: '阶段', group: '基本信息', behavior: 'manual' },
  { id: 'mb_id', label: '主板标识', group: '基本信息', behavior: 'manual' },
  { id: 'storage', label: '存储', group: '基本信息', behavior: 'manual' },
  { id: 'band', label: '出货市场', group: '基本信息', behavior: 'manual' },
  { id: 'emmc', label: 'flash EMMC', group: '存储/主板', behavior: 'manual' },
  { id: 'ddr', label: 'flash DDR', group: '存储/主板', behavior: 'manual' },
];

const skuData: SKUData[] = [
  {
    id: 'sku_1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    supplies: [
      {
        id: 's1',
        supplyKey: '一供',
        label: '一供',
        values: {
          project: 'X6728',
          stage: 'PR1',
          mb_id: 'A1',
          storage: '4+128',
          band: '北美',
          emmc: '14201661一供宏芯宇128G',
          ddr: '14201579一供三星4G',
        },
      },
      {
        id: 's2',
        supplyKey: '二供',
        label: '二供',
        values: {
          project: 'X6728',
          stage: 'PR1',
          mb_id: 'A1',
          storage: '4+128',
          band: '北美',
          emmc: '14201611二供江波龙128G',
          ddr: '14201580二供三星4G',
        },
      },
    ],
  },
];

describe('buildStep5TableModel', () => {
  it('keeps the preview order and merges sku-spanning fields', () => {
    const model = buildStep5TableModel({ activeFields, skuData });

    expect(model.rows[0]).toMatchObject({ kind: 'title', title: '基本信息' });
    expect(model.rows[1]).toMatchObject({ kind: 'field', fieldId: 'project' });
    expect(model.rows.some((row) => row.kind === 'group' && row.title === '基本信息')).toBe(false);

    const storageRow = model.rows.find(
      (row) => row.kind === 'field' && row.fieldId === 'storage'
    );
    expect(storageRow).toBeDefined();
    expect(storageRow!.cells).toEqual([{ value: '4+128', colSpan: 2 }]);

    const emmcRow = model.rows.find((row) => row.kind === 'field' && row.fieldId === 'emmc');
    expect(emmcRow!.cells.map((cell) => cell.colSpan)).toEqual([1, 1]);
    expect(emmcRow!.cells.map((cell) => cell.value)).toEqual([
      '14201661一供宏芯宇128G',
      '14201611二供江波龙128G',
    ]);
  });
});
```

- [ ] **Step 2: 写 workbook 测试，锁定 `!merges`、`!cols` 和关键单元格**

```ts
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildTrialProductionWorkbook } from './trialProductionWorkbook';
import type { FieldDefinition, SKUData } from '../types';

const activeFields: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基本信息', behavior: 'manual' },
  { id: 'stage', label: '阶段', group: '基本信息', behavior: 'manual' },
  { id: 'mb_id', label: '主板标识', group: '基本信息', behavior: 'manual' },
  { id: 'storage', label: '存储', group: '基本信息', behavior: 'manual' },
  { id: 'band', label: '出货市场', group: '基本信息', behavior: 'manual' },
  { id: 'emmc', label: 'flash EMMC', group: '存储/主板', behavior: 'manual' },
  { id: 'ddr', label: 'flash DDR', group: '存储/主板', behavior: 'manual' },
];

const skuData: SKUData[] = [
  {
    id: 'sku_1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    supplies: [
      {
        id: 's1',
        supplyKey: '一供',
        label: '一供',
        values: {
          project: 'X6728',
          stage: 'PR1',
          mb_id: 'A1',
          storage: '4+128',
          band: '北美',
          emmc: '14201661一供宏芯宇128G',
          ddr: '14201579一供三星4G',
        },
      },
      {
        id: 's2',
        supplyKey: '二供',
        label: '二供',
        values: {
          project: 'X6728',
          stage: 'PR1',
          mb_id: 'A1',
          storage: '4+128',
          band: '北美',
          emmc: '14201611二供江波龙128G',
          ddr: '14201580二供三星4G',
        },
      },
    ],
  },
];

describe('buildTrialProductionWorkbook', () => {
  it('writes the same preview structure into the workbook sheet', () => {
    const wb = buildTrialProductionWorkbook({
      projectName: 'X6728',
      activeFields,
      skuData,
      layout: {
        supplyWidths: { s1: 140, s2: 140 },
        rowHeights: { project: 40, storage: 40, emmc: 40 },
      },
    });

    const ws = wb.Sheets['搭配表'];
    expect(ws['A1']?.v).toBe('基本信息');
    expect(ws['A2']?.v).toBe('01');
    expect(ws['B2']?.v).toBe('项目名称');
    expect(ws['C2']?.v).toBe('X6728');

    expect(ws['!merges']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ s: expect.objectContaining({ r: 0, c: 0 }) }),
        expect.objectContaining({ s: expect.objectContaining({ r: 1, c: 2 }) }),
      ])
    );

    expect(ws['!cols']?.length).toBeGreaterThan(3);
    expect(ws['!rows']?.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 跑定向测试，确认当前占位实现还不满足要求**

Run:
```bash
npm test -- src/lib/step5TableModel.test.ts 2>&1 | head -c 4000
npm test -- src/lib/trialProductionWorkbook.test.ts 2>&1 | head -c 4000
```

Expected:
```text
FAIL: 找不到模块 / 函数，或断言不通过
```

- [ ] **Step 4: 提交测试基线**

```bash
git add src/lib/step5TableModel.test.ts src/lib/trialProductionWorkbook.test.ts
git commit -m "test: lock step5 preview export layout"
```

---

### Task 2: 提炼第 5 步纯表格模型，作为预览和导出的唯一来源

**Files:**
- Create: `src/lib/step5TableModel.ts`

- [ ] **Step 1: 实现纯模型，描述第 5 步可见表格而不是第 4 步编辑控件**

```ts
import type { FieldDefinition, SKUData } from '../types';

export interface Step5LayoutSnapshot {
  supplyWidths: Record<string, number>;
  rowHeights: Record<string, number>;
}

export interface Step5Cell {
  value: string;
  colSpan: number;
}

export interface Step5FieldRow {
  kind: 'field';
  indexLabel: string;
  fieldId: string;
  fieldLabel: string;
  cells: Step5Cell[];
}

export interface Step5GroupRow {
  kind: 'group';
  title: string;
}

export interface Step5TitleRow {
  kind: 'title';
  title: string;
}

export type Step5Row = Step5TitleRow | Step5GroupRow | Step5FieldRow;

export interface Step5TableModel {
  columns: Array<{ skuId: string; supplyId: string; label: string }>;
  rows: Step5Row[];
}

const SKU_SPANNING_FIELD_IDS = new Set(['project', 'stage', 'mb_id', 'storage', 'band']);

export function isSkuSpanningField(fieldId: string): boolean {
  return SKU_SPANNING_FIELD_IDS.has(fieldId);
}

export function buildStep5TableModel(args: {
  activeFields: FieldDefinition[];
  skuData: SKUData[];
}): Step5TableModel {
  const columns = args.skuData.flatMap((sku) =>
    sku.supplies.map((supply) => ({
      skuId: sku.id,
      supplyId: supply.id,
      label: supply.label,
    }))
  );

  const rows: Step5Row[] = [{ kind: 'title', title: '基本信息' }];
  let visibleIndex = 1;

  const basicInfoFields = args.activeFields.filter((field) => field.group === '基本信息');
  for (const field of basicInfoFields) {
    const cells: Step5Cell[] = [];
    for (const sku of args.skuData) {
      if (isSkuSpanningField(field.id)) {
        const value = sku.supplies[0]?.values[field.id] ?? '';
        cells.push({ value, colSpan: Math.max(1, sku.supplies.length) });
      } else {
        for (const supply of sku.supplies) {
          cells.push({ value: supply.values[field.id] ?? '', colSpan: 1 });
        }
      }
    }

    rows.push({
      kind: 'field',
      indexLabel: String(visibleIndex).padStart(2, '0'),
      fieldId: field.id,
      fieldLabel: field.label,
      cells,
    });
    visibleIndex += 1;
  }

  const otherGroups = Array.from(
    new Set(args.activeFields.filter((field) => field.group !== '基本信息').map((field) => field.group))
  );
  for (const group of otherGroups) {
    const groupFields = args.activeFields.filter((field) => field.group === group);
    if (groupFields.length === 0) continue;

    rows.push({ kind: 'group', title: group });

    for (const field of groupFields) {
      const cells: Step5Cell[] = [];
      for (const sku of args.skuData) {
        if (isSkuSpanningField(field.id)) {
          const value = sku.supplies[0]?.values[field.id] ?? '';
          cells.push({ value, colSpan: Math.max(1, sku.supplies.length) });
        } else {
          for (const supply of sku.supplies) {
            cells.push({ value: supply.values[field.id] ?? '', colSpan: 1 });
          }
        }
      }

      rows.push({
        kind: 'field',
        indexLabel: String(visibleIndex).padStart(2, '0'),
        fieldId: field.id,
        fieldLabel: field.label,
        cells,
      });
      visibleIndex += 1;
    }
  }

  return { columns, rows };
}
```

- [ ] **Step 2: 运行模型测试，确认纯模型行为稳定**

Run:
```bash
npm test -- src/lib/step5TableModel.test.ts 2>&1 | head -c 4000
```

Expected:
```text
PASS: step5TableModel.test.ts
```

- [ ] **Step 3: 提交纯模型实现**

```bash
git add src/lib/step5TableModel.ts src/lib/step5TableModel.test.ts
git commit -m "feat: extract step5 preview table model"
```

---

### Task 3: 让第 5 步预览直接渲染同一份模型，并把当前布局回传给 App

**Files:**
- Modify: `src/components/TrialProductionTable.tsx`

- [ ] **Step 1: 增加布局快照回传接口，让导出可以拿到当前列宽和行高**

```ts
import type { Step5LayoutSnapshot } from '../lib/step5TableModel';

interface TrialProductionTableProps {
  // ...
  onStep5LayoutChange?: (layout: Step5LayoutSnapshot) => void;
}
```

- [ ] **Step 2: 在 `currentStep === 5` 时改成静态渲染分支，数据来源只用 `buildStep5TableModel()`**

```tsx
const step5Model = buildStep5TableModel({ activeFields, skuData });

if (currentStep === 5) {
  return (
    <div className="...">
      <table className="..." style={{ tableLayout: 'fixed' }}>
        {/* 只渲染 step5Model.rows，不再渲染 Step 4 的新增列、删除按钮、可编辑输入框、resize handle */}
      </table>
    </div>
  );
}
```

- [ ] **Step 3: 在列宽或行高变化时，把当前布局同步给 App**

```ts
useEffect(() => {
  if (currentStep !== 5) return;
  onStep5LayoutChange?.({
    supplyWidths: colWidths,
    rowHeights,
  });
}, [currentStep, colWidths, rowHeights, onStep5LayoutChange]);
```

- [ ] **Step 4: 保留 Step 2/3/4 的编辑行为不变，不要引入第二套预览逻辑**

```tsx
// currentStep 2/3/4 继续沿用现有可编辑渲染路径。
// currentStep 5 只渲染静态预览。
```

- [ ] **Step 5: 跑浏览器手工验证，确认第 5 步还是原来的预览内容，只是渲染来源变成模型**

Run:
```bash
npm run dev 2>&1 | head -c 4000
```

Manual check:
```text
1. 打开 localhost:3000，进入第 5 步。
2. 确认分组顺序、字段顺序、合并项和多列供方顺序没有变。
3. 确认没有出现 Step 4 的“方案名称编辑框”“加列按钮”“删除按钮”“插入按钮”。
```

- [ ] **Step 6: 提交预览重构**

```bash
git add src/components/TrialProductionTable.tsx
git commit -m "refactor: render step5 preview from shared model"
```

---

### Task 4: 用同一份模型生成 Excel 工作簿，包含合并、列宽、行高和基础样式

**Files:**
- Create: `src/lib/trialProductionWorkbook.ts`

- [ ] **Step 1: 实现 workbook builder，直接按模型写 cell、merge、width、height 和样式**

```ts
import * as XLSX from 'xlsx';
import type { FieldDefinition, SKUData } from '../types';
import { buildStep5TableModel, type Step5LayoutSnapshot } from './step5TableModel';

export function buildTrialProductionWorkbook(args: {
  projectName: string;
  activeFields: FieldDefinition[];
  skuData: SKUData[];
  layout?: Step5LayoutSnapshot;
}): XLSX.WorkBook {
  const model = buildStep5TableModel({
    activeFields: args.activeFields,
    skuData: args.skuData,
  });

  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  // 用 encode_cell 手工铺表，避免 aoa_to_sheet 丢失合并和样式控制。
  // A1 是标题行，后续按 model.rows 顺序写入。
  // 表头、分组行、字段行都由同一份模型驱动。

  XLSX.utils.book_append_sheet(wb, ws, '搭配表');
  return wb;
}
```

- [ ] **Step 2: 把预览里的合并规则写进 workbook，确保和第 5 步一一对应**

```ts
// 规则要点：
// 1. title 行跨整张表合并
// 2. group 行跨整张表合并
// 3. project/stage/mb_id/storage/band 按 SKU 横向合并
// 4. emmc/ddr 等非合并字段按 supply 一列一个单元格
// 5. 不写 Step 4 的加列占位列，不写 UI 控件
```

- [ ] **Step 3: 让 workbook 读取 layout snapshot，导出时保留当前预览的列宽和行高**

```ts
// layout.supplyWidths 用来设置 supply 列宽
// layout.rowHeights 用来设置字段行高
// 如果 snapshot 不存在，回退到预览默认宽度，但不新增兼容分支
```

- [ ] **Step 4: 运行 workbook 测试，确认关键单元格和 merge topology 正确**

Run:
```bash
npm test -- src/lib/trialProductionWorkbook.test.ts 2>&1 | head -c 4000
```

Expected:
```text
PASS: trialProductionWorkbook.test.ts
```

- [ ] **Step 5: 提交 workbook 实现**

```bash
git add src/lib/trialProductionWorkbook.ts src/lib/trialProductionWorkbook.test.ts
git commit -m "feat: export step5 preview as excel workbook"
```

---

### Task 5: 把 `App.tsx` 的导出入口切到新 workbook builder，保留现有文件命名逻辑

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 App 里保存第 5 步布局快照，并把它传给表格组件**

```ts
import { buildTrialProductionWorkbook } from './lib/trialProductionWorkbook';
import type { Step5LayoutSnapshot } from './lib/step5TableModel';

const [step5Layout, setStep5Layout] = useState<Step5LayoutSnapshot | null>(null);

<TrialProductionTable
  // ...
  onStep5LayoutChange={setStep5Layout}
/>
```

- [ ] **Step 2: 替换 `performExport()` 的占位 workbook，实现真正导出**

```ts
const performExport = () => {
  const wb = buildTrialProductionWorkbook({
    projectName: projectInfo.name,
    activeFields,
    skuData,
    layout: step5Layout ?? undefined,
  });

  const existingSameName = history.filter((item) => item.name === projectInfo.name);
  const maxVersion =
    existingSameName.length > 0
      ? Math.max(...existingSameName.map((item) => item.version || 1))
      : 1;

  XLSX.writeFile(wb, `搭配表_${projectInfo.name}_V${maxVersion}.xlsx`, { cellStyles: true });
  setIsFlowComplete(true);
};
```

- [ ] **Step 3: 保留第 5 步按钮禁用逻辑，不新增第二个开关**

```tsx
<button
  onClick={handleExport}
  disabled={isExportDisabled}
  className={isExportDisabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#2e7d32] text-white hover:bg-[#1b5e20] active:scale-95'}
>
  完成并导出
</button>
```

- [ ] **Step 4: 跑全量测试和 lint，确认导出改动没有破坏现有流程**

Run:
```bash
npm test 2>&1 | head -c 4000
npm run lint 2>&1 | head -c 4000
```

Expected:
```text
PASS: vitest 全量通过
PASS: tsc --noEmit 通过
```

- [ ] **Step 5: 提交 App 接线改动**

```bash
git add src/App.tsx
git commit -m "refactor: wire step5 export through shared workbook builder"
```

---

### Task 6: 手工验收导出文件和预览的一致性

**Files:**
- No new code files. Use the generated workbook and browser preview for QA.

- [ ] **Step 1: 启动本地页面并在第 5 步人工对照**

Run:
```bash
npm run dev 2>&1 | head -c 4000
```

Manual check:
```text
1. 打开 localhost:3000，进入第 5 步。
2. 确认预览里有多个 supply 列，且顺序与数据一致。
3. 确认 project / stage / mb_id / storage / band 这些行在每个 SKU 下是横向合并的。
4. 确认 group 行跨全表合并。
5. 确认没有 Step 4 的可编辑控件混进第 5 步。
```

- [ ] **Step 2: 导出 Excel，核对 workbook 的结构、合并项和关键内容**

Manual check:
```text
1. 点击“完成并导出”。
2. 打开生成的 xlsx 文件，确认 sheet 名为“搭配表”。
3. 检查第一行标题、分组行、字段行和 supply 列的数量。
4. 检查合并单元格数量和位置是否和预览一致。
5. 检查导出里没有按钮、拖拽把手、插入列、删除列等 UI 元素。
```

- [ ] **Step 3: 最终验证命令**

Run:
```bash
npm test 2>&1 | head -c 4000
npm run lint 2>&1 | head -c 4000
git status --short 2>&1 | head -c 4000
```

Expected:
```text
- test/lint 全通过
- 只保留本次计划涉及的改动
```

## 验收标准

- 导出的 Excel 使用同一份 Step 5 模型生成，和浏览器里的第 5 步预览没有两套布局逻辑。
- 导出文件包含与预览一致的多个 supply 列，且列顺序、字段顺序、分组顺序一致。
- `project`、`stage`、`mb_id`、`storage`、`band` 这些 Step 5 里跨 supply 的字段，在 Excel 里也必须横向合并。
- 分组行在 Excel 中必须跨整张表合并，不能拆成多个单元格。
- 导出文件不能包含 Step 4 的编辑控件、加列占位列、删除按钮、插入按钮或其它 UI 组件。
- 导出的 workbook 必须保留预览的主要样式信息，包括边框、对齐、填充和基础列宽/行高。
- `npm test` 和 `npm run lint` 必须通过。
- 浏览器里第 5 步预览和导出的 Excel 需要人工对照通过。

## 假设

- “完完全全复刻”优先指结构、合并项、列顺序、组顺序和主要样式，不要求 Excel 像网页像素级一致。
- `xlsx` 的列宽单位和网页像素不完全等价，所以宽度只能做到一致的比例和观感，不能承诺 1:1 像素级匹配。
- 第 5 步预览是权威来源，导出不新增任何 Step 4 的编辑逻辑或兼容路径。
