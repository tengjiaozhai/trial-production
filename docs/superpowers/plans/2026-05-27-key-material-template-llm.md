# 关键物料选项模板大模型匹配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从“关键物料选项模板/选型模板”Excel第一张sheet中解析 `分类2` 数据，调用大模型为目标物料匹配最相似分类2，并把结果按业务规则自动填入 Step2 对应字段，支持单元格内 1~3 列展示（对应一供/二供/三供）。

**Architecture:** 新增独立解析链路，不复用旧的归一化规则。上传后解析模板首sheet并抽取行数据；用一次批量 LLM 调用返回 `fieldId -> 分类2` 映射；再按字段规则生成显示值与分列选项，写入 `SKUData`。Step2 渲染层从“字段专用 options”改为“通用 fieldOptions 映射”，仅在单元格内部拆列，不改变表头列结构。

**Tech Stack:** TypeScript, React 19, Vite, xlsx, Vitest, 浏览器 `fetch`（OpenAI 兼容 Chat Completions）。

---

## 实现前约束（必须遵守）

- 这是新线，按 0->1 实现，不沿用旧的归一化匹配策略。
- 文件名和首sheet名都必须命中关键字：`关键物料选项模版` / `关键物料选项模板` / `关键物料选型模板`。
- 只解析第一个sheet，其他sheet忽略。
- 目标物料固定为：`电池、喇叭、听筒、MIC、马达、spk FPC、Sidekey FPC、IR FPC、镜片、壳料、电池盖、卡托、侧键、辅料、散热、PCB、小板`。
- `电池-散热` 规则：拼接 `主二供 + 供应商 + 物料描述`，不加分隔符。
- `PCB-小板` 规则：仅取 `品牌`。
- 同一 `分类2` 若有多行，按供方拆分为多个小列展示，最多展示到 `三供`。
- 模型配置直接写入配置文件（按用户要求，不做安全抽象）：
  - `baseUrl=https://newapi.tinno.com`
  - `apiKey=sk-6GkM5jZowDN1Fspqnyavbv5IPDSqIgVnHYIFakm6NbuQdzHT`
  - `model=qwen3.6-plus`
- 失败策略：匹配或取值失败时留空，并保留冲突提示（fail-closed）。

## 代码结构映射

- Create: `src/config/keyMaterialLLM.ts`
- Create: `src/lib/keyMaterialTemplate.ts`
- Create: `src/lib/keyMaterialTemplate.test.ts`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/TrialProductionTable.tsx`

## 类型与接口变更（先锁定）

在 `src/types.ts` 增加通用选项结构，避免每个字段单独加一个 `xxxOptions`：

```ts
export type SplitOptionFieldId =
  | 'lcd' | 'front_cam' | 'main_cam' | 'sub_cam'
  | 'battery' | 'speaker' | 'receiver' | 'mic' | 'motor'
  | 'spk_fpc' | 'sidekey_fpc' | 'ir_fpc' | 'lens' | 'housing'
  | 'battery_cover' | 'sim_tray' | 'side_key' | 'aux_material'
  | 'cooling' | 'pcb' | 'sub_board';

export type SupplyTag = '一供' | '二供' | '三供' | '';

export interface SplitFieldOption {
  supply: SupplyTag;
  text: string;
  sourceCategory2: string;
}

export interface KeyMaterialTemplateMatch {
  sourceFileName: string;
  sourceSheetName: string;
  category2ByField: Partial<Record<SplitOptionFieldId, string>>;
  optionsByField: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>>;
}

export interface ProjectInfo {
  // ...existing fields
  keyMaterialTemplate?: KeyMaterialTemplateMatch;
}

export interface SKUData {
  // ...existing fields
  fieldOptions?: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>>;
}
```

说明：旧的 `lcdOptions/frontCamOptions/mainCamOptions/subCamOptions` 在完成迁移后删除，保留单一权威路径 `fieldOptions`。

### Task 1: 先写失败测试，锁定模板解析行为

**Files:**
- Create: `src/lib/keyMaterialTemplate.test.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: 新建模板解析失败测试（文件名+首sheet命中）**

