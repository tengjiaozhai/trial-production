# Efuse Label Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Append the selected `是否熔丝` value to the affected internal sample requirement row label in Step 5 preview and the exported workbook, for example `硬件(efuse)` or `硬件(no efuse)`.

**Architecture:** Keep `projectInfo.efuseConfigs` as the source of truth. Move the efuse-capable field list into one shared helper so the dropdown render path and the Step 5 label-formatting path use the same field whitelist. Extend `buildStep5TableModel` to format field labels with the selected efuse suffix, then thread `efuseConfigs` through both Step 5 preview and `buildTrialProductionWorkbook` so preview and export stay on one canonical path.

**Tech Stack:** React, TypeScript, Vitest, `xlsx`

**Assumption:** This plan uses the raw saved dropdown value with ASCII parentheses, for example `硬件(efuse)` and `硬件(no efuse)`. Empty selection leaves the label unchanged.

---

## File Structure

- Create: `src/lib/efuseFields.ts` — shared efuse-capable field IDs and label-formatting helper.
- Modify: `src/lib/step5TableModel.ts` — accept `efuseConfigs` and format Step 5 field labels through the shared helper.
- Modify: `src/lib/step5TableModel.test.ts` — add unit coverage for efuse suffix formatting.
- Modify: `src/components/TrialProductionTable.tsx` — replace inline efuse field whitelist with the shared helper and pass `efuseConfigs` into the Step 5 model call.
- Modify: `src/components/TrialProductionTable.test.tsx` — add a Step 5 preview assertion for the formatted label.
- Modify: `src/lib/trialProductionWorkbook.ts` — accept `efuseConfigs` and forward them into `buildStep5TableModel`.
- Modify: `src/lib/trialProductionWorkbook.test.ts` — assert the exported worksheet writes the suffixed label.
- Modify: `src/App.tsx` — pass `projectInfo.efuseConfigs` into `buildTrialProductionWorkbook`.

### Task 1: Shared Efuse Field Rules

**Files:**
- Create: `src/lib/efuseFields.ts`
- Modify: `src/lib/step5TableModel.ts`
- Test: `src/lib/step5TableModel.test.ts`

- [ ] **Step 1: Write the failing Step 5 model tests**

Add two tests to `src/lib/step5TableModel.test.ts` so the model must append the selected efuse mode for supported rows and leave unsupported/blank rows alone.

```ts
const efuseActiveFields: FieldDefinition[] = [
  { id: 'hw_eng', label: '硬件', group: '内部样机需求', behavior: 'manual' },
  { id: 'project', label: '项目名称', group: '基本信息', behavior: 'manual' },
];

const efuseSkuData: SKUData[] = [
  {
    id: 'sku_1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    fieldOptions: {},
    supplies: [
      {
        id: 's1',
        supplyKey: '一供',
        label: 'Supply A',
        values: { hw_eng: '8', project: 'X6728' },
      },
    ],
  },
];

it('appends the selected efuse mode to supported Step 5 labels', () => {
  const model = buildStep5TableModel({
    activeFields: efuseActiveFields,
    skuData: efuseSkuData,
    efuseConfigs: { hw_eng: 'efuse' },
  });

  const row = model.rows.find((item) => item.kind === 'field' && item.fieldId === 'hw_eng');
  if (!row || row.kind !== 'field') throw new Error('expected hw_eng field row');
  expect(row.fieldLabel).toBe('硬件(efuse)');
});

it('keeps labels unchanged when no efuse mode is selected', () => {
  const model = buildStep5TableModel({
    activeFields: efuseActiveFields,
    skuData: efuseSkuData,
    efuseConfigs: {},
  });

  const row = model.rows.find((item) => item.kind === 'field' && item.fieldId === 'hw_eng');
  if (!row || row.kind !== 'field') throw new Error('expected hw_eng field row');
  expect(row.fieldLabel).toBe('硬件');
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/step5TableModel.test.ts
```

Expected: FAIL because `buildStep5TableModel` does not accept `efuseConfigs` and never changes `fieldLabel`.

- [ ] **Step 3: Create the shared efuse helper and wire the Step 5 model**

Create `src/lib/efuseFields.ts` with the single source of truth for the efuse-capable row IDs and a small formatter.

