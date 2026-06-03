# 第二步 PCBA 单元格冲突消解实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第二步基于同一 PCBA 的全部原始配置行计算字段级候选值，冲突单元格显示空输入框、红框和候选值小字，用户点击候选或手动输入后立即消除冲突，并且重新自动获取时重置这些选择。

**Architecture:** 配置表解析一次产出两份结果：给 Step 1 用的聚合 `pcbaOptions`，以及给 Step 2 用的原始 `pcbaRows`。`startAutoCalc` 不再对 `checkedPcbaOptions` 做 `find(first match)`，而是基于 `pcbaRows` 逐字段收集候选值，唯一非空值自动填入，2 个及以上不同非空值则写空并生成冲突 DTO。`skuData` 仍然是已选值的唯一权威来源，`TrialProductionTable.tsx` 只负责渲染冲突单元格和候选按钮，`Sidebar.tsx` 只负责定位到稳定的 `data-step2-cell-id`。

**Tech Stack:** React 19, TypeScript, Vitest, xlsx, DOM `data-*` hooks

**Assumptions:**
- `checkedPcbaOptions` 继续表示用户勾选的唯一 PCBA 列表，不改成重复列模式。
- 候选值展示全部唯一非空项，不截断。
- 只要单元格已有非空手动值，就视为已解决，不再显示冲突态。
- 重新自动获取时，之前的手动解决结果全部重置。

---

## File Structure

- Modify: `src/types.ts` - 增加 `PcbaSourceRow`、`PcbaWorkbookParseResult`、`Step2CellConflict` 相关类型，并给 `ProjectInfo` 增加 `pcbaRows`.
- Modify: `src/lib/utils.ts` - 把 PCBA 解析收敛成一个返回 `{ pcbaOptions, pcbaRows }` 的 canonical 入口。
- Modify: `src/lib/utils.test.ts` - 让解析测试同时覆盖聚合结果和原始重复行保留。
- Create: `src/lib/step2CellConflicts.ts` - 纯函数：基于原始 PCBA 行、当前 `skuData` 和已勾选 PCBA 计算单元格级冲突。
- Create: `src/lib/step2CellConflicts.test.ts` - 单元格级候选值去重、自动填充、冲突生成和已解决状态覆盖。
- Delete: `src/lib/step2PcbaConflicts.ts` - 旧的重复 PCBA 卡片级冲突 helper，不再保留。
- Delete: `src/lib/step2PcbaConflicts.test.ts` - 配套旧测试一起移除。
- Modify: `src/App.tsx` - 保存 `pcbaRows`，用新 helper 计算 Step 2 冲突，传给表格和侧边栏。
- Modify: `src/components/TrialProductionTable.tsx` - 渲染冲突单元格、候选按钮和稳定定位属性。
- Modify: `src/components/Sidebar.tsx` - 改成展示单元格级冲突，并定位到精确 cell。
- Modify: `src/components/TrialProductionTable.test.tsx` - 覆盖冲突单元格渲染、候选点击、手动输入清除冲突。
- Modify: `src/components/Sidebar.test.tsx` - 覆盖侧边栏点击后定位到精确单元格而不是只滚到 `mb_id` 行。

## 验收标准

- Step 1 继续只显示唯一 PCBA，不生成重复列。
- Step 2 中，单元格只要有 1 个唯一非空候选就自动填；有 2 个及以上不同非空候选就显示冲突态。
- 冲突态单元格输入框内为空，边框红色，下面展示所有候选值小字。
- 点击候选值后，当前 cell 立即写入值，冲突从 UI 中消失。
- 手动输入任意非空值后，冲突也消失。
- 侧边栏冲突卡点击后能滚动到精确 cell，定位 hook 不再只依赖 `step2-mb-id-cell`。
- 只要还有未解决的单元格冲突，第二步“下一步”仍然不可进入下一步。
- 重新自动获取时，之前选过的冲突值会回到未解决状态。

