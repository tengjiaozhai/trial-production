# Electron + Univer 桌面端迁移实现计划

> **对智能体工作者的要求：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现本计划。步骤使用复选框（`- [ ]`）语法进行追踪。

**目标：** 将当前的试产搭配表 React/Vite 应用转换为单一权威的 electron-egg 桌面应用，并用 Univer Sheets 工作区替换自定义表格。

**架构：** Electron 桌面运行时成为唯一的规范运行时。React 应用移到 `frontend/` 下；Electron/electron-egg 负责应用启动和打包。Univer 仅作为表格交互层；现有业务状态和 Excel 导出保持权威性。

**技术栈：** React 19、TypeScript 5.8、Vite 6、Tailwind CSS 4、electron-egg、ee-core、ee-bin、Electron、electron-builder、Univer Sheets、Vitest、xlsx。

---

## 阶段门控

| 阶段 | 独立负责人 | 依赖阶段 | 验收条件 |
|---|---|---|---|
| Phase 0：基线确认与安全 | 仓库维护者 | 无 | 当前测试/lint 行为已记录；用户改动不受影响 |
| Phase 1：Electron 壳 | 桌面端负责人 | Phase 0 | Electron 开发窗口加载未改动的应用 |
| Phase 2：打包 | 桌面端负责人 | Phase 1 | macOS `.dmg` 本地可构建；Windows `.exe` 在 Windows/CI 构建 |
| Phase 3：Univer 基础 | Sheet 负责人 | Phase 0 | 已本地化的 Univer sheet 在应用壳中渲染 |
| Phase 4：Sheet 模型适配器 | Sheet 负责人 | Phase 3 | 快照 + 业务映射测试通过 |
| Phase 5：交互集成 | 应用负责人 | Phase 4 | Step 2-5 工作流通过 Univer 运行 |
| Phase 6：旧代码清理 | 应用负责人 | Phase 5 | 旧表格路径已删除；无重复的运行时/表格路径 |
| Phase 7：端到端发布验证 | QA 负责人 | Phase 6 | 完整 test/lint/dev/build/package 验收通过 |

并行规则：

- Phase 1 和 Phase 3 在 Phase 0 之后可以同时开始，只要它们不编辑相同文件。
- Phase 4 可以在 Phase 3 定义 Univer 依赖形态后，纯库测试先行推进。
- Phase 5 必须等待 Phase 4。
- Phase 6 必须等待 Phase 5。
- Phase 7 必须等待 Phase 6。

## 文件职责映射

### 桌面端运行时

- 创建 `electron/main.js`：electron-egg 应用引导。
- 创建 `electron/config/config.default.js`：BrowserWindow、mainServer、日志和安全默认配置。
- 创建 `electron/config/config.prod.js`：生产环境覆盖配置。
- 创建 `electron/preload/index.js`：preload 注册。
- 创建 `electron/preload/bridge.js`：contextBridge API 暴露面。
- 创建 `electron/preload/lifecycle.js`：生命周期类，包含 `ready`、`electronAppReady`、`windowReady` 和 `beforeClose` 方法；方法可以是空操作（仅记录日志）。
- 创建 `cmd/bin.js`：ee-bin dev/build/move/package 命令。
- 创建 `cmd/builder.json`：Windows NSIS 构建器配置。
- 创建 `cmd/builder-mac.json`：macOS dmg 构建器配置。
- 创建 `build/icons/*`：构建器配置所需的图标资源。
- 创建 `build/extraResources/read.txt`：最小额外资源目录，使构建器配置可解析。
- 修改根 `package.json`：桌面端脚本和 Electron 依赖。
- 修改根 `package-lock.json`：依赖锁更新。

### 前端运行时

- 将当前前端文件移到 `frontend/`。
- 修改 `frontend/package.json`：前端 dev/build/test/lint 脚本。
- 修改 `frontend/vite.config.ts`：`base: './'`、现有别名行为和测试设置路径。
- 修改 `frontend/index.html`：相对路径的生产加载。
- 仅在移动导致引入路径损坏时修改引入路径。

### Univer Sheet

