# Electron + Univer 桌面端设计

## 目标

将试产搭配表 React/Vite SPA 转换为单一权威的 Electron 桌面应用，以本地 `tn-viewer` 的 electron-egg 结构为实现参考。用 Univer Sheets 替换手工构建的试产表格，包含简体中文本地化，同时保留现有的五步业务流程、校验行为和 Excel 导出。

## 已确认决策

- 使用完整的 electron-egg 结构，而非最小化的 Electron 壳。
- 桌面应用是规范的运行时路径。不保留并行的旧 SPA 路径。
- 使用 Univer Sheets 作为规范表格实现。不保留旧的 `TrialProductionTable` 作为回退。
- 在 macOS 上本地构建 `.dmg`。在 Windows 机器或 CI 上构建 `.exe`。
- 保持当前业务模型（`skuData`、`activeFields`、`ProjectInfo`、校验结果）为数据源。Univer 快照是视图/编辑投影，而非业务状态的权威来源。

## Electron 架构

根包成为桌面应用包。添加 `tn-viewer` 使用的相同高层级目录：

- `electron/` — electron-egg 主进程、preload 桥接、生命周期和配置。
- `cmd/` — `ee-bin` 的开发、构建、移动和打包命令。
- `build/` — 图标和安装程序资源。
- `public/` — 打包后的 Electron 代码和前端构建输出。
- `frontend/` — 现有的 React/Vite 应用。

开发通过 electron-egg 运行：

- 前端开发服务器从 `frontend/` 运行。
- 本地开发时 Electron 加载开发 URL。
- 生产环境加载 `public/dist/index.html`。

窗口默认值：

- 宽度和高度遵循 `tn-viewer` 风格：大型桌面工作区，具有合理的窗口最小尺寸。
- `contextIsolation: true`。
- `nodeIntegration: false`。
- Preload 仅暴露本应用所需的显式桌面 API。
- `autoHideMenuBar: true`。

打包：

- `cmd/builder.json` 生成 Windows NSIS `.exe`。
- `cmd/builder-mac.json` 生成 macOS `.dmg`。
- 当前的本地 macOS 构建是未签名的，除非后续提供签名凭证。
- Windows `.exe` 仅接受来自 Windows 或 CI 的构建，因为当前 Mac 环境没有 `wine` 或 `makensis`。

## Univer 表格设计

将 `TrialProductionTable` 替换为 `TrialProductionSheet`。

应用保持当前业务状态作为数据源：

- `skuData`
- `activeFields`
- `currentStep`
- `projectInfo.efuseConfigs`
- 校验结果和 Step 2 冲突

添加纯适配器函数：

- 从当前业务状态构建 Univer workbook 快照。
- 构建从可见 sheet 单元格到 `{ skuId, supplyId, fieldId, scope }` 的行列业务映射。
- 从 `buildStep5TableModel()` 构建 Step 5 预览数据，使 Excel 预览语义与导出语义保持一致。

步骤行为：

- Step 2、3、4 渲染可编辑 sheet。
- Step 5 渲染只读预览 sheet。
- 基本信息和供应列在可行时通过 Univer 冻结/滚动行为保持可见和可导航。
- 业务结构变更（插入 SKU 块、添加供应、复制选中 SKU、粘贴到新 SKU）仍由应用级按钮和 `tableOperations.ts` 驱动。
- Univer 原生行列插入/删除菜单被隐藏或禁用，使用户无法绕过结构化的 `skuData` 模型。

本地化：

- 使用 Univer 简体中文区域设置（`LocaleType.ZH_CN`）并合并所需的 preset/plugin 语言包。
- 保持周围应用 UI 使用现有的中文标签。

事件与同步：

- 单元格编辑事件将 `row/column` 映射回业务键，并调用现有回调（如 `onUpdateValue`）。
- SKU 作用域字段（如 `band`、`storage`、`project`、`stage`、`mb_id`）在当前行为需要跨供应更新时，更新所有相关供应。
- 供应标签和已选供应更新保持为显式的应用控件，除非 Univer 单元格被有意映射到这些字段。