### Task 1: 让 PCBA 解析同时保留聚合结果和原始重复行

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/utils.ts`
- Modify: `src/lib/utils.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写失败测试，要求解析结果同时返回聚合选项和原始行**

在 `src/lib/utils.test.ts` 新增一个用例，验证同一 PCBA 的两条原始记录不会被吞掉，Step 1 仍然只拿到 1 个聚合选项。

```ts
import { extractPcbaWorkbookData } from './utils';

it('preserves raw duplicate rows while still aggregating step1 options', async () => {
  const file = makeXlsxFile([
    ['PCBA配置', '出货市场', '项目名称', 'EMMC', 'DDR'],
    ['A1', 'SSA', 'X6728', '128G', '4G'],
    ['A1', 'LATAM', 'X6728', '256G', '8G'],
  ]);

  const result = await extractPcbaWorkbookData(file);

  expect(result.pcbaOptions).toEqual([
    {
      pcba: 'A1',
      projectName: 'X6728',
      band: '',
      bandConflict: true,
      duplicateConflict: true,
      duplicateCount: 2,
      emmc: '128G',
      ddr: '4G',
    },
  ]);

  expect(result.pcbaRows).toEqual([
    {
      pcba: 'A1',
      sourceIndex: 0,
      values: {
        projectName: 'X6728',
        band: 'SSA',
        emmc: '128G',
        ddr: '4G',
      },
    },
    {
      pcba: 'A1',
      sourceIndex: 1,
      values: {
        projectName: 'X6728',
        band: 'LATAM',
        emmc: '256G',
        ddr: '8G',
      },
    },
  ]);
});
```

- [ ] **Step 2: 运行解析测试，确认它先失败**

Run:

```bash
npm run test -- src/lib/utils.test.ts
```

Expected: 新增的 `extractPcbaWorkbookData` 还不存在，或者返回结构不完整，测试失败。

- [ ] **Step 3: 实现新的 canonical 解析入口**

在 `src/types.ts` 增加原始行与解析结果类型：

```ts
export interface PcbaSourceRow {
  pcba: string;
  sourceIndex: number;
  values: Record<string, string>;
}

export interface PcbaWorkbookParseResult {
  pcbaOptions: PcbaOption[];
  pcbaRows: PcbaSourceRow[];
}

export interface ProjectInfo {
  // ...
  pcbaOptions?: PcbaOption[];
  pcbaRows?: PcbaSourceRow[];
  // ...
}
```

在 `src/lib/utils.ts` 把原来的 workbook 扫描逻辑收敛到一个返回对象的入口：

```ts
export async function extractPcbaWorkbookData(file: File): Promise<PcbaWorkbookParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // 复用现有的表头定位、market 列识别和重复行统计逻辑
  // 同时维护 pcbaRows，用于 Step 2 逐字段候选值计算
}
```

在 `src/App.tsx` 里把配置表上传路径切到这个新入口，并把 `pcbaRows` 一起写入 `projectInfo`：

```ts
const parsed = await extractPcbaWorkbookData(configFile as File);
setProjectInfo(prev => ({
  ...prev,
  pcbaOptions: parsed.pcbaOptions,
  pcbaRows: parsed.pcbaRows,
  checkedPcbaOptions: prev.checkedPcbaOptions && prev.checkedPcbaOptions.length > 0
    ? prev.checkedPcbaOptions
    : [],
}));
```

- [ ] **Step 4: 重新运行解析测试和 lint**

Run:

```bash
npm run test -- src/lib/utils.test.ts
npm run lint
```

