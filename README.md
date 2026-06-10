# 试产搭配表自动生成

天珑手机试产搭配表自动生成交互工具，支持五步向导、业务规则校验及 Excel 导出。

## 技术栈

- **前端框架**: React 19 + TypeScript 5.8
- **构建工具**: Vite 6
- **样式**: Tailwind CSS 4
- **AI 集成**: Qwen LLM (qwen3.7-max @ newapi.tinno.com)
- **部署**: 静态 SPA，托管于 Google AI Studio

## 快速开始

### 前置要求

- Node.js (推荐 18+)
- npm

### 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器 (端口 3000)
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm run test

# 类型检查
npm run lint

# 预览生产构建
npm run preview

# 清理构建文件
npm run clean
```

## 项目结构

```
trial-production/
├── src/
│   ├── main.tsx                          # 应用入口
│   ├── App.tsx                           # 主应用（核心状态 + 所有步进逻辑）
│   ├── types.ts                          # TypeScript 类型定义
│   ├── constants.ts                      # 常量（字段定义、模板阶段、校验规则）
│   ├── index.css                         # 全局样式
│   ├── config/
│   │   └── keyMaterialLLM.ts             # LLM 端点配置
│   ├── components/                       # UI 组件
│   │   ├── StepsIndicator.tsx            # 五步向导指示器
│   │   ├── Sidebar.tsx                   # 侧边栏（校验结果 + 统计）
│   │   ├── TrialProductionTable.tsx      # 核心表格组件
│   │   └── HistoryModal.tsx              # 历史记录弹窗
│   └── lib/                              # 核心业务逻辑（14模块）
│       ├── utils.ts                      # 通用工具函数
│       ├── keyMaterialTemplate.ts        # 关键物料模板处理
│       ├── managedMaterialCore.ts        # 管控物料处理
│       ├── sampleCollectionWorkbook.ts   # 样机收集表处理
│       ├── step2CellConflicts.ts         # PCBA 配置冲突检测
│       ├── step4SampleCalc.ts            # 样机数量计算
│       ├── step4ValidationRules.ts       # 校验规则引擎
│       ├── step4StorageValidationResults.ts # 存储校验结果
│       ├── step5TableModel.ts            # 导出表格模型
│       ├── supplyProjection.ts           # 供应数据投影
│       ├── tableOperations.ts            # 表格操作（复制/粘贴/插入）
│       ├── tableViewport.ts              # 表格视口处理
│       ├── trialProductionWorkbook.ts    # Excel 工作簿生成
│       └── efuseFields.ts                # eFuse 字段配置
├── docs/
│   └── dev-memory/                       # 开发记忆系统
├── AGENTS.md                             # 项目代理配置
├── PROJECT-INDEX.json                    # 项目索引
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## 核心功能

### 五步向导流程

1. **填写必填项**: 项目信息（名称、客户、阶段）+ 上传 4 类 Excel 文件
2. **自动获取**: PCBA 选项解析 + LLM 匹配关键物料/核心器件/样机需求 → 冲突检测
3. **补充完善**: 按供应键完善 SKU 数据，支持插入/复制/粘贴操作
4. **计算与校验**: 样机数量计算 + 业务规则校验（可点击聚焦到单元格）
5. **导出预览**: 最终表格预览 + `.xlsx` 文件导出

### 业务规则校验

- 颜色一致性校验
- 存储一致性校验
- 标识包含校验
- 壳体 MBOM 校验
- E-BOM 存储一致性校验

### 模板阶段支持

| 模板 | 阶段 |
|------|------|
| 标准 | EVB → EVT → DVT1 → DVT2 → PVT → MP |
| 传音 | T0 → PR0 → PR1 → PR2 → PIR → MP |
| 中兴 | T0 → T1 → T2 → T3 → NPI → MP |

## 开发指南

### 路径别名

`@/` 映射到项目根目录，不是 `src/`。示例：
```typescript
import { X } from '@/src/types'  // 正确
import { X } from '@/types'      // 错误
```

### 测试

```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npm run test -- src/lib/utils.test.ts
```

### 开发记忆系统

在修改业务逻辑前，请先查看 `docs/dev-memory/` 目录：
- `patterns.md` - 表头解析策略、冲突判定要点
- `decisions.md` - 架构决策记录
- `active-problems.md` - 已知活跃问题
- `troubleshooting.md` - 故障排查记录

## 主要依赖

| 库 | 用途 |
|---|---|
| `@dnd-kit/core/sortable/utilities` | 拖拽排序表格行 |
| `xlsx` | Excel 文件读写 |
| `lucide-react` | 图标库 |
| `motion` (framer-motion v12) | 动画效果 |
| `@google/genai` | LLM API 客户端 |
| `tailwind-merge` + `clsx` | className 组合 |
| `express` + `dotenv` | 服务器端能力 |

## 代码风格

- 使用 `clsx` + `tailwind-merge` 的 `cn()` 工具函数进行 className 组合
- 无组件库 - 所有 UI 使用 Tailwind CSS 手工构建
- 动画使用 `motion/react` (framer-motion v12 API)
- 仅使用 `lucide-react` 图标

## 已知问题

1. Step2 冲突快速候选按钮只对 `lcd` 生效 - `band` 和 `storage` 只有占位提示
2. 关键物料模板字段在 LLM 超时或部分返回时整批留空 - 无兜底机制

## 部署

项目为静态 SPA，可部署到任何静态文件托管服务。当前托管于 Google AI Studio。

查看应用：https://ai.studio/apps/8de212f4-a2c7-4d66-94dc-6e2650de96ed