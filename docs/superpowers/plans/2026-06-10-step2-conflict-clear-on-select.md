# Step2 冲突先清空再候选回填实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Step2 所有冲突单元格先置空，用户必须从侧栏候选值中回填后才视为已解决。非空但未命中候选值的手工输入，不得自动解除冲突。

**Key decisions:**
- 冲突清空范围覆盖所有 Step2 冲突，不只限于 desc 字段
- `sku` 级冲突要清空该 SKU 下所有 supply 的同字段值
- `supply` 级冲突只清空目标 supply 对应单元格
- 冲突是否解决以“当前值严格等于某个 candidate.writeValue”为准
- 关键物料与管控物料仍按同一 `supplyTag` 严格对齐比较，供位对调继续保留为冲突

## Tasks

### Task 1: 冲突判定函数改造成可区分“初始冲突”和“已解决冲突”

**Files**
- `frontend/src/lib/step2CellConflicts.ts`
- `frontend/src/lib/step2CellConflicts.test.ts`

- [ ] 为 `buildStep2CellConflicts` 增加“是否按当前值判定已解决”的开关，默认保持现有 UI 使用方式
- [ ] 将“非空即已解决”改成“命中候选值才已解决”
- [ ] 为 duplicate PCBA 冲突和 managed-material 冲突都补充测试
- [ ] 覆盖 `sku` 级与 `supply` 级两种作用域

### Task 2: 抽出纯函数清空 Step2 冲突单元格

**Files**
- `frontend/src/lib/step2ConflictResolution.ts`
- `frontend/src/lib/step2ConflictResolution.test.ts`

- [ ] 新增纯函数，根据冲突列表把 `SKUData` 中对应单元格清空
- [ ] `sku` 级冲突清空整列，`supply` 级冲突只清空目标供位
- [ ] 不影响无冲突字段和 Step4 派生值重算

### Task 3: 接入 App Step2 自动获取链路

**Files**
- `frontend/src/App.tsx`

- [ ] Step2 自动获取时先生成完整自动值
- [ ] 基于完整自动值计算“初始冲突列表”
- [ ] 用纯函数清空冲突单元格后再 `setSkuData`
- [ ] UI 侧栏继续用“按当前值判定未解决”的冲突列表，确保点击候选后冲突卡消失

## TDD / 验收

- [ ] `step2CellConflicts.test.ts` 新增：
  - 预填值存在时，`respectCurrentValues=false` 仍能产出 swapped battery 两条冲突
  - 当前值等于某个候选值时冲突消失
  - 当前值非空但不等于候选值时冲突仍保留
- [ ] `step2ConflictResolution.test.ts` 新增：
  - `sku` 级冲突会清空同 SKU 所有 supply 的字段
  - `supply` 级冲突只清空目标 supply
- [ ] 运行：
  - `cd frontend && npm test -- step2CellConflicts.test.ts step2ConflictResolution.test.ts`
  - `cd frontend && npm run lint`
- [ ] 手工回归：
  - Step2 电池一供/二供对调时，左侧出现两条冲突
  - 对应表格单元格初始为空
  - 点击候选后仅写回目标单元格/整列，不误填其它供位
  - 未全部处理完前，“下一步”仍禁用
