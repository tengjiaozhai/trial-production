# 管控物料表核心器件自动填充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从上传的“管控物料表”Excel中解析 `CPU / flash EMMC / flash DDR / 电源管理 / 无线发射 / 射频收发器 / NFC` 对应物料，并把结果自动填入 Step2 对应字段，支持同一字段按 `一供/二供/三供` 在单元格内拆列展示。

**Architecture:** 复用现有“管控物料表”上传入口，但新增一条独立的“核心器件解析”链路。上传后先解析首个业务 sheet 的 `物料名称` 候选集，再用一次批量 LLM 调用把目标字段映射到“精确存在于源表”的物料名称；`startAutoCalc` 按当前 `PCBA` 的 `EMMC/DDR` 容量生成最终文案，统一写入 `SKUData.fieldOptions` 与 `sup.values`。

**Tech Stack:** TypeScript, React 19, Vite, xlsx, Vitest, 浏览器 `fetch`（OpenAI 兼容 Chat Completions）。

---

## 先锁定的实现口径

- 真实样例 `../X6728传音管控物料表_V3.5-2025-10-10.xlsx` 的 `SheetNames[0]` 是 `保密级别`，不是业务页；因此本计划不按“workbook 的第一个 tab”取值，而是按“首个业务 sheet”取值。
- 真实样例业务页 `X6728` 的标题行在第 `2` 行，表头在第 `5` 行，必备列是 `物料名称 / 传音编码 / 供应商 / 一/二供`；样例里没有 `分类2` 列，所以本计划以 `物料名称` 为 LLM 候选源。
- `flash EMMC` 和 `flash DDR` 不能写死成 `128G/4G`，必须按当前 `PCBA` 解析到的容量动态匹配；否则多 SKU 时会直接错配。
- 当前仓库已经有 `fieldOptions`、`keyMaterialTemplate`、`src/config/keyMaterialLLM.ts`，但 `App.tsx` 和 `TrialProductionTable.tsx` 还在走旧的 `lcdOptions/frontCamOptions/...` 路径；本计划要求同次改动收敛到 `fieldOptions` 单一路径。
- 当前 `startAutoCalc` 还保留演示 stub：
  - 根据文件名伪造 `cpu`
  - 随机清空 `lcd` 制造冲突
  这两段必须在本功能落地时一起删除。

## 代码结构映射

- Modify: `src/types.ts`
- Reuse: `src/config/keyMaterialLLM.ts`
- Create: `src/lib/managedMaterialCore.ts`
- Create: `src/lib/managedMaterialCore.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TrialProductionTable.tsx`

## 需要新增或收敛的类型

在 `src/types.ts` 把 `SplitOptionFieldId` 扩展到核心器件字段，并新增“管控物料表核心器件匹配结果”类型：

```ts
export type SplitOptionFieldId =
  | 'lcd' | 'front_cam' | 'main_cam' | 'sub_cam'
  | 'cpu' | 'emmc' | 'ddr' | 'pmu' | 'tx' | 'rf_transceiver' | 'nfc'
  | 'battery' | 'speaker' | 'receiver' | 'mic' | 'motor'
  | 'spk_fpc' | 'sidekey_fpc' | 'ir_fpc' | 'lens' | 'housing'
  | 'battery_cover' | 'sim_tray' | 'side_key' | 'aux_material'
  | 'cooling' | 'pcb' | 'sub_board';

export interface ManagedMaterialCoreRow {
  materialName: string;
  code: string;
  vendor: string;
  supply: string;
}

export interface ManagedMaterialCoreMatch {
  sourceFileName: string;
  sourceSheetName: string;
  rows: ManagedMaterialCoreRow[];
  materialNames: string[];
  materialNameByStaticField: Partial<Record<'cpu' | 'pmu' | 'tx' | 'rf_transceiver' | 'nfc', string>>;
  materialNameByEmmcSize: Record<string, string>;
  materialNameByDdrSize: Record<string, string>;
}

export interface ProjectInfo {
  // ...existing fields
  managedMaterialCore?: ManagedMaterialCoreMatch;
}
```

说明：

- `cpu / pmu / tx / rf_transceiver / nfc` 的匹配结果可以在上传时固定。
- `emmc / ddr` 的最终物料名称必须按 `PcbaOption` 容量分开存。
- `SKUData` 继续只保留 `fieldOptions`，不再新增 `cpuOptions`、`emmcOptions` 之类的平行结构。

