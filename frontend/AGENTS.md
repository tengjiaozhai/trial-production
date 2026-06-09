# 试产搭配表自动生成 — AGENTS.md

## Project Overview

- **名称**: 试产搭配表自动生成
- **描述**: 天珑手机试产搭配表自动生成交互工具，支持五步向导、业务规则校验及 Excel 导出
- **技术栈**: React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4 + Qwen LLM
- **部署**: 静态 SPA，托管于 Google AI Studio（`metadata.json` 声明 `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`）

## Commands

| Command | Action | Notes |
|---------|--------|-------|
| `npm run dev` | Start dev server on port 3000 | Accepts `--host=0.0.0.0` |
| `npm run build` | Build to `dist/` + inject build timestamp | No lint needed before build |
| `npm run test` | Run all Vitest tests | `vitest run` (not `vitest` — no watch) |
| `npm run lint` | Type-check only via `tsc --noEmit` | No ESLint, no Prettier |
| `npm run preview` | Vite preview of `dist/` | |
| `npm run clean` | Remove `dist/` and `server.js` | |

Run a single test: `npm run test -- src/lib/utils.test.ts`

## Path Aliases

`@/` maps to project **root**, not `src/`. Example: `import { X } from '@/src/types'`, not `@/types`.

## tsconfig Quirks

- No `strict: true` — type checking is lenient
- `experimentalDecorators: true` + `useDefineForClassFields: false`
- `moduleResolution: "bundler"` — do not add `compilerOptions.paths` entries manually

## Test Quirks

- `vite.config.ts` sets `test.environment: 'node'` (not `jsdom`) — but tests import `@testing-library/react` and `@testing-library/jest-dom`. This works because Vite runs component tests in a simulated DOM via JSDOM even when env is `node`. Verify new DOM-dependent tests pass under current config before changing.
- `vitest.setup.ts` auto-cleans up after each test via `@testing-library/react`'s `cleanup`.

## Architecture

- **Entry**: `src/main.tsx` → `src/App.tsx` (1384 lines, core state + all step logic, no router)

### 五步向导

| Step | Name | Description |
|------|------|-------------|
| 1 | 填写必填项 | 项目信息（名称、客户、阶段）+ 上传 4 类 Excel |
| 2 | 自动获取 | PCBA 选项解析 + LLM 匹配关键物料/核心器件/样机需求 → 冲突检测 |
| 3 | 补充完善 | 按供应键完善 SKU 数据，支持插入/复制/粘贴 |
| 4 | 计算与校验 | 样机数量计算 + 业务规则校验（可点击聚焦到单元格） |
| 5 | 导出预览 | 最终表格预览 + `.xlsx` 导出 |

## Source Layout

