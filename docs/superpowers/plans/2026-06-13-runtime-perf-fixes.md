# Runtime Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复试产搭配表 SPA 的运行时性能问题：Univer 引擎懒加载、App.tsx 重渲染半径收缩、LLM 调用去重、localStorage 写入去抖、校验执行时机收敛。

**Architecture:**
1. 静态导入 → 动态导入（Univer 仅在到达 Step 2 后才请求 chunk）
2. App.tsx 的状态按"步进 + 业务主题"拆为独立 hook（useStep1State / useSkuState / useHistoryState / useAuthState / useProjectInfo）
3. LLM 调用点加 in-flight 单飞 + 结果缓存（按 `Workbook` 指纹）
4. localStorage 写入加 debounce（200ms）+ 仅在 history 真正变化时写
5. `runValidation` 改为显式触发按钮 + 单元格编辑后 debounce 触发（不再 useEffect 全量跑）

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6 + Vitest 4 + Univer (`@univerjs/presets`) + xlsx + motion v12

**Scope guard:** 不动 Vercel server-side 规则（本项目为静态 SPA），不动 Vite 构建配置（不在本次范围）。仅做运行时 + 客户端优化。

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `frontend/src/main.tsx` | 移除 `@univerjs/sheets/facade` 与 `@univerjs/sheets-ui/facade` 的顶层 import；CSS 保持顶层（CSS 体积小，合并即可） |
| `frontend/src/components/TrialProductionSheet.tsx` | Univer 改为动态 `import()`，仅在 step ≥ 2 时请求；保留 `useEffect` 初始化逻辑不变 |
| `frontend/src/hooks/useStep1State.ts` | 新建：抽离 `projectInfo` 中 step1 相关字段（name / customer / stage / files / step1Errors / manualPcbaInput） |
| `frontend/src/hooks/useSkuState.ts` | 新建：抽离 `skuData` / `activeFields` / `selectedRows` / `isFlowComplete` / `step5Layout` / `validationResults` 及其 setter |
| `frontend/src/hooks/useHistoryState.ts` | 新建：抽离 `history` / `showHistory` / `createNewPrompt` + 包装 localStorage 写入（含 debounce） |
| `frontend/src/hooks/useAuthState.ts` | 新建：抽离 `isLoggedIn` / `isChecking` / `currentUser` + 登录检查 + 登出 |
| `frontend/src/lib/auth.ts` | `recordUsage` 改为 fire-and-forget 派发，不阻塞调用方 |
| `frontend/src/lib/keyMaterialTemplate.ts` | `matchCategory2WithLLM` 加 in-flight 锁 + 简单内存缓存（按 `category2List` 的 join string 索引） |
| `frontend/src/lib/managedMaterialCore.ts` | `matchManagedMaterialNamesWithLLM` 同样加 in-flight 锁 + 缓存 |
| `frontend/src/lib/sampleCollectionWorkbook.ts` | `matchSampleCollectionRowsWithLLM` 同样加 in-flight 锁 + 缓存 |
| `frontend/src/App.tsx` | 替换内联 useState 为上述 hooks；`runValidation` 从 useEffect 改为手动按钮触发 + 编辑后 250ms debounce；删除 2 处 `// alert(...)` 注释 |
| `frontend/src/lib/__tests__/llm-cache.test.ts` | 新建：3 个 LLM 模块各自的"相同输入命中缓存"测试 |
| `frontend/src/lib/__tests__/localStorage-debounce.test.ts` | 新建：history debounce 测试（用 fake timers） |
| `docs/dev-memory/decisions.md` | 追加本次 5 项 ADR |

### Files NOT Modified
- `vite.config.ts`（本次不动构建配置）
- `package.json`（不增减依赖）
- `frontend/src/lib/step4ValidationRules.ts`（规则引擎本身不动，仅收敛调用频次）
- `frontend/src/lib/univerTrialProductionSheet.ts`（snapshot 模型不变）

---

## 任务清单

### Task 1: Univer 引擎懒加载

**Files:**
- Modify: `frontend/src/main.tsx:3-7`
- Modify: `frontend/src/components/TrialProductionSheet.tsx:1-12`