- 创建 `frontend/src/components/TrialProductionSheet.tsx`：Univer 驱动的替换组件。
- 创建 `frontend/src/components/TrialProductionSheet.test.tsx`：组件集成测试。
- 创建 `frontend/src/lib/univerTrialProductionSheet.ts`：业务状态到 Univer 快照的适配器及业务单元格映射。
- 创建 `frontend/src/lib/univerTrialProductionSheet.test.ts`：纯适配器测试。
- 创建 `frontend/src/lib/univerSheetEvents.ts`：编辑事件规范化和反向映射。
- 创建 `frontend/src/lib/univerSheetEvents.test.ts`：事件映射测试。
- 修改 `frontend/src/App.tsx`：将 `TrialProductionTable` 替换为 `TrialProductionSheet`。
- 修改 `frontend/src/components/Sidebar.tsx`：对于 Univer 驱动的步骤，通过 sheet 聚焦处理器路由聚焦，而不是 DOM 单元格查询。

### 清理

- 替换后删除 `frontend/src/components/TrialProductionTable.tsx`。
- 删除或重写 `frontend/src/components/TrialProductionTable.test.tsx`。
- 在 `TrialProductionSheet` 接管 sheet 尺寸和滚动后，删除 `frontend/src/lib/tableViewport.ts` 和 `frontend/src/lib/tableViewport.test.ts`。
- 保留 `frontend/src/lib/tableOperations.ts`；它仍然是复制/粘贴/插入 SKU 行为的业务权威。
- 保留 `frontend/src/lib/step5TableModel.ts` 和 `frontend/src/lib/trialProductionWorkbook.ts`；它们仍然是导出的权威。

## Phase 0：基线确认与安全

### Task 0.1：捕获当前仓库状态

**文件：**

- 只读：仓库状态和现有文档。

- [x] 运行：

```bash
git status --short 2>&1 | head -c 4000
```

预期输出：

```text
显示已存在的用户改动，包括 PROJECT-INDEX.json、PROJECT-INDEX.md 和 AGENTS.md（如果仍在）。
```

- [x] 在任务笔记中记录：这些用户改动不能被还原或暂存，除非明确要求。

验收：

- 实施者能在触及文件前识别出哪些改动是用户所有的。
- 此任务不修改任何仓库追踪的文件。

### Task 0.2：捕获基线验证

**文件：**

- 只读，除非后续需要安装依赖锁文件。

- [x] 运行：

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 12000
```

- [x] 运行：

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
```

验收：

- 迁移前已记录基线通过/失败状态。
- 后续失败可与已有失败区分开来。

## Phase 1：Electron-Egg 运行时壳

### Task 1.1：将前端移到 `frontend/`

**文件：**

- 将当前前端文件移到 `frontend/`。
- 根包保留给 Electron。

步骤：

- [x] 将当前 React/Vite 源文件移到 `frontend/`，同时保持相对结构。
- [x] 确保 `frontend/src/main.tsx` 仍然引入 `./App.tsx` 和 `./index.css`。
- [x] 确保 `frontend/vite.config.ts` 保持别名 `@` 映射到前端项目根目录。
- [x] 将 Vite 生产 base 设置为 `./`。

验收：

