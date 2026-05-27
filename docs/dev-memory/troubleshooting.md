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