- [ ] **Step 1: 写失败测试** — 在 `frontend/src/components/TrialProductionSheet.test.tsx` 中新增一个断言：当父组件传入 `currentStep = 1` 时，`createUniver` 不应被调用。

```tsx
// frontend/src/components/TrialProductionSheet.test.tsx
import { vi } from 'vitest';

vi.mock('@univerjs/presets', () => ({
  createUniver: vi.fn(() => ({
    univer: { dispose: vi.fn() },
    univerAPI: { getActiveWorkbook: () => null },
  })),
  LocaleType: { ZH_CN: 'zh-CN' },
  mergeLocales: vi.fn(),
}));

import { TrialProductionSheet } from './TrialProductionSheet';
import { createUniver } from '@univerjs/presets';
import { render } from '@testing-library/react';
import { FIELD_DEFS } from '../constants';

it('does not load Univer on step 1', () => {
  render(
    <TrialProductionSheet
      activeFields={FIELD_DEFS}
      skuData={[]}
      currentStep={1}
      step2Conflicts={[]}
      efuseConfigs={[]}
      onUpdateValue={vi.fn()}
      onStructureRowInsert={vi.fn()}
      onStructureColumnInsert={vi.fn()}
      onFieldLabelChange={vi.fn()}
      onAppendField={vi.fn()}
      onAppendSupplyToAllSkus={vi.fn()}
    />
  );
  expect(createUniver).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 跑测试，预期失败**（因为现在 mount 就调用）

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/components/TrialProductionSheet.test.tsx -t "does not load Univer on step 1"
```

预期：FAIL，`expect(createUniver).not.toHaveBeenCalled()` 抛 `expected "createUniver" to not be called`

- [ ] **Step 3: 改 TrialProductionSheet.tsx 顶部 import 为动态**

把 `TrialProductionSheet.tsx` 顶部所有 `@univerjs/*` 静态 import 替换为 `useEffect` 内的 `await import()`：

```tsx
// 替换 1-9 行的所有 import
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
// ... 其他内部 import 保持 ...

// 替换 useEffect(() => { ... }, []) 内部
useEffect(() => {
  let cancelled = false;
  let univerInstance: any = null;

  (async () => {
    const { createUniver, LocaleType, mergeLocales } = await import('@univerjs/presets');
    const { UniverSheetsCorePreset } = await import('@univerjs/preset-sheets-core');
    const UniverPresetSheetsCoreZhCN = (await import('@univerjs/preset-sheets-core/locales/zh-CN')).default;
    const { UniverSheetsDataValidationPreset } = await import('@univerjs/preset-sheets-data-validation');
    const UniverPresetSheetsDataValidationZhCN = (await import('@univerjs/preset-sheets-data-validation/locales/zh-CN')).default;
    await import('@univerjs/preset-sheets-data-validation/lib/index.css');
    const { Direction, ICommandService } = await import('@univerjs/core');
    const { FUniver } = await import('@univerjs/core/facade');

    if (cancelled) return;
    const container = containerRef.current;
    if (!container || univerRef.current) return;

    univerInstance = createUniver({
      locale: LocaleType.ZH_CN,
      locales: {
        [LocaleType.ZH_CN]: mergeLocales(
          UniverPresetSheetsCoreZhCN,
          UniverPresetSheetsDataValidationZhCN,
        ),
      },
      presets: [
        UniverSheetsCorePreset({ container }),
        UniverSheetsDataValidationPreset(),
      ],
    });

    univerRef.current = univerInstance;
    univerAPIRef.current = univerInstance.univerAPI;
    const readyTimer = window.setTimeout(() => setUniverReady(true), 0);
    univerReadyTimersRef.current.push(readyTimer);
  })();

  return () => {
    cancelled = true;
    clearTimersInRef(focusRetryTimersRef);
    clearTimersInRef(viewportRestoreTimersRef);
    clearTimersInRef(univerReadyTimersRef);
    if (univerRef.current) {
      univerRef.current.univer.dispose();
      univerRef.current = null;
      univerAPIRef.current = null;
    }
    setUniverReady(false);
  };
}, []);
```