Step 2 冲突：

- 冲突单元格接收 Univer 单元格样式，使未解决状态可见。
- 候选选项移到轻量级的侧边/顶部候选面板，以当前冲突单元格为键值。
- 选择候选值调用与手动编辑相同的业务更新回调。

Step 4 校验定位：

- `ValidationResult` 继续以 `skuId`、`supplyId` 和 `targetFieldId ?? fieldId` 为键值。
- `TrialProductionSheet` 暴露按业务键聚焦的操作。
- 侧边栏校验卡片调用该操作，而非查询 `data-step4-cell-id` 等 DOM 属性。

Step 5 导出：

- `buildTrialProductionWorkbook()` 仍然是唯一的权威 Excel 导出路径。
- 不要切换到 Univer 导出用于业务输出。
- 从 Univer 读取行高和列宽（如果可用），并更新现有的 `Step5LayoutSnapshot`。

## 迁移顺序

1. 将现有 React 应用移到 `frontend/`，并更新 Vite 配置以支持 Electron 生产加载。
2. 添加 electron-egg 目录、包脚本、配置、builder 配置，以及这些 builder 配置所需的最小图标/资源。
3. 验证 Electron 可以加载未改动的现有前端。
4. 添加 Univer 依赖和一个最小的本地化 sheet 组件。
5. 添加业务到 Univer 的适配器及测试。
6. 添加编辑事件反向映射及测试。
7. 将 `TrialProductionTable` 的使用替换为 `TrialProductionSheet`。
8. 重新连接 Step 2 冲突、Step 3 结构操作、Step 4 校验聚焦和 Step 5 布局/导出。
9. 移除不再使用的旧表格代码，包括旧的视口帮助函数和不再适用的 DOM 定位测试。
10. 运行完整验证和打包检查。

## 测试与验收标准

单元和组件检查：

- 业务到 Univer 快照适配器创建正确的行、列、合并/跨列语义、样式和只读 Step 5 数据。
- 反向映射将编辑发送到准确的 `skuId`、`supplyId` 和 `fieldId`。
- Step 2 候选选择解析正确的冲突单元格。
- Step 4 侧边栏卡片聚焦预期的 Univer 单元格。
- 现有业务模块仍然通过，尤其是 `tableOperations`、`step5TableModel`、`trialProductionWorkbook`、校验和冲突测试。

命令：

- `npm run test`
- `npm run lint`
- `npm run dev`
- `npm run build`
- `npm run build-m`
- 在 Windows 或 CI 上：`npm run build-w`

打包验收：

- macOS 生成未签名的 `.dmg`，可在本地打开。
- Windows/CI 生成 NSIS `.exe`。
- 应用启动到试产搭配表向导，并能以 Univer 作为表格 UI 完成现有五步流程。

## 风险与约束

- Univer 是一个复杂的电子表格运行时。保持所有业务写入流经现有回调，以避免隐藏的状态分歧。
- 如果 Univer 菜单或权限功能的行为与文档不符，选择更简单的单路径控制：隐藏该功能，将业务控制保持在 sheet 外部。
- 除非后续明确要求，否则不要为旧表格行为引入兼容分支。
- 在此次迁移中，不要使用 Univer 导出替代现有的业务 workbook 导出。
- 代码签名和公证不在本次设计范围内。

## 参考

- 本地参考：`/Users/shenmingjie/tinno/tn-viewer`
- electron-egg：`https://github.com/dromara/electron-egg`
- Univer Sheets：`https://docs.univer.ai/guides/sheets`
- Univer i18n：`https://docs.univer.ai/guides/sheets/getting-started/i18n`
- Univer Facade API：`https://docs.univer.ai/guides/sheets/getting-started/facade`
