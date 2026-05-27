# Band Auto-Fill from PCBA Config Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从配置表的「PCBA配置表」sheet 中，读取每个 PCBA 标识对应行的「出货市场」列值，自动填入 `band` 字段；若同一 PCBA 对应多个不同出货市场，则在 Step 2 表格中标红 `band` 单元格并在 Sidebar 显示冲突条目。

**Architecture:** 扩展 `extractPcbaOptions` 返回类型为 `PcbaOption[]`（含 `pcba` / `band` / `bandConflict` 字段）；在 `startAutoCalc` 中用 `band` 值初始化对应 SKU 的 supply values；若 `bandConflict=true`，则 band 留空，让现有 Step 2 空值标红机制自然触发。

**Tech Stack:** TypeScript, React 19, xlsx (已安装), vitest (新增，仅用于 `extractPcbaOptions` 单元测试)

---

## 文件变更一览

| 文件 | 操作 | 职责变化 |
|------|------|----------|
| `src/lib/utils.ts` | 修改 | `extractPcbaOptions` 返回 `PcbaOption[]`；新增出货市场列查找与多值冲突检测 |
| `src/types.ts` | 修改 | 新增 `PcbaOption` 接口；`ProjectInfo.pcbaOptions` 类型改为 `PcbaOption[]` |
| `src/App.tsx` | 修改 | Step 1 PCBA 选择 UI 适配新类型；`startAutoCalc` 用 `band` 初始化 supply values |
| `src/components/Sidebar.tsx` | 不修改 | 已有 `step2Conflicts` 机制，自动显示 band 冲突条目 |
| `src/components/TrialProductionTable.tsx` | 不修改 | 已有空值标红机制，band 冲突时 band='' 即可触发 |
| `vite.config.ts` | 修改 | 添加 vitest test 配置 |
| `src/lib/utils.test.ts` | 新建 | `extractPcbaOptions` 单元测试 |

---

## Task 1: 安装 vitest 并配置

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: 安装 vitest**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm install -D vitest
```

- [ ] **Step 2: 修改 `vite.config.ts`，添加 test 配置**

将整个文件替换为：

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      environment: 'node',
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```

- [ ] **Step 3: 在 `package.json` 的 scripts 中添加 test 命令**

在 `"lint": "tsc --noEmit"` 这行下方加一行：

```json
"test": "vitest run"
```

- [ ] **Step 4: 验证 vitest 可运行**

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run --reporter=verbose 2>&1 | head -c 2000
```

Expected: `No test files found` 或 `0 passed`，无报错。

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "chore: add vitest for unit testing"
```

---


## Task 2: 定义 `PcbaOption` 类型并更新 `ProjectInfo`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: 在 `src/types.ts` 中，在 `ProjectInfo` 接口之前新增 `PcbaOption` 接口**

在 `export interface ProjectInfo {` 这行前面插入：

```ts
export interface PcbaOption {
  pcba: string;          // PCBA 标识，如 "A1"、"U1"
  band: string;          // 出货市场（即频段）；冲突时为空字符串 ""
  bandConflict: boolean; // true 表示该 PCBA 对应配置表中多个不同出货市场
}
```

- [ ] **Step 2: 修改 `ProjectInfo` 中的 `pcbaOptions` 字段类型**

将：
```ts
pcbaOptions?: string[];
```
改为：
```ts
pcbaOptions?: PcbaOption[];
```

`checkedPcbaOptions?: string[]` 保持不变（只记录用户勾选了哪些 pcba 标识）。

- [ ] **Step 3: 运行类型检查，记录报错数量**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx tsc --noEmit 2>&1 | head -c 4000
```

Expected: 有若干报错（App.tsx 中旧的 string[] 用法），记录总数，后续 Task 5 清零。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add PcbaOption type, update ProjectInfo.pcbaOptions to PcbaOption[]"
```

---

## Task 3: 先写测试（TDD）

**Files:**
- Create: `src/lib/utils.test.ts`

测试通过 `xlsx` 库在内存中构造 xlsx Buffer，模拟真实配置表 sheet，完全不依赖磁盘文件。

