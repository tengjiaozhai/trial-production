# Table Viewport And Sidebar Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让多供方和多主板标识场景下的表格上下区域严格等宽，并补上可见的横向滚动与可收缩 Sidebar，从而给表格留出更大的视野。

**Architecture:** 抽出一个很小的 viewport metrics helper 统一计算表格总宽度、总列数和 step4 附加列数，`TrialProductionTable` 的顶部和底部两个 `<table>` 共享同一份结果。Sidebar 的展开/收起由 `App` 持有会话级状态并向下传递，主内容区通过 `min-w-0` 和宽度过渡自动扩展，不写入持久化存储。

**Tech Stack:** React 19, TypeScript, Vitest, Tailwind CSS

---

### Task 1: Add Shared Viewport Metrics

**Files:**
- Create: `src/lib/tableViewport.ts`
- Test: `src/lib/tableViewport.test.ts`
- Modify: `src/components/TrialProductionTable.tsx`

- [ ] **Step 1: Write the failing test for shared width math**

```ts
import { describe, expect, it } from 'vitest';
import { buildTableViewportMetrics } from './tableViewport';

describe('buildTableViewportMetrics', () => {
  it('returns one shared table width for both table shells', () => {
    const metrics = buildTableViewportMetrics({
      currentStep: 2,
      skuData: [
        {
          id: 'sku1',
          stage: 'PR1',
          orderNo: '',
          project: 'X6728',
          supplies: [
            { id: 's1', supplyKey: '一供', label: '一供', values: {} },
            { id: 's2', supplyKey: '二供', label: '二供', values: {} },
          ],
        },
      ],
      colWidths: { s1: 140, s2: 180 },
    });

    expect(metrics.totalTableWidthPx).toBe(metrics.topTableWidthPx);
    expect(metrics.totalTableWidthPx).toBe(metrics.bottomTableWidthPx);
    expect(metrics.basicInfoColSpan).toBe(metrics.bodyColSpan);
    expect(metrics.totalValueColumns).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- src/lib/tableViewport.test.ts`  
Expected: FAIL with missing module/function errors.

- [ ] **Step 3: Implement the minimal viewport helper**

```ts
import type { SKUData, StepId } from '../types';

const INDEX_COL_WIDTH = 32;
const FIELD_COL_WIDTH = 120;
const STEP4_EXTRA_COL_WIDTH = 40;

export interface TableViewportMetrics {
  totalTableWidthPx: number;
  topTableWidthPx: number;
  bottomTableWidthPx: number;
  totalValueColumns: number;
  basicInfoColSpan: number;
  bodyColSpan: number;
}

export function buildTableViewportMetrics(args: {
  currentStep: StepId;
  skuData: SKUData[];
  colWidths: Record<string, number>;
}): TableViewportMetrics {
  const supplyColumns = args.skuData.reduce((acc, sku) => acc + sku.supplies.length, 0);
  const step4ExtraColumns = args.currentStep === 4 ? args.skuData.length : 0;
  const totalValueColumns = supplyColumns + step4ExtraColumns;
  const supplyWidthPx = args.skuData.reduce(
    (acc, sku) => acc + sku.supplies.reduce((sum, supply) => sum + (args.colWidths[supply.id] ?? 140), 0),
    0,
  );

  const totalTableWidthPx =
    INDEX_COL_WIDTH +
    FIELD_COL_WIDTH +
    supplyWidthPx +
    step4ExtraColumns * STEP4_EXTRA_COL_WIDTH;

  return {
    totalTableWidthPx,
    topTableWidthPx: totalTableWidthPx,
    bottomTableWidthPx: totalTableWidthPx,
    totalValueColumns,
    basicInfoColSpan: 2 + totalValueColumns,
    bodyColSpan: 2 + totalValueColumns,
  };
}
```

- [ ] **Step 4: Wire the helper into `TrialProductionTable`**

```ts
const viewport = buildTableViewportMetrics({ currentStep, skuData, colWidths });
const tableStyle = {
  tableLayout: 'fixed' as const,
  width: `${viewport.totalTableWidthPx}px`,
  minWidth: `${viewport.totalTableWidthPx}px`,
};
```

- [ ] **Step 5: Re-run the unit test and commit**

Run: `npm run test -- src/lib/tableViewport.test.ts`  
Expected: PASS.

```bash
git add src/lib/tableViewport.ts src/lib/tableViewport.test.ts src/components/TrialProductionTable.tsx
git commit -m "feat: add shared viewport metrics for trial table"
```

### Task 2: Make the Table Use a Single Horizontal Viewport