```ts
export const EFUSE_FIELD_IDS = new Set([
  'ce_cert',
  'customer_sample_req',
  'hw_eng',
  'hw_test',
  'sw_eng',
  'sw_test',
  'struct_eng',
  'reliability',
  'reliability_eng',
  'image_eng',
  'npm',
  'ux',
  'parts',
]);

export function supportsEfuseLabel(fieldId: string): boolean {
  return EFUSE_FIELD_IDS.has(fieldId);
}

export function formatFieldLabelWithEfuse(args: {
  fieldId: string;
  fieldLabel: string;
  efuseConfigs?: Record<string, string>;
}): string {
  const suffix = args.efuseConfigs?.[args.fieldId]?.trim();
  if (!suffix || !supportsEfuseLabel(args.fieldId)) return args.fieldLabel;
  return `${args.fieldLabel}(${suffix})`;
}
```

Then update `src/lib/step5TableModel.ts` to accept `efuseConfigs` and call the formatter when building field rows.

```ts
import { formatFieldLabelWithEfuse } from './efuseFields';

export function buildStep5TableModel(args: {
  activeFields: FieldDefinition[];
  skuData: SKUData[];
  includeSupplierRow?: boolean;
  efuseConfigs?: Record<string, string>;
}): Step5TableModel {
  // ...
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
  // ...
}
```