```ts
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseKeyMaterialTemplate } from './keyMaterialTemplate';

function makeFileFromWorkbook(name: string, wb: XLSX.WorkBook) {
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('parseKeyMaterialTemplate', () => {
  it('returns null when file name does not contain key material keyword', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['分类2']]), '关键物料选项模版');
    const file = makeFileFromWorkbook('普通文件.xlsx', wb);
    const result = await parseKeyMaterialTemplate(file);
    expect(result).toBeNull();
  });

  it('parses first sheet rows with required columns', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['分类1', '分类2', '物料描述', '品牌', '供应商', '主二供'],
      ['结构件', '电池', '5000mAh', 'ATL', 'ATL', '一供'],
      ['结构件', '电池', '5000mAh', 'DESAY', '德赛', '二供'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, '项目(V633A)-关键物料选项模版-天珑2026-05-19');
    const file = makeFileFromWorkbook('项目(V633A)-关键物料选项模版-天珑2026-05-19.xlsx', wb);

    const result = await parseKeyMaterialTemplate(file);
    expect(result).not.toBeNull();
    expect(result!.category2List).toContain('电池');
    expect(result!.rows).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run:
```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/keyMaterialTemplate.test.ts
```
Expected: FAIL，报 `parseKeyMaterialTemplate` 未定义。

- [ ] **Step 3: 补类型定义（最小实现）**

```ts
// src/lib/keyMaterialTemplate.ts
export interface KeyMaterialTemplateRow {
  category2: string;
  description: string;
  brand: string;
  vendor: string;
  supply: string;
}

export interface ParsedKeyMaterialTemplate {
  sourceFileName: string;
  sourceSheetName: string;
  category2List: string[];
  rows: KeyMaterialTemplateRow[];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/keyMaterialTemplate.test.ts src/types.ts
git commit -m "test: add failing tests for key material template parsing"
```

### Task 2: 实现模板解析与 LLM 分类2匹配

**Files:**
- Create: `src/config/keyMaterialLLM.ts`
- Create: `src/lib/keyMaterialTemplate.ts`
- Modify: `src/lib/keyMaterialTemplate.test.ts`

- [ ] **Step 1: 新增 LLM 固定配置文件（按用户要求硬编码）**

```ts
// src/config/keyMaterialLLM.ts
export const KEY_MATERIAL_LLM_CONFIG = {
  baseUrl: 'https://newapi.tinno.com',
  apiKey: 'sk-6GkM5jZowDN1Fspqnyavbv5IPDSqIgVnHYIFakm6NbuQdzHT',
  model: 'qwen3.6-plus',
  endpoint: '/v1/chat/completions',
  timeoutMs: 30000,
} as const;
```

- [ ] **Step 2: 实现首sheet解析函数**

```ts
const KEYWORDS = ['关键物料选项模版', '关键物料选项模板', '关键物料选型模板'];

function hasKeyword(input: string): boolean {
  return KEYWORDS.some((k) => input.includes(k));
}

export async function parseKeyMaterialTemplate(file: File): Promise<ParsedKeyMaterialTemplate | null> {
  if (!hasKeyword(file.name)) return null;

  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const firstSheetName = wb.SheetNames[0] ?? '';
  if (!hasKeyword(firstSheetName)) return null;

  const ws = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  const header = rows[0]?.map((v) => String(v).trim()) ?? [];

  const category2Idx = header.findIndex((h) => h === '分类2');
  const descIdx = header.findIndex((h) => h === '物料描述');
  const brandIdx = header.findIndex((h) => h === '品牌');
  const vendorIdx = header.findIndex((h) => h === '供应商');
  const supplyIdx = header.findIndex((h) => h === '主二供');

  if ([category2Idx, descIdx, brandIdx, vendorIdx, supplyIdx].some((idx) => idx === -1)) return null;

  const parsedRows: KeyMaterialTemplateRow[] = [];
  const set = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const category2 = String(row[category2Idx] ?? '').trim();
    if (!category2) continue;

    parsedRows.push({
      category2,
      description: String(row[descIdx] ?? '').trim(),
      brand: String(row[brandIdx] ?? '').trim(),
      vendor: String(row[vendorIdx] ?? '').trim(),
      supply: String(row[supplyIdx] ?? '').trim(),
    });
    set.add(category2);
  }

  return {
    sourceFileName: file.name,
    sourceSheetName: firstSheetName,
    category2List: Array.from(set),
    rows: parsedRows,
  };
}
```

- [ ] **Step 3: 实现批量匹配函数（OpenAI 兼容）**

```ts
const TARGETS = [
  { fieldId: 'battery', materialName: '电池', mode: 'desc' },
  { fieldId: 'speaker', materialName: '喇叭', mode: 'desc' },
  { fieldId: 'receiver', materialName: '听筒', mode: 'desc' },
  { fieldId: 'mic', materialName: 'MIC', mode: 'desc' },
  { fieldId: 'motor', materialName: '马达', mode: 'desc' },
  { fieldId: 'spk_fpc', materialName: 'spk FPC', mode: 'desc' },
  { fieldId: 'sidekey_fpc', materialName: 'Sidekey FPC', mode: 'desc' },
  { fieldId: 'ir_fpc', materialName: 'IR FPC', mode: 'desc' },
  { fieldId: 'lens', materialName: '镜片', mode: 'desc' },
  { fieldId: 'housing', materialName: '壳料', mode: 'desc' },
  { fieldId: 'battery_cover', materialName: '电池盖', mode: 'desc' },
  { fieldId: 'sim_tray', materialName: '卡托', mode: 'desc' },
  { fieldId: 'side_key', materialName: '侧键', mode: 'desc' },
  { fieldId: 'aux_material', materialName: '辅料', mode: 'desc' },
  { fieldId: 'cooling', materialName: '散热', mode: 'desc' },
  { fieldId: 'pcb', materialName: 'PCB', mode: 'brand' },
  { fieldId: 'sub_board', materialName: '小板', mode: 'brand' },
] as const;

