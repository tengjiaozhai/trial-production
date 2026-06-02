# Duplicate PCBA Conflict Surfacing in Step 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `extractPcbaOptions` sees the same PCBA/mainboard identifier more than once, step 2 should still build the board once, but the sidebar must surface a duplicate-conflict card and the table must expose a precise DOM target for the affected `mb_id` cell wrapper.

**Architecture:** Keep `extractPcbaOptions` as the canonical parser and add duplicate metadata directly to `PcbaOption`. Add one small pure helper that turns selected PCBA options into step-2 duplicate-conflict DTOs so `App.tsx` stops carrying ad hoc conflict logic. `TrialProductionTable.tsx` only gets `data-*` hooks on the `mb_id` cell wrapper, and `Sidebar.tsx` owns the click-to-scroll / temporary red-border effect.

**Tech Stack:** React 19, TypeScript, Vitest, xlsx, DOM `data-*` attributes

**Execution Shape:** Do Task 1 first because it changes the shared contract. After that, Task 2 and Task 3 can be dispatched to separate agents in parallel; they touch different surfaces once the new type/helper shapes are in place.

---

### Task 1: Parse Duplicate PCBA Metadata

**Files:**
- Modify: `src/types.ts`
- Modify: `src/lib/utils.ts`
- Modify: `src/lib/utils.test.ts`

- [ ] **Step 1: Write failing tests for duplicate PCBA metadata**

```ts
describe('extractPcbaOptions', () => {
  it('flags duplicate PCBA rows even when the repeated rows are identical', async () => {
    const aoa = [
      ['PCBA配置', '出货市场', 'EMMC', 'DDR'],
      ['D1', 'SSA', '128G', '4G'],
      ['D1', 'SSA', '128G', '4G'],
    ];
    const result = await extractPcbaOptions(makeXlsxFile(aoa));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      pcba: 'D1',
      projectName: '',
      band: 'SSA',
      bandConflict: false,
      duplicateConflict: true,
      duplicateCount: 2,
      emmc: '128G',
      ddr: '4G',
    });
  });

  it('keeps bandConflict independent from duplicateConflict', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['D1', 'SSA'],
      ['D1', 'LATAM'],
    ];
    const result = await extractPcbaOptions(makeXlsxFile(aoa));

    expect(result[0]).toMatchObject({
      pcba: 'D1',
      band: '',
      bandConflict: true,
      duplicateConflict: true,
      duplicateCount: 2,
    });
  });
});
```

- [ ] **Step 2: Run the parser test and verify it fails**

Run: `npm run test -- src/lib/utils.test.ts`
Expected: the new expectations fail because `PcbaOption` has no duplicate fields yet and `extractPcbaOptions` still drops repeated rows silently.

- [ ] **Step 3: Add the duplicate fields and count rows in the parser**

```ts
export interface PcbaOption {
  pcba: string;
  projectName: string;
  band: string;
  bandConflict: boolean;
  duplicateConflict: boolean;
  duplicateCount: number;
  emmc: string;
  ddr: string;
}
```

```ts
const pcbaCounts = new Map<string, number>();

for (let r = headerRowIdx + 1; r < aoa.length; r++) {
  const row = aoa[r];
  const rawVal = row[headerColIdx];
  if (rawVal === null || rawVal === undefined) continue;

  const val = String(rawVal).trim();
  if (!val) continue;

  const isMergedRow = /[一-龥]/.test(val) || /\s/.test(val);
  if (isMergedRow) continue;

  pcbaCounts.set(val, (pcbaCounts.get(val) ?? 0) + 1);
  if (!pcbaMarkets.has(val)) {
    // keep the current first-occurrence parsing logic exactly as-is
  }
}

// when building the result:
const duplicateCount = pcbaCounts.get(pcba) ?? 1;
return {
  pcba,
  projectName,
  band,
  bandConflict,
  duplicateConflict: duplicateCount > 1,
  duplicateCount,
  emmc,
  ddr,
};
```

- [ ] **Step 4: Re-run the parser tests and lint**

Run:
- `npm run test -- src/lib/utils.test.ts`
- `npm run lint`