- [ ] **Step 4: Re-run the Step 5 model test to verify it passes**

Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/step5TableModel.test.ts
```

Expected: PASS with the new `硬件(efuse)` assertion green.

- [ ] **Step 5: Commit the shared-model change**

```bash
git add src/lib/efuseFields.ts src/lib/step5TableModel.ts src/lib/step5TableModel.test.ts
git commit -m "feat: format step5 efuse field labels"
```

### Task 2: Step 5 Preview Wiring

**Files:**
- Modify: `src/components/TrialProductionTable.tsx`
- Test: `src/components/TrialProductionTable.test.tsx`

- [ ] **Step 1: Write the failing Step 5 preview test**

Add a Step 5 preview test to `src/components/TrialProductionTable.test.tsx` that proves the rendered row label includes the efuse suffix.

```tsx
it('renders efuse suffixes in Step 5 preview labels', () => {
  render(
    <TrialProductionTable
      currentStep={5}
      skuData={[
        {
          id: 'sku1',
          stage: 'PR1',
          orderNo: '',
          project: 'X6728',
          supplies: [
            { id: 's1', supplyKey: '一供', label: '一供', values: { hw_eng: '8' } },
          ],
        },
      ]}
      efuseConfigs={{ hw_eng: 'no efuse' }}
      activeFields={[
        { id: 'hw_eng', label: '硬件', group: '内部样机需求', behavior: 'manual' },
      ]}
      onUpdateValue={() => {}}
    />
  );

  expect(screen.getByText('硬件(no efuse)')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the preview test to verify it fails**

Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/TrialProductionTable.test.tsx
```

Expected: FAIL because `TrialProductionTable` calls `buildStep5TableModel` without `efuseConfigs`.

- [ ] **Step 3: Replace the inline efuse field whitelist and pass `efuseConfigs` into Step 5**

Update the dropdown render path in `src/components/TrialProductionTable.tsx` to reuse the shared helper instead of the hard-coded list, then pass `efuseConfigs` into the Step 5 model call.

```ts
import { supportsEfuseLabel } from '../lib/efuseFields';

// ...
{supportsEfuseLabel(field.id) && (
  <select
    className="border border-[#DDE7F3] rounded bg-[#F6F9FF] text-[10px] font-bold text-[#64748B] px-1 py-0.5 w-full outline-none hover:bg-slate-100 transition-colors text-center cursor-pointer disabled:cursor-not-allowed"
    value={efuseConfigs?.[field.id] || ''}
    onChange={(e) => onUpdateEfuse?.(field.id, e.target.value)}
    disabled={currentStep === 5}
  >
    <option value="" disabled>是否熔丝</option>
    <option value="no efuse">no efuse</option>
    <option value="efuse">efuse</option>
  </select>
)}

// ...
if (currentStep === 5) {
  const step5Model = buildStep5TableModel({
    activeFields,
    skuData,
    includeSupplierRow: true,
    efuseConfigs,
  });
  // ...
}
```

- [ ] **Step 4: Re-run the preview test to verify it passes**

Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/TrialProductionTable.test.tsx
```

Expected: PASS with the `硬件(no efuse)` preview label visible.

- [ ] **Step 5: Commit the preview wiring**

```bash
git add src/components/TrialProductionTable.tsx src/components/TrialProductionTable.test.tsx
git commit -m "feat: show efuse labels in step5 preview"
```

### Task 3: Workbook Export Wiring

**Files:**
- Modify: `src/lib/trialProductionWorkbook.ts`
- Modify: `src/lib/trialProductionWorkbook.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing workbook export test**

Add a focused export test in `src/lib/trialProductionWorkbook.test.ts` that asserts the worksheet writes the suffixed row label into column B.

```ts
it('writes efuse suffixes into exported field labels', () => {
  const wb = buildTrialProductionWorkbook({
    projectName: 'X6728',
    activeFields: [
      { id: 'hw_eng', label: '硬件', group: '内部样机需求', behavior: 'manual' },
    ],
    skuData: [
      {
        id: 'sku_1',
        stage: 'PR1',
        orderNo: '',
        project: 'X6728',
        fieldOptions: {},
        supplies: [
          {
            id: 's1',
            supplyKey: '一供',
            label: 'Supply A',
            values: { hw_eng: '8' },
          },
        ],
      },
    ],
    efuseConfigs: { hw_eng: 'efuse' },
  });

  const ws = wb.Sheets['搭配表'];
  expect(ws['B2']?.v).toBe('硬件(efuse)');
});
```

- [ ] **Step 2: Run the workbook export test to verify it fails**

Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/trialProductionWorkbook.test.ts
```

Expected: FAIL because `buildTrialProductionWorkbook` does not accept or forward `efuseConfigs`.

- [ ] **Step 3: Thread `efuseConfigs` into workbook export from `App`**

Update `src/lib/trialProductionWorkbook.ts` to accept `efuseConfigs` and pass them to `buildStep5TableModel`, then update `src/App.tsx` so export uses `projectInfo.efuseConfigs`.

```ts
// src/lib/trialProductionWorkbook.ts
export function buildTrialProductionWorkbook(args: {
  projectName: string;
  activeFields: FieldDefinition[];
  skuData: SKUData[];
  layout?: Step5LayoutSnapshot;
  efuseConfigs?: Record<string, string>;
}): XLSX.WorkBook {
  const model = buildStep5TableModel({
    activeFields: args.activeFields,
    skuData: args.skuData,
    includeSupplierRow: true,
    efuseConfigs: args.efuseConfigs,
  });
  // ...
}
```

```ts
// src/App.tsx
const wb = buildTrialProductionWorkbook({
  projectName: projectInfo.name ?? 'trial',
  activeFields,
  skuData,
  layout: step5Layout ?? undefined,
  efuseConfigs: projectInfo.efuseConfigs,
});
```

- [ ] **Step 4: Run the workbook test and the focused regression set**

Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/trialProductionWorkbook.test.ts src/lib/step5TableModel.test.ts src/components/TrialProductionTable.test.tsx
```

Expected: PASS with export and preview both using the same formatted labels.

- [ ] **Step 5: Run typecheck and commit the export wiring**

Run:

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint
```

Expected: PASS (`tsc --noEmit`)

```bash
git add src/lib/trialProductionWorkbook.ts src/lib/trialProductionWorkbook.test.ts src/App.tsx
git commit -m "feat: include efuse labels in exported workbook"
```

## Self-Review

- **Spec coverage:** The plan covers the source dropdown field set, Step 5 preview, and the final workbook export path. The suffix rule is single-path and only applies when a saved efuse value exists.
- **Placeholder scan:** No `TODO`/`TBD` placeholders remain; every code-changing step includes concrete code and commands.
- **Type consistency:** `efuseConfigs?: Record<string, string>` is threaded consistently through `ProjectInfo`, `TrialProductionTable`, `buildStep5TableModel`, and `buildTrialProductionWorkbook`.