```
trial-production/
├── src/
│   ├── main.tsx                          # 应用入口
│   ├── App.tsx                           # 主应用（1384行，所有步进状态和业务逻辑）
│   ├── types.ts                          # TypeScript 类型（186行）
│   ├── constants.ts                      # 常量（119字段定义、模板阶段、校验规则、mock数据）
│   ├── index.css                         # 全局样式（Tailwind + Inter 字体）
│   ├── config/
│   │   └── keyMaterialLLM.ts             # LLM 端点配置（qwen3.7-max @ newapi.tinno.com）
│   ├── components/                       # UI 组件
│   │   ├── StepsIndicator.tsx            # 五步向导指示器
│   │   ├── Sidebar.tsx                   # 侧边栏（校验结果 + 统计 + 导航按钮）
│   │   ├── TrialProductionTable.tsx      # 核心表格（拖拽排序、单元格编辑、冲突展示）
│   │   └── HistoryModal.tsx              # 历史记录弹窗
│   └── lib/                              # 核心业务逻辑（14模块，均有 .test.ts）
│       ├── utils.ts                      # 通用工具（PCBA解析、存储规范化、cn()）
│       ├── keyMaterialTemplate.ts        # 关键物料模板 + LLM 列匹配
│       ├── managedMaterialCore.ts        # 管控物料 + LLM 名称匹配
│       ├── sampleCollectionWorkbook.ts   # 样机收集表 + LLM 行名匹配
│       ├── step2CellConflicts.ts         # PCBA 配置冲突检测
│       ├── step4SampleCalc.ts            # 样机数量计算
│       ├── step4ValidationRules.ts       # 校验规则引擎
│       ├── step4StorageValidationResults.ts # 存储校验结果构建
│       ├── step5TableModel.ts            # 导出表格模型
│       ├── supplyProjection.ts           # 供应数据投影和规范化
│       ├── tableOperations.ts            # 表格操作（复制/粘贴/插入 SKU）
│       ├── tableViewport.ts              # 表格视口处理
│       ├── trialProductionWorkbook.ts    # Excel 工作簿生成（xlsx 库）
│       └── efuseFields.ts                # eFuse 字段配置
├── docs/
│   └── dev-memory/                       # 开发记忆系统
│       ├── patterns.md                   # 编码/架构模式
│       ├── decisions.md                  # 架构决策记录
│       ├── active-problems.md            # 已知活跃问题
│       └── troubleshooting.md            # 故障排查记录
├── AGENTS.md                             # 本文件
├── PROJECT-INDEX.json                    # 项目索引（JSON）
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## Core Modules

| Module | Responsibility | Key Functions |
|--------|---------------|---------------|
| `utils.ts` | PCBA 选项提取与解析、存储值规范化、LCM 选项推断 | `extractPcbaOptions`, `normalizeStorage`, `cn()` |
| `keyMaterialTemplate.ts` | 关键物料 Excel 表头解析 + LLM `category2` → 字段 ID | `parseKeyMaterialTemplate`, `matchCategory2WithLLM` |
| `managedMaterialCore.ts` | 管控物料表器件名提取 + LLM 标准化匹配 | `parseManagedMaterialCoreWorkbook`, `matchManagedMaterialNamesWithLLM` |
| `sampleCollectionWorkbook.ts` | 样机收集表行名 + LLM 匹配 | `parseSampleCollectionWorkbook`, `matchSampleCollectionRowsWithLLM` |
| `step2CellConflicts.ts` | PCBA 配置冲突检测 | `buildStep2CellConflicts` |
| `step4ValidationRules.ts` | 颜色/BOM、存储/组件、标识包含、壳体 MBOM 等校验 | `validateColorAgainstBom`, `validateStorageAgainstComponents` |
| `trialProductionWorkbook.ts` | 最终 Excel 生成 | `buildTrialProductionWorkbook` |

## Key Business Concepts

### 模板阶段

| 模板 | 阶段 |
|------|------|
| 标准 | EVB → EVT → DVT1 → DVT2 → PVT → MP |
| 传音 | T0 → PR0 → PR1 → PR2 → PIR → MP |
| 中兴 | T0 → T1 → T2 → T3 → NPI → MP |

### 字段行为类型
- `auto`: 从文件自动解析填充
- `calc`: 根据其他字段计算
- `manual`: 用户手动输入
- `order_no`: 订单号特殊处理

### 供应标签
一供 / 二供 / 三供 / 四供

### PCBA 配置
从配置表提取主板标识（PCBA），含频段 / EMMC / DDR，支持冲突检测。

### 校验规则
校验规则引擎位于 `step4ValidationRules.ts`，覆盖颜色一致性、存储一致性、标识包含、壳体 MBOM、E-BOM 存储一致性等。

## LLM Integration

- **Not Gemini** — 实际使用 `qwen3.7-max` 通过天珑内部 API 网关（`newapi.tinno.com`）
- **API Key**: 硬编码于 `src/config/keyMaterialLLM.ts`
- **用途**: 关键物料列名分类、核心器件名称匹配、样机收集表行名匹配

## Dev Memory

先查 `docs/dev-memory/`，再改业务逻辑：
- `patterns.md` — 表头解析策略、冲突判定要点
- `decisions.md` — ADR（PCBA 列识别、存储值格式）
- `active-problems.md` — 已知问题（LCD 冲突候选不全、关键物料模板字段空白）
- `troubleshooting.md` — 根因分析与修复模式

## Known Active Problems

1. Step2 冲突快速候选按钮只对 `lcd` 生效 — `band` 和 `storage` 只有占位提示
2. 关键物料模板字段（`battery`, `speaker`, `receiver` 等）在 LLM 超时或部分返回时整批留空 — 无兜底机制

## Key Dependencies

| Library | Purpose |
|---------|---------|
| `@dnd-kit/core/sortable/utilities` | Drag-and-drop table row reordering |
| `xlsx` | Excel file read/write |
| `lucide-react` | Icons |
| `motion` (framer-motion v12) | Animations |
| `@google/genai` | LLM API client |
| `tailwind-merge` + `clsx` | className composition |
| `express` + `dotenv` | Server-side capability (for AI Studio) |

## Style

- `clsx` + `tailwind-merge` with `cn()` utility for className merging (from `src/lib/utils.ts`)
- No component library — all UI is hand-built with Tailwind CSS
- Motion animations use `motion/react` (the `motion` package — framer-motion v12 API)
- Use `lucide-react` icons only
