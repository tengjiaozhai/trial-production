# Decisions

## 2026-05-27 - 配置表 PCBA 列识别策略
- `PCBA配置` 表头必须先做精确匹配候选（`PCBA配置` 或 `PCBA 配置`），不能用宽松包含匹配。
- 存在多个候选列时，选择“向下有效 PCBA 值数量最多”的列作为真实数据列。
- 目的：避免把标题单元格（如 `...PCBA配置表`）或空白结构列误判为数据列。

## 2026-05-27 - Step2 初始存储值生成规则
- 从配置表提取到的 `DDR/EMMC` 文本先提取数字，再组装为 `DDR+EMMC`（示例：`4+128`）。
- 不再直接拼接原始文本（如 `4GB 一供+128GB 一供`），防止后续校验规则误判为空或格式异常。

## 2026-06-11 - Step3 `prod_loc` 下拉与历史值约束
- `prod_loc` 必须使用 `requireValueInList(options, false, true)` 创建普通单选下拉，不能把 `multiple` 误当成“显示下拉”的开关。
- 历史记录、复制粘贴、sheet snapshot、编辑回写都必须先做值规范化，禁止对象 payload 直接进入 `Univer` 单元格。
- `prod_loc` 只允许 `宜宾 / 南昌 / 河源 / 越南 / 自定义 / ''`，非法值必须清空，避免污染下拉状态。

## 2026-06-13 - Step 5 列结构对齐 Step 2-4（1+N）
- Step 5 旧的列结构是 `A=序号(01/02) + B=字段名 + C..=数据`（2+N 列），现在改为 `A=字段名 + B..=数据`（1+N 列），与 Step 2-4 完全一致。
- 直接删除 `Step5FieldRow.indexLabel` 字段与 `visibleIndex` 计数逻辑，符合 "No Legacy By Default" 原则；不保留 `_unused`/`_deprecated` 别名。
- `leadingColumns` 收敛为常量 `1`，Univer 列号 → 业务列号换算统一；Step 5 插入列/行的 anchor 行为随之对齐 Step 2-4。
- A 列宽度复用 Step 2-4 公式 `Math.max(maxLabelLength * 16, 120)`（Univer 像素）或 `Math.max(maxLabelLength, 18)`（Excel `wch` 字符宽度），保证 eFuse 标签如 `硬件(efuse)` 完整显示。
- 历史 plan/spec（如 `2026-05-28-step5-exact-excel-export.md`）作为实施快照不修改，本次变更以本 ADR 单一权威记录。
- 实施计划：`docs/superpowers/plans/2026-06-13-step5-column-alignment.md`；commits：`baf40ba` (删 indexLabel) → `121e152` (excel 1+N) → `d7f1c44` (univer 1+N) → `e19aebf` (test 1+N 断言)。