### Task 1: 先写失败测试，锁定真实业务 sheet 与字段规则

**Files:**
- Create: `src/lib/managedMaterialCore.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: 为“首个业务 sheet 解析”写失败测试**

```ts
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  parseManagedMaterialCoreWorkbook,
  buildManagedMaterialCoreFieldOptions,
} from './managedMaterialCore';

function makeWorkbookFile(name: string, sheets: Array<{ name: string; rows: any[][]; hidden?: 0 | 1 }>) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Sheets: [] as any[] };
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
    wb.Workbook.Sheets.push({ Hidden: sheet.hidden ?? 0 });
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('parseManagedMaterialCoreWorkbook', () => {
  it('picks the first visible business sheet and extracts material rows', async () => {
    const file = makeWorkbookFile('X6728传音管控物料表.xlsx', [
      { name: '保密级别', rows: [[''], ['']], hidden: 0 },
      { name: 'Change List', rows: [[''], ['']], hidden: 0 },
      {
        name: 'X6728',
        hidden: 0,
        rows: [
          [''],
          ['传音管控物料表'],
          ['品牌:', 'Infinix'],
          ['研发填写'],
          ['序号', '物料名称', '传音编码', '物料描述', '供应商型号', '供应商', '用量', '物料颜色', '传音是否已封样', '物料通用性', '平台是否已认证', 'MOQ', 'MPQ', '试产LT', '量产LT', '一/二供'],
          [1, 'CPU', '15600178', 'MTK主芯片', 'MT6769V/CBZA', 'MTK', 1, '/', '是', '标准件', '是', 3000, 3000, 28, 14, '一供'],
          [2, '电源管理', '15700056', '电源管理器', 'MT6358W/AN', 'MTK', 1, '/', '是', '标准件', '是', 3000, 3000, 28, 14, '一供'],
          [3, '128GB EMMC', '14201661', 'EMMC_128G', 'HAC19-1280BSAC', 'HAC19-1280BSAC', 1, '/', '是', '标准件', '是', 3000, 3000, 28, 14, '一供'],
          [4, 'LPD4X 4GB', '14201579', 'LPDDR_4G', 'K4UBE3D4AM_SGCL', 'K4UBE3D4AM_SGCL', 1, '/', '是', '标准件', '是', 3000, 3000, 28, 14, '一供'],
        ],
      },
      { name: 'X6728B', rows: [['hidden']], hidden: 1 },
    ]);

    const result = await parseManagedMaterialCoreWorkbook(file);
    expect(result).not.toBeNull();
    expect(result!.sourceSheetName).toBe('X6728');
    expect(result!.rows.map((row) => row.materialName)).toContain('CPU');
    expect(result!.rows.map((row) => row.materialName)).toContain('128GB EMMC');
  });
});
```

- [ ] **Step 2: 为“核心器件字段规则”写失败测试**

```ts
it('builds cpu/emmc/ddr/pmu/tx/rf/nfc values by rule', () => {
  const match = {
    sourceFileName: 'X6728传音管控物料表.xlsx',
    sourceSheetName: 'X6728',
    rows: [
      { materialName: 'CPU', code: '15600178', vendor: 'MTK', supply: '一供' },
      { materialName: '128GB EMMC', code: '14201661', vendor: 'HAC19-1280BSAC', supply: '一供' },
      { materialName: '128GB EMMC', code: '14201611', vendor: 'FEMDNN128G-A3V01', supply: '二供' },
      { materialName: 'LPD4X 4GB', code: '14201579', vendor: 'K4UBE3D4AM_SGCL', supply: '一供' },
      { materialName: '电源管理', code: '15700056', vendor: 'MTK', supply: '一供' },
      { materialName: 'PA-4G', code: '33600023', vendor: 'FX5627Y', supply: '一供' },
      { materialName: '射频收发器', code: '15700052', vendor: 'MT6177MV/BC', supply: '一供' },
      { materialName: 'NFC', code: '34200031', vendor: 'SL6550A-X6728专用', supply: '一供' },
    ],
    materialNames: ['CPU', '128GB EMMC', 'LPD4X 4GB', '电源管理', 'PA-4G', '射频收发器', 'NFC'],
    materialNameByStaticField: {
      cpu: 'CPU',
      pmu: '电源管理',
      tx: 'PA-4G',
      rf_transceiver: '射频收发器',
      nfc: 'NFC',
    },
    materialNameByEmmcSize: { '128': '128GB EMMC' },
    materialNameByDdrSize: { '4': 'LPD4X 4GB' },
  } as const;

  const result = buildManagedMaterialCoreFieldOptions(match, {
    pcba: 'A1',
    projectName: 'X6728',
    band: 'SSA',
    bandConflict: false,
    emmc: '128GB 一供',
    ddr: '4GB 一供',
  });

  expect(result.cpu?.[0].text).toBe('15600178');
  expect(result.emmc?.map((item) => item.text)).toEqual([
    '14201661一供HAC19-1280BSAC128G',
    '14201611二供FEMDNN128G-A3V01128G',
  ]);
  expect(result.ddr?.[0].text).toBe('14201579一供K4UBE3D4AM_SGCL4G');
  expect(result.pmu?.[0].text).toBe('15700056一供');
  expect(result.tx?.[0].text).toBe('33600023一供');
  expect(result.rf_transceiver?.[0].text).toBe('15700052一供');
  expect(result.nfc?.[0].text).toBe('34200031一供');
});
```

- [ ] **Step 3: 为“EMMC/DDR 按容量动态匹配”写失败测试**

```ts
it('uses pcba sizes instead of hard-coded 128G/4G', () => {
  const match = {
    sourceFileName: 'X.xlsx',
    sourceSheetName: 'X6728',
    rows: [
      { materialName: '256GB EMMC', code: '14209999', vendor: 'BWCTA256', supply: '一供' },
      { materialName: 'LPD4X 6GB', code: '14208888', vendor: 'K4UBE6', supply: '一供' },
    ],
    materialNames: ['256GB EMMC', 'LPD4X 6GB'],
    materialNameByStaticField: {},
    materialNameByEmmcSize: { '256': '256GB EMMC' },
    materialNameByDdrSize: { '6': 'LPD4X 6GB' },
  } as const;

  const result = buildManagedMaterialCoreFieldOptions(match, {
    pcba: 'B1',
    projectName: 'X6728',
    band: 'SSA',
    bandConflict: false,
    emmc: '256GB 一供',
    ddr: '6GB 一供',
  });

  expect(result.emmc?.[0].text).toBe('14209999一供BWCTA256256G');
  expect(result.ddr?.[0].text).toBe('14208888一供K4UBE66G');
});
```

- [ ] **Step 4: 运行测试，确认失败**

Run:
```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/managedMaterialCore.test.ts
```

Expected: FAIL，提示 `parseManagedMaterialCoreWorkbook` 或 `buildManagedMaterialCoreFieldOptions` 未定义。

- [ ] **Step 5: Commit**

```bash
git add src/lib/managedMaterialCore.test.ts src/types.ts
git commit -m "test: add failing tests for managed material core parsing"
```

### Task 2: 实现首个业务 sheet 解析与批量 LLM 匹配

**Files:**
- Create: `src/lib/managedMaterialCore.ts`
- Reuse: `src/config/keyMaterialLLM.ts`
- Modify: `src/lib/managedMaterialCore.test.ts`

- [ ] **Step 1: 在 `src/lib/managedMaterialCore.ts` 新增基础解析类型与 helper**

```ts
import * as XLSX from 'xlsx';
import type { ManagedMaterialCoreMatch, ManagedMaterialCoreRow, PcbaOption, SplitFieldOption, SplitOptionFieldId, SupplyTag } from '../types';
import { KEY_MATERIAL_LLM_CONFIG } from '../config/keyMaterialLLM';

