# Implementation Notes — Electron + Univer 桌面端迁移

## 执行日期

2026-06-09

## 完成的阶段

| 阶段 | 状态 | 关键产出 |
|------|------|----------|
| Phase 0：基线确认 | ✅ 完成 | 16 文件 175 测试全部通过，零失败基线 |
| Phase 1：Electron 壳 | ✅ 完成 | 前端移入 `frontend/`，electron-egg 结构创建 |
| Phase 2：打包 | ✅ 完成 | macOS `.dmg` 构建成功（96MB unsigned） |
| Phase 3：Univer 基础 | ✅ 完成 | Univer 依赖安装，中文 locale 配置，最小组件 |
| Phase 4：Sheet 模型适配器 | ✅ 完成 | 业务→Univer 适配器 + 反向映射器，TDD 驱动 |
| Phase 5：App 集成 | ✅ 完成 | TrialProductionSheet 替换 TrialProductionTable |
| Phase 6：旧代码清理 | ✅ 完成 | 删除 TrialProductionTable + tableViewport |
| Phase 7：端到端验证 | ✅ 完成 | test/lint/build/build-m 全部通过 |

## 文件变更清单

### 新建文件

| 文件 | 用途 |
|------|------|
| `electron/main.js` | electron-egg 主进程入口 |
| `electron/config/config.default.js` | BrowserWindow 配置 |
| `electron/config/config.prod.js` | 生产环境覆盖 |
| `electron/preload/index.js` | Preload 注册 |
| `electron/preload/bridge.js` | contextBridge API |
| `electron/preload/lifecycle.js` | 生命周期类 |
| `cmd/bin.js` | ee-bin 命令配置 |
| `cmd/builder.json` | Windows NSIS 构建器 |
| `cmd/builder-mac.json` | macOS DMG 构建器 |
| `build/icons/icon.png` | 图标占位 |
| `build/icons/icon.ico` | Windows 图标占位 |
| `build/icons/icon.icns` | macOS 图标占位 |
| `build/extraResources/read.txt` | 额外资源占位 |
| `frontend/package.json` | 前端独立包配置 |
| `frontend/src/components/TrialProductionSheet.tsx` | Univer 驱动的表格组件 |
| `frontend/src/components/TrialProductionSheet.test.tsx` | 组件测试 |
| `frontend/src/lib/univerTrialProductionSheet.ts` | 业务→Univer 适配器 |
| `frontend/src/lib/univerTrialProductionSheet.test.ts` | 适配器测试 |
| `frontend/src/lib/univerSheetEvents.ts` | 编辑事件反向映射 |
| `frontend/src/lib/univerSheetEvents.test.ts` | 事件映射测试 |

### 修改的文件

| 文件 | 变更 |
|------|------|
| `package.json` | 改为 Electron 桌面应用包 |
| `frontend/vite.config.ts` | 添加 `base: './'` |
| `frontend/src/main.tsx` | 添加 Univer CSS 导入 |
| `frontend/src/App.tsx` | 替换 TrialProductionTable → TrialProductionSheet |
| `frontend/src/components/Sidebar.tsx` | DOM 查询 → onFocusCell 回调 |
| `frontend/src/components/Sidebar.test.tsx` | 适配新的回调接口 |

### 删除的文件

| 文件 | 原因 |
|------|------|
| `frontend/src/components/TrialProductionTable.tsx` | 被 TrialProductionSheet 替换 |
| `frontend/src/components/TrialProductionTable.test.tsx` | 随组件删除 |
| `frontend/src/lib/tableViewport.ts` | Univer 接管视口管理 |
| `frontend/src/lib/tableViewport.test.ts` | 随模块删除 |
| `PROJECT-INDEX.md` | 内容已合并入 AGENTS.md |

## 测试演进

| 阶段 | 测试文件数 | 测试用例数 |
|------|-----------|-----------|
| Phase 0 基线 | 16 | 175 |
| Phase 3 Univer | 17 | 178 |
| Phase 4 适配器 | 19 | 193 |
| Phase 5 集成 | 19 | 193 |
| Phase 6 清理 | 17 | 169 |

Phase 6 测试数减少是因为删除了 TrialProductionTable（19 测试）和 tableViewport（5 测试），同时新增了 TrialProductionSheet（3 测试）和适配器（15 测试）。

## 架构决策

1. **`@/` 别名**：映射到 `frontend/` 项目根目录，而非 `src/`。
2. **CSS 导入**：Univer CSS 通过 `@univerjs/preset-sheets-core/lib/index.css` 导入（包 exports 不支持直接 `index.css`）。
3. **测试环境**：组件测试使用 `// @vitest-environment jsdom` pragma，因为全局配置为 `node`。
4. **聚焦机制**：Sidebar 通过 `onFocusCell` 回调调用 `TrialProductionSheet.focusCellByBusinessKey()`，不再使用 DOM 查询。
5. **业务状态权威**：Univer snapshot 仅为视图投影，所有编辑通过 `onUpdateValue` 回调写回 React state。

## 已知限制

1. **Univer bundle 较大**：前端构建产物 6.8MB（含 Univer 全量 locale），需要后续 code splitting 优化。
2. **Step 2 候选面板**：当前仅通过 Sidebar 卡片聚焦，尚未实现 Univer 内嵌候选面板 UI。
3. **Step 5 布局快照**：`Step5LayoutSnapshot` 集成尚未从 Univer 读取行高列宽。
4. **Windows `.exe`**：需要 Windows/CI 环境构建，当前 macOS 无法生成。
5. **图标占位**：使用纯色 PNG 占位，需要替换为正式产品图标。