Expected: 解析测试通过，`pcbaOptions` 仍然保持原有聚合语义，`pcbaRows` 保留所有原始重复行。

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/utils.ts src/lib/utils.test.ts src/App.tsx
git commit -m "feat: preserve raw pcba rows for step2 conflicts"
```

### Task 2: 用原始行生成单元格级冲突模型

**Files:**
- Create: `src/lib/step2CellConflicts.ts`
- Create: `src/lib/step2CellConflicts.test.ts`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Delete: `src/lib/step2PcbaConflicts.ts`
- Delete: `src/lib/step2PcbaConflicts.test.ts`

- [ ] **Step 1: 写失败测试，覆盖 sku-scoped 和 supply-scoped 冲突**

在 `src/lib/step2CellConflicts.test.ts` 新增两个用例：一个是整行共享的 `stage` 冲突，一个是供应商单元格的 `lcd` 冲突。

```ts
import { describe, it, expect } from 'vitest';
import { buildStep2CellConflicts } from './step2CellConflicts';

it('emits one unresolved supply cell conflict when duplicate source rows produce two different candidates', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { lcd: 'BOE', emmc: '128G' } },
      { pcba: 'A1', sourceIndex: 1, values: { lcd: 'CSOT', emmc: '128G' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { lcd: '' } },
        ],
      },
    ],
  });

  expect(result).toEqual([
    {
      kind: 'cell_conflict',
      scope: 'supply',
      cellId: 'step2-cell-sku-1-sup-1-lcd',
      skuId: 'sku-1',
      supplyId: 'sup-1',
      fieldId: 'lcd',
      fieldLabel: 'LCD',
      pcba: 'A1',
      supplyLabel: '一供',
      candidates: ['BOE', 'CSOT'],
    },
  ]);
});

it('does not emit a conflict when the current cell already has a resolved non-empty value', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { stage: 'PR1' } },
      { pcba: 'A1', sourceIndex: 1, values: { stage: 'PR2' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { stage: 'PR1' } },
        ],
      },
    ],
  });

  expect(result).toEqual([]);
});
```

- [ ] **Step 2: 运行 helper 测试，确认它先失败**

Run:

```bash
npm run test -- src/lib/step2CellConflicts.test.ts
```

Expected: `buildStep2CellConflicts` 还不存在，或者返回的是旧的 `duplicate_pcba` 卡片模型，测试失败。

- [ ] **Step 3: 实现新的 helper 并删除旧 helper**

在 `src/lib/step2CellConflicts.ts` 定义新的冲突类型和纯函数：

```ts
export interface Step2CellConflict {
  kind: 'cell_conflict';
  scope: 'sku' | 'supply';
  cellId: string;
  skuId: string;
  supplyId?: string;
  fieldId: string;
  fieldLabel: string;
  pcba: string;
  supplyLabel: string;
  candidates: string[];
}

export function buildStep2CellConflicts(input: {
  checkedPcbaOptions: string[];
  pcbaRows: PcbaSourceRow[];
  skuData: SKUData[];
}): Step2CellConflict[] {
  // 1. 按 pcba 分组原始行
  // 2. 针对 Step 2 会自动填的每个 field 收集唯一非空候选
  // 3. 单一候选直接视为已解析，2 个及以上不同候选时生成冲突 DTO
  // 4. 已有非空手动值的 cell 直接跳过
}
```

同时在 `src/App.tsx` 把当前 `step2Conflicts` 的 `useMemo` 改成读取 `pcbaRows`，不再读取旧的 `step2PcbaConflicts`：

```ts
const step2Conflicts = useMemo(
  () =>
    buildStep2CellConflicts({
      checkedPcbaOptions: projectInfo.checkedPcbaOptions ?? [],
      pcbaRows: projectInfo.pcbaRows ?? [],
      skuData,
    }),
  [projectInfo.checkedPcbaOptions, projectInfo.pcbaRows, skuData]
);
```

- [ ] **Step 4: 重新运行 helper 测试和 lint**

Run:

```bash
npm run test -- src/lib/step2CellConflicts.test.ts src/lib/utils.test.ts
npm run lint
```

Expected: 冲突 helper 只在 `2+` 不同候选时返回未解决 cell，单一候选自动消失。

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/App.tsx src/lib/step2CellConflicts.ts src/lib/step2CellConflicts.test.ts src/lib/utils.ts src/lib/utils.test.ts
git rm src/lib/step2PcbaConflicts.ts src/lib/step2PcbaConflicts.test.ts
git commit -m "feat: derive step2 cell conflicts from raw pcba rows"
```