export async function matchCategory2WithLLM(
  category2List: string[]
): Promise<Partial<Record<SplitOptionFieldId, string>>> {
  const prompt = [
    '你是BOM物料匹配助手。',
    '我会给你分类2候选列表与目标物料名。',
    '请为每个目标物料返回最可能同一物料的分类2。',
    '返回必须是JSON对象，key是fieldId，value是候选列表中“完全一致”的分类2字符串或null。',
    '禁止返回候选列表外的值。',
    `候选分类2: ${JSON.stringify(category2List)}`,
    `目标物料: ${JSON.stringify(TARGETS.map((x) => ({ fieldId: x.fieldId, materialName: x.materialName })) )}`,
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KEY_MATERIAL_LLM_CONFIG.timeoutMs);

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
    signal: controller.signal,
  });

  clearTimeout(timer);
  if (!resp.ok) return {};

  const json = await resp.json();
  const text = json?.choices?.[0]?.message?.content ?? '{}';
  const raw = JSON.parse(text) as Record<string, string | null>;

  const allowed = new Set(category2List);
  const out: Partial<Record<SplitOptionFieldId, string>> = {};

  for (const target of TARGETS) {
    const picked = raw[target.fieldId];
    if (typeof picked === 'string' && allowed.has(picked)) {
      out[target.fieldId] = picked;
    }
  }
  return out;
}
```

- [ ] **Step 4: 新增构造展示选项函数（按字段规则）**

```ts
const SUPPLY_ORDER: Record<string, number> = { '一供': 1, '二供': 2, '三供': 3 };

export function buildOptionsByField(
  parsed: ParsedKeyMaterialTemplate,
  category2ByField: Partial<Record<SplitOptionFieldId, string>>
): Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> {
  const output: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> = {};

  for (const t of TARGETS) {
    const category2 = category2ByField[t.fieldId];
    if (!category2) continue;

    const rows = parsed.rows
      .filter((r) => r.category2 === category2)
      .sort((a, b) => (SUPPLY_ORDER[a.supply] ?? 99) - (SUPPLY_ORDER[b.supply] ?? 99))
      .slice(0, 3);

    const options: SplitFieldOption[] = [];

    for (const row of rows) {
      if (t.mode === 'brand') {
        const brand = row.brand.trim();
        if (!brand) continue;
        options.push({ supply: (row.supply as any) ?? '', text: brand, sourceCategory2: category2 });
        continue;
      }

      const supply = row.supply.trim();
      const vendor = row.vendor.trim();
      const desc = row.description.trim();
      if (!supply || !vendor || !desc) continue;
      options.push({ supply: (supply as any) ?? '', text: `${supply}${vendor}${desc}`, sourceCategory2: category2 });
    }

    if (options.length > 0) output[t.fieldId] = options;
  }

  return output;
}

export function serializeSplitOptions(options: SplitFieldOption[]): string {
  return options.map((o) => o.text).join(' / ');
}
```

- [ ] **Step 5: 运行测试并通过**

Run:
```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/keyMaterialTemplate.test.ts
```
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/config/keyMaterialLLM.ts src/lib/keyMaterialTemplate.ts src/lib/keyMaterialTemplate.test.ts
git commit -m "feat: add key material template parser and llm matcher"
```

### Task 3: 接入上传流程与 Step2 自动填充值

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: 在上传流程解析关键物料模板并写入 ProjectInfo**

```ts
const keyMaterialFile = fileList.find((f) =>
  /关键物料选项模版|关键物料选项模板|关键物料选型模板/.test(f.name)
);

if (keyMaterialFile) {
  const parsed = await parseKeyMaterialTemplate(keyMaterialFile);
  if (parsed) {
    const category2ByField = await matchCategory2WithLLM(parsed.category2List);
    const optionsByField = buildOptionsByField(parsed, category2ByField);

    setProjectInfo((prev) => ({
      ...prev,
      keyMaterialTemplate: {
        sourceFileName: parsed.sourceFileName,
        sourceSheetName: parsed.sourceSheetName,
        category2ByField,
        optionsByField,
      },
    }));
  }
}
```

- [ ] **Step 2: 在 `startAutoCalc` 回填对应字段初值**