- 从 `frontend/` 运行成功：

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build 2>&1 | head -c 12000
```

- 没有引入路径使用过期的根目录位置。
- 旧的根 Vite 入口不作为第二运行时保留。

### Task 1.2：添加 Electron-Egg 主进程

**文件：**

- 创建 `electron/main.js`
- 创建 `electron/config/config.default.js`
- 创建 `electron/config/config.prod.js`
- 创建 `electron/preload/index.js`
- 创建 `electron/preload/bridge.js`
- 创建 `electron/preload/lifecycle.js`

所需行为：

- 通过 `const { ElectronEgg } = require('ee-core')` 引导。
- 仅按需注册生命周期/preload。
- 配置 BrowserWindow 为 `contextIsolation: true` 和 `nodeIntegration: false`。
- 生产环境主服务器加载 `/public/dist/index.html`。

验收：

- Electron 启动时不要求渲染器访问 Node 全局变量。
- Preload 桥接仅暴露显式 API。
- 配置遵循 `tn-viewer` 的风格，但不复制不安全的 `contextIsolation: false` 或 `nodeIntegration: true`。

### Task 1.3：添加 EE-Bin 命令

**文件：**

- 创建 `cmd/bin.js`
- 修改根 `package.json`
- 修改根 `package-lock.json`

所需的根脚本：

```json
{
  "dev": "ee-bin dev",
  "build": "npm run build-frontend && npm run build-electron",
  "start": "ee-bin start",
  "dev-frontend": "ee-bin dev --serve=frontend",
  "dev-electron": "ee-bin dev --serve=electron",
  "build-frontend": "ee-bin build --cmds=frontend && ee-bin move --flag=frontend_dist",
  "build-electron": "ee-bin build --cmds=electron",
  "build-w": "ee-bin build --cmds=win64",
  "build-m": "ee-bin build --cmds=mac"
}
```

验收：

- `npm run dev` 启动 Electron 桌面端流程。
- `npm run build` 将前端输出写入 `public/dist`，Electron 输出写入 `public/electron`。
- 没有根 `vite` 脚本作为规范的应用程序启动路径保留。

## Phase 2：打包

### Task 2.1：添加构建器配置和所需资源

**文件：**

- 创建 `cmd/builder.json`
- 创建 `cmd/builder-mac.json`
- 创建 `build/icons/icon.ico`
- 创建 `build/icons/icon.icns`
- 创建 `build/icons/icon.png`
- 创建 `build/extraResources/read.txt`

所需配置：

- Windows 目标：NSIS `.exe`。
- macOS 目标：`.dmg`。
- `asar: true`。
- 打包的应用中排除仅开发用的目录。
- 产物名称包含产品名、操作系统、版本和架构。

验收：

- 构建器配置可解析所有引用的图标/资源路径。
- macOS 配置不需要签名凭证。
- Windows 配置适用于 Windows/CI，而非当前仅 Mac 的验证环境。

### Task 2.2：验证打包命令

**文件：**

- Task 2.1 之后不应有源文件编辑。

命令：

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build 2>&1 | head -c 12000
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build-m 2>&1 | head -c 12000
```

Windows 或 CI 命令：

```bash
npm run build-w
```

验收：

- 本地 macOS 生成 `.dmg`。
- Windows/CI 生成 NSIS `.exe`。
- 如果在 macOS 上未构建 `.exe`，这不视为本地失败，因为 Windows/CI 是认可路径。

## Phase 3：Univer 基础

### Task 3.1：添加 Univer 依赖和样式

**文件：**

- 修改 `frontend/package.json`
- 修改 `frontend/package-lock.json`
- 根据 Univer 包指南，修改 `frontend/src/main.tsx` 或 `frontend/src/index.css` 以添加所需的 Univer CSS 引入。

依赖项：

- `@univerjs/presets`
- `@univerjs/preset-sheets-core`
- `@univerjs/core`
- 所选 Univer preset 所需的任何 peer 依赖，包括 `rxjs`（如果未通过传递依赖引入）。

验收：

- `cd frontend && npm run lint` 通过或仅暴露可在本阶段修复的可操作 Univer 类型问题。
- Univer 中文区域包通过已安装的包路径引入，而非手动复制。

### Task 3.2：创建最小化本地化 Univer 组件

**文件：**

- 创建 `frontend/src/components/TrialProductionSheet.tsx`
- 创建 `frontend/src/components/TrialProductionSheet.test.tsx`

所需行为：

- 组件在可行时接受当前 `TrialProductionTable` 的属性接口。
- 组件以简体中文区域设置初始化 Univer。
- 组件渲染最小化的 workbook，暂时不连接业务编辑。

验收：

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
```

- 测试验证组件渲染了 sheet 宿主。
- 手动开发检查确认 Univer UI 标签为中文。

## Phase 4：Sheet 模型适配器

### Task 4.1：构建业务到 Sheet 的适配器

**文件：**

- 创建 `frontend/src/lib/univerTrialProductionSheet.ts`
- 创建 `frontend/src/lib/univerTrialProductionSheet.test.ts`

所需导出：

```ts
export interface TrialProductionCellKey {
  skuId: string;
  supplyId?: string;
  fieldId: string;
  scope: 'sku' | 'supply' | 'field';
}