### Task 3: 渲染冲突单元格和侧边栏精确定位

**Files:**
- Modify: `src/components/TrialProductionTable.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/TrialProductionTable.test.tsx`
- Modify: `src/components/Sidebar.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 写失败测试，覆盖空红框和候选按钮**

在 `src/components/TrialProductionTable.test.tsx` 增加一个 step 2 冲突单元格用例，要求输入框内为空、边框红色、候选值都渲染出来，并且点击候选会调用原有的更新回调。

```ts
it('renders an unresolved conflict cell as a blank red input with candidate chips', () => {
  const onUpdateValue = vi.fn();

  render(
    <TrialProductionTable
      currentStep={2}
      skuData={[
        {
          id: 'sku-1',
          stage: 'PR1',
          orderNo: '',
          project: 'A1',
          supplies: [
            {
              id: 'sup-1',
              supplyKey: '一供',
              label: '一供',
              values: { lcd: '' },
            },
          ],
        },
      ]}
      step2Conflicts={[
        {
          kind: 'cell_conflict',
          scope: 'supply',
          cellId: 'step2-cell-sku-1-sup-1-lcd',
          skuId: 'sku-1',
          supplyId: 'sup-1',
          fieldId: 'lcd',
          fieldLabel: 'LCD',
          pcba: 'A1',
          supplyLabel: '一供',
          candidates: ['BOE', 'CSOT'],
        },
      ]}
      onUpdateValue={onUpdateValue}
      activeFields={[
        { id: 'lcd', label: 'LCD', group: '器件规格', behavior: 'calc' },
      ]}
    />
  );

  expect(screen.getByTestId('step2-cell-sku-1-sup-1-lcd')).toHaveClass('border-rose-500');
  expect(screen.getByPlaceholderText('-')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'BOE' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'CSOT' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'BOE' }));
  expect(onUpdateValue).toHaveBeenCalledWith('sku-1', 'sup-1', 'lcd', 'BOE');
});
```

再在 `src/components/Sidebar.test.tsx` 增加一个用例，要求侧边栏点击后定位到 `data-step2-cell-id` 对应的元素，而不是只滚到 `mb_id` 行。

```ts
it('scrolls to the exact conflict cell by data-step2-cell-id', () => {
  const target = document.createElement('div');
  target.dataset.step2CellId = 'step2-cell-sku-1-sup-1-lcd';
  target.scrollIntoView = vi.fn();
  document.body.appendChild(target);

  render(
    <Sidebar
      currentStep={2}
      projectInfo={{ name: '', customer: '', stage: '', files: [] }}
      skuData={[]}
      validationResults={[]}
      onGoBack={vi.fn()}
      isFlowComplete={false}
      setIsFlowComplete={vi.fn()}
      onRunValidation={vi.fn()}
      step2Conflicts={[
        {
          kind: 'cell_conflict',
          scope: 'supply',
          cellId: 'step2-cell-sku-1-sup-1-lcd',
          skuId: 'sku-1',
          supplyId: 'sup-1',
          fieldId: 'lcd',
          fieldLabel: 'LCD',
          pcba: 'A1',
          supplyLabel: '一供',
          candidates: ['BOE', 'CSOT'],
        },
      ]}
    />
  );

  fireEvent.click(screen.getByText('点击定位'));
  expect(target.scrollIntoView).toHaveBeenCalledWith(
    expect.objectContaining({ inline: 'center' })
  );
});
```

- [ ] **Step 2: 运行组件测试，确认它们先失败**

Run:

```bash
npm run test -- src/components/TrialProductionTable.test.tsx src/components/Sidebar.test.tsx
```

Expected: 组件还没有冲突 cell UI 和 `data-step2-cell-id` 定位逻辑，测试失败。

- [ ] **Step 3: 实现表格和侧边栏渲染**

在 `src/components/TrialProductionTable.tsx`：

```ts
interface TrialProductionTableProps {
  // ...
  step2Conflicts?: Step2CellConflict[];
}