```ts
const fieldOptions = projectInfo.keyMaterialTemplate?.optionsByField ?? {};

const materialValues = Object.fromEntries(
  Object.entries(fieldOptions).map(([fieldId, options]) => [
    fieldId,
    serializeSplitOptions(options ?? []),
  ])
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
        ...materialValues,
        storage: storageValue,
        band: bandValue,
        lcd: lcdValue,
        front_cam: frontCamValue,
        main_cam: mainCamValue,
        sub_cam: subCamValue,
      },
    },
  ],
};
```

- [ ] **Step 3: 清理旧字段专用 options（单路径收敛）**

删除 `SKUData` 上 `lcdOptions/frontCamOptions/mainCamOptions/subCamOptions` 的读写；统一收敛为 `fieldOptions`。

- [ ] **Step 4: 运行回归检查**

Run:
```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/utils.test.ts src/lib/keyMaterialTemplate.test.ts
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint
```
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/types.ts
git commit -m "feat: wire key material template values into step2"
```

### Task 4: Step2 单元格拆列泛化（支持 1~3 列）

**Files:**
- Modify: `src/components/TrialProductionTable.tsx`

- [ ] **Step 1: 写失败断言（若当前无组件测试，则先定义人工验收点）**

人工验收点：

```md
1. 当 fieldOptions[fieldId] 长度=1 时，单元格内显示 1 列。
2. 长度=2 时显示 2 列。
3. 长度>=3 时显示 3 列（取前三个）。
4. 没有 options 时仍是原 input。
```

- [ ] **Step 2: 把专用映射改为通用映射**

```tsx
const options = sku.fieldOptions?.[field.id as SplitOptionFieldId];

{options && options.length > 0 ? (
  <div
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
        className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-700 text-center"
      >
        {option.text}
      </div>
    ))}
  </div>
) : (
  <input ... />
)}
```

- [ ] **Step 3: 回归现有 LCD/CAM 展示行为**

确保 `lcd/front_cam/main_cam/sub_cam` 在迁移到 `fieldOptions` 后仍按原逻辑展示分列，不新增外层列。

- [ ] **Step 4: Commit**

```bash
git add src/components/TrialProductionTable.tsx
git commit -m "refactor: use generic split options rendering for step2 cells"
```

### Task 5: 端到端验证与交付校验

**Files:**
- 无新增代码文件；执行验证命令与页面检查

- [ ] **Step 1: 执行自动化检查**

Run:
```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/utils.test.ts src/lib/keyMaterialTemplate.test.ts
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint
```
Expected: PASS。

- [ ] **Step 2: 浏览器手工场景验证**

```md
1. 打开 http://localhost:3000/
2. 上传配置相关 xlsx + 关键物料选项模板 xlsx
3. 项目名/模板/试产阶段任意填写，选择主板标识 A1
4. 进入 Step2
5. 核验：
   - 电池~散热字段出现 “主二供+供应商+物料描述” 文本
   - PCB/小板字段只显示品牌值
   - 同一分类2多行时，单元格内按供方拆为 2 或 3 小列
   - 匹配不到的字段留空，仍出现冲突提示
```

- [ ] **Step 3: 输出验证记录（供评审）**

```md
- 测试命令与结果
- 手工验证截图（至少包含一个2列字段、一个3列字段）
- 未命中字段列表（如有）
```

- [ ] **Step 4: Commit（若仅验证则跳过）**

```bash
# 验证步骤无代码改动可不提交
```

## 测试清单（必须覆盖）

- 解析层：文件名/首sheet名关键字命中与拒绝路径。
- 表头层：`分类2/物料描述/品牌/供应商/主二供` 缺任一列时 fail-closed。
- 匹配层：LLM 返回值必须在候选 `分类2` 集合内，越界值丢弃。
- 规则层：`电池~散热` 拼接文本；`PCB/小板` 品牌文本。
- 多供层：同分类2多行时，最多展示 `一供/二供/三供` 三列。
- 冲突层：空值时仍保留 Step2 冲突提示。

## 参考注意点

- 不要把 `fieldOptions` 复制成多个平行结构；只保留一条权威路径。
- 不要把 LLM 匹配结果直接信任入库；先做“是否在分类2候选内”校验。
- 不要为失败场景增加猜测式 fallback（例如改用其他sheet或模糊子串兜底）。
- 不要把“拆分列”误解成新增表格列；这里只是单元格内部网格。
- 对于 `主二供` 值异常（空、非一/二/三供），展示顺序按 `一供>二供>三供>其他`。

## 默认假设与已定策略

- 关键字判断使用 `includes`，不做正则复杂清洗。
- 只处理首sheet，且首sheet必须命中关键字。
- 一次上传只取第一个命中的关键物料模板文件。
- LLM 调用失败或超时时，不中断流程，仅保持字段空值与冲突提示。
- 配置表中的 `A1` 等 PCBA 逻辑保持现有实现，不在本新线中重写。