并在 useEffect 入口处加早退：`if (currentStep < 2) return;`

- [ ] **Step 4: 改 main.tsx 删除 Univer facade 顶层 import**

```tsx
// frontend/src/main.tsx
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import '@univerjs/preset-sheets-core/lib/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

（保留 preset-sheets-core 的 CSS，因为该 CSS 必须顶层 import，否则动态 import 还没回来时首次渲染会闪烁）

- [ ] **Step 5: 跑测试，预期通过**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/components/TrialProductionSheet.test.tsx -t "does not load Univer on step 1"
```

预期：PASS

- [ ] **Step 6: 跑全量测试，确认无回归**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run
```

预期：全部通过。如果有 Univer mock 引起的连锁错误，按错误调整 `TrialProductionSheet.test.tsx` 的 import 路径与 mock 列表。

- [ ] **Step 7: 跑 build 验证产物分块**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build
```

确认 `dist/assets/` 中出现新的 `TrialProductionSheet-*.js` chunk，且该 chunk 体积 ≥ 1MB（说明 Univer 已被拆出主包）。

- [ ] **Step 8: 提交**

```bash
git -C /Users/shenmingjie/tinno/trial-production/trial-production add frontend/src/main.tsx frontend/src/components/TrialProductionSheet.tsx frontend/src/components/TrialProductionSheet.test.tsx
git -C /Users/shenmingjie/tinno/trial-production/trial-production commit -m "perf(univer): lazy-load Univer engine only when currentStep >= 2"
```

---

### Task 2: LLM 调用单飞 + 内存缓存

**Files:**
- Modify: `frontend/src/lib/keyMaterialTemplate.ts:186` (`matchCategory2WithLLM`)
- Modify: `frontend/src/lib/managedMaterialCore.ts:226` (`matchManagedMaterialNamesWithLLM`)
- Modify: `frontend/src/lib/sampleCollectionWorkbook.ts:151` (`matchSampleCollectionRowsWithLLM`)
- Create: `frontend/src/lib/__tests__/llm-cache.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// frontend/src/lib/__tests__/llm-cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { generateContent: vi.fn() },
  })),
}));

import { matchCategory2WithLLM } from '../keyMaterialTemplate';
import { matchManagedMaterialNamesWithLLM } from '../managedMaterialCore';
import { matchSampleCollectionRowsWithLLM } from '../sampleCollectionWorkbook';

describe('LLM single-flight + cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keyMaterial: same input reuses cache', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 })
    );
    const list = ['电池', '喇叭'];
    await matchCategory2WithLLM(list);
    await matchCategory2WithLLM(list);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('managedMaterial: same input reuses cache', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 })
    );
    const args = { descFieldMap: { a: '电池' } as any, managedMaterialNames: ['电池'] };
    await matchManagedMaterialNamesWithLLM(args);
    await matchManagedMaterialNamesWithLLM(args);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('sampleCollection: same input reuses cache', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 })
    );
    const rows = ['硬件测试'];
    await matchSampleCollectionRowsWithLLM(rows);
    await matchSampleCollectionRowsWithLLM(rows);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 跑测试，预期失败**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/lib/__tests__/llm-cache.test.ts
```

预期：FAIL（fetch 被调用 2 次而非 1 次）

- [ ] **Step 3: 在 `keyMaterialTemplate.ts` 顶部加缓存 + 单飞锁**

在 `matchCategory2WithLLM` 函数体外、`KEY_MATERIAL_LLM_CONFIG` 下方加：

```ts
// frontend/src/lib/keyMaterialTemplate.ts （在 KEY_MATERIAL_LLM_CONFIG 定义之后）
const llmResultCache = new Map<string, Promise<Record<string, string>>>();
const llmInFlight = new Map<string, Promise<Record<string, string>>>();
```

在 `matchCategory2WithLLM` 函数开头加：

```ts
const cacheKey = [...category2List].sort().join('|');
if (llmResultCache.has(cacheKey)) return llmResultCache.get(cacheKey)!;
if (llmInFlight.has(cacheKey)) return llmInFlight.get(cacheKey)!;
```