const conflictByCellId = new Map(step2Conflicts?.map((item) => [item.cellId, item] as const));
```

对于 `step2Conflicts` 命中的 cell：

```tsx
<td
  data-testid={conflict.cellId}
  data-step2-cell-id={conflict.cellId}
  data-sku-id={sku.id}
  data-supply-id={conflict.supplyId}
  data-field-id={field.id}
>
  <input value="" className="border-rose-500 ring-1 ring-rose-200" />
  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-[#2563EB]">
    {conflict.candidates.map((candidate) => (
      <button
        key={candidate}
        type="button"
        onClick={() => onUpdateValue(sku.id, conflict.supplyId ?? sku.supplies[0].id, field.id, candidate)}
      >
        {candidate}
      </button>
    ))}
  </div>
</td>
```

在 `src/components/Sidebar.tsx` 把旧的 `duplicate_pcba` 类型删掉，改成导入新的 `Step2CellConflict`，并把定位逻辑改为：

```ts
const cell = document.querySelector<HTMLElement>(
  `[data-step2-cell-id="${conflict.cellId}"]`
);
if (!cell) return;
cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
```

同时把侧边栏卡片文案改成字段级提示，例如 `LCD存在冲突`，detail 里保留 `pcba` 和 `supplyLabel`，不要再写“主板重复 2 次”。

- [ ] **Step 4: 重新运行组件测试和 lint**

Run:

```bash
npm run test -- src/components/TrialProductionTable.test.tsx src/components/Sidebar.test.tsx src/lib/step2CellConflicts.test.ts
npm run lint
```

Expected: 冲突 cell 在表格里显示空红框和候选值，侧边栏点击能滚到精确 cell。

- [ ] **Step 5: Commit**

```bash
git add src/components/TrialProductionTable.tsx src/components/Sidebar.tsx src/components/TrialProductionTable.test.tsx src/components/Sidebar.test.tsx
git commit -m "feat: render step2 cell conflicts with exact cell targeting"
```

### Task 4: 验证下一步禁用、重算重置和端到端回归

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 确认下一步按钮仍然依赖未解决冲突数**

`src/App.tsx` 里继续让第二步的“下一步”按钮依赖 `step2Conflicts.length > 0`，不要恢复成只看旧的重复 PCBA 卡片数。

```ts
const disableNextToPreview =
  (currentStep === 4 && isExportDisabled) ||
  (currentStep === 2 && step2Conflicts.length > 0);
```

- [ ] **Step 2: 运行完整相关测试**

Run:

```bash
npm run test -- src/lib/utils.test.ts src/lib/step2CellConflicts.test.ts src/components/TrialProductionTable.test.tsx src/components/Sidebar.test.tsx
```

Expected: 解析、冲突模型、表格渲染和侧边栏定位都通过。

- [ ] **Step 3: 用浏览器做一次完整手工回归**

1. Run: `npm run dev`
2. 打开 `http://localhost:3000`
3. 上传一份包含同一 PCBA 多条记录的配置表
4. 进入第二步，确认冲突单元格是空输入框 + 红框 + 下方候选值
5. 点击一个候选值，确认该单元格立即变成普通值
6. 再点一次“自动获取”或重新计算，确认冲突状态被重置回初始状态
7. 确认只要还有未解决冲突，“下一步”仍然不可点击

- [ ] **Step 4: 最终 Commit**

```bash
git add src/App.tsx
git commit -m "feat: reset step2 cell conflicts on recalculation"
```

## Notes

- 这次改动不要保留旧的 `duplicate_pcba` 卡片模型和旧 helper 路径。
- Step 2 的冲突状态必须从原始配置行推导，不能继续从 `pcbaOptions.find(...)` 取第一条记录。
- 如果某个 cell 只有唯一非空值，不要把它当冲突展示。
