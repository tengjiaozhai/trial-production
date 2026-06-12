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
- 新增列的业务含义固定为“新增供位”，不是新增 SKU，也不是普通备注列。
- 新增行的业务含义固定为“新增自定义手填字段”。
- 五供及以上使用自动中文序号供位，不弹窗让用户输入供位名。
- Univer workbook 仍然是投影层；保存、历史记录、导出、校验都继续读取业务状态。
