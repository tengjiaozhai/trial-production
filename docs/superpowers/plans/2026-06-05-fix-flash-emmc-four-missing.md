# 修复 Flash EMMC 四供丢失

## Summary
把当前 split-supply 的权威模型从“最多三供”扩到“最多四供”，并去掉管控物料核心器件构建时对供应行的三条截断。目标结果是：用用户提供的两份 Excel 时，`B1 / 128GB` 必须展示 4 个供应列，且 Step 3/4/5 都能保留 `四供`。

## Key Changes
- **供应类型与顺序**
  - 将 `SupplyTag` 扩为 `一供 | 二供 | 三供 | 四供 | ''`。
  - 统一供应顺序为 `一供 -> 二供 -> 三供 -> 四供`，替换掉现有各处只到三供的硬编码。
- **管控物料核心器件链路**
  - 在 `managedMaterialCore.ts` 中让 `toSupplyTag` 识别 `四供`。
  - `buildManagedMaterialCoreFieldOptions` 不再 `.slice(0, 3)`，而是按供应顺序返回该物料名下的全部供应行。
  - 保持现有 LLM / 本地 size 匹配逻辑不变；问题不在匹配物料名，而在匹配后的供应行被截断。
- **供应列推导与投影**
  - 更新 `deriveSupplyColumnsFromFieldOptions`，让它能从 `fieldOptions` 正确推导出 `四供` 列。
  - 更新 `listSupplyKeys` / `selectedSupplyKey` 相关投影逻辑，确保 Step 3 的供应选择下拉框包含 `四供`，Step 4/5 只投影所选供应时也能处理 `四供`。
- **UI 文案**
  - 把表格里的 `一供/二供` 文案改成中性名称，比如 `供应` 或 `供应选择`，避免四供出现后文案仍写死两供。

## Test Plan
- 在 `managedMaterialCore.test.ts` 增加四供用例：`128GB EMMC` 四条供应行应完整产出，且包含 `14201690四供...`。
- 在 `step4SampleCalc.test.ts` 增加 `四供` 列推导断言，验证供应列顺序为 `一供/二供/三供/四供`。
- 在 `supplyProjection.test.ts` 增加 `四供` 选择与投影断言。
- 若改了供应行文案，同步更新 `step5TableModel.test.ts` 或相关表格测试。
- 用真实文件做一次最小回归：`../infinix  X6728_X6728B配置表_V1.4_20250619.xlsx` + `../X6728传音管控物料表_V3.5-2025-10-10.xlsx`，确认 `B1` 显示四供，第四列值来自 `14201690`。

## Assumptions
- 本次范围明确收敛到支持 `四供`；不额外泛化到 `五供+`。
- 不改动与本次问题无关的模板解析逻辑，除非编译或联动测试证明必须一起改。
- 现有 Vitest 运行被本地 Rollup 可选依赖问题阻塞；实现后应先修复依赖环境，再跑针对性测试命令。
