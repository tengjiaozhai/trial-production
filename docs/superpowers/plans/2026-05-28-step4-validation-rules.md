# Step 4 Validation Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在第4步补齐并收敛三条业务校验规则（存储、颜色、整机标识），并在冲突时禁用“下一步: 导出预览”和第5步导出按钮。  
**Architecture:** 把 Rule-1/2/3 的比较逻辑从 `App.tsx` 抽到纯函数模块，先用 Vitest 锁定行为，再在 `runValidation()` 中接入，保留现有 `ValidationResult` 结构与 `isExportDisabled` 单一开关。第4步按钮直接复用 `isExportDisabled`，不引入第二套状态。  
**Tech Stack:** React 19, TypeScript, Vitest

---

## 文件结构

- Create: `src/lib/step4ValidationRules.ts`
- Create: `src/lib/step4ValidationRules.test.ts`
- Modify: `src/App.tsx`

### Task 1: 先写失败测试，锁定三条新规则

**Files:**
- Create: `src/lib/step4ValidationRules.test.ts`

- [ ] **Step 1: 写存储规则测试（storage vs flash EMMC/flash DDR）**

```ts
import { describe, expect, it } from 'vitest';
import {
  parseStoragePair,
  extractTrailingSize,
  validateStorageAgainstComponents,
  validateColorAgainstBom,
  validateUnitIdVsMbId,
} from './step4ValidationRules';

describe('parseStoragePair', () => {
  it('parses 4+128 into ddr/emmc tokens', () => {
    expect(parseStoragePair('4+128')).toEqual({ ddr: '4', emmc: '128' });
  });

  it('supports optional G suffix', () => {
    expect(parseStoragePair('4G+128G')).toEqual({ ddr: '4', emmc: '128' });
  });
});

describe('extractTrailingSize', () => {
  it('extracts last size token from flash strings', () => {
    expect(extractTrailingSize('14201661一供宏芯宇128G')).toBe('128');
    expect(extractTrailingSize('14201579一供三星4G')).toBe('4');
  });
});

describe('validateStorageAgainstComponents', () => {
  it('passes when storage matches flash EMMC and flash DDR', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇128G',
        ddr: '14201579一供三星4G',
      })
    ).toEqual({ ok: true, reasons: [] });
  });

  it('fails when either emmc or ddr mismatches', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇64G',
        ddr: '14201579一供三星4G',
      })
    ).toEqual({ ok: false, reasons: ['flash EMMC不匹配'] });
  });
});

describe('validateColorAgainstBom', () => {
  it('passes when MBOM matches even if PBOM is NA', () => {
    expect(
      validateColorAgainstBom({
        color: '钛银色',
        mbom: 'V633A-MBOM-TSN_A1_钛银色_128+4_誉鑫_PR2-1-试产',
        pbom: 'NA',
      })
    ).toEqual({ ok: true });
  });

  it('fails when MBOM and PBOM both do not contain color', () => {
    expect(
      validateColorAgainstBom({
        color: '钛银色',
        mbom: 'V633A-MBOM-TSN_A1_深蓝色_128+4_誉鑫_PR2-1-试产',
        pbom: 'PBOM-黑色',
      })
    ).toEqual({ ok: false });
  });
});

describe('validateUnitIdVsMbId', () => {
  it('passes when unit_id contains mb_id', () => {
    expect(validateUnitIdVsMbId({ unitId: 'PR1-A1', mbId: 'A1' })).toEqual({ ok: true });
  });

  it('fails when unit_id does not contain mb_id', () => {
    expect(validateUnitIdVsMbId({ unitId: 'PR1-B2', mbId: 'A1' })).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: 运行测试确认失败（TDD 起点）**

Run:
```bash
npm test -- src/lib/step4ValidationRules.test.ts 2>&1 | head -c 4000
```

Expected:
```text
FAIL: Cannot find module './step4ValidationRules'
```

- [ ] **Step 3: 提交（测试先行基线）**

```bash
git add src/lib/step4ValidationRules.test.ts
git commit -m "test: add step4 validation rule specs"
```

### Task 2: 实现纯函数规则模块

**Files:**
- Create: `src/lib/step4ValidationRules.ts`

- [ ] **Step 1: 实现存储、颜色、整机标识规则函数**

```ts
export function parseStoragePair(raw: string): { ddr: string; emmc: string } | null {
  const match = String(raw ?? '').replace(/\s+/g, '').match(/^(\d+)[gG]?\+(\d+)[gG]?$/);
  if (!match) return null;
  return { ddr: match[1], emmc: match[2] };
}

export function extractTrailingSize(raw: string): string {
  const text = String(raw ?? '');
  const matches = [...text.matchAll(/(\d+)\s*[gG]\b/g)];
  if (matches.length > 0) return matches[matches.length - 1][1];
  const fallback = [...text.matchAll(/(\d+)\b/g)];
  return fallback.length > 0 ? fallback[fallback.length - 1][1] : '';
}

