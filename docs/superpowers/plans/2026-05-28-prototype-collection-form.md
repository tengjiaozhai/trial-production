# 样机收集表负责团队字段自动获取 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让样机收集表中的 `硬件、硬测、软件、软测、结构、可靠性、压测、影像、NPM、体验、器件、产品` 自动回填到 Step2 对应字段，并按一供/二供拆成两个小列展示数字。

**Architecture:** 新增独立的样机收集表解析链路，复用现有 `fieldOptions` 渲染能力，不新开第二套 UI 结构。上传阶段只做 workbook 解析和“目标词 -> 行名”匹配；`startAutoCalc` 阶段再结合当前 `stage` 和 `pcba` 精确定位列，生成每个 SKU 的数值选项。

**Tech Stack:** TypeScript, xlsx, fetch, Vitest

---

## Summary

- 文件入口规则：文件名必须包含 `样机收集表`；sheet 不要求也包含完整关键字，按你的补充，候选 sheet 只要求名称包含 `样机`。
- 数据定位规则：第 1 行按试产阶段精确匹配，第 2 行模糊匹配 `一供/二供`，第 3 行精确匹配主板标识。
- 行匹配规则：在 `大ToB-原型` 这一列收集候选行名，对 `硬件-产品` 这 12 个目标词做 LLM 主匹配，缺失项重试，再做本地关键词 fallback。
- 输出规则：只取数字；一供、二供分别生成两个 `SplitFieldOption`，复用现有分裂单元格展示。
- 命名规则：`reliability_eng` 的 label 改为 `可靠性（内部）`，`reliability` 的 label 改为 `可靠性（客户）`；这次只回填前者。

## Important Interfaces

- 在 [types.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/types.ts) 扩展 `SplitOptionFieldId`，加入：
  - `hw_eng`
  - `hw_test`
  - `sw_eng`
  - `sw_test`
  - `struct_eng`
  - `reliability_eng`
  - `pressure_test`
  - `image_eng`
  - `npm`
  - `ux`
  - `parts`
  - `pm`
- 新增 `SampleCollectionFieldId` 子类型，专门约束这 12 个字段的 helper 签名，避免到处写长联合。
- 在 `ProjectInfo` 增加 `sampleCollection` 状态，保存“样机收集表原始解析结果 + 每个候选 sheet 的行名匹配结果”。
- 保持 `SplitFieldOption` 结构不变，`text` 存数字字符串，`sourceCategory2` 复用为“命中的原始行名”元数据，不做全局类型重命名。

## Implementation Changes

- 新增 `src/lib/sampleCollectionWorkbook.ts`：
  - 解析所有可见且名称包含 `样机` 的 sheet。
  - 对第 1、2 行做 fill-forward，展开合并表头的阶段/供方信息，避免只在首列有值时后续列全丢。
  - 读取第 3 行主板标识。
  - 从第 1 列 `大ToB-原型` 收集非空候选行名和原始数据行。
- 在新模块内实现 `matchSampleCollectionRowsWithLLM()`：
  - 目标字段固定映射到现有字段 ID：
    - `硬件 -> hw_eng`
    - `硬测 -> hw_test`
    - `软件 -> sw_eng`
    - `软测 -> sw_test`
    - `结构 -> struct_eng`
    - `可靠性 -> reliability_eng`
    - `压测 -> pressure_test`
    - `影像 -> image_eng`
    - `NPM -> npm`
    - `体验 -> ux`
    - `器件 -> parts`
    - `产品 -> pm`
  - 复用核心器件/器件规格现在的成熟模式：
    - JSON 请求 helper
    - 返回值清洗
    - 只对缺失字段做第二次重试
    - 本地 regex fallback
- 在 [App.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/App.tsx) 的上传链路中：
  - 把 `样机收集表` 纳入 upload loading 阻塞范围。
  - 增加类似 `样机收集表大模型匹配中...` 的步骤文案。
  - 上传时仅保存解析结果，不在这里按 stage/pcba 直接取值。
- 在 `startAutoCalc` 中：
  - 对每个 SKU，按当前 `projectInfo.stage` 精确匹配第 1 行。
  - 按当前 `pcba` 精确匹配第 3 行。
  - 在同一个阶段分组内，分别取左侧第一个命中的 `一供` 列和 `二供` 列。
  - 用命中的行名读取该行两个单元格，提取纯数字，生成 `SplitFieldOption[]`。
  - 把结果 merge 进现有 `fieldOptions`，不新开 `teamOptions`、`sampleOptions` 之类平行结构。
- 在 [constants.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/constants.ts)：
  - `reliability_eng.label` 改为 `可靠性（内部）`
  - `reliability.label` 改为 `可靠性（客户）`
- 不改 [TrialProductionTable.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/components/TrialProductionTable.tsx) 的分裂展示主逻辑；它已经能展示这些字段的 `fieldOptions`，只需要吃到正确数据。

## Test Plan

- 解析测试：
  - 只接受文件名包含 `样机收集表` 的 workbook。
  - 只解析可见且名称包含 `样机` 的 sheet。
  - 第 1、2 行 fill-forward 后，`PR1/A1/一供` 能定位到真实列。
- 匹配测试：
  - `硬测 -> 硬件测试`
  - `体验 -> 体验试用`
  - `可靠性 -> 可靠性测试`
  - `压测 -> 压力测试`
  - `fetch` 失败时 fallback 仍能命中这些行。
- 取值测试：
  - 同一行的一供、二供数字拆成两个 option。
  - 空白单元格跳过，不生成空 option。
  - 若单元格是 `12台` 这类混合文本，只保留数字部分。
- 集成测试：
  - `startAutoCalc` 后 `sku.fieldOptions.hw_eng / hw_test / ... / pm` 有值。
  - `stage` 不精确相等时留空，不做 `T0 -> ES` 之类映射。
  - `reliability_eng` 被回填，`reliability` 不被这条链路写入。
  - UI 中两个 `可靠性` label 分别显示为 `可靠性（内部）` 和 `可靠性（客户）`。

## Assumptions

- 样机收集表的真实规则按你刚刚锁定的版本执行：
  - 文件名包含 `样机收集表`
  - sheet 名只要求包含 `样机`
  - 选择“第一个能命中当前主板标识的候选 sheet”
- 阶段匹配必须精确相等，任何别名或模糊匹配都不做。
- 这次范围只覆盖负责团队这 12 个字段，不碰 `样机需求` 组里现有的 `reliability` 自动来源。
- 继续遵守单一路径：样机收集表结果最终只落到 `fieldOptions`，不引入新的并行渲染协议。
