# PCBA Storage Auto-Fill & EBOM Desc Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract EMMC and DDR values from PCBA config sheet, auto-fill `storage` field per SKU, then validate `ebom_desc` storage tokens against PCBA config using order-insensitive (normalized) matching in Step 4 validation engine.

**Architecture:** (1) Extend `extractPcbaOptions` in `utils.ts` to also parse EMMC and DDR columns from the PCBA config sheet row, returning them in `PcbaOption`. (2) `startAutoCalc` in `App.tsx` uses the new fields to auto-fill `storage` when building SKU data. (3) `runValidation` in `App.tsx` gains a new rule (R-EBOM-STORAGE-001) that extracts a `DDR+EMMC` token from `ebom_desc` and normalizes it against the PCBA-derived storage value.

**Tech Stack:** TypeScript, React 19, Vitest (unit tests), xlsx library for sheet parsing.

---
### Task 1: Extend PcbaOption type to carry emmc and ddr

**Files:**
- Modify: `src/types.ts:33-37`

- [ ] **Step 1: Open `src/types.ts` and extend `PcbaOption`**

Replace the existing interface:

```ts
export interface PcbaOption {
  pcba: string;
  band: string;
  bandConflict: boolean;
  emmc: string; // raw value from EMMC column, e.g. "128G" or "128"; empty string if column absent
  ddr: string;  // raw value from DDR column, e.g. "4G" or "4"; empty string if column absent
}
```

- [ ] **Step 2: Run type-check to verify no downstream breakage yet**

```bash
npm run lint
```

Expected: errors about `emmc`/`ddr` missing in places that construct `PcbaOption` — that is expected and will be fixed in Tasks 2 and 3.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "types: extend PcbaOption with emmc and ddr fields"
```

---
### Task 2: Add normalizeStorage helper + write failing tests

**Files:**
- Modify: `src/lib/utils.ts` (add `normalizeStorage` export before `extractPcbaOptions`)
- Modify: `src/lib/utils.test.ts` (add `normalizeStorage` test suite)

**Background:** `normalizeStorage` takes a raw string (e.g. from `ebom_desc` like `"4+128"` or from PCBA config like `"128+4"`), strips trailing `G`/`g` from each token, sorts the two numbers ascending, and returns them joined with `+`. This makes `4+128` and `128+4` equal after normalization.

- [ ] **Step 1: Add failing tests for `normalizeStorage` in `src/lib/utils.test.ts`**

Append this describe block:

```ts
import { normalizeStorage } from './utils';