**Files:**
- Modify: `src/components/TrialProductionTable.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace hardcoded table width assumptions with the shared metrics**

```tsx
<div className="relative border border-slate-200 rounded shadow-sm bg-white overflow-hidden flex flex-col h-[calc(100vh-280px)] min-w-0">
  <div
    ref={topTableRef}
    onScroll={handleScroll('top')}
    className="overflow-x-auto overflow-y-hidden shrink-0 z-20 border-b-2 border-slate-300 shadow-sm min-w-0"
  >
    <table className="text-sm border-separate border-spacing-0" style={tableStyle}>
      <thead>
        <tr>
          <th colSpan={viewport.basicInfoColSpan}>基本信息</th>
        </tr>
      </thead>
    </table>
  </div>

  <div
    ref={bottomTableRef}
    onScroll={handleScroll('bottom')}
    className="overflow-auto flex-1 z-0 scrollbar-thin scrollbar-thumb-slate-300 relative bg-white min-w-0"
  >
    <table className="text-sm border-separate border-spacing-0" style={tableStyle}>
      <tbody>{/* same column model as top table */}</tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 2: Keep top and bottom scroll positions synchronized**

```ts
const handleScroll = (source: 'top' | 'bottom') => (e: React.UIEvent<HTMLDivElement>) => {
  const scrollLeft = e.currentTarget.scrollLeft;
  if (source === 'top' && bottomTableRef.current) {
    bottomTableRef.current.scrollLeft = scrollLeft;
  } else if (source === 'bottom' && topTableRef.current) {
    topTableRef.current.scrollLeft = scrollLeft;
  }
};
```

- [ ] **Step 3: Make the app shell allow horizontal growth**

```tsx
<div className="flex flex-1 overflow-hidden relative min-w-0">
  <Sidebar
    currentStep={currentStep}
    projectInfo={projectInfo}
    skuData={skuData}
    validationResults={validationResults}
    onBackToEdit={() => setCurrentStep(3)}
    onGoBack={goBack}
    isFlowComplete={isFlowComplete}
    setIsFlowComplete={setIsFlowComplete}
    onRunValidation={runValidation}
    step2Conflicts={step2Conflicts}
  />

  <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6 pb-24 scroll-smooth">
    {/* table views */}
  </main>
</div>
```

- [ ] **Step 4: Manually verify the wide-table scenarios**

Run: `npm run dev`  
Expected:
- 选择多个主板标识后，顶部“基本信息”和下方其他块边界完全对齐。
- 表格出现可见的横向滚动体验，右侧列能顺畅预览。
- 第2步、第3步、第4步、第5步的表格壳都不会被父容器静默裁切。

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/TrialProductionTable.tsx
git commit -m "feat: align trial table viewport and horizontal scrolling"
```

### Task 3: Add a Collapsible Sidebar Rail

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add a session-level collapsed state to the app shell**

```ts
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
```

- [ ] **Step 2: Pass collapse state and toggle handler into Sidebar**

```tsx
<Sidebar
  currentStep={currentStep}
  projectInfo={projectInfo}
  skuData={skuData}
  validationResults={validationResults}
  onBackToEdit={() => setCurrentStep(3)}
  onGoBack={goBack}
  isFlowComplete={isFlowComplete}
  setIsFlowComplete={setIsFlowComplete}
  onRunValidation={runValidation}
  step2Conflicts={step2Conflicts}
  collapsed={sidebarCollapsed}
  onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
/>
```

- [ ] **Step 3: Implement the sidebar rail and arrow control**

```tsx
export function Sidebar({ collapsed, onToggleCollapsed, ...rest }: SidebarProps) {
  return (
    <aside
      className={cn(
        "relative h-full bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-10 transition-all duration-300 ease-out",
        collapsed ? "w-12" : "w-80",
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-[#0f2e4a] hover:border-[#0f2e4a] transition-colors z-20"
      >
        <ArrowLeft size={14} className={cn("transition-transform", collapsed && "rotate-180")} />
      </button>

      <div className={cn("flex-1 overflow-hidden transition-opacity duration-200", collapsed && "opacity-0 pointer-events-none")}>
        {/* existing sidebar content */}
      </div>

      {collapsed && (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <AlertCircle size={16} />
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Make the main content claim the freed width**

```tsx
<main className={cn(
  "flex-1 min-w-0 overflow-y-auto p-4 md:p-6 pb-24 scroll-smooth transition-[padding] duration-300",
  sidebarCollapsed ? "md:p-4" : "md:p-6",
)}>
```

- [ ] **Step 5: Verify the collapsed/expanded experience and commit**

Run: `npm run dev`  
Expected:
- 点击 Sidebar 箭头后，左侧面板向左收缩，表格获得更大视野。
- 再次点击后可恢复默认展开。
- 冲突定位、步骤切换和底部操作按钮不受影响。

```bash
git add src/App.tsx src/components/Sidebar.tsx
git commit -m "feat: add collapsible sidebar rail"
```

---

## Final Verification Checklist

- [ ] `npm run lint` 通过。
- [ ] `npm run test` 通过。
- [ ] 多主板标识 + 多供方时，顶部基本信息块与下方其他块严格等宽。
- [ ] 横向预览可见，右侧数据可被拖到视口中查看。
- [ ] Sidebar 可收起，收起后表格视野明显增大。

## Assumptions

- Sidebar 收起状态只保留在当前会话内，不写入 `localStorage`。
- 本次只处理视口和布局层，不改供应数据、校验规则或导出逻辑。
- 横向滚动仍由现有 top/bottom 两段同步机制负责，只是改成“宽度显式一致、滚动可见可操作”的状态。