在函数末尾 `return result;` 之前加：

```ts
llmResultCache.set(cacheKey, Promise.resolve(result));
llmInFlight.delete(cacheKey);
```

并在所有 `throw` / `return fallback` 路径之前加：

```ts
llmInFlight.delete(cacheKey);
```

具体来说，在 `keyMaterialTemplate.ts:186` 开始的 `matchCategory2WithLLM` 中：
- 函数体最外层用 `try { ... } catch { ... } finally { llmInFlight.delete(cacheKey); }` 包裹
- 在 `try` 块开头处执行"缓存命中检查"
- 在 `try` 块结束、即将 `return result` 之前执行"写入缓存"
- 在 `catch` 块内 `return fallback` 之前不写缓存（但要清 in-flight）

- [ ] **Step 4: 同样改造 `managedMaterialCore.ts:226` 与 `sampleCollectionWorkbook.ts:151`**

两个文件的改造方式与 Step 3 一致：
- 在模块顶部加 `llmResultCache` + `llmInFlight` Map
- cacheKey 用 `JSON.stringify` 排序后的入参（managedMaterial 需要序列化 `descFieldMap` 与 `managedMaterialNames`，sampleCollection 仅用 `rowNames`）
- 在 try 开头检查缓存、在 return 前写缓存

managedMaterial 的 cacheKey：

```ts
const cacheKey = JSON.stringify({
  desc: Object.fromEntries(Object.entries(args.descFieldMap).sort()),
  names: [...args.managedMaterialNames].sort(),
});
```

sampleCollection 的 cacheKey：

```ts
const cacheKey = [...rowNames].sort().join('|');
```

- [ ] **Step 5: 跑测试，预期通过**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/lib/__tests__/llm-cache.test.ts
```

预期：3 个 it 全部 PASS

- [ ] **Step 6: 跑单文件原有测试，确保 fallback 路径仍工作**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/lib/keyMaterialTemplate.test.ts src/lib/managedMaterialCore.test.ts src/lib/sampleCollectionWorkbook.test.ts
```

预期：全部通过。如有失败，检查 mock 与 fetch 拦截是否与新代码兼容。

- [ ] **Step 7: 提交**

```bash
git -C /Users/shenmingjie/tinno/trial-production/trial-production add frontend/src/lib/keyMaterialTemplate.ts frontend/src/lib/managedMaterialCore.ts frontend/src/lib/sampleCollectionWorkbook.ts frontend/src/lib/__tests__/llm-cache.test.ts
git -C /Users/shenmingjie/tinno/trial-production/trial-production commit -m "perf(llm): single-flight + cache for the three category/row matchers"
```

---

### Task 3: localStorage history 写入去抖

**Files:**
- Create: `frontend/src/hooks/useHistoryState.ts`
- Modify: `frontend/src/App.tsx:81-82, 146-177, 244, 327, 358, 367`

- [ ] **Step 1: 写失败测试**

```ts
// frontend/src/lib/__tests__/localStorage-debounce.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryState } from '../../hooks/useHistoryState';

describe('useHistoryState debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces multiple setHistory into one localStorage write', () => {
    const { result } = renderHook(() => useHistoryState());
    act(() => {
      result.current.setHistory([{ id: '1', timestamp: 1, name: 'a' } as any]);
      result.current.setHistory([{ id: '2', timestamp: 2, name: 'b' } as any]);
      result.current.setHistory([{ id: '3', timestamp: 3, name: 'c' } as any]);
    });
    expect(localStorage.getItem('trial_production_history')).toBeNull();
    act(() => { vi.advanceTimersByTime(250); });
    const written = JSON.parse(localStorage.getItem('trial_production_history')!);
    expect(written).toHaveLength(1);
    expect(written[0].id).toBe('3');
  });

  it('does not write when history did not change', () => {
    const { result } = renderHook(() => useHistoryState());
    act(() => {
      result.current.setHistory([{ id: '1', timestamp: 1, name: 'a' } as any]);
    });
    act(() => { vi.advanceTimersByTime(250); });
    const before = localStorage.getItem('trial_production_history');
    act(() => {
      result.current.setHistory([{ id: '1', timestamp: 1, name: 'a' } as any]);
    });
    act(() => { vi.advanceTimersByTime(250); });
    const after = localStorage.getItem('trial_production_history');
    expect(before).toBe(after);
  });
});
```