- [ ] **Step 1: 创建 `src/lib/utils.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { extractPcbaOptions } from './utils';

/** 构造含 "PCBA配置表" sheet 的 xlsx File 对象 */
function makeXlsxFile(aoa: (string | null)[][]): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'PCBA配置表');
  const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('extractPcbaOptions', () => {
  it('每个 PCBA 对应一个出货市场，返回含 band 的列表', async () => {
    const aoa = [
      ['PCBA配置', '出货市场', '其他列'],
      ['A1',       'SSA',      'x'],
      ['B1',       'LATAM',    'y'],
    ];
    const result = await extractPcbaOptions(makeXlsxFile(aoa));
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA',   bandConflict: false });
    expect(result[1]).toEqual({ pcba: 'B1', band: 'LATAM', bandConflict: false });
  });

  it('同一 PCBA 对应多个不同出货市场 → bandConflict=true, band=""', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['A1',       'SSA'],
      ['A1',       'LATAM'],
    ];
    const result = await extractPcbaOptions(makeXlsxFile(aoa));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: '', bandConflict: true });
  });

  it('同一 PCBA 多行但出货市场相同 → 不算冲突', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['A1',       'SSA'],
      ['A1',       'SSA'],
    ];
    const result = await extractPcbaOptions(makeXlsxFile(aoa));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false });
  });

  it('没有出货市场列时，band="" bandConflict=false', async () => {
    const aoa = [
      ['PCBA配置', '其他列'],
      ['A1',       'x'],
    ];
    const result = await extractPcbaOptions(makeXlsxFile(aoa));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: '', bandConflict: false });
  });

  it('没有 PCBA配置表 sheet 时返回空数组', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A']]), '其他sheet');
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test.xlsx');
    expect(await extractPcbaOptions(file)).toEqual([]);
  });

  it('跳过含中文的分隔行', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['单板规格',  null],
      ['A1',       'SSA'],
    ];
    const result = await extractPcbaOptions(makeXlsxFile(aoa));
    expect(result).toHaveLength(1);
    expect(result[0].pcba).toBe('A1');
  });
});
```

- [ ] **Step 2: 运行测试，确认全部失败**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/lib/utils.test.ts --reporter=verbose 2>&1 | head -c 3000
```

Expected: 6 tests FAIL（类型不匹配，extractPcbaOptions 仍返回 string[]）

- [ ] **Step 3: Commit 测试文件**

```bash
git add src/lib/utils.test.ts
git commit -m "test: add extractPcbaOptions tests for band auto-fill (red)"
```

---

## Task 4: 实现新版 `extractPcbaOptions`

**Files:**
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: 在 `src/lib/utils.ts` 顶部添加 import**

在第 1 行 `import { clsx, type ClassValue } from 'clsx';` 之后添加：

```ts
import type { PcbaOption } from '../types';
```

- [ ] **Step 2: 将整个 `extractPcbaOptions` 函数替换为以下实现**

删除原有函数（第 23-84 行），替换为：

```ts
/**
 * 从上传的配置表文件中提取 PCBA 配置选项，含出货市场（band）。
 *
 * 策略：
 * 1. 在 "PCBA配置表" sheet 中找 /PCBA\s*配置/ 的表头列（headerColIdx）。
 * 2. 在同一表头行中找 /出货\s*市场/ 的列（marketColIdx）；找不到则 marketColIdx=-1。
 * 3. 逐行收集数据：跳过含中文或空白的分隔行，以 pcba 为 key 收集所有 market 值到 Set。
 * 4. Set.size===0 → band='', bandConflict=false
 *    Set.size===1 → band=唯一值, bandConflict=false
 *    Set.size>1   → band='', bandConflict=true
 */
export async function extractPcbaOptions(file: File): Promise<PcbaOption[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const targetSheetName = wb.SheetNames.find(name => name.includes('PCBA配置表'));
  if (!targetSheetName) return [];

  const ws = wb.Sheets[targetSheetName];
  const aoa: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: true,
  }) as (string | number | null | undefined)[][];

  if (!aoa.length) return [];

  // Find header row: cell matches /PCBA\s*配置/
  let headerRowIdx = -1;
  let headerColIdx = -1;

  for (let r = 0; r < aoa.length; r++) {
    for (let c = 0; c < aoa[r].length; c++) {
      if (/PCBA\s*配置/.test(String(aoa[r][c] ?? '').trim())) {
        headerRowIdx = r;
        headerColIdx = c;
        break;
      }
    }
    if (headerRowIdx !== -1) break;
  }

  if (headerRowIdx === -1) return [];

  // Find "出货市场" column in the same header row
  let marketColIdx = -1;
  const headerRow = aoa[headerRowIdx];
  for (let c = 0; c < headerRow.length; c++) {
    if (/出货\s*市场/.test(String(headerRow[c] ?? '').trim())) {
      marketColIdx = c;
      break;
    }
  }

  // Collect: Map<pcba, Set<marketValue>>
  const pcbaMarkets = new Map<string, Set<string>>();
  const pcbaOrder: string[] = [];

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const row = aoa[r];
    const rawPcba = row[headerColIdx];
    if (rawPcba === null || rawPcba === undefined) continue;

    const pcba = String(rawPcba).trim();
    if (!pcba) continue;

    // Skip separator rows
    if (/[\u4e00-\u9fa5]/.test(pcba) || /\s/.test(pcba)) continue;

    if (!pcbaMarkets.has(pcba)) {
      pcbaMarkets.set(pcba, new Set());
      pcbaOrder.push(pcba);
    }

    if (marketColIdx !== -1) {
      const raw = row[marketColIdx];
      if (raw !== null && raw !== undefined) {
        const market = String(raw).trim();
        if (market) pcbaMarkets.get(pcba)!.add(market);
      }
    }
  }

  return pcbaOrder.map(pcba => {
    const markets = pcbaMarkets.get(pcba)!;
    if (markets.size === 0) return { pcba, band: '', bandConflict: false };
    if (markets.size === 1) return { pcba, band: [...markets][0], bandConflict: false };
    return { pcba, band: '', bandConflict: true };
  });
}
```

- [ ] **Step 3: 运行测试，确认全部通过**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vitest run src/lib/utils.test.ts --reporter=verbose 2>&1 | head -c 3000
```

