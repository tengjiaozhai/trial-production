# 基本信息表头合并为单行实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把"基本信息"顶部表的双层表头(单独的"基本信息" colSpan 行 + 单独的"方案名称" + SortableHeader 行)合并为单行,移除冗余的"方案名称"静态标签,保留所有 SortableHeader 交互能力。

**Architecture:** `TrialProductionTable.tsx` 的顶部 `<thead>` 由两行变一行:
- 第一个 sticky `<th>` 仍为空(对齐 body 的行号列)
- 第二个 sticky `<th>`(覆盖 field label 列)用文字 "基本信息" 替代原 colSpan 大格
- 后续直接渲染 N 个 `<SortableHeader>`,与当前 SortableHeader props 完全一致
- 末尾保留一个空 `<th>`

`viewport.basicInfoColSpan` 字段不再被本组件使用,但保留在 `TableViewportMetrics` 接口与测试里以避免连带改动(后续可清理)。`SortableContext`(body rows)、`SortableRow`、`data-step2-cell-id` 等定位属性均不受影响。

**Tech Stack:** React 19, TypeScript, Vitest, @dnd-kit

**Assumptions:**
- SortableHeader 行为与 props 不变,仅位置从第二行挪到第一行。
- 用户接受 step 1 / step 5 下 SortableHeader 现在会"显式出现"(step 1: 可编辑 input + resize handle;step 5: 只读文本),这本身是改进。
- 顶部表 `BASIC_INFO_BLOCK_HEIGHT_PX = 200px` 不变,少一行后 body 多约 40px 视觉空间。

---

## File Structure

- Modify: `src/components/TrialProductionTable.tsx` - `<thead>` 从两行结构改为单行结构(905–944)。

## 验收标准

- 顶部表表头只有一行:空 sticky-left-0 th + "基本信息" sticky-left-[32px] th + N × SortableHeader + 尾空 th。
- 静态 "方案名称" 文字彻底从 DOM 移除(可用 `data-testid` 或文本查询确认)。
- `data-testid="sku-header-block"` / `"sku-select"` / `"column-insert-after"` 在 step 2-4 下全部仍可定位。
- step 1 / step 5 下 SortableHeader 正常渲染(input 模式 / 文本模式)。
- `npm test` 全绿,`npm run lint`(tsc --noEmit)无错。

## 实施步骤

- [ ] 在 `TrialProductionTable.tsx` 905–944,删除原双行 `<thead>`,按方案 A 写为单行结构。
- [ ] `npm test` 通过(覆盖 TrialProductionTable、Sidebar 既有测试)。
- [ ] `npm run lint` 通过。
- [ ] (可选)`npm run build` 验证产物。

## 不在本计划范围

- 移除 `viewport.basicInfoColSpan` 字段与相关测试 —— 留作后续清理。
- 调整 `BASIC_INFO_BLOCK_HEIGHT_PX` 常量 —— 不动。
- 改 SortableHeader 内部逻辑 —— 不动。