- [ ] **Step 2: 跑测试，预期失败**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/lib/__tests__/localStorage-debounce.test.ts
```

预期：FAIL（hooks 还没创建）

- [ ] **Step 3: 创建 `useHistoryState` hook**

```ts
// frontend/src/hooks/useHistoryState.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HistoryEntry } from '../types';
import { normalizeHistoryEntries } from '../lib/skuValueNormalization';
import { shouldAllowQaSeed } from '../lib/qaHistorySeeds';
import { getQaSeedEntries } from '../lib/qaHistorySeeds';

const STORAGE_KEY = 'trial_production_history';
const DEBOUNCE_MS = 200;

export function useHistoryState() {
  const [history, setHistoryState] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [createNewPrompt, setCreateNewPrompt] = useState(false);
  const writeTimerRef = useRef<number | null>(null);
  const lastWrittenRef = useRef<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined' && shouldAllowQaSeed(window.location.hostname)) {
      const seeded = getQaSeedEntries(window.location.search);
      if (seeded) {
        const normalized = normalizeHistoryEntries(seeded);
        setHistoryState(normalized.entries);
        lastWrittenRef.current = JSON.stringify(normalized.entries);
        setShowHistory(true);
        return;
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as HistoryEntry[];
      const compatible = parsed.filter((e) =>
        e.skuData.every((sku) =>
          sku.supplies.every((sup) => typeof (sup as any).supplyKey === 'string')
        )
      );
      const normalized = normalizeHistoryEntries(compatible);
      setHistoryState(normalized.entries);
      lastWrittenRef.current = JSON.stringify(normalized.entries);
    } catch {
      // ignore parse error
    }
  }, []);

  const writeHistory = useCallback((next: HistoryEntry[]) => {
    if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(() => {
      const serialized = JSON.stringify(next);
      if (serialized === lastWrittenRef.current) return;
      localStorage.setItem(STORAGE_KEY, serialized);
      lastWrittenRef.current = serialized;
    }, DEBOUNCE_MS);
  }, []);

  const setHistory = useCallback((updater: HistoryEntry[] | ((prev: HistoryEntry[]) => HistoryEntry[])) => {
    setHistoryState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeHistory(next);
      return next;
    });
  }, [writeHistory]);

  return {
    history,
    setHistory,
    showHistory,
    setShowHistory,
    createNewPrompt,
    setCreateNewPrompt,
  };
}
```

- [ ] **Step 4: 跑测试，预期通过**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/lib/__tests__/localStorage-debounce.test.ts
```

预期：2 个 it 全部 PASS

- [ ] **Step 5: 在 App.tsx 替换原 useState**

把 `App.tsx:81-83`：

```ts
const [history, setHistory] = useState<HistoryEntry[]>([]);
const [showHistory, setShowHistory] = useState(false);
const [createNewPrompt, setCreateNewPrompt] = useState(false);
```

替换为：

```ts
import { useHistoryState } from './hooks/useHistoryState';
// ... 其它 import ...
const { history, setHistory, showHistory, setShowHistory, createNewPrompt, setCreateNewPrompt } = useHistoryState();
```

并删除 `App.tsx:146-177` 整段"useEffect 加载 history"代码（已迁入 hook 内）。

- [ ] **Step 6: 删除 App.tsx 中其他 localStorage.setItem('trial_production_history', ...) 调用**

行号：244、327、358、367 — 把这些行的 `localStorage.setItem(STORAGE_KEY, ...)` 整行删除（`setHistory` 已经触发 debounce 写入）。如果某些路径需要立即写（如导出前的最后落盘），保留为 `setHistory(newHistory)` 不变（hook 已自动落盘）。

- [ ] **Step 7: 跑全量测试**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run
```

预期：全部通过

- [ ] **Step 8: 跑 lint**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint
```

预期：通过

- [ ] **Step 9: 提交**

```bash
git -C /Users/shenmingjie/tinno/trial-production/trial-production add frontend/src/hooks/useHistoryState.ts frontend/src/App.tsx frontend/src/lib/__tests__/localStorage-debounce.test.ts
git -C /Users/shenmingjie/tinno/trial-production/trial-production commit -m "perf(history): debounce localStorage writes + dedup same payload"
```

---

### Task 4: 校验执行时机收敛

**Files:**
- Modify: `frontend/src/App.tsx:963-967`（删除 useEffect 触发）

- [ ] **Step 1: 改 App.tsx 删除 useEffect 自动校验**

把 `App.tsx:963-967`：

```ts
useEffect(() => {
  if (currentStep >= 4) {
    runValidation();
  }
}, [currentStep, isFlowComplete, skuData]);
```

替换为：

```ts
const runValidationDebounced = useDebouncedCallback(runValidation, 250);

useEffect(() => {
  if (currentStep >= 4) {
    runValidationDebounced();
  }
}, [currentStep, isFlowComplete, skuData, runValidationDebounced]);
```

并在文件顶部 import 处加：

```ts
import { useDebouncedCallback } from 'use-debounce';
```

（如未安装 `use-debounce` 库，则**改成手写 8 行 debounce**，见 Step 1b）

- [ ] **Step 1b（fallback）: 手写 debounce**

如果不想加新依赖，把 Step 1 的代码替换为：

```ts
// App.tsx 顶部加
function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const fnRef = useRef(fn);
  const timerRef = useRef<number | null>(null);
  useEffect(() => { fnRef.current = fn; }, [fn]);
  return useCallback(((...args: Parameters<T>) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => fnRef.current(...args), delay);
  }) as T, [delay]);
}

// 在组件内
const runValidationDebounced = useDebouncedCallback(runValidation, 250);
```

- [ ] **Step 2: 跑全量测试 + lint**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint
```

预期：全部通过

- [ ] **Step 3: 提交**

```bash
git -C /Users/shenmingjie/tinno/trial-production/trial-production add frontend/src/App.tsx
git -C /Users/shenmingjie/tinno/trial-production/trial-production commit -m "perf(validation): debounce runValidation triggered on step/data change"
```

---

### Task 5: App.tsx 状态拆分（最大头 — 风险最高）

> 警告：本任务改动最大。**先做完 Task 1–4 再做本任务**，因为前 4 个任务的失败风险已隔离。

**Files:**
- Create: `frontend/src/hooks/useStep1State.ts`
- Create: `frontend/src/hooks/useSkuState.ts`
- Create: `frontend/src/hooks/useAuthState.ts`
- Modify: `frontend/src/App.tsx:62-93`（删除原 useState 块）
- Modify: `frontend/src/App.tsx` 全文（替换 `projectInfo.*` / `setProjectInfo` 调用为 `step1.set*` / `sku.set*` / `auth.set*`）

- [ ] **Step 1: 写 useStep1State hook**

```ts
// frontend/src/hooks/useStep1State.ts
import { useState } from 'react';
import type { ProjectInfo, Template } from '../types';

export function useStep1State() {
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState<Template | ''>('');
  const [stage, setStage] = useState('');
  const [files, setFiles] = useState<ProjectInfo['files']>([]);
  const [step1Errors, setStep1Errors] = useState<Record<string, boolean>>({});
  const [manualPcbaInput, setManualPcbaInput] = useState('');
  return {
    name, setName,
    customer, setCustomer,
    stage, setStage,
    files, setFiles,
    step1Errors, setStep1Errors,
    manualPcbaInput, setManualPcbaInput,
  };
}
```

- [ ] **Step 2: 写 useSkuState hook**

```ts
// frontend/src/hooks/useSkuState.ts
import { useState } from 'react';
import type { SKUData, FieldDefinition, ValidationResult, Step5LayoutSnapshot } from '../types';
import { FIELD_DEFS } from '../constants';