Expected:
```
Test Files  1 passed (1)
Tests       6 passed (6)
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: extractPcbaOptions returns PcbaOption[] with band and bandConflict"
```

---

## Task 5: 适配 `App.tsx`

**Files:**
- Modify: `src/App.tsx`

三处改动：(A) `startAutoCalc` 中 band 赋值；(B) Step 1 PCBA checkbox UI 显示 band 提示；(C) `doResetForNew` 中 pcbaOptions 初始值。

- [ ] **Step 1: 修改 `startAutoCalc` 中生成 baseData 的部分（约第 382-395 行）**

将：
```ts
baseData = projectInfo.checkedPcbaOptions.map((pcba, idx) => ({
  id: `sku_${Date.now()}_${idx}`,
  stage: projectInfo.stage,
  orderNo: '',
  project: pcba,
  supplies: [
    { id: `s_${Date.now()}_${idx}_1`, label: '主供', values: { storage: pcba.replace('PCBA-', '').replace('G', '') + '+G', lcd: '' } }
  ]
}));
```

改为：
```ts
baseData = projectInfo.checkedPcbaOptions.map((pcbaId, idx) => {
  const opt = (projectInfo.pcbaOptions || []).find(o => o.pcba === pcbaId);
  const bandValue = opt && !opt.bandConflict ? opt.band : '';
  return {
    id: `sku_${Date.now()}_${idx}`,
    stage: projectInfo.stage,
    orderNo: '',
    project: pcbaId,
    supplies: [
      {
        id: `s_${Date.now()}_${idx}_1`,
        label: '主供',
        values: {
          storage: pcbaId.replace('PCBA-', '').replace('G', '') + '+G',
          lcd: '',
          band: bandValue,
        }
      }
    ]
  };
});
```

- [ ] **Step 2: 修改 Step 1 中 PCBA checkbox 列表的渲染（约第 941-962 行）**

将：
```tsx
{projectInfo.pcbaOptions.map(pcba => (
  <label
    key={pcba}
    className={cn(
      "flex items-center justify-center gap-2 bg-white px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors relative border border-slate-200 rounded-lg shadow-sm min-w-[60px]",
      projectInfo.checkedPcbaOptions?.includes(pcba) ? 'bg-blue-50/50 border-blue-400' : ''
    )}
  >
    <input
      type="checkbox"
      className="w-3.5 h-3.5 text-blue-600 rounded shrink-0"
      checked={projectInfo.checkedPcbaOptions?.includes(pcba)}
      onChange={(e) => {
        setProjectInfo(prev => {
          const c = new Set(prev.checkedPcbaOptions || []);
          if (e.target.checked) c.add(pcba); else c.delete(pcba);
          return { ...prev, checkedPcbaOptions: Array.from(c) };
        });
      }}
    />
    <span className="text-[13px] font-bold text-slate-800 truncate" title={pcba}>{pcba}</span>
  </label>
))}
```

