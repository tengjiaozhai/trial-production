# 项目索引 - 试产搭配表自动生成工具

## 项目概述

- **名称**: 试产搭配表自动生成
- **描述**: 天珑手机试产搭配表自动生成交互工具，支持四步向导流程、业务规则校验及Excel导出
- **技术栈**: React 19 + TypeScript + Vite + Tailwind CSS + Gemini AI
- **主要功能**: 
  - 从配置表、物料表、样机收集表等文件自动解析数据
  - 通过LLM(Gemini)智能匹配关键物料和样机需求
  - 四步向导流程生成试产搭配表
  - 业务规则校验(颜色、存储、标识等)
  - Excel导出功能

## 目录结构

```
trial-production/
├── src/
│   ├── main.tsx                    # 应用入口
│   ├── App.tsx                     # 主应用组件，包含核心业务逻辑
│   ├── types.ts                    # TypeScript类型定义
│   ├── constants.ts                # 常量定义(字段、模板、规则)
│   ├── index.css                   # 全局样式
│   ├── components/                 # UI组件
│   │   ├── StepsIndicator.tsx      # 步骤指示器组件
│   │   ├── Sidebar.tsx             # 侧边栏组件
│   │   ├── TrialProductionTable.tsx # 试产表格主组件
│   │   └── HistoryModal.tsx        # 历史记录弹窗
│   └── lib/                        # 核心业务逻辑库
│       ├── utils.ts                # 通用工具函数
│       ├── keyMaterialTemplate.ts  # 关键物料选型模板解析
│       ├── managedMaterialCore.ts  # 管控物料核心器件解析
│       ├── sampleCollectionWorkbook.ts # 样机收集表解析
│       ├── step2CellConflicts.ts   # Step2单元格冲突检测
│       ├── step4SampleCalc.ts      # Step4样机数量计算
│       ├── step4ValidationRules.ts # Step4校验规则
│       ├── step5TableModel.ts      # Step5表格模型
│       ├── supplyProjection.ts     # 供应投影处理
│       ├── tableOperations.ts      # 表格操作(复制/粘贴/插入)
│       ├── tableViewport.ts        # 表格视口处理
│       ├── trialProductionWorkbook.ts # 试产工作簿生成
│       └── efuseFields.ts          # eFuse字段配置
├── docs/                           # 文档目录
├── package.json                    # 项目依赖配置
├── vite.config.ts                  # Vite构建配置
├── tsconfig.json                   # TypeScript配置
└── index.html                      # HTML入口
```

## 核心模块说明

### 1. 类型系统 (`src/types.ts`)
- **主要类型**:
  - `ProjectInfo`: 项目信息(名称、客户模板、试产阶段、文件列表、PCBA选项等)
  - `SKUData`: SKU数据结构(阶段、订单号、供应列表)
  - `SkuSupply`: 单个供应配置(供应商标签、字段值)
  - `FieldDefinition`: 字段定义(行为: auto/calc/manual)
  - `PcbaOption`: PCBA配置选项(主板标识、频段、存储等)
  - `ManagedMaterialWorkbook`: 管控物料工作簿数据
  - `SampleCollectionWorkbookData`: 样机收集表数据
  - `ValidationResult`: 校验结果
  - `HistoryEntry`: 历史记录条目

### 2. 常量配置 (`src/constants.ts`)
- **字段定义**: 119个字段，分组为: 基本信息、常用项、存储/PCBA、核心器件、常规器件、工艺辅料、BOM信息、内部样机需求、客户样机需求、统计汇总
- **模板阶段**: 标准(EVB→MP)、传音(T0→MP)、中兴(T0→MP)
- **校验规则**: 7条业务规则(R-COLOR-001等)

### 3. 主应用 (`src/App.tsx`)
- **状态管理**: 使用React Hooks管理项目状态、SKU数据、校验结果等
- **核心流程**:
  1. Step1: 项目信息录入 + 文件上传解析
  2. Step2: PCBA配置选择 + 冲突检测
  3. Step3: 供应选择
  4. Step4: 数据校验 + 样机数量计算
  5. Step5: 表格预览 + Excel导出

### 4. 核心业务逻辑 (`src/lib/`)

#### 文件解析模块
- **keyMaterialTemplate.ts**: 解析关键物料选型模板，通过LLM匹配字段分类
- **managedMaterialCore.ts**: 解析管控物料表，匹配核心器件(CPU、PMU、TX等)
- **sampleCollectionWorkbook.ts**: 解析样机收集表，匹配内部样机需求行名

#### 数据处理模块
- **step4SampleCalc.ts**: 计算样机需求数量(基于供应键值)
- **supplyProjection.ts`: 处理供应数据投影和规范化
- **tableOperations.ts`: 表格操作(插入字段、复制粘贴SKU等)

#### 校验与输出模块
- **step4ValidationRules.ts`: 业务规则校验(颜色一致性、存储配置、标识包含等)
- **trialProductionWorkbook.ts`: 生成Excel工作簿(使用xlsx库)
- **step2CellConflicts.ts`: 检测PCBA配置冲突

## 关键业务概念

### 模板类型
- **标准模板**: EVB → EVT → DVT1 → DVT2 → PVT → MP
- **传音模板**: T0 → PR0 → PR1 → PR2 → PIR → MP
- **中兴模板**: T0 → T1 → T2 → T3 → NPI → MP

### 字段行为类型
- `auto`: 从文件自动解析填充
- `calc`: 根据其他字段计算得出
- `manual`: 用户手动输入
- `order_no`: 订单号特殊处理

### 供应标签
- 一供、二供、三供(可扩展)

### PCBA配置
- 从配置表提取主板标识(PCBA)
- 包含信息: 项目名、频段、EMMC、DDR
- 支持冲突检测(频段冲突、重复配置)

## LLM集成

使用Google Gemini API进行智能匹配:
1. **关键物料分类匹配**: 将Excel中的分类2映射到系统字段
2. **核心器件名称匹配**: 匹配管控物料表中的器件名称
3. **样机需求行名匹配**: 匹配样机收集表中的需求行名

## 测试文件

- `*.test.ts` / `*.test.tsx`: 单元测试文件
- 使用Vitest + @testing-library/react

## 开发命令

```bash
npm run dev      # 启动开发服务器(端口3000)
npm run build    # 构建生产版本
npm run lint     # TypeScript类型检查
npm run test     # 运行测试
```

## 数据流向

```
文件上传 → 文件解析(PCBA/物料/样机) → LLM匹配 → SKU生成 → 校验 → Excel导出
```

## 索引元数据

- **创建时间**: 2026-06-05
- **版本**: 0.0.0
- **适用场景**: 试产搭配表自动生成、手机试产流程管理