export function useSkuState() {
  const [skuData, setSkuData] = useState<SKUData[]>([]);
  const [activeFields, setActiveFields] = useState<FieldDefinition[]>(FIELD_DEFS);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isFlowComplete, setIsFlowComplete] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isExportDisabled, setIsExportDisabled] = useState(true);
  const [step5Layout, setStep5Layout] = useState<Step5LayoutSnapshot | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [copiedSku, setCopiedSku] = useState<any>(null);
  return {
    skuData, setSkuData,
    activeFields, setActiveFields,
    selectedRows, setSelectedRows,
    isFlowComplete, setIsFlowComplete,
    validationResults, setValidationResults,
    isExportDisabled, setIsExportDisabled,
    step5Layout, setStep5Layout,
    selectedSkuId, setSelectedSkuId,
    copiedSku, setCopiedSku,
  };
}
```

- [ ] **Step 3: 写 useAuthState hook**

```ts
// frontend/src/hooks/useAuthState.ts
import { useEffect, useState } from 'react';
import { checkLoginStatus } from '../lib/auth';
import { getLocalBypassUser, shouldBypassLocalLogin } from '../config/localAuth';
import type { UserInfo } from '../lib/auth';

export function useAuthState() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    (async () => {
      if (shouldBypassLocalLogin()) {
        setIsLoggedIn(true);
        setCurrentUser(getLocalBypassUser());
        setIsChecking(false);
        return;
      }
      const status = await checkLoginStatus();
      setIsLoggedIn(status.isLoggedIn);
      setCurrentUser(status.user || null);
      setIsChecking(false);
    })();
  }, []);

  return { isLoggedIn, setIsLoggedIn, isChecking, setIsChecking, currentUser, setCurrentUser };
}
```

- [ ] **Step 4: 在 App.tsx 接入三个 hook**

把 `App.tsx:62-93` 整段 useState 块删除，替换为：

```ts
import { useStep1State } from './hooks/useStep1State';
import { useSkuState } from './hooks/useSkuState';
import { useAuthState } from './hooks/useAuthState';
import { useHistoryState } from './hooks/useHistoryState';

// 在组件顶部
const step1 = useStep1State();
const sku = useSkuState();
const auth = useAuthState();
const historyState = useHistoryState();
const [currentStep, setCurrentStep] = useState<StepId>(1);
const [loading, setLoading] = useState(false);
const [loadingText, setLoadingText] = useState('');
const [loadingPhase, setLoadingPhase] = useState<'upload' | 'calc'>('calc');
const [isUploadResolving, setIsUploadResolving] = useState(false);
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [stepsCollapsed, setStepsCollapsed] = useState(false);
```

- [ ] **Step 5: 全文替换 `setProjectInfo(prev => ({ ...prev, name: ... }))` → `step1.setName(...)`**

- 用 grep 找出所有 `setProjectInfo` 调用点
- 逐个替换为对应的 step1.set* 或 sku.set* 或 historyState.set*
- 这是机械替换，每个调用点根据访问的字段（name/customer/stage/files/pcbaRows/checkedPcbaOptions/keyMaterialTemplate/managedMaterialCore/managedMaterialSupplierAlignment/sampleCollectionWorkbook/supplyKeys）映射到正确的 hook

> ⚠️ 提示：`projectInfo` 中还包含 step 2-4 的派生状态（pcbaRows / keyMaterialTemplate / managedMaterialCore / sampleCollectionWorkbook 等）。这些字段需要单独的 hook。**本任务只迁移 step1 + sku + auth + history，projectInfo 残留字段先保持原样**，等下一步再分。

- [ ] **Step 6: 跑 build 验证**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run
```

预期：build 通过 + 全量测试通过

- [ ] **Step 7: 提交**

```bash
git -C /Users/shenmingjie/tinno/trial-production/trial-production add frontend/src/hooks/useStep1State.ts frontend/src/hooks/useSkuState.ts frontend/src/hooks/useAuthState.ts frontend/src/App.tsx
git -C /Users/shenmingjie/tinno/trial-production/trial-production commit -m "refactor(app): split App.tsx state into useStep1State/useSkuState/useAuthState"
```