改为：
```tsx
{projectInfo.pcbaOptions.map(opt => (
  <label
    key={opt.pcba}
    className={cn(
      "flex items-center justify-center gap-2 bg-white px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors relative border border-slate-200 rounded-lg shadow-sm min-w-[60px]",
      projectInfo.checkedPcbaOptions?.includes(opt.pcba) ? 'bg-blue-50/50 border-blue-400' : ''
    )}
  >
    <input
      type="checkbox"
      className="w-3.5 h-3.5 text-blue-600 rounded shrink-0"
      checked={projectInfo.checkedPcbaOptions?.includes(opt.pcba)}
      onChange={(e) => {
        setProjectInfo(prev => {
          const c = new Set(prev.checkedPcbaOptions || []);
          if (e.target.checked) c.add(opt.pcba); else c.delete(opt.pcba);
          return { ...prev, checkedPcbaOptions: Array.from(c) };
        });
      }}
    />
    <div className="flex flex-col items-center min-w-0">
      <span className="text-[13px] font-bold text-slate-800 truncate" title={opt.pcba}>{opt.pcba}</span>
      {opt.band && !opt.bandConflict && (
        <span className="text-[10px] text-slate-400 font-medium">{opt.band}</span>
      )}
      {opt.bandConflict && (
        <span className="text-[10px] text-amber-500 font-bold">多市场冲突</span>
      )}
    </div>
  </label>
))}
```

- [ ] **Step 3: 修改"全选" checkbox 的 checked 判断（约第 928 行）**

将：
```tsx
checked={projectInfo.checkedPcbaOptions?.length === projectInfo.pcbaOptions.length}
```
改为（逻辑不变，但确保使用 opt.pcba 对齐）：
```tsx
checked={
  projectInfo.pcbaOptions.length > 0 &&
  projectInfo.checkedPcbaOptions?.length === projectInfo.pcbaOptions.length
}
```

- [ ] **Step 4: 运行类型检查，必须 0 errors**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx tsc --noEmit 2>&1 | head -c 4000
```

Expected: 无输出（0 errors）。如有报错，按报错信息逐一修复后再次运行，直到清零。

- [ ] **Step 5: 运行 vite build 验证产物**

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npx vite build 2>&1 | tail -c 1000
```

Expected: `built in Xs`，无错误。

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: init band from PcbaOption.band in startAutoCalc, show band hint in PCBA selector"
```

---

## Task 6: 手动验证三个场景

此任务无代码改动，纯手动端到端验证。

- [ ] **Step 1: 启动开发服务器**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run dev
```

- [ ] **Step 2: 场景 A — 正常情况（无冲突）**

构造一个配置表，PCBA配置表 sheet 中：

| PCBA配置 | 出货市场 |
|---------|---------|
| A1      | SSA     |
| B1      | LATAM   |

操作：上传 → 勾选 A1 → 填写必填项 → 点「点此开始解析」

验证：
- Step 1 选择列表中 A1 下方显示灰色小字 `SSA`
- 进入 Step 2：`band` 行中 A1 列显示 `SSA`，无红色背景
- Sidebar 「冲突待确认」列表中无 band 条目

- [ ] **Step 3: 场景 B — 冲突情况**

配置表中：

| PCBA配置 | 出货市场 |
|---------|---------|
| A1      | SSA     |
| A1      | LATAM   |

操作：上传 → 勾选 A1 → 解析

验证：
- Step 1 中 A1 checkbox 下方显示 `多市场冲突`（amber 色）
- 进入 Step 2：`band` 单元格显示红色背景 + placeholder `⚠️ 频段存在冲突`
- Sidebar 出现「频段存在冲突」冲突条目，点击可滚动定位

- [ ] **Step 4: 场景 C — 没有出货市场列**

配置表中 PCBA配置表 sheet 只有「PCBA配置」列，无「出货市场」列：

操作：上传 → 勾选 A1 → 解析

验证：
- Step 1 中 A1 下方无额外提示文字
- 进入 Step 2：`band` 单元格为空并标红（behavior=auto 空值即冲突）
- 用户可手动填写

---

## 自检：规格覆盖

| 需求点 | 覆盖任务 |
|--------|---------|
| 从配置表读取出货市场列 | Task 4 |
| 主板标识=PCBA配置列对应行 | Task 4（按 headerColIdx 匹配行） |
| 取对应行的出货市场值 | Task 4（marketColIdx 读取） |
| 自动填入 band 字段 | Task 5（startAutoCalc 赋值） |
| 多行数据提示冲突 | Task 4（bandConflict 检测） |
| Step 2 标红 band 单元格 | 现有机制：band='' 即标红（Task 5 保证冲突时 band=''） |
| Sidebar 显示冲突条目 | 现有 step2Conflicts 机制自动覆盖 |
| Step 1 UI 展示 band / 冲突提示 | Task 5 Step 2 |
