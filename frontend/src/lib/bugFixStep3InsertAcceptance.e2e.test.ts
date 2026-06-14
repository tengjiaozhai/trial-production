/**
 * Acceptance test: 修复 "Step 3 插入新 supply 丢失 anchor" bug 的全流程验收
 *
 * 场景（来自用户报告）：
 *   1. 从历史记录加载一个 Step 5 状态（多个 supplies，selectedSupplyKey=一供）
 *   2. 点"上一步"两次到 Step 3
 *   3. 在 Step 3 触发"新增插入一列"（Univer insert-col 命令，anchor=一供/B1）
 *   4. 点"下一步"两次切到 Step 5
 *   5. 验收：anchor（B1）必须保留，不能丢失
 *
 * 这个测试直接调用 lib 函数（不通过 UI），但在数据流上完全等价于用户操作。
 */
import { describe, expect, it } from 'vitest';
import { insertDynamicSupply } from './dynamicStructure';
import { projectSkuForStep, getNextUnusedSupplyKey } from './supplyProjection';
import type { SKUData } from '../types';

function makeInitialSku(): SKUData {
  return {
    id: 'sku_acceptance',
    stage: 'EVB',
    orderNo: 'ORD-001',
    project: 'AcceptanceTest',
    selectedSupplyKey: '一供',
    supplies: [
      {
        id: 's_b1',
        supplyKey: '一供',
        label: '一供',
        values: {
          project: 'AcceptanceTest',
          stage: 'EVB',
          color: 'Black',
          unit_id: 'U-001',
          mb_id: 'B1',
          band: 'B1/B3/B5',
          storage: '128G+4G',
          lcd: 'LCD-A',
          hw_eng: '8',
          order_no: 'ORD-001',
        },
      },
    ],
  };
}

describe('Bug acceptance: Step 3 insert → Step 5 anchor retention', () => {
  it('Scenario 1: load history with one supply, insert at Step 3, switch to Step 5 → anchor (B1) preserved', () => {
    // Step 1: 从历史加载 — skuData 有一个 supply "一供" (B1)
    const historySku = makeInitialSku();
    expect(historySku.supplies).toHaveLength(1);
    expect(historySku.selectedSupplyKey).toBe('一供');
    expect(historySku.supplies[0].values.mb_id).toBe('B1');

    // Step 2: 模拟"上一步"两次 → 进入 Step 3
    // 在 Step 3 下，projectSkuForStep 会按 selectedSupplyKey 投影（不变，因为只有一个 supply）
    const step3View = projectSkuForStep(historySku, 3);
    expect(step3View.supplies).toHaveLength(1);
    expect(step3View.supplies[0].id).toBe('s_b1');

    // Step 3: 模拟 Univer insert-col 命令在 Step 3 触发
    // 用户的 anchor = s_b1 (B1)
    // App.tsx:1077 Task 1 改动：currentStep >= 3 → afterSupplyId = anchor (插入到 anchor 之后)
    const step3AfterInsert = insertDynamicSupply({
      sku: step3View,
      afterSupplyId: 's_b1',
      currentStep: 3,
      newSupplyId: 's_aa1',
      newSupplyKey: getNextUnusedSupplyKey(step3View),
    });

    // 验收点 1：anchor 仍保持选中（关键 bug 修复点）
    expect(step3AfterInsert.selectedSupplyKey).toBe('一供');
    // 验收点 2：supplies 现在有 2 个
    expect(step3AfterInsert.supplies).toHaveLength(2);
    // 验收点 3：新 supply 在 anchor 之后（Task 1 改动后的位置语义）
    expect(step3AfterInsert.supplies[0].id).toBe('s_b1');
    expect(step3AfterInsert.supplies[1].id).toBe('s_aa1');

    // Step 4: 模拟"下一步"两次 → 进入 Step 4 / Step 5
    // Step 4 视图：projectSkuForStep 按 selectedSupplyKey='一供' 过滤
    const step4View = projectSkuForStep(step3AfterInsert, 4);
    expect(step4View.supplies).toHaveLength(1);
    // 关键验收：anchor B1 保留下来！
    expect(step4View.supplies[0].id).toBe('s_b1');
    expect(step4View.supplies[0].values.mb_id).toBe('B1');
    expect(step4View.selectedSupplyKey).toBe('一供');

    // Step 5 视图：与 Step 4 投影相同
    const step5View = projectSkuForStep(step3AfterInsert, 5);
    expect(step5View.supplies).toHaveLength(1);
    expect(step5View.supplies[0].id).toBe('s_b1');
    expect(step5View.supplies[0].values.mb_id).toBe('B1');
  });

  it('Scenario 2: full data roundtrip — Step 5 view (1 supply) → Step 3 view (1 supply) → insert (2 supplies) → Step 5 view (still 1, but anchor) → Excel export sees B1', () => {
    const historySku = makeInitialSku();

    // Step 5 → Step 3（"上一步"两次）
    const step3View = projectSkuForStep(historySku, 3);

    // Step 3 插入
    const afterInsert = insertDynamicSupply({
      sku: step3View,
      afterSupplyId: 's_b1',
      currentStep: 3,
      newSupplyId: 's_aa1',
      newSupplyKey: getNextUnusedSupplyKey(step3View),
    });

    // Step 3 → Step 5（"下一步"两次）
    const step5View = projectSkuForStep(afterInsert, 5);

    // 验收：Step 5 视图看到 B1（anchor），新列被"隐藏"在 Step 5 投影之外
    expect(step5View.supplies).toHaveLength(1);
    expect(step5View.supplies[0].values.mb_id).toBe('B1');
    expect(step5View.supplies[0].values.project).toBe('AcceptanceTest');

    // 验收：原始 skuData（afterInsert）保留了所有 supplies，user 切回 Step 3 仍可访问 aa1
    expect(afterInsert.supplies).toHaveLength(2);
    expect(afterInsert.supplies.map((s) => s.id)).toEqual(['s_b1', 's_aa1']);
  });

  it('Scenario 3: pre-fix bug is documented — selectedSupplyKey would be lost if insert still auto-switched', () => {
    // 文档化修复前行为：手动模拟"如果 selectedSupplyKey 仍然被自动切到新 supply"
    const historySku = makeInitialSku();
    const step3View = projectSkuForStep(historySku, 3);

    // 模拟"修复前"行为：selectedSupplyKey 强制切到新 supply
    const preFixSku: SKUData = {
      ...step3View,
      supplies: [
        step3View.supplies[0],
        {
          id: 's_aa1',
          supplyKey: '二供',
          label: '二供',
          values: { ...step3View.supplies[0].values },
        },
      ],
      // 修复前：自动切到新 supply
      selectedSupplyKey: '二供',
    };

    // Step 5 投影：只保留 selectedSupplyKey 对应的 supply
    const step5PreFix = projectSkuForStep(preFixSku, 5);
    expect(step5PreFix.supplies).toHaveLength(1);
    expect(step5PreFix.supplies[0].id).toBe('s_aa1');
    // 关键：B1 作为独立 supply 维度在 Step 5 视图里消失
    expect(step5PreFix.supplies.find((s) => s.id === 's_b1')).toBeUndefined();
    // 验收：修复后行为（Scenario 1）vs 修复前行为（这里）的核心差异
    // 修复前：Step 5 supplies[0] = s_aa1（anchor 消失）
    // 修复后：Step 5 supplies[0] = s_b1（anchor 保留）
  });
});