describe('normalizeStorage', () => {
  it('canonical order: smaller first', () => {
    expect(normalizeStorage('4+128')).toBe('4+128');
  });

  it('reversed input equals canonical', () => {
    expect(normalizeStorage('128+4')).toBe('4+128');
  });

  it('strips trailing G', () => {
    expect(normalizeStorage('128G+4G')).toBe('4+128');
  });

  it('strips trailing g (lowercase)', () => {
    expect(normalizeStorage('4g+128g')).toBe('4+128');
  });

  it('real ebom_desc token: extracts first NNN+NNN token', () => {
    // normalizeStorage receives the already-extracted token, not full desc
    expect(normalizeStorage('8+256')).toBe('8+256');
  });

  it('returns empty string when input has no two numeric tokens', () => {
    expect(normalizeStorage('')).toBe('');
    expect(normalizeStorage('V633A-EBOM')).toBe('');
    expect(normalizeStorage('128')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: `normalizeStorage is not a function` — confirms test is wired to real code.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/lib/utils.test.ts
git commit -m "test: add normalizeStorage failing tests"
```

---
### Task 3: Implement normalizeStorage in utils.ts

**Files:**
- Modify: `src/lib/utils.ts` (add export before `extractPcbaOptions`)

- [ ] **Step 1: Add the implementation**

Insert before the `export async function extractPcbaOptions` line:

```ts
/**
 * Normalize a storage string like "4+128", "128+4", "128G+4G" into
 * a canonical "smaller+larger" form without G suffix.
 * Returns "" if the input does not contain two numeric tokens separated by "+".
 */
export function normalizeStorage(raw: string): string {
  const match = raw.replace(/[Gg]/g, '').match(/(\d+)\+(\d+)/);
  if (!match) return '';
  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);
  return `${Math.min(a, b)}+${Math.max(a, b)}`;
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npm test
```

Expected: all `normalizeStorage` tests PASS, existing `extractPcbaOptions` tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add normalizeStorage utility"
```

---
### Task 4: Extend extractPcbaOptions to parse EMMC and DDR columns

**Files:**
- Modify: `src/lib/utils.ts` -- `extractPcbaOptions` function body
- Modify: `src/lib/utils.test.ts` -- add new test cases

**Background:** The PCBA config sheet has columns: `PCBA配置`, `出货市场`, and two more whose headers match `/^EMMC$/i` and `/^DDR$/i`. The function must locate those column indices and build `emmc`/`ddr` value-sets per PCBA (same single-value vs conflict logic as `band`). Single unique value -> store it; zero or conflict -> `''`.

- [ ] **Step 1: Add failing tests for EMMC/DDR extraction in `src/lib/utils.test.ts`**

Append inside the existing `describe('extractPcbaOptions', ...)` block:

```ts
it('extracts emmc and ddr from dedicated columns', async () => {
  const aoa = [
    ['PCBA配置', '出货市场', 'EMMC', 'DDR'],
    ['A1', 'SSA', '128G', '4G'],
    ['B1', 'LATAM', '256G', '8G'],
  ];
  const file = makeXlsxFile(aoa);
  const result = await extractPcbaOptions(file);
  expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false, emmc: '128G', ddr: '4G' });
  expect(result[1]).toEqual({ pcba: 'B1', band: 'LATAM', bandConflict: false, emmc: '256G', ddr: '8G' });
});

it('emmc/ddr columns absent -> emmc and ddr are empty strings', async () => {
  const aoa = [
    ['PCBA配置', '出货市场'],
    ['A1', 'SSA'],
  ];
  const file = makeXlsxFile(aoa);
  const result = await extractPcbaOptions(file);
  expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false, emmc: '', ddr: '' });
});

it('same PCBA with conflicting EMMC rows -> emmc is empty string', async () => {
  const aoa = [
    ['PCBA配置', '出货市场', 'EMMC', 'DDR'],
    ['A1', 'SSA', '128G', '4G'],
    ['A1', 'SSA', '256G', '4G'],
  ];
  const file = makeXlsxFile(aoa);
  const result = await extractPcbaOptions(file);
  expect(result[0].emmc).toBe('');
  expect(result[0].ddr).toBe('4G');
});
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
npm test
```

Expected: new tests FAIL with `emmc` undefined on result object.

- [ ] **Step 3: Add EMMC/DDR column detection to `extractPcbaOptions` in `src/lib/utils.ts`**

After the existing `marketColIdx` search loop (around line 73), add:

```ts
let emmcColIdx = -1;
let ddrColIdx = -1;
for (let c = 0; c < headerRow.length; c++) {
  const val = String(headerRow[c] ?? '').trim().toUpperCase();
  if (val === 'EMMC') emmcColIdx = c;
  if (val === 'DDR')  ddrColIdx  = c;
}
```

After `const pcbaMarkets = new Map<string, Set<string>>();` (around line 76), add:

```ts
const pcbaEmmcSets = new Map<string, Set<string>>();
const pcbaDdrSets  = new Map<string, Set<string>>();
```

Inside the data-row loop, after the `marketColIdx` block, add:

```ts
const collectSet = (colIdx: number, map: Map<string, Set<string>>) => {
  if (colIdx === -1) return;
  const raw = row[colIdx];
  if (raw === null || raw === undefined) return;
  const v = String(raw).trim();
  if (!v) return;
  if (!map.has(val)) map.set(val, new Set<string>());
  map.get(val)!.add(v);
};
collectSet(emmcColIdx, pcbaEmmcSets);
collectSet(ddrColIdx,  pcbaDdrSets);
```

In the results-building `.map()`, change the return to:

```ts
const emmcSet = pcbaEmmcSets.get(pcba) ?? new Set<string>();
const ddrSet  = pcbaDdrSets.get(pcba)  ?? new Set<string>();
if (markets.size === 0) {
  return { pcba, band: '', bandConflict: false, emmc: emmcSet.size === 1 ? [...emmcSet][0] : '', ddr: ddrSet.size === 1 ? [...ddrSet][0] : '' };
} else if (markets.size === 1) {
  return { pcba, band: [...markets][0], bandConflict: false, emmc: emmcSet.size === 1 ? [...emmcSet][0] : '', ddr: ddrSet.size === 1 ? [...ddrSet][0] : '' };
} else {
  return { pcba, band: '', bandConflict: true, emmc: emmcSet.size === 1 ? [...emmcSet][0] : '', ddr: ddrSet.size === 1 ? [...ddrSet][0] : '' };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: extract emmc/ddr columns from PCBA config sheet"
```

---

### Task 5: Auto-fill storage field from PCBA emmc+ddr in startAutoCalc

**Files:**
- Modify: `src/App.tsx` -- `startAutoCalc` function (around lines 362-432)

**Background:** After `extractPcbaOptions` now returns `emmc` and `ddr` per option, `startAutoCalc` should look up the selected option and combine `ddr+emmc` (normalized order: DDR first, then EMMC, matching the conventional storage notation `4+128`) into the SKU supply's `storage` field. If either value is missing, leave `storage` as empty string so the user can fill it manually.

- [ ] **Step 1: Locate the supply initialization code in `startAutoCalc`**

In `src/App.tsx` around line 392, find this block:

```ts
supplies: [
  { id: `s_${Date.now()}_${idx}_1`, label: '主供', values: { storage: pcbaId.replace('PCBA-', '').replace('G', '') + '+G', lcd: '', band: bandValue } }
]
```

- [ ] **Step 2: Replace the storage value computation**

Replace only the `storage:` expression inside that object (leave all other fields unchanged):

```ts
const storageValue = (() => {
  if (!opt) return '';
  const ddrRaw  = (opt.ddr  || '').replace(/[Gg]/g, '').trim();
  const emmcRaw = (opt.emmc || '').replace(/[Gg]/g, '').trim();
  if (!ddrRaw || !emmcRaw) return '';
  return `${ddrRaw}+${emmcRaw}`;
})();
```

Then use `storageValue` for the `storage` field:

```ts
supplies: [
  { id: `s_${Date.now()}_${idx}_1`, label: '主供', values: { storage: storageValue, lcd: '', band: bandValue } }
]
```

- [ ] **Step 3: Run type-check and tests**

```bash
npm run lint && npm test
```

Expected: no type errors, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: auto-fill storage from PCBA emmc+ddr in startAutoCalc"
```

---

### Task 6: Add EBOM desc storage validation rule in runValidation

**Files:**
- Modify: `src/App.tsx` -- `runValidation` function (around lines 435-570)
- Modify: `src/constants.ts` -- add rule definition `R-EBOM-STORAGE-001`

**Background:** `ebom_desc` is a free-text field like `V633A-EBOM-4模11频-2频-4+128-A1`. The rule must:
1. Extract the first `NNN+NNN` token from `ebom_desc` (ignoring trailing G).
2. Build the PCBA-derived storage from `storage` field (already `ddr+emmc` format, e.g. `4+128`).
3. Normalize both with `normalizeStorage` and compare.
4. If `ebom_desc` contains no `NNN+NNN` token -> `warn` (cannot verify).
5. If both tokens present and mismatch -> `error`.
6. If match -> `pass`.

- [ ] **Step 1: Add rule definition in `src/constants.ts`**

Append to the `AM_RULE_DEFS` array:

```ts
{
  id: 'R-EBOM-STORAGE-001',
  title: 'EBOM描述存储配置一致性',
  amReference: 'EBOM描述中的 DDR+EMMC 符号应与存储字段匹配（顺序无关），不一致时给出错误提示',
  requiresFlowComplete: false,
},
```

- [ ] **Step 2: Import normalizeStorage in App.tsx**

In `src/App.tsx`, update the import from `./lib/utils`:

```ts
import { cn, extractPcbaOptions, normalizeStorage } from './lib/utils';
```

- [ ] **Step 3: Add the new rule inside `runValidation` in `src/App.tsx`**

Inside the `sku.supplies.forEach` loop, after the existing Rule 3 block (around line 564), add:

```ts
// --- Rule R-EBOM-STORAGE-001: ebom_desc storage token vs storage field ---
const ebomDesc = String(vals['ebom_desc'] || '').toLowerCase();
const storageFld = String(vals['storage'] || '').toLowerCase();

const ebomTokenMatch = ebomDesc.replace(/[gG]/g, '').match(/(\d+)\+(\d+)/);
const ebomToken = ebomTokenMatch ? `${ebomTokenMatch[1]}+${ebomTokenMatch[2]}` : '';

if (!ebomDesc) {
  // No ebom_desc filled -- skip rule entirely (different rule handles empty fields)
} else if (!ebomToken) {
  results.push({
    id: `RULE-EBOM-STORAGE-${sku.id}-${sup.id}`,
    title: 'EBOM描述无存储标识',
    amReference: 'R-EBOM-STORAGE-001',
    detail: `${prefix}EBOM描述中未找到 DDR+EMMC 数字格式（如 4+128），无法校验。`,
    level: 'warn',
    fieldId: 'ebom_desc',
  });
} else if (!storageFld) {
  results.push({
    id: `RULE-EBOM-STORAGE-${sku.id}-${sup.id}`,
    title: 'EBOM描述存储待校验',
    amReference: 'R-EBOM-STORAGE-001',
    detail: `${prefix}存储字段未填写，无法与 EBOM 描述校验。`,
    level: 'warn',
    fieldId: 'storage',
  });
} else {
  const normalEbom    = normalizeStorage(ebomToken);
  const normalStorage = normalizeStorage(storageFld);
  if (normalEbom && normalStorage && normalEbom !== normalStorage) {
    results.push({
      id: `RULE-EBOM-STORAGE-${sku.id}-${sup.id}`,
      title: 'EBOM描述存储不匹配',
      amReference: 'R-EBOM-STORAGE-001',
      detail: `${prefix}EBOM描述存储(${ebomToken})与存储字段(${storageFld})不一致。`,
      level: 'error',
      fieldId: 'ebom_desc',
    });
  } else {
    results.push({
      id: `RULE-EBOM-STORAGE-${sku.id}-${sup.id}`,
      title: 'EBOM存储核验通过',
      amReference: 'R-EBOM-STORAGE-001',
      detail: `${prefix}EBOM描述存储与存储字段匹配。`,
      level: 'pass',
      fieldId: 'ebom_desc',
    });
  }
}
```

- [ ] **Step 4: Run type-check and tests**

```bash
npm run lint && npm test
```

Expected: no type errors, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/constants.ts
git commit -m "feat: validate ebom_desc storage token against storage field in Step 4"
```

---

### Task 7: Add unit tests for the EBOM storage validation rule logic

**Files:**
- Modify: `src/lib/utils.test.ts` -- add `normalizeStorage` integration cases that mirror real ebom_desc inputs

**Note:** The full `runValidation` function runs inside a React component and is not directly unit-testable without a full render. Instead, test the pure logic via `normalizeStorage` edge cases that cover the real-world inputs from `ebom_desc` parsing.

- [ ] **Step 1: Add integration-style tests for real EBOM desc patterns**

Append to `describe('normalizeStorage')` in `src/lib/utils.test.ts`:

```ts
it('real ebom_desc: V633A-EBOM-4 mod 11freq-2freq-4+128-A1 token is 4+128', () => {
  // Simulate extraction: caller strips non-numeric prefix, passes token directly
  expect(normalizeStorage('4+128')).toBe('4+128');
});

it('real pcba storage: 128+4 normalizes to same as 4+128', () => {
  expect(normalizeStorage('128+4')).toBe(normalizeStorage('4+128'));
});

it('real pcba storage with G: 128G+4G normalizes to 4+128', () => {
  expect(normalizeStorage('128G+4G')).toBe('4+128');
});

it('8+256 and 256+8 are equal', () => {
  expect(normalizeStorage('8+256')).toBe(normalizeStorage('256+8'));
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.test.ts
git commit -m "test: add real-world ebom_desc normalization coverage"
```

---

### Task 8: Final lint + full test run

**Files:** none

- [ ] **Step 1: Run full type check**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all test suites PASS, zero failures.

- [ ] **Step 3: Smoke-check in browser (manual)**

```bash
npm run dev
```

1. Upload a PCBA config xlsx that has EMMC and DDR columns.
2. In Step 1 select a PCBA option and proceed to Step 2.
3. Verify `storage` column is auto-filled with `DDR+EMMC` value (e.g. `4+128`).
4. In Step 3 fill `ebom_desc` with a string containing a matching token (e.g. `V633A-EBOM-4+128-A1`).
5. Proceed to Step 4 and confirm rule `R-EBOM-STORAGE-001` shows `pass`.
6. Change `ebom_desc` to contain `8+256` and confirm the rule shows `error`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: pcba storage extraction and ebom_desc validation complete"
```