export interface TrialProductionSheetModel {
  workbookSnapshot: unknown;
  cellMap: Record<string, TrialProductionCellKey>;
}
```

所需行为：

- 使用与旧表格相同的步骤字段过滤器，为每个当前步骤生成可见行。
- 从可见的 `skuData` 和供应生成列。
- 通过 `buildStep5TableModel()` 保留 Step 5 的合并/跨列语义。
- 将 Step 5 单元格标记为只读。
- 为 Step 2 冲突单元格添加样式。

验收：

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/univerTrialProductionSheet.test.ts 2>&1 | head -c 12000
```

测试用例必须覆盖：

- Step 2 冲突单元格具有映射的业务键和冲突样式。
- Step 3 自定义行在其分组可见时保持可见。
- Step 4 可校验定位的单元格存在于 `cellMap` 中。
- Step 5 使用 `buildStep5TableModel()` 并将预览单元格标记为只读。

### Task 4.2：构建编辑事件反向映射器

**文件：**

- 创建 `frontend/src/lib/univerSheetEvents.ts`
- 创建 `frontend/src/lib/univerSheetEvents.test.ts`

所需导出：

```ts
export interface TrialProductionSheetEdit {
  key: TrialProductionCellKey;
  value: string;
}

export function mapUniverEditToBusinessEdit(input: {
  row: number;
  column: number;
  value: unknown;
  cellMap: Record<string, TrialProductionCellKey>;
}): TrialProductionSheetEdit | null;
```

所需行为：

- 对未映射的单元格返回 `null`。
- 将编辑后的值规范化为字符串。
- 保留 `sku` 作用域与 `supply` 作用域的信息。

验收：

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/univerSheetEvents.test.ts 2>&1 | head -c 12000
```

## Phase 5：应用集成

### Task 5.1：在应用中替换表格组件

**文件：**

- 修改 `frontend/src/App.tsx`
- 修改 `frontend/src/components/TrialProductionSheet.tsx`
- 修改 `frontend/src/components/Sidebar.tsx`

所需行为：

- `App.tsx` 在 Step 2 及之后渲染 `TrialProductionSheet`。
- 现有的 Step 1 保持不变。
- 单元格编辑调用现有的 `handleUpdateValue`。
- SKU 作用域的编辑按当前行为要求更新所有相关供应。
- 对于 Univer 驱动的步骤，侧边栏聚焦调用 `focusCellByBusinessKey` 路径，而非直接 DOM 单元格查找。

验收：

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/Sidebar.test.tsx src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
```

手动验收：

- Step 2 冲突卡片聚焦到 sheet 单元格。
- Step 4 校验卡片聚焦到目标字段单元格。
- 编辑普通供应作用域的单元格改变 `skuData`。

### Task 5.2：重新连接 Step 2 候选面板

**文件：**

- 修改 `frontend/src/components/TrialProductionSheet.tsx`
- 修改 `frontend/src/components/TrialProductionSheet.test.tsx`

所需行为：

- 选中冲突单元格时打开候选面板。
- 候选点击调用与编辑相同的业务更新回调。
- SKU 作用域的冲突候选应用到所有相关供应。

验收：

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
```

手动验收：

- 候选面板显示字段标签、PCBA、供应标签或"整列"以及候选按钮。
- 选择候选值后，状态重新计算后冲突样式消失。

### Task 5.3：保留 Step 3 结构性操作

**文件：**

- 修改 `frontend/src/components/TrialProductionSheet.tsx`
- 保留 `frontend/src/lib/tableOperations.ts`
- 保留 `frontend/src/lib/tableOperations.test.ts`

所需行为：

- 添加供应、插入 SKU、复制选中 SKU、粘贴到新 SKU、插入行和删除行保持为应用级操作。
- Univer 原生行列插入/删除菜单不成为业务结构的入口点。

验收：

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/tableOperations.test.ts src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
```

手动验收：

- 用户可以复制选中的 SKU 并粘贴到新 SKU。
- 用户不能使用 Univer 原生菜单创建在 `skuData` 中没有表示的列。

### Task 5.4：保留 Step 5 预览和导出布局

**文件：**

- 修改 `frontend/src/components/TrialProductionSheet.tsx`
- 保留 `frontend/src/lib/step5TableModel.ts`
- 保留 `frontend/src/lib/trialProductionWorkbook.ts`