export function validateStorageAgainstComponents(args: {
  storage: string;
  emmc: string;
  ddr: string;
}): { ok: boolean; reasons: string[] } {
  const pair = parseStoragePair(args.storage);
  if (!pair) return { ok: false, reasons: ['存储格式错误'] };

  const reasons: string[] = [];
  const emmcSize = extractTrailingSize(args.emmc);
  const ddrSize = extractTrailingSize(args.ddr);

  if (!emmcSize || emmcSize !== pair.emmc) reasons.push('flash EMMC不匹配');
  if (!ddrSize || ddrSize !== pair.ddr) reasons.push('flash DDR不匹配');

  return { ok: reasons.length === 0, reasons };
}

export function validateColorAgainstBom(args: {
  color: string;
  mbom: string;
  pbom: string;
}): { ok: boolean } {
  const color = String(args.color ?? '').trim();
  if (!color) return { ok: false };

  const mbom = String(args.mbom ?? '').trim();
  const pbom = String(args.pbom ?? '').trim();
  const mbomMatch = mbom.includes(color);
  const pbomMatch = pbom.includes(color);
  return { ok: mbomMatch || pbomMatch };
}

export function validateUnitIdVsMbId(args: {
  unitId: string;
  mbId: string;
}): { ok: boolean } {
  const unitId = String(args.unitId ?? '').trim().toUpperCase();
  const mbId = String(args.mbId ?? '').trim().toUpperCase();
  if (!unitId || !mbId) return { ok: false };
  return { ok: unitId.includes(mbId) };
}
```

- [ ] **Step 2: 运行规则单测确认通过**

Run:
```bash
npm test -- src/lib/step4ValidationRules.test.ts 2>&1 | head -c 4000
```

Expected:
```text
PASS: all tests in step4ValidationRules.test.ts
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/step4ValidationRules.ts src/lib/step4ValidationRules.test.ts
git commit -m "feat: implement step4 rule helpers for storage color unit-id"
```

### Task 3: 接入 App 第4步校验引擎（替换 Rule-1/2/3）

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 引入新规则函数**

```ts
import {
  validateColorAgainstBom,
  validateStorageAgainstComponents,
  validateUnitIdVsMbId,
} from './lib/step4ValidationRules';
```

- [ ] **Step 2: 用新规则替换 runValidation 中 Rule-1/2/3 逻辑**

```ts
// Rule-1 color: MBOM or PBOM 任一匹配即可
const color = String(vals['color'] || '').trim();
const mbom = String(vals['mbom'] || '').trim();
const pbom = String(vals['pbom'] || '').trim();
if (!color) {
  results.push({
    id: `RULE-COLOR-${sku.id}-${sup.id}`,
    title: '颜色项待填',
    amReference: 'Rule-1',
    detail: `${prefix}未填写颜色，无法执行一致性校验。`,
    level: 'warn',
    fieldId: 'color',
  });
} else {
  const colorCheck = validateColorAgainstBom({ color, mbom, pbom });
  results.push({
    id: `RULE-COLOR-${sku.id}-${sup.id}`,
    title: colorCheck.ok ? '颜色一致性核验通过' : '颜色不一致',
    amReference: 'Rule-1',
    detail: colorCheck.ok
      ? `${prefix}颜色与 MBOM/PBOM 任一描述匹配。`
      : `${prefix}颜色(${color})与 MBOM/PBOM 均不匹配。`,
    level: colorCheck.ok ? 'pass' : 'error',
    fieldId: 'color',
  });
}

// Rule-2 storage vs flash EMMC/flash DDR
const storage = String(vals['storage'] || '').trim();
const emmc = String(vals['emmc'] || '').trim();
const ddr = String(vals['ddr'] || '').trim();
if (!storage) {
  results.push({
    id: `RULE-STORAGE-${sku.id}-${sup.id}`,
    title: '存储字段待填',
    amReference: 'Rule-2',
    detail: `${prefix}未填写存储，无法执行存储核验。`,
    level: 'warn',
    fieldId: 'storage',
  });
} else {
  const storageCheck = validateStorageAgainstComponents({ storage, emmc, ddr });
  results.push({
    id: `RULE-STORAGE-${sku.id}-${sup.id}`,
    title: storageCheck.ok ? '存储核验通过' : '存储配置冲突',
    amReference: 'Rule-2',
    detail: storageCheck.ok
      ? `${prefix}存储与 flash EMMC/flash DDR 匹配。`
      : `${prefix}存储(${storage})与${storageCheck.reasons.join('、')}冲突。`,
    level: storageCheck.ok ? 'pass' : 'error',
    fieldId: 'storage',
  });
}

