# Univer 动态新增行列持久化设计

## Summary
当前问题不是 Univer 插入 API 失效，而是插入只发生在 workbook 视图层；下一次失焦、步骤切换或 snapshot 重建时，表格会重新由 `activeFields` 和 `skuData` 生成，所以新增行列没有业务状态承接就会消失。官方 Row/Column Facade API 支持插入行列，但不会自动写回应用业务模型：[Univer Row & Column Facade API](https://docs.univer.ai/guides/sheets/features/core/row-col#facade-api)。

本次采用你确认的方案：保留 Univer 原生插入菜单，监听 `sheet.command.insert-row` / `sheet.command.insert-col`，把新增行列转成业务状态变更后持久化。

## Key Changes
- 在 [TrialProductionSheet.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/frontend/src/components/TrialProductionSheet.tsx) 增加结构命令监听：
  - 监听 `api.Event.CommandExecuted`。
  - 只处理 `sheet.command.insert-row` 和 `sheet.command.insert-col`。
  - 根据当前 sheet model 把插入行映射为 `activeFields` 新增自定义手填字段。
  - 根据当前 sheet model 把插入列映射为指定 SKU 新增供位。
  - 不把 Univer 临时空行/空列当作权威数据保存，权威数据仍然是 React 状态。
- 扩展业务状态接口：
  - `insert-row` 生成 `FieldDefinition`，默认 `label = 自定义字段N`，`behavior = manual`，`fieldCategory = manual`，`group` 继承插入点所在分组。
  - 允许编辑新增行的标签列，回写到 `activeFields[*].label`。
  - `insert-col` 生成新的 `SkuSupply`，继承同 SKU 的基础字段，普通字段为空。
- 扩展供位模型：
  - 将当前固定 `SupplyTag` 从“一供-四供”扩展为字符串供位 key。
  - 保留内置排序：`一供 / 二供 / 三供 / 四供 / 五供 / 六供 ...`。
  - 新增供位默认取当前 SKU 中未使用的下一个中文序号供位。
  - Step2 新增供位后，Step3 的 `一供/二供` 下拉自动包含新增供位。
- Step 范围按你的选择支持全步骤：
  - Step2：新增供位立即显示为新列，进入 Step3 后出现在供位下拉。
  - Step3/Step4/Step5：新增供位后同步设置该 SKU 的 `selectedSupplyKey` 为新供位，避免投影后“新增列又消失”。
  - Step5 保持在 Step5，不自动回退；结构变更后重建 Step5 表格并重跑校验/导出禁用状态。
- 明确不在本轮实现删除/移动行列：
  - 拦截或忽略 `remove-row/remove-col/move-row/move-col`，避免用户误以为删除/移动也会保存。
  - 后续如要支持删除/移动，应单独设计业务语义。

## Public Interfaces
- 新增 `onInsertFieldAfter(anchorFieldId, count, stepContext)`。
- 新增 `onInsertSupplyAfter(skuId, anchorSupplyId, count, stepContext)`。
- 新增 `onUpdateFieldLabel(fieldId, label)`。
- 新增供位工具：
  - `nextSupplyKey(existingKeys): string`
  - `compareSupplyKey(a, b): number`
  - `listSupplyKeys(sku)` 改为支持五供及以上。
- `buildTrialProductionSheetModel` 和 Step5 model 需要暴露足够的 row/column anchor 信息，供命令监听从 Univer 坐标映射回业务字段与 SKU 供位。

## Test Plan
- 单元测试：
  - 插入字段：在任意字段后新增行，`activeFields` 增加自定义字段并继承分组。
  - 编辑新增字段标签：标签列编辑会更新 `activeFields.label`。
  - 插入供位：SKU 从一供/二供新增到三供，`sku.supplies` 增加新 supply。
  - 超过四供：自动生成五供、六供，并按供位序排序。
  - Step2->Step3：Step2 新增供位后，Step3 `supply_select` 下拉包含新增供位。
  - Step3/4/5：新增供位会同步成为当前选中供位，投影后不消失。
- 行为测试：
  - 在 Step2 原生插入列，失焦/切步/保存历史后新供位仍存在。
  - 在 Step3 原生插入行，填写新字段值后切到 Step4/Step5 仍保留。
  - Step5 插入列后仍停留 Step5，表格重建后能看到新供位，导出前状态被重新计算。
- 手工验收：
  - 打开历史记录进入 Step2，右键/原生菜单新增列，切到 Step3，下拉出现新供位。
  - 在 Step3 新增行并修改行名，填写值，切到 Step4 再返回 Step3，行名和值不丢。
  - 在 Step5 新增列，表格不白屏，新供位不因重建消失。
  - 保存历史后重新加载，同样的新增行列仍存在。

## Assumptions
- 新增列的业务含义固定为"新增供位"，不是新增 SKU，也不是普通备注列。
- 新增行的业务含义固定为"新增自定义手填字段"。
- 五供及以上使用自动中文序号供位，不弹窗让用户输入供位名。
- Univer workbook 仍然是投影层；保存、历史记录、导出、校验都继续读取业务状态。

## 落地状态(滚动更新)

> 该表与代码同步,每次有 commit 改动本计划相关区域都要更新。

### 已落地(2026-06-12 merge `codex/supply-key-generalization` → `dev-smj`)

| Plan 节点 | 落地位置 | 落地命名 | 备注 |
|---|---|---|---|
| `nextSupplyKey(existingKeys)` | `frontend/src/lib/supplyKeys.ts:118` | `getNextUnusedSupplyKeyFromKeys(keys)` | 同时在 `supplyProjection.ts:31` 暴露 `getNextUnusedSupplyKey(sku)` 便捷版本 |
| `compareSupplyKey(a, b)` | `frontend/src/lib/supplyKeys.ts:61` | `compareSupplyKeys(a, b)` | 函数名带复数 |
| `listSupplyKeys` 支持五供+ | `frontend/src/lib/supplyProjection.ts:26` | 同名,改用 `sortSupplyKeys` | 移除原硬编码 `SUPPLY_ORDER` |
| `SupplyTag` 扩展为字符串 | `frontend/src/types.ts:23` | `'' \| \`${string}供\`` 模板字面量 | 运行时仍由 `buildSupplyKey` 集中生成 |

### 待落地(下一轮)

| Plan 节点 | 阻塞因素 | 解除阻塞的下一步 |
|---|---|---|
| ~~`onInsertFieldAfter(anchorFieldId, count, stepContext)`~~ | **已被 Plan B 替代** | 见 `已落地` 表的 `handleAppendField` |
| ~~`onInsertSupplyAfter(skuId, anchorSupplyId, count, stepContext)`~~ | **已被 Plan B 替代** | 见 `已落地` 表的 `handleAppendSupplyToAllSkus` |
| `onUpdateFieldLabel(fieldId, label)` | `dynamicStructure.ts:47` 已有 `updateCustomFieldLabel`,可直接复用,需在 sheet 监听链里挂回调 | 监听链落地后接入(目前由 `handleFieldLabelChange` 走 onFieldLabelChange prop) |
| `TrialProductionSheet.tsx` 监听 `CommandExecuted` | **降级为不必须**:Plan B 用应用侧按钮接管,不再依赖原生菜单命令 | 保留监听代码作 fallback,后续 Univer 升级如发现原生菜单命令 id 稳定可考虑重新启用 |
| `buildTrialProductionSheetModel` 暴露 row/col anchor | 当前已有 `resolveStructureRowInsertPayload` / `resolveStructureColumnInsertPayload`,**Plan B 不再需要**(按钮走无 anchor 路径) | 维持现状 |
| 真实菜单 → React 状态回写 E2E | **被 Plan B 替代** | 应用侧按钮已用 vitest 行为测试覆盖(`TrialProductionSheet.behavior.test.tsx` "structure toolbar" describe) |

### Plan B 落地(2026-06-13)

| Plan B 节点 | 落地位置 | 备注 |
|---|---|---|
| `handleAppendField()` | `App.tsx` `handleAppendField` | 取 `activeFields` 最后一个,用 `buildNextCustomFieldLabel` + `createInsertedField` + `insertFieldAfter` 追加 |
| `handleAppendSupplyToAllSkus()` | `App.tsx` `handleAppendSupplyToAllSkus` | `setSkuData` map 所有 sku,每个调 `insertDynamicSupply` + `getNextUnusedSupplyKey` |
| 顶部工具栏 `+ 新增字段` / `+ 新增供位` | `TrialProductionSheet.tsx` render | 用 `onAppendField` / `onAppendSupplyToAllSkus` prop 门控,只在传入时渲染 |
| 诊断开关 `DIAG_COMMAND_LOG` | **已删除** | Plan B 完成后不再需要,连带 16 行注释一起清理 |
| 不动 Univer 原生右键菜单 | (本轮不做) | 后续可作为独立任务,用 FUniver facade 关掉 contextmenu 的 insert 项 |

## 命名漂移(与 Plan 原文对照)

Plan 草稿里的接口名是设计意图,实际代码命名更明确,文档同步过来:

- `nextSupplyKey(existingKeys): string` → `getNextUnusedSupplyKeyFromKeys(keys: Iterable<SupplyTag>): SupplyTag` (`supplyKeys.ts:118`)。`get*` 前缀更明确,输入从 `string[]` 放宽到 `Iterable<SupplyTag>`,签名更通用。
- `nextSupplyKey(sku): string` → `getNextUnusedSupplyKey(sku: SKUData): SupplyTag` (`supplyProjection.ts:31`)。`sku` 版本作为便捷封装,内部转调 keys 版本。
- `compareSupplyKey(a, b): number` → `compareSupplyKeys(a, b): number` (`supplyKeys.ts:61`)。复数更准确(操作集合元素)。

> 不调整 Plan 草稿作为历史快照,但本节"落地状态"表是权威对照。

## 风险与未决问题

### R1: `SupplyTag` 模板字面量类型护栏过宽
`'' | \`${string}供\`` 接受任何以"供"结尾的字符串。目前所有 `supplyKey` 创建都走 `buildSupplyKey(ordinal)`,运行时安全;但 type-level 没有拦截 `sku.supplyKey = '客户供'` 这类直接赋值。
**缓解**:后续可在 `supplyKeys.ts` 引入 brand type `type SupplyKey = string & { readonly __brand: 'SupplyKey' }`,只接受 `buildSupplyKey` / `''` 作为构造点;普通字段继续用 `SupplyTag`。

### R2: 原生菜单真实 command id 未确认
Plan 假设监听 `sheet.command.insert-row` / `sheet.command.insert-col` 就能捕获原生右键菜单。Findings 表明真实 runtime 路径可能不同(如 `sheet.command.insert-row-before` / `sheet.command.insert-multi-rows-above` 等子命令)。`STRUCTURE_ROW_INSERT_COMMAND_IDS` 已经收集了 5 个候选 id,但未经验证。
**缓解**:见下方"诊断 step"。

### R3: `parseSupplyOrdinal` / `buildSupplyKey` 双向性无测试
`formatChineseNumeral` 处理"十"省略"一"的特殊规则只对 10-19 生效,但 `parseChineseNumeral` 对"十"的处理也用了 `current || 1` 兜底,两边的边界行为没有 roundtrip 测试覆盖。
**缓解**:补 `supplyKeys.test.ts` roundtrip 用例,`for n in [1, 200]: parseSupplyOrdinal(buildSupplyKey(n)) === n`。

### R4: `normalizeSelectedSupplyKey` 在 dynamic key 上的稳定性无测试
当前测试只覆盖到 `六供`,未覆盖 `十供` / `二十供` / `一百零一供` 等极端情况;`projectSkuForStep` 内部用 `find` 找 `selectedSupplyKey`,理论上对任意 `SupplyTag` 都 work,但缺断言。
**缓解**:在 `supplyProjection.test.ts` 补 `normalizeSelectedSupplyKey` 和 `projectSkuForStep` 对 `十供` / `二十供` 的端到端测试。

### Open Questions
- **Q1**:原生菜单真的走 `ICommandService.onCommandExecuted` 吗?还是走 facade 层的 `FUniver` 事件?需诊断 step 确认。
- **Q2**:如果原生菜单的 command id 不在 facade 文档里(可能用底层 op 如 `sheet.operation.set-selections`),Plan 的"保留原生菜单"前提是否仍成立?若不成立,需降级为"应用侧 `+ 新增字段` / `+ 新增供位` 按钮 + 我们自己写 Univer 渲染"。
- **Q3**:`selectedSupplyKey` 在 dynamic key(> 一供~四供)上,`Step3` 的下拉里 `value` 属性是否还能被原生 form 正确序列化?(DOM 层面 `option.value="六供"` 是合法字符串,理论上 OK,需手验。)

## 下一轮:诊断 step(进入业务接入前必做)

最小验证链路,在 `TrialProductionSheet.tsx` 临时挂一个**全量 command 日志**,目标是把"原生右键菜单触发的真实 command id 列表"摸清楚。

**做法**:
1. 在 `TrialProductionSheet.tsx` 当前 `useEffect` 结构监听块(Line 700)起手处加一段 `if (DIAG_COMMAND_LOG) commandService.onCommandExecuted(c => console.log('[diag:cmd]', c.id, c.params))`,用 `DIAG_COMMAND_LOG` 常量门控(`const DIAG_COMMAND_LOG = false;` 默认关,改 `true` 启用)。
2. 真实浏览器打开,Step2/3/4/5 各用一次原生右键"插入行/插入列"。
3. DevTools 复制所有 `[diag:cmd]` 日志,搜出与 insert 相关的 id。
4. 用真实 id 调整 `STRUCTURE_ROW_INSERT_COMMAND_IDS` / `STRUCTURE_COLUMN_INSERT_COMMAND_IDS`。
5. 验证通过后,把 `DIAG_COMMAND_LOG` 改回 `false`,删除诊断代码。

**风险**:诊断日志会打印所有 command,正常操作时也会刷屏,务必在捕获后立即关掉。

## 滚动更新日志

- **2026-06-12**:Plan 草稿完成
- **2026-06-12 (5e2781a)**:merge `codex/supply-key-generalization`,`SupplyTag` 模板字面量 + `supplyKeys.ts` 基础工具落地。本表回填已落地项。
- **2026-06-12 (本次编辑)**:补"命名漂移"、"风险"、"诊断 step"、R1-R4。
- **2026-06-13 (Plan B 落地)**:应用侧 `+ 新增字段` / `+ 新增供位` 按钮 + `handleAppendField` / `handleAppendSupplyToAllSkus` 业务回调 + 删除 `DIAG_COMMAND_LOG` 诊断开关 + 新增 4 个 vitest 行为测试覆盖按钮渲染/点击/无回调时不渲染。`结构桥接` 路径降级为 fallback,业务主路径完全由应用侧按钮承担。