所需行为：

- Step 5 为只读。
- Step 5 预览从 `buildStep5TableModel()` 生成。
- 行高和列宽变化在可用时更新 `Step5LayoutSnapshot`。
- Excel 导出仍然调用 `buildTrialProductionWorkbook()`。

验收：

```bash
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test -- src/lib/step5TableModel.test.ts src/lib/trialProductionWorkbook.test.ts src/components/TrialProductionSheet.test.tsx 2>&1 | head -c 12000
```

手动验收：

- Step 5 sheet 不可编辑。
- 导出的 workbook 仍然包含预期的 `搭配表` sheet。

## Phase 6：旧代码清理与规范化

### Task 6.1：移除旧表格路径

**文件：**

- 删除 `frontend/src/components/TrialProductionTable.tsx`
- 删除或替换 `frontend/src/components/TrialProductionTable.test.tsx`
- 删除 `frontend/src/lib/tableViewport.ts`
- 删除 `frontend/src/lib/tableViewport.test.ts`
- 修改任何过期的引入路径。

验收：

```bash
cd frontend && rg -n "TrialProductionTable|tableViewport|data-step4-cell-id|data-step2-cell-id" src 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 12000
cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
```

预期结果：

- 没有生产引入引用 `TrialProductionTable`。
- 没有生产代码依赖旧的 DOM 定位属性进行 sheet 聚焦。
- 测试和类型检查通过。

### Task 6.2：更新项目文档和索引

**文件：**

- 如果 `AGENTS.md` 打算被追踪，则修改它。
- 修改 `PROJECT-INDEX.json`。
- 如果 `README.md` 记录了启动/构建命令，则修改它。
- 从文档中移除过时的 `metadata.json` 引用，因为桌面端现在是规范的。
- 除非用户明确要求暂存或追踪，否则不修改当前未追踪的 `AGENTS.md`。

验收：

- 文档中的命令与根桌面端脚本和 `frontend/` 脚本一致。
- 文档说明 `.exe` 在 Windows/CI 上构建，`.dmg` 在 macOS 上本地构建。
- 文档不将静态 SPA 部署作为规范运行时呈现。

## Phase 7：端到端验证

### Task 7.1：完整本地验证

命令：

```bash
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run test 2>&1 | head -c 12000
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build 2>&1 | head -c 12000
/Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run build-m 2>&1 | head -c 12000
```

验收：

- 所有测试通过。
- 类型检查通过。
- Electron 构建完成。
- `.dmg` 存在于配置的输出目录中，且可在本地打开。

### Task 7.2：手动产品流程验证

所需截图：

- Electron 窗口加载到 Step 1。
- Step 2 Univer sheet 包含未解决的冲突。
- Step 2 候选面板已打开。
- Step 3 复制/粘贴 SKU 控制可见。
- Step 4 校验卡片聚焦到 Univer 单元格。
- Step 5 只读预览。
- macOS `.dmg` 应用已启动。
- Windows `.exe` 应用在 Windows/CI 中已启动。

验收：

- 五步流程可完成。
- 冲突阻断仍然有效。
- 校验卡片仍能导航到单元格。
- 导出的 `.xlsx` 可打开，且与预期的业务 workbook 结构匹配。
- Univer UI 显示为中文。

### Task 7.3：Windows/CI 打包验证

Windows 或 CI 上的命令：

```bash
npm run build-w
```

验收：

- 生成了 NSIS `.exe` 产物。
- 安装后的应用启动到试产搭配表向导。
- 此结果被记录，包含产物路径和构建环境。

## 最终完成标准

- [x] 一个规范运行时：Electron 桌面端。
- [x] 一个规范表格：Univer 驱动的 `TrialProductionSheet`。
- [x] 一个规范业务状态：现有的 React 状态和业务模块。
- [x] 一个规范导出路径：`buildTrialProductionWorkbook()`。
- [x] `npm run test`、`npm run lint`、`npm run build` 和 `npm run build-m` 在本地通过。
- [ ] `npm run build-w` 在 Windows/CI 上通过。（需要 Windows/CI 环境）
- [x] 旧的手工构建表格路径已被移除，而非隐藏在回退后面。
