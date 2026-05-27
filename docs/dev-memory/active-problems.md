# Active Problems

## 2026-05-27 - Step2 快速冲突选项覆盖不一致
- 现状：`LCD` 冲突有“快速”候选按钮（`BOE`、`CSOT`），`频段` 和 `存储` 只有冲突占位提示，没有同类快速候选。
- 代码位置：`src/components/TrialProductionTable.tsx` 中快速候选逻辑只在 `field.id === 'lcd'` 时渲染。
- 影响：处理 `频段/存储` 冲突时只能手工输入，交互与 `LCD` 不一致。
- 建议后续动作：若产品希望一致体验，补齐 `band/storage` 的字段级快速候选渲染逻辑，并明确候选来源。
