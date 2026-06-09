# Visual Review — Electron + Univer 桌面端

## 审查状态

⚠️ **待截图** — 当前环境无法启动 Electron GUI 进行视觉截图。以下为架构层面的视觉验收清单。

## 视觉验收清单

### 布局结构

- [x] 步骤指示器保持在顶部
- [x] 侧边栏保持在左侧（w-80 / w-12 折叠）
- [x] 主工作区在右侧，flex-1 填充
- [x] 底部操作栏固定在底部
- [x] Electron 窗口默认 1600x900，最大化启动

### Univer 集成

- [x] Univer CSS 通过 `@univerjs/preset-sheets-core/lib/index.css` 正确导入
- [x] 简体中文 locale 通过 `LocaleType.ZH_CN` + `mergeLocales(UniverPresetSheetsCoreZhCN)` 配置
- [x] Sheet 容器占满可用高度（`width: 100%; height: 100%`）
- [x] Sheet 画布在 `overflow: hidden` 容器内，不溢出

### 交互状态

- [x] Step 2 冲突：Sidebar 卡片点击 → `onFocusCell` → `focusCellByBusinessKey`
- [x] Step 4 校验：Sidebar 卡片点击 → 同上
- [x] Step 5 只读：`model.readOnly = true` 时加载 Step5TableModel
- [x] 单元格编辑：`SheetEditEnded` 事件 → `mapUniverEditToBusinessEdit` → `onUpdateValue`

### 企业蓝视觉语言

- [x] 主色调 `#2563EB`（蓝）保持不变
- [x] 背景色 `#F6F9FF` 保持不变
- [x] 边框色 `#DDE7F3` 保持不变
- [x] 文字色 `#0B1F33` / `#64748B` 保持不变
- [x] 字体 Inter + JetBrains Mono 保持不变

## 待办

- [ ] 使用 `playwright-cli` 启动 Electron 应用，截取各步骤状态
- [ ] 验证 Univer UI 标签为中文
- [ ] 验证 Sheet 画布填满可用高度
- [ ] 验证工具栏密度不压过产品 UI
- [ ] 验证冲突状态和校验聚焦状态视觉上可区分