Expected:
- The updated parser tests pass.
- Existing `bandConflict` cases still behave the same.
- Non-duplicate PCBA rows still return `duplicateConflict: false` and `duplicateCount: 1`.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: expose duplicate pcba metadata from parser"
```

### Task 2: Build Step 2 Conflict Plumbing and Table Target Hooks

**Files:**
- Create: `src/lib/step2PcbaConflicts.ts`
- Test: `src/lib/step2PcbaConflicts.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TrialProductionTable.tsx`
- Modify: `src/components/TrialProductionTable.test.tsx`

- [ ] **Step 1: Write failing tests for the conflict helper and table locator hook**

```ts
import { buildStep2DuplicatePcbaConflicts } from './step2PcbaConflicts';

it('returns one duplicate conflict card for a selected duplicated PCBA', () => {
  const conflicts = buildStep2DuplicatePcbaConflicts({
    pcbaOptions: [
      {
        pcba: 'D1',
        projectName: 'X6728',
        band: 'SSA',
        bandConflict: false,
        duplicateConflict: true,
        duplicateCount: 2,
        emmc: '128G',
        ddr: '4G',
      },
      {
        pcba: 'E1',
        projectName: 'X6728',
        band: 'LATAM',
        bandConflict: false,
        duplicateConflict: false,
        duplicateCount: 1,
        emmc: '256G',
        ddr: '8G',
      },
    ],
    checkedPcbaOptions: ['D1', 'E1'],
    skuData: [
      { id: 'sku_1', stage: 'PR1', orderNo: '', project: 'D1', supplies: [] },
      { id: 'sku_2', stage: 'PR1', orderNo: '', project: 'E1', supplies: [] },
    ],
  });

  expect(conflicts).toEqual([
    {
      kind: 'duplicate_pcba',
      pcba: 'D1',
      duplicateCount: 2,
      skuId: 'sku_1',
      fieldId: 'mb_id',
      fieldLabel: '主板标识',
      detail: '主板标识 D1 在配置表中出现 2 次，自动获取已暂停，请人工确认',
    },
  ]);
});
```

```tsx
it('marks the mb_id cell wrapper with a step2 locator on the visible duplicated board', () => {
  render(
    <TrialProductionTable
      currentStep={2}
      skuData={[
        {
          id: 'sku_1',
          stage: 'PR1',
          orderNo: '',
          project: 'D1',
          supplies: [{ id: 's1', supplyKey: '一供', label: '一供', values: {} }],
        },
      ]}
      activeFields={[baseField, { id: 'mb_id', label: '主板标识', group: '基本信息', behavior: 'manual' }]}
      onUpdateValue={() => {}}
    />
  );

  expect(document.querySelector('[data-step2-pcba="D1"][data-step2-field="mb_id"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run the new helper/table tests and verify they fail**

Run:
- `npm run test -- src/lib/step2PcbaConflicts.test.ts src/components/TrialProductionTable.test.tsx`

Expected:
- The helper test fails because the helper does not exist yet.
- The table locator test fails because `mb_id` does not expose a cell-level target yet.

- [ ] **Step 3: Implement the helper and wire step 2 in App**

```ts
// src/lib/step2PcbaConflicts.ts
import type { PcbaOption, SKUData } from '../types';

export interface DuplicatePcbaConflict {
  kind: 'duplicate_pcba';
  pcba: string;
  duplicateCount: number;
  skuId: string;
  fieldId: 'mb_id';
  fieldLabel: '主板标识';
  detail: string;
}

export function buildStep2DuplicatePcbaConflicts(args: {
  pcbaOptions: PcbaOption[];
  checkedPcbaOptions: string[];
  skuData: SKUData[];
}): DuplicatePcbaConflict[] {
  const selected = new Set(args.checkedPcbaOptions);
  const optionByPcba = new Map(args.pcbaOptions.map((opt) => [opt.pcba, opt]));

  return args.skuData.flatMap((sku) => {
    if (!selected.has(sku.project)) return [];
    const opt = optionByPcba.get(sku.project);
    if (!opt || !opt.duplicateConflict) return [];

    return [{
      kind: 'duplicate_pcba' as const,
      pcba: opt.pcba,
      duplicateCount: opt.duplicateCount,
      skuId: sku.id,
      fieldId: 'mb_id' as const,
      fieldLabel: '主板标识' as const,
      detail: `主板标识 ${opt.pcba} 在配置表中出现 ${opt.duplicateCount} 次，自动获取已暂停，请人工确认`,
    }];
  });
}
```

```ts
// src/App.tsx
const step2Conflicts = buildStep2DuplicatePcbaConflicts({
  pcbaOptions: projectInfo.pcbaOptions ?? [],
  checkedPcbaOptions: projectInfo.checkedPcbaOptions ?? [],
  skuData,
});
```

```ts
// keep duplicate boards visible, but blank auto-derived values
const isDuplicate = !!opt?.duplicateConflict;
const bandValue = opt && !opt.bandConflict && !isDuplicate ? opt.band : '';
const storageValue = isDuplicate ? '' : (() => {
  if (!opt) return '';
  const ddrNum = (opt.ddr || '').match(/\d+/)?.[0] || '';
  const emmcNum = (opt.emmc || '').match(/\d+/)?.[0] || '';
  if (!ddrNum || !emmcNum) return '';
  return `${ddrNum}+${emmcNum}`;
})();
const fieldOptions: SKUData['fieldOptions'] = isDuplicate
  ? {}
  : {
      lcd: lcdRaw.length > 0 ? toLcdSplitOptions(lcdRaw, 'LCD') : keyMaterialOptions.lcd,
      front_cam: frontCamRaw.length > 0 ? toLcdSplitOptions(frontCamRaw, 'FRONT_CAM') : keyMaterialOptions.front_cam,
      main_cam: mainCamRaw.length > 0 ? toLcdSplitOptions(mainCamRaw, 'MAIN_CAM') : keyMaterialOptions.main_cam,
      sub_cam: subCamRaw.length > 0 ? toLcdSplitOptions(subCamRaw, 'SUB_CAM') : keyMaterialOptions.sub_cam,
      ...Object.fromEntries(
        (Object.keys(keyMaterialOptions) as import('./types').SplitOptionFieldId[])
          .filter((k) => !['lcd', 'front_cam', 'main_cam', 'sub_cam'].includes(k))
          .map((k) => [k, keyMaterialOptions[k]]),
      ),
      ...coreOptions,
      ...sampleOptions,
    };
```

- [ ] **Step 4: Add the `mb_id` DOM hook in the table**

```tsx
// inside the mb_id cell wrapper in TrialProductionTable.tsx
<div
  data-step2-pcba={currentStep === 2 && field.id === 'mb_id' ? sku.project : undefined}
  data-step2-field={currentStep === 2 && field.id === 'mb_id' ? 'mb_id' : undefined}
  className={cn(
    'rounded-lg flex items-center transition-all duration-300 ease-out overflow-hidden w-full',
    currentStep !== 5 ? 'border bg-white' : 'border-none bg-transparent',
    currentStep !== 5 && 'border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 hover:border-slate-300 hover:shadow-sm focus-within:shadow-md focus-within:shadow-blue-500/5',
  )}
>
```

- [ ] **Step 5: Re-run the helper, table, and lint checks**

Run:
- `npm run test -- src/lib/step2PcbaConflicts.test.ts src/components/TrialProductionTable.test.tsx`
- `npm run test -- src/lib/utils.test.ts`
- `npm run lint`

Expected:
- The helper returns exactly one duplicate conflict card per selected duplicated PCBA.
- The duplicated board still appears once in step 2.
- The `mb_id` cell wrapper is queryable by `data-step2-pcba` and `data-step2-field`.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/TrialProductionTable.tsx src/components/TrialProductionTable.test.tsx src/lib/step2PcbaConflicts.ts src/lib/step2PcbaConflicts.test.ts
git commit -m "feat: add step2 duplicate pcba conflict plumbing"
```

### Task 3: Render Sidebar Conflict Cards and Exact-Target Highlight

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Test: `src/components/Sidebar.test.tsx`

- [ ] **Step 1: Write a failing sidebar test for the duplicate conflict card and highlight**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { Sidebar } from './Sidebar';

it('shows one duplicate PCBA conflict card and highlights the exact mb_id target on click', () => {
  document.body.innerHTML = `
    <div id="row-mb_id"></div>
    <div data-step2-pcba="D1" data-step2-field="mb_id" class="border border-slate-200"></div>
  `;
  Element.prototype.scrollIntoView = vi.fn();

  render(
    <Sidebar
      currentStep={2}
      projectInfo={{ name: '', customer: '', stage: '', files: [], checkedPcbaOptions: [] }}
      skuData={[]}
      validationResults={[]}
      isFlowComplete={false}
      setIsFlowComplete={() => {}}
      onGoBack={() => {}}
      onRunValidation={() => {}}
      step2Conflicts={[{
        kind: 'duplicate_pcba',
        pcba: 'D1',
        duplicateCount: 2,
        skuId: 'sku_1',
        fieldId: 'mb_id',
        fieldLabel: '主板标识',
        detail: '主板标识 D1 在配置表中出现 2 次，自动获取已暂停，请人工确认',
      }]}
    />
  );

  fireEvent.click(screen.getByText('主板标识 D1 在配置表中出现 2 次，自动获取已暂停，请人工确认'));
  expect(document.querySelector('[data-step2-pcba="D1"][data-step2-field="mb_id"]')).toHaveClass('ring-2');
});
```

- [ ] **Step 2: Run the sidebar test and verify it fails**

Run: `npm run test -- src/components/Sidebar.test.tsx`
Expected: the click/highlight assertions fail because the sidebar still expects the old anonymous conflict shape and does not target the `mb_id` wrapper.

- [ ] **Step 3: Replace the sidebar conflict shape and implement the highlight behavior**

```ts
import type { DuplicatePcbaConflict } from '../lib/step2PcbaConflicts';

interface SidebarProps {
  currentStep: StepId;
  projectInfo: ProjectInfo;
  skuData: SKUData[];
  validationResults: ValidationResult[];
  onBackToEdit?: () => void;
  onGoBack: () => void;
  isFlowComplete: boolean;
  setIsFlowComplete: (val: boolean) => void;
  onRunValidation: () => void;
  step2Conflicts?: DuplicatePcbaConflict[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}
```

```ts
const focusDuplicatePcbaConflict = (conflict: DuplicatePcbaConflict) => {
  const row = document.getElementById(`row-${conflict.fieldId}`);
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const target = document.querySelector(
    `[data-step2-pcba="${conflict.pcba}"][data-step2-field="${conflict.fieldId}"]`,
  ) as HTMLElement | null;

  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('ring-2', 'ring-rose-500', 'bg-rose-50');
  window.setTimeout(() => target.classList.remove('ring-2', 'ring-rose-500', 'bg-rose-50'), 2000);
};
```

```tsx
{step2Conflicts.map((c) => (
  <div
    key={`${c.pcba}-${c.skuId}`}
    onClick={() => focusDuplicatePcbaConflict(c)}
    className="p-3 bg-rose-50/50 rounded border border-rose-200 hover:border-rose-400 hover:shadow-sm transition-all cursor-pointer space-y-1 group"
  >
    <div className="flex justify-between items-center">
      <span className="text-[13px] font-black text-rose-700">
        主板标识 {c.pcba} 在配置表中出现 {c.duplicateCount} 次
      </span>
      <span className="text-[11px] font-bold text-rose-500/80 group-hover:text-rose-600">点击定位</span>
    </div>
    <p className="text-[12px] text-rose-600/80 font-medium">
      {c.detail}
    </p>
  </div>
))}
```

- [ ] **Step 4: Re-run the sidebar and full targeted tests**

Run:
- `npm run test -- src/components/Sidebar.test.tsx src/components/TrialProductionTable.test.tsx src/lib/step2PcbaConflicts.test.ts src/lib/utils.test.ts`
- `npm run lint`

Expected:
- The sidebar shows exactly one duplicate-conflict card for each selected duplicated PCBA.
- Clicking the card scrolls the step 2 table to `row-mb_id` and flashes the exact `mb_id` cell wrapper.
- The existing validation sidebar in steps 4 and 5 remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Sidebar.test.tsx
git commit -m "feat: surface duplicate pcba conflicts in sidebar"
```

### Assumptions and Acceptance

- Duplicate detection only applies to PCBA rows parsed from `extractPcbaOptions`; manual PCBA entry remains unchanged in this iteration.
- `bandConflict` and `duplicateConflict` are independent signals and can both be true on the same `PcbaOption`.
- Duplicate boards are still generated once in step 2; the implementation only pauses auto-derived values and surfaces the conflict.
- The exact verification target for the workbook example is the local step 2 UI with `D1` duplicated in the imported `PCBA配置表`.

### Final Verification

Run:
- `npm run test -- src/lib/utils.test.ts src/lib/step2PcbaConflicts.test.ts src/components/TrialProductionTable.test.tsx src/components/Sidebar.test.tsx`
- `npm run lint`

Manual check:
- Upload `infinix X6728_X6728B配置表_V1.4_20250619.xlsx` or a synthetic workbook with two `D1` rows.
- Open step 2.
- Confirm the board is still created once, the sidebar shows one duplicate-conflict card, and clicking it flashes the exact `mb_id` target.