// Rule-3 unit_id contains mb_id
const unitId = String(vals['unit_id'] || '').trim();
const mbId = String(vals['mb_id'] || '').trim();
if (!unitId || !mbId) {
  results.push({
    id: `RULE-SUFFIX-${sku.id}-${sup.id}`,
    title: '整机标识待完善',
    amReference: 'Rule-3',
    detail: `${prefix}请完善整机标识和主板标识后再校验。`,
    level: 'warn',
    fieldId: 'unit_id',
  });
} else {
  const idCheck = validateUnitIdVsMbId({ unitId, mbId });
  results.push({
    id: `RULE-SUFFIX-${sku.id}-${sup.id}`,
    title: idCheck.ok ? '整机标识核验通过' : '整机标识冲突',
    amReference: 'Rule-3',
    detail: idCheck.ok
      ? `${prefix}整机标识(${unitId})包含主板标识(${mbId})。`
      : `${prefix}整机标识(${unitId})不包含主板标识(${mbId})。`,
    level: idCheck.ok ? 'pass' : 'error',
    fieldId: 'unit_id',
  });
}
```

- [ ] **Step 3: 保留并不改动 `R-EBOM-STORAGE-001` 规则**

Run:
```bash
rg -n "R-EBOM-STORAGE-001" src/App.tsx 2>&1 | head -c 4000
```

Expected:
```text
仍存在且逻辑未删除
```

- [ ] **Step 4: 运行类型检查与全量测试**

Run:
```bash
npm run lint 2>&1 | head -c 4000
npm test 2>&1 | head -c 4000
```

Expected:
```text
tsc --noEmit 通过
vitest 全通过
```

- [ ] **Step 5: 提交**

```bash
git add src/App.tsx src/lib/step4ValidationRules.ts src/lib/step4ValidationRules.test.ts
git commit -m "feat: enforce step4 storage color unit-id validation rules"
```

### Task 4: 第4步按钮禁用联动

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 为第4步“下一步: 导出预览”增加 disabled 与样式**

```ts
const disableNextToPreview = currentStep === 4 && isExportDisabled;
```

```tsx
<button
  disabled={disableNextToPreview}
  onClick={() => {
    if (disableNextToPreview) return;
    setCurrentStep((currentStep + 1) as StepId);
  }}
  className={cn(
    "px-6 py-2 rounded font-bold text-[13px] transition-all flex items-center gap-2",
    disableNextToPreview
      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
      : "bg-[#00897b] text-white hover:bg-[#00796b] active:scale-95"
  )}
>
  下一步: {currentStep === 2 ? '要素补全' : currentStep === 3 ? '规则引擎核验' : '导出预览'}
</button>
```

- [ ] **Step 2: 手工验证第4步与第5步都受 error 控制**

Run:
```bash
npm run dev 2>&1 | head -c 4000
```

Expected:
```text
1) 第4步出现 error 时，“下一步: 导出预览”灰显不可点。
2) 解决冲突后按钮恢复可点。
3) 第5步“完成并导出”仍沿用 isExportDisabled 灰显逻辑。
```

- [ ] **Step 3: 提交**

```bash
git add src/App.tsx
git commit -m "feat: disable step4 next-to-preview when validation has errors"
```

### Task 5: 回归检查与交付

**Files:**
- Modify: `docs/superpowers/plans/2026-05-28-step4-validation-rules.md`

- [ ] **Step 1: 运行最终回归命令**

Run:
```bash
npm run lint 2>&1 | head -c 4000
npm test 2>&1 | head -c 4000
git status --short 2>&1 | head -c 4000
```

Expected:
```text
lint/test 通过，工作区只包含本需求预期改动
```

- [ ] **Step 2: 验收场景清单**

```text
A. 存储=4+128，emmc=...128G，ddr=...4G -> Rule-2 pass
B. 三供场景下任一供方不匹配 -> 该供方 Rule-2 error，按钮灰显
C. 颜色=钛银色，MBOM 包含，PBOM=NA -> Rule-1 pass
D. MBOM/PBOM 都不含颜色 -> Rule-1 error，按钮灰显
E. unit_id=PR1-A1, mb_id=A1 -> Rule-3 pass
F. unit_id=PR1-B2, mb_id=A1 -> Rule-3 error，按钮灰显
```

- [ ] **Step 3: 提交计划更新（如需）**

```bash
git add docs/superpowers/plans/2026-05-28-step4-validation-rules.md
git commit -m "docs: add executable plan for step4 validation rules"
```

## 自检结果（已覆盖）

- Spec coverage: 覆盖了存储、颜色、整机标识三条规则，以及第4步按钮灰显要求。  
- Placeholder scan: 无 `TODO/TBD/implement later` 占位描述。  
- Type consistency: 新增函数命名与 `runValidation` 引用一致，`ValidationResult` 结构不变。