const STATIC_TARGETS = [
  { key: 'cpu', label: 'CPU' },
  { key: 'pmu', label: '电源管理' },
  { key: 'tx', label: '无线发射' },
  { key: 'rf_transceiver', label: '射频收发器' },
  { key: 'nfc', label: 'NFC' },
] as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '');
}

function toSupplyTag(raw: string): SupplyTag {
  return raw === '一供' || raw === '二供' || raw === '三供' ? raw : '';
}

function extractSize(raw: string): string {
  return String(raw ?? '').match(/\d+/)?.[0] ?? '';
}
```

- [ ] **Step 2: 实现“首个业务 sheet 解析”**

```ts
export async function parseManagedMaterialCoreWorkbook(file: File): Promise<{
  sourceFileName: string;
  sourceSheetName: string;
  rows: ManagedMaterialCoreRow[];
  materialNames: string[];
} | null> {
  if (!file.name.includes('管控物料表')) return null;

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  for (const [sheetIdx, sheetName] of wb.SheetNames.entries()) {
    const meta = wb.Workbook?.Sheets?.[sheetIdx];
    if (meta?.Hidden) continue;

    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    const topRows = aoa.slice(0, 10).flat().map((cell) => String(cell ?? '').trim());
    const hasTitle = topRows.some((cell) => cell.includes('管控物料表'));
    if (!hasTitle) continue;

    const headerRowIdx = aoa.findIndex((row) => {
      const normalized = row.map(normalizeHeader);
      return normalized.includes('物料名称') && normalized.some((cell) => /编码/.test(cell)) && normalized.includes('供应商');
    });
    if (headerRowIdx === -1) continue;

    const header = aoa[headerRowIdx].map(normalizeHeader);
    const materialIdx = header.findIndex((cell) => cell === '物料名称');
    const codeIdx = header.findIndex((cell) => /编码/.test(cell));
    const vendorIdx = header.findIndex((cell) => cell === '供应商');
    const supplyIdx = header.findIndex((cell) => cell === '一/二供');
    if ([materialIdx, codeIdx, vendorIdx, supplyIdx].some((idx) => idx === -1)) return null;

    const rows: ManagedMaterialCoreRow[] = [];
    const materialNames = new Set<string>();

    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const materialName = String(row[materialIdx] ?? '').trim();
      if (!materialName) continue;
      const code = String(row[codeIdx] ?? '').trim();
      const vendor = String(row[vendorIdx] ?? '').trim();
      const supply = String(row[supplyIdx] ?? '').trim();
      rows.push({ materialName, code, vendor, supply });
      materialNames.add(materialName);
    }

    return {
      sourceFileName: file.name,
      sourceSheetName: sheetName,
      rows,
      materialNames: Array.from(materialNames),
    };
  }

  return null;
}
```

- [ ] **Step 3: 实现批量 LLM 匹配，静态字段与容量字段一次返回**

```ts
export async function matchManagedMaterialNamesWithLLM(args: {
  materialNames: string[];
  emmcSizes: string[];
  ddrSizes: string[];
}): Promise<Pick<ManagedMaterialCoreMatch, 'materialNameByStaticField' | 'materialNameByEmmcSize' | 'materialNameByDdrSize'>> {
  const targets = [
    ...STATIC_TARGETS.map((item) => ({ key: item.key, label: item.label })),
    ...args.emmcSizes.map((size) => ({ key: `emmc_${size}`, label: `flash EMMC ${size}G` })),
    ...args.ddrSizes.map((size) => ({ key: `ddr_${size}`, label: `flash DDR ${size}G` })),
  ];

  const prompt = [
    '你是手机BOM物料匹配助手。',
    '我会给你一组目标字段和一组源表中的物料名称候选。',
    '请为每个目标字段返回一个“完全等于候选列表中某项”的物料名称，或者返回 null。',
    '禁止输出候选列表外的值。',
    `候选物料名称: ${JSON.stringify(args.materialNames)}`,
    `目标字段: ${JSON.stringify(targets)}`,
    '只返回 JSON 对象，例如：{"cpu":"CPU","emmc_128":"128GB EMMC","ddr_4":"LPD4X 4GB"}',
  ].join('\n');

  const resp = await fetch(`${KEY_MATERIAL_LLM_CONFIG.baseUrl}${KEY_MATERIAL_LLM_CONFIG.endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY_MATERIAL_LLM_CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: KEY_MATERIAL_LLM_CONFIG.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    return { materialNameByStaticField: {}, materialNameByEmmcSize: {}, materialNameByDdrSize: {} };
  }

  const json = await resp.json();
  const raw = JSON.parse(json?.choices?.[0]?.message?.content ?? '{}') as Record<string, string | null>;
  const allowed = new Set(args.materialNames);

  const materialNameByStaticField: Record<string, string> = {};
  const materialNameByEmmcSize: Record<string, string> = {};
  const materialNameByDdrSize: Record<string, string> = {};

  for (const item of STATIC_TARGETS) {
    const value = raw[item.key];
    if (typeof value === 'string' && allowed.has(value)) materialNameByStaticField[item.key] = value;
  }
  for (const size of args.emmcSizes) {
    const value = raw[`emmc_${size}`];
    if (typeof value === 'string' && allowed.has(value)) materialNameByEmmcSize[size] = value;
  }
  for (const size of args.ddrSizes) {
    const value = raw[`ddr_${size}`];
    if (typeof value === 'string' && allowed.has(value)) materialNameByDdrSize[size] = value;
  }

  return { materialNameByStaticField, materialNameByEmmcSize, materialNameByDdrSize };
}
```

- [ ] **Step 4: 实现按 PCBA 生成字段选项**

```ts
export function buildManagedMaterialCoreFieldOptions(
  match: ManagedMaterialCoreMatch,
  pcbaOption?: PcbaOption
): Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> {
  if (!pcbaOption) return {};

  const emmcSize = extractSize(pcbaOption.emmc);
  const ddrSize = extractSize(pcbaOption.ddr);
  const sortWeight: Record<string, number> = { '一供': 1, '二供': 2, '三供': 3 };

  const buildRows = (materialName: string | undefined, formatter: (row: ManagedMaterialCoreRow) => string) => {
    if (!materialName) return [];
    return match.rows
      .filter((row) => row.materialName === materialName)
      .sort((a, b) => (sortWeight[a.supply] ?? 99) - (sortWeight[b.supply] ?? 99))
      .slice(0, 3)
      .map((row) => ({
        supply: toSupplyTag(row.supply),
        text: formatter(row),
        sourceCategory2: materialName,
      }))
      .filter((row) => row.text.trim() !== '');
  };

  return {
    cpu: buildRows(match.materialNameByStaticField.cpu, (row) => row.code),
    emmc: buildRows(match.materialNameByEmmcSize[emmcSize], (row) => `${row.code}${row.supply}${row.vendor}${emmcSize}G`),
    ddr: buildRows(match.materialNameByDdrSize[ddrSize], (row) => `${row.code}${row.supply}${row.vendor}${ddrSize}G`),
    pmu: buildRows(match.materialNameByStaticField.pmu, (row) => `${row.code}${row.supply}`),
    tx: buildRows(match.materialNameByStaticField.tx, (row) => `${row.code}${row.supply}`),
    rf_transceiver: buildRows(match.materialNameByStaticField.rf_transceiver, (row) => `${row.code}${row.supply}`),
    nfc: buildRows(match.materialNameByStaticField.nfc, (row) => `${row.code}${row.supply}`),
  };
}

export function serializeSplitFieldOptions(options: SplitFieldOption[]): string {
  return options.map((item) => item.text).join(' / ');
}
```

- [ ] **Step 5: 运行测试并通过**

Run:
```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/managedMaterialCore.test.ts
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/lib/managedMaterialCore.ts src/lib/managedMaterialCore.test.ts
git commit -m "feat: add managed material core parser and matcher"
```

### Task 3: 接入上传链路与 Step2 自动填充

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: 在 `handleFileUpload` 里按现有配置表结果准备容量目标**

```ts
const configFiles = fileList.filter((f: File) => f.name.includes('配置'));
let parsedPcbaOptions: PcbaOption[] = [];

for (const configFile of configFiles) {
  const options = await extractPcbaOptions(configFile as File);
  if (options.length > 0) {
    parsedPcbaOptions = options;
    setProjectInfo(prev => ({
      ...prev,
      pcbaOptions: options,
      checkedPcbaOptions: prev.checkedPcbaOptions && prev.checkedPcbaOptions.length > 0
        ? prev.checkedPcbaOptions
        : [],
    }));
    break;
  }
}

const emmcSizes = Array.from(new Set(parsedPcbaOptions.map((item) => item.emmc.match(/\d+/)?.[0] || '').filter(Boolean)));
const ddrSizes = Array.from(new Set(parsedPcbaOptions.map((item) => item.ddr.match(/\d+/)?.[0] || '').filter(Boolean)));
```

- [ ] **Step 2: 在物料表上传时解析 `managedMaterialCore`**

```ts
const materialFiles = fileList.filter((f: File) => f.name.includes('管控物料表'));
for (const materialFile of materialFiles) {
  const parsed = await parseManagedMaterialCoreWorkbook(materialFile as File);
  if (!parsed) continue;

  const coreMatch = await matchManagedMaterialNamesWithLLM({
    materialNames: parsed.materialNames,
    emmcSizes,
    ddrSizes,
  });

  setProjectInfo(prev => ({
    ...prev,
    managedMaterialCore: {
      sourceFileName: parsed.sourceFileName,
      sourceSheetName: parsed.sourceSheetName,
      rows: parsed.rows,
      materialNames: parsed.materialNames,
      materialNameByStaticField: coreMatch.materialNameByStaticField,
      materialNameByEmmcSize: coreMatch.materialNameByEmmcSize,
      materialNameByDdrSize: coreMatch.materialNameByDdrSize,
    },
  }));
  break;
}
```

- [ ] **Step 3: 如果配置表晚于物料表上传，补跑一次容量映射**

```ts
if (parsedPcbaOptions.length > 0 && projectInfo.managedMaterialCore) {
  const refresh = await matchManagedMaterialNamesWithLLM({
    materialNames: projectInfo.managedMaterialCore.materialNames,
    emmcSizes,
    ddrSizes,
  });

  setProjectInfo(prev => ({
    ...prev,
    managedMaterialCore: prev.managedMaterialCore ? {
      ...prev.managedMaterialCore,
      materialNameByStaticField: {
        ...prev.managedMaterialCore.materialNameByStaticField,
        ...refresh.materialNameByStaticField,
      },
      materialNameByEmmcSize: refresh.materialNameByEmmcSize,
      materialNameByDdrSize: refresh.materialNameByDdrSize,
    } : prev.managedMaterialCore,
  }));
}
```

- [ ] **Step 4: 在 `startAutoCalc` 把核心器件字段并入 `fieldOptions` 和 `sup.values`**

```ts
const lcdOptions = resolveLcdOptionsForProject(opt?.projectName || '', projectInfo.materialWorkbook);
const frontCamOptions = resolveFrontCamOptionsForProject(opt?.projectName || '', projectInfo.materialWorkbook);
const mainCamOptions = resolveMainCamOptionsForProject(opt?.projectName || '', projectInfo.materialWorkbook);
const subCamOptions = resolveSubCamOptionsForProject(opt?.projectName || '', projectInfo.materialWorkbook);

const coreFieldOptions = projectInfo.managedMaterialCore
  ? buildManagedMaterialCoreFieldOptions(projectInfo.managedMaterialCore, opt)
  : {};

const fieldOptions = {
  lcd: lcdOptions.map((item) => ({ supply: item.supply, text: item.text, sourceCategory2: 'LCD' })),
  front_cam: frontCamOptions.map((item) => ({ supply: item.supply, text: item.text, sourceCategory2: 'FRONT_CAM' })),
  main_cam: mainCamOptions.map((item) => ({ supply: item.supply, text: item.text, sourceCategory2: 'MAIN_CAM' })),
  sub_cam: subCamOptions.map((item) => ({ supply: item.supply, text: item.text, sourceCategory2: 'SUB_CAM' })),
  ...coreFieldOptions,
};

const initialValues = Object.fromEntries(
  Object.entries(fieldOptions).map(([fieldId, options]) => [fieldId, serializeSplitFieldOptions(options ?? [])])
);

return {
  id: `sku_${Date.now()}_${idx}`,
  stage: projectInfo.stage,
  orderNo: '',
  project: pcbaId,
  fieldOptions,
  supplies: [
    {
      id: `s_${Date.now()}_${idx}_1`,
      label: '主供',
      values: {
        ...initialValues,
        storage: storageValue,
        band: bandValue,
      },
    },
  ],
};
```

- [ ] **Step 5: 删除演示 stub，避免真实数据被覆盖**

从 `src/App.tsx` 删除这两段：

```ts
projectInfo.files.forEach(f => {
  if (f.name.toLowerCase().includes('ccl')) {
    newValues['cpu'] = f.name.includes('MTK') ? 'MT6761' : 'T606';
  }
});

if (Math.random() > 0.3) {
   newValues['lcd'] = '';
}
```

- [ ] **Step 6: 删除文件时同步清空 `managedMaterialCore`**

```ts
if (deletedFile?.type === '物料表' && !hasRemainingMaterial) {
  next = { ...next, materialWorkbook: undefined, managedMaterialCore: undefined };
}
```

- [ ] **Step 7: 运行回归检查**

Run:
```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/utils.test.ts src/lib/managedMaterialCore.test.ts
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint
```

Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/types.ts
git commit -m "feat: wire managed material core values into step2"
```

### Task 4: 把 Step2 渲染正式收敛到 `fieldOptions`

**Files:**
- Modify: `src/components/TrialProductionTable.tsx`

- [ ] **Step 1: 把旧的 `camOptionsMap` 改成通用读取**

```tsx
const options = sku.fieldOptions?.[field.id as SplitOptionFieldId];

return options && options.length > 0 ? (
  <div
    style={{ minHeight: rowHeight ? rowHeight - 20 : 34 }}
    className={cn(
      'grid gap-1.5 w-full p-1',
      options.length === 1 && 'grid-cols-1',
      options.length === 2 && 'grid-cols-2',
      options.length >= 3 && 'grid-cols-3'
    )}
  >
    {options.slice(0, 3).map((option) => (
      <div
        key={`${field.id}-${option.supply}-${option.text}`}
        className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-700 text-center leading-snug"
      >
        {option.text}
      </div>
    ))}
  </div>
) : null;
```

- [ ] **Step 2: 删除 `sku.lcdOptions/frontCamOptions/mainCamOptions/subCamOptions` 旧引用**

删除：

```tsx
const camOptionsMap: Record<string, any[] | undefined> = {
  lcd: sku.lcdOptions,
  front_cam: sku.frontCamOptions,
  main_cam: sku.mainCamOptions,
  sub_cam: sku.subCamOptions,
};
```

- [ ] **Step 3: 人工验收点**

```md
1. CPU 只显示编码，如 `15600178`
2. EMMC / DDR 按一供二供拆成 2~3 个小列
3. 电源管理 / 无线发射 / 射频收发器 / NFC 按编码+供方展示
4. LCD / CAM 的拆列行为不回退
5. 外层表格列数不变，只是单元格内部拆列
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TrialProductionTable.tsx
git commit -m "refactor: render step2 split cells from fieldOptions"
```

### Task 5: 端到端验证

**Files:**
- 无新增代码文件

- [ ] **Step 1: 自动化检查**

Run:
```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/utils.test.ts src/lib/managedMaterialCore.test.ts
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint
```

Expected: PASS。

- [ ] **Step 2: 浏览器手工验证**

```md
1. 打开 http://localhost:3000/
2. 上传配置表 + 管控物料表 + 其他现有必需文件
3. 任意填写项目名/模板/试产阶段，勾选 `A1`
4. 进入 Step2
5. 验收：
   - `CPU` 自动填入单值编码
   - `flash EMMC` 显示类似 `14201661一供HAC19-1280BSAC128G`
   - `flash DDR` 显示类似 `14201579一供K4UBE3D4AM_SGCL4G`
   - `电源管理` 显示类似 `15700056一供`
   - `无线发射` 命中 `PA-4G` 或模型返回的等价物料名称后，显示编码+供方
   - `射频收发器` / `NFC` 正常填入
   - 匹配不到时留空，并继续显示 Step2 冲突
```

- [ ] **Step 3: 验证多 SKU 容量差异**

```md
1. 如果配置表里存在 `256GB` 或 `6GB` 的 PCBA
2. 选中对应 PCBA 后重新进入 Step2
3. 验证 `EMMC/DDR` 文案跟随容量变化，不再固定为 `128G/4G`
```

- [ ] **Step 4: 验证记录**

```md
- 测试命令及结果
- Step2 截图：至少一张包含 3 列拆分
- 未命中字段及其实际候选物料名称
```

## 关键实现注意点

- `分类2` 是需求口径里的词，但真实样例没有该列；本实现必须以 `物料名称` 为唯一候选源，不要同时维护两套解析。
- `无线发射` 在真实样例里大概率会被模型映射到 `PA-4G`，不是 `无线收发器`；不要手写规则强行覆盖模型结果，先做“是否存在于候选集”校验。
- `EMMC/DDR` 的容量后缀来自 `PcbaOption`，不是来自上传顺序，也不是固定常量。
- 四供及以上不展示，统一 `slice(0, 3)`；若未来产品明确要展示四供，再单开需求。
- 当前 `src/config/keyMaterialLLM.ts` 已经存在，本功能复用这个配置文件，不再新增第二份模型配置。

## 默认假设

- 需求中的“电池管理”按现有字段解释为 `电源管理`，落到 `pmu`。
- 只处理文件名包含 `管控物料表` 的 workbook。
- 只处理首个可解析业务 sheet，不尝试从第二个业务 sheet 补救。
- LLM 返回值必须精确等于候选 `物料名称` 之一；越界值直接丢弃。
- 本计划基于当前仓库真实状态编写，不假设上一个“关键物料模板”计划已经实现。
