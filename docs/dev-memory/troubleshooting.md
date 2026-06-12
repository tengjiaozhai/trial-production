# Troubleshooting

## 2026-05-27 - 只选 A1 仍出现“频段/存储/LCD 冲突”

### 症状
- 导入 4 个 `.xlsx`（排除 `搭配表数据拆解（最终）.xls`）并只勾选 `A1` 后，Step2 仍显示大量冲突。
- 左侧冲突说明统一为 `A1-主供 缺少值`，典型字段是 `频段`、`存储`、`LCD`。

### 根因
- `extractPcbaOptions` 曾使用宽松正则匹配 `PCBA配置`，在真实表中会先命中标题或空结构列。
- 结果是读取不到 `A1` 的有效 `出货市场/EMMC/DDR`，Step2 基于空值判定冲突。
- 另外，存储字段原先直接拼接原始文本，格式不稳定。

### 修复
- `src/lib/utils.ts`：
  - 表头改为精确候选匹配。
  - 多候选时按有效数据行数打分选列。
- `src/App.tsx`：
  - `storage` 改为 `DDR/EMMC` 数字提取后拼接为标准 `x+y`。
- `src/lib/utils.test.ts`：
  - 增加“标题包含 PCBA配置表 + 双 PCBA 表头”的回归用例。

### 验证
- `npm run test -- src/lib/utils.test.ts` 通过。
- `npm run lint` 通过。
- 用真实文件 `../infinix  X6728_X6728B配置表_V1.4_20250619.xlsx` 提取结果验证：
  - `A1.band = SSA+北非+中东+中亚`
  - `A1.storage = 4+128`

## 2026-06-11 - Step3 `prod_loc` 失去下拉并出现 `[object Object]`

### 症状
- 从历史记录进入第 3 步后，`试产地点` 行偶发显示 `[object Object]` 或没有下拉箭头。
- 手工切换 `prod_loc` 后，下拉状态不稳定，历史记录再次打开会复发。

### 根因
- 单元格值在历史加载、复制、回写链路中保留了对象 payload，而不是纯字符串。
- `prod_loc` 的数据验证也曾误用 `requireValueInList` 的参数位，把普通单选列表建成了错误模式。

### 修复
- 新增统一值规范化，覆盖历史记录、复制粘贴、编辑回写和 workbook snapshot。
- `prod_loc` 仅允许枚举字符串，非法值直接清空并回到待选状态。
- 数据验证改为普通单选下拉，保证单元格继续显示可选项。

### 验证
- 从历史记录加载到第 3 步后，`prod_loc` 不再显示 `[object Object]`。
- 点击 `试产地点` 单元格可见 `宜宾 / 南昌 / 河源 / 越南 / 自定义` 下拉项。
- 选择后保存、切换步骤、重开历史记录，值仍保持为纯字符串。

## 2026-06-12 - Univer 首次挂载空壳（canvas=0）

### 症状
- 从 Step1 进入 Step2，或从历史记录直达 Step2-5，Univer 只渲染外壳（workbench-layout / headerbar / ribbon），不渲染 cell data（canvas=0，无 workbench-container）。
- 切到下一步再切回来就正常（currentStep 变化触发 Effect 2 重跑）。

### 根因
- `TrialProductionSheet` 的 Effect 2（createWorkbook）依赖 `[model, skuData, activeFields, currentStep, skuSupplyKeys]`，**不含 `univerReady`**。
- Effect 1 同步 createUniver + `setTimeout(0) setUniverReady(true)`。
- React 19.2.7 + StrictMode 下，`setUniverReady(true)` 翻转不会让 Effect 2 重跑（deps 未变），`createWorkbook()` 在首次挂载时永远不执行。
- 子智能体用隔离复现（`univerReady-strictmode-repro.test.tsx`）实证：`B.createWorkbook=0, B.earlyReturn=2`。
- Playwright 实测：修复前 canvas=0，修复后 canvas=3。

### 修复
- `src/components/TrialProductionSheet.tsx:459`：Effect 2 deps 加 `univerReady`。
- `src/App.tsx:276`：`loadHistoryItem` 删掉双 rAF / 800ms warm-up / Step4 跳转 hack，改为 `setCurrentStep(normalized.entry.currentStep)`。

### 验证
- `npm run lint` 通过。
- `npm run build` 通过。
- Playwright E2E Step1→2：canvas=3 ✅。
- Playwright E2E 历史直达 Step5：canvas=3 ✅。
