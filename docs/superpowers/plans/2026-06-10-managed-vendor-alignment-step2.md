# 关键物料与管控物料供应商对齐冲突实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Step 2 增加“关键物料表 vs 管控物料表”的供应商对齐校验。对齐范围覆盖关键物料表中 `mode: 'desc'` 的字段，支持管控物料表的 `一供-四供` 供应商解析、来源冲突提示、侧栏候选回填和定位。

**Architecture:** 保留现有 `keyMaterialTemplate` 和 `managedMaterialCore` 的解析职责，新加一个独立的供应商对齐层，专门负责：
- 把管控物料表的 `物料名称` 匹配到目标字段
- 聚合每个 `物料名称 + 供位` 下的供应商
- 对比关键物料与管控物料的 vendor
- 生成 Step 2 冲突 DTO 和 managed-only 供位扩列结果

**Execution Shape:** Task 1 先落地共享类型和对齐核心，因为它改变公共契约。Task 2 和 Task 3 在 Task 1 之后可以并行推进，分别负责侧栏/UI 和 `App.tsx` 数据流接线。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `frontend/src/lib/managedMaterialCore.ts` | 修改 | 增加 desc 字段的物料名称匹配结果 |
| `frontend/src/lib/managedMaterialSupplierAlignment.ts` | 新建 | 双源供应商对齐、冲突生成、managed-only 供位扩列 |
| `frontend/src/lib/step2CellConflicts.ts` | 修改 | 承载来源感知冲突候选 DTO |
| `frontend/src/components/Sidebar.tsx` | 修改 | 展示来源标签、候选按钮、冲突提示 |
| `frontend/src/App.tsx` | 修改 | 在 Step 2 自动获取与冲突计算中接入对齐层 |
| `frontend/src/lib/*.test.ts` | 修改/新增 | TDD 覆盖对齐、冲突、侧栏、App 数据流 |

---

## Task 1: 共享契约与对齐核心

**Files:**
- Modify: `frontend/src/lib/managedMaterialCore.ts`
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/lib/managedMaterialSupplierAlignment.ts`
- Create: `frontend/src/lib/managedMaterialSupplierAlignment.test.ts`

- [ ] **Step 1: 为 desc 字段匹配写失败测试**

验证 `battery / speaker / receiver / mic / motor / fingerprint / spk_fpc / sidekey_fpc / ir_fpc / lens / housing / battery_cover / sim_tray / side_key / aux_material / cooling` 能从管控物料表名称集合中匹配到对应物料名称。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm test -- managedMaterialCore.test.ts managedMaterialSupplierAlignment.test.ts 2>&1 | head -c 12000`

- [ ] **Step 3: 扩展管控物料匹配结果**

在 `ManagedMaterialCoreMatch` 中增加 desc 字段的名称映射结果，保持现有 static / emmc / ddr 映射不变。

- [ ] **Step 4: 实现对齐核心**

新增纯函数，输入：
- 关键物料 `optionsByField`
- 管控物料 `rows/materialNames`
- 当前 `pcbaOption`

输出：
- 关键/管控双源冲突候选
- managed-only `三供/四供` 供位的补充值
- 来源标签与写回值

- [ ] **Step 5: 重新运行测试并通过**

Run:
- `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm test -- managedMaterialCore.test.ts managedMaterialSupplierAlignment.test.ts 2>&1 | head -c 12000`
- `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000`

---

## Task 2: Step 2 冲突模型与侧栏

**Files:**
- Modify: `frontend/src/lib/step2CellConflicts.ts`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/Sidebar.test.tsx`
- Create/Modify: `frontend/src/lib/step2CellConflicts.test.ts`

- [ ] **Step 1: 为来源感知候选写失败测试**

覆盖以下行为：
- 关键物料候选与管控物料候选都能展示来源标签
- 管控物料同供位多个 vendor 全部暴露为候选
- 点击候选会把 `writeValue` 写回当前单元格
- 点击“定位”仍然跳转到正确单元格

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm test -- step2CellConflicts.test.ts Sidebar.test.tsx 2>&1 | head -c 12000`

- [ ] **Step 3: 替换冲突候选结构**

将 `Step2CellConflict.candidates` 从 `string[]` 改成来源感知 DTO 数组，不保留兼容分支。

- [ ] **Step 4: 调整侧栏渲染**

侧栏显示：
- 冲突标题
- `关键物料 / 管控物料` 来源标签
- 候选写回按钮
- 说明文案仍保留，但不再依赖裸字符串候选

- [ ] **Step 5: 复跑测试**

Run:
- `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm test -- step2CellConflicts.test.ts Sidebar.test.tsx 2>&1 | head -c 12000`
- `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000`

---

## Task 3: App 数据流接线

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/lib/step4SampleCalc.ts`
- Modify: `frontend/src/lib/step4SampleCalc.test.ts`
- Modify: `frontend/src/lib/trialProductionWorkbook.ts` if needed for final export alignment

- [ ] **Step 1: 为 App 流程写失败测试**

覆盖：
- Step 2 自动获取时会合并关键物料与管控物料的供应商结果
- 管控-only `三供/四供` 会自动扩列并落值
- vendor 冲突会清空单元格并生成冲突卡
- 历史记录加载后仍能重新生成同样的冲突状态

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm test -- step4SampleCalc.test.ts trialProductionWorkbook.test.ts 2>&1 | head -c 12000`

- [ ] **Step 3: 在 App 自动获取链路中接入对齐层**

保留现有关键物料生成逻辑，只在其后追加管控物料对齐、冲突生成和 managed-only 供位扩列。

- [ ] **Step 4: 接好历史加载与导出**

确保历史记录加载时能恢复新的冲突状态；导出仍沿用同一份 canonical 数据，不单独搞第二条兼容链。

- [ ] **Step 5: 完整验证**

Run:
- `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm test 2>&1 | head -c 12000`
- `cd frontend && /Users/shenmingjie/.nvm/versions/node/v24.13.1/bin/npm run lint 2>&1 | head -c 12000`

---

## Acceptance Criteria

- 关键物料与管控物料 vendor 一致时不报冲突
- vendor 不一致时单元格清空并在侧栏生成冲突卡
- 侧栏候选支持来源标签和一键回填
- 管控物料表新增 `三供/四供` 时会自动扩列并写入值
- 管控物料表同供位多 vendor 时全部暴露，不静默折叠
- 现有 Step 2 重复 PCBA 冲突、定位、回填行为不回退

---

## Assumptions

- 冲突比较以 vendor 为主，不把物料描述字符串作为主判定键
- 管控物料候选回填值统一拼成 `供位+供应商+物料名称`
- 新供位扩列是预期行为，不视为异常
- 不保留旧的 `string[]` 冲突候选兼容层
