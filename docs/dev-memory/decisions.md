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

## 2026-06-13 - Step 3-5 新增列"单独成列"语义
- 现状：所有 step 共用同一段 before/after 位置逻辑（`App.tsx:handleStructureColumnInsert` 的 `afterSupplyId` 计算）
- 决策：Step 2 保持 `before=挤占 anchor 左侧`、`after=anchor 之后`；Step 3-5 统一为"所有插入都到 anchor 之后"（`before` 与 `after` 业务层等价）
- 实现：`App.tsx` 的 `afterSupplyId` 映射加 `currentStep >= 3` 三元判断
- Univer 端不动：`TrialProductionSheet.tsx` 仍 step-agnostic，方向（`Direction.LEFT/RIGHT`）由 Univer 命令层区分，业务层统一映射
- 函数 invariant：`insertDynamicSupply` 签名/行为不变；`dynamicStructure.test.ts` 4 个用例不变
- 测试策略 A：0 新增测试；靠 `dynamicStructure.test.ts`（Step 2 行为）+ `behavior.test.tsx`（Step 3+`after` 链路）守护
- 业务影响：Step 3-5 用户点"左侧插入列"现在等价于"右侧插入列"，新列永远追加在 anchor 之后；anchor 保持原位
- 实施计划：`docs/superpowers/plans/2026-06-13-step3-5-insert-column-after-anchor.md`；commit：`ba80770 refactor(insert-column): step 3-5 always insert after anchor`

## 2026-06-13 - 修复 Step 3+ 插入新 supply 时 selectedSupplyKey 自动丢失 anchor
- 背景：Step 3 选中 B1 → 在 B1 左侧新增一列 aa1 → 切到 Step 4 后 B1 丢失，只剩 aa1
- 根因：`dynamicStructure.ts:insertDynamicSupply` 在 Step 3+ 下自动把 `selectedSupplyKey` 切到新插入的 supply；Step 4 投影（`supplyProjection.ts:projectSkuForStep`）按 selectedSupplyKey 过滤，导致 anchor 被丢弃
- 决策：`insertDynamicSupply` 改为单一职责 — 只做"插入新 supply"，不再附带 selectedSupplyKey 切换副作用；调用方按需显式控制切换
- 函数 invariant：`insertDynamicSupply` 不再修改 `selectedSupplyKey`，新 supply 插入后 anchor 仍保持选中
- 测试：`dynamicStructure.test.ts` "switches selectedSupplyKey to the inserted supply from step 3 onward" 反转为 "keeps the current selectedSupplyKey when inserting a new supply from step 3 onward"
- 业务影响：用户在 Step 3+ 选中 anchor 后点"插入列"，anchor 保持选中；切到 Step 4 看到 anchor 而不是新列；新列需要用户主动切到才能编辑
- 兼容性：与 `App.tsx:handleStructureColumnInsert` 的现有调用无冲突；现有 `dynamicStructure.test.ts` 7 个用例全过
- 实施计划：`docs/superpowers/plans/2026-06-13-fix-insert-supply-selected-supply-key.md`；commits：`f56679d` (red test) → `00ded56` (fix)