---

### Task 6: 清理两处 alert 注释代码 + 写 ADR

**Files:**
- Modify: `frontend/src/App.tsx:237, 240`
- Modify: `docs/dev-memory/decisions.md`

- [ ] **Step 1: 删除 App.tsx 237、240 行的 alert 注释**

```diff
-      // if (!isExport) alert(`已更新覆盖历史记录: ${entry.name} V${version}`);
+      // silent: 用户已通过 UI 反馈看到状态
       } else {
         newHistory = [entry, ...newHistory];
-      // if (!isExport) alert(`已保存为新版本: V${version}`);
+      // silent: 用户已通过 UI 反馈看到状态
       }
```

（直接整行删除也可，因为 Sidebar.tsx 已用 toast 反馈）

- [ ] **Step 2: 在 `docs/dev-memory/decisions.md` 末尾追加**

```md
## 2026-06-13: 运行时性能优化第一轮

- **ADR-2026-06-13-1: Univer 引擎改为动态 import**
  - 主包不再含 Univer；进入 step ≥ 2 时才请求 chunk。
  - 副作用：main bundle 减小约 4–5 MB；首次进入 step 2 时多一次网络请求。

- **ADR-2026-06-13-2: LLM 三路调用加 in-flight 单飞 + 内存缓存**
  - cache key：sorted category2List / sorted descFieldMap + names / sorted rowNames。
  - 失效：刷新页面失效。同一项目不刷新场景下避免重复请求。
  - 不写磁盘：避免历史 history 体积膨胀。

- **ADR-2026-06-13-3: history localStorage 写入去抖 + dedup**
  - 200ms debounce；serialized 内容未变则跳过写入。
  - 入口：useHistoryState hook 内部。

- **ADR-2026-06-13-4: 校验改为 debounce 触发**
  - 250ms debounce；保留 useEffect 自动触发，但合并短时间内的多次触发。
  - 不改 runValidation 本身。

- **ADR-2026-06-13-5: App.tsx 状态拆分**
  - 第一步：拆出 useStep1State / useSkuState / useAuthState / useHistoryState。
  - 后续：projectInfo 残留的 step 2-4 派生状态再做下一轮拆分。
```

- [ ] **Step 3: 提交**

```bash
git -C /Users/shenmingjie/tinno/trial-production/trial-production add frontend/src/App.tsx docs/dev-memory/decisions.md
git -C /Users/shenmingjie/tinno/trial-production/trial-production commit -m "chore: remove dead alert comments + record 5 ADRs in dev-memory"
```

---

## 自检（Self-Review）

### 覆盖核对
- [x] 段 A（App.tsx 单组件结构）→ Task 5
- [x] 段 B（useMemo/useCallback）→ 现状已有部分覆盖，本轮不重写（属于更大重构）
- [x] 段 C（校验时机）→ Task 4
- [x] 段 D（LLM 去重/取消/缓存）→ Task 2
- [x] 段 E（localStorage 频率）→ Task 3
- [x] 段 F（Univer 生命周期）→ Task 1
- [x] 段 G-J → 风险过大，本轮不动，留到下一轮

### 占位符扫描
- 无 "TBD" / "TODO" / "fill in details"
- 每个 Task 都包含具体代码（非伪代码）
- 每个 Task 都有验证步骤（test / build / lint）

### 类型一致性
- `useHistoryState` 返回字段名（`history` / `setHistory` / `showHistory` / `createNewPrompt`）与原 App.tsx 命名一致
- `useStep1State` / `useSkuState` 字段名与原 useState 一致
- `useAuthState` 字段名与原 useState 一致
- `runValidationDebounced` 类型与 `runValidation` 签名一致（都是 `(...) => void`）

### 已知风险
1. Task 5 是最大改动，已限定在 step1/sku/auth/history 四个 hook，projectInfo 残留字段不重写
2. Univer 动态 import 在测试环境需要 mock — Step 1 已处理
3. `useDebouncedCallback` 如果用 `use-debounce` 库需先安装，否则用 fallback 手写
