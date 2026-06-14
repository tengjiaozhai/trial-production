/**
 * Acceptance test: 修复 "Step 3 在多 SKU 列中新增列 → Step 4 右侧列丢失" 验收
 *
 * 场景（用户描述）：
 *   1. Step 3 视图里至少有两列（2 个 SKU，每个 selectedSupplyKey 对应一个 supply）
 *   2. 在两列中新增一列（Univer insert-col 命令，anchor 在第一个 SKU）
 *   3. 点击"下一步"到 Step 4
 *   4. 验收：新增列的右边列（第二个 SKU）是否丢失
 */
import { describe, expect, it } from 'vitest';
import { insertDynamicSupply } from './dynamicStructure';
import { projectSkuForStep, getNextUnusedSupplyKey } from './supplyProjection';
import type { SKUData } from '../types';

function makeTwoSkuData(): SKUData[] {
  return [
    {
      id: 'sku_left', stage: 'EVB', orderNo: 'ORD-L', project: 'TwoSkuTest', selectedSupplyKey: '一供',
      supplies: [{
        id: 's_left', supplyKey: '一供', label: '一供',
        values: { project: 'TwoSkuTest', stage: 'EVB', color: 'Black', mb_id: 'B1', band: 'B1', storage: '4+128' },
      }],
    },
    {
      id: 'sku_right', stage: 'EVB', orderNo: 'ORD-R', project: 'TwoSkuTest', selectedSupplyKey: '一供',
      supplies: [{
        id: 's_right', supplyKey: '一供', label: '一供',
        values: { project: 'TwoSkuTest', stage: 'EVB', color: 'White', mb_id: 'B2', band: 'B2', storage: '4+256' },
      }],
    },
  ];
}

describe('Bug acceptance: 2-SKU Step 3 insert → Step 4 right column retention', () => {
  it('Scenario 1: 2 SKU Step 3 view, insert at first SKU, switch to Step 4 → right SKU supply preserved', () => {
    // Step 1: 加载历史
    const skuData = makeTwoSkuData();
    expect(skuData).toHaveLength(2);

    // Step 2: Step 3 视图
    const step3View = projectSkusForStep(skuData, 3);
    expect(step3View).toHaveLength(2);
    expect(step3View[0].supplies).toHaveLength(1);  // selectedSupplyKey only
    expect(step3View[1].supplies).toHaveLength(1);

    // Step 3: 在第一个 SKU (sku_left) 后插入新 supply
    // 模拟 Univer insert-col, position=after, anchor=sku_left 的 s_left
    const step3AfterInsert = step3View.map((sku) => {
      if (sku.id !== 'sku_left') return sku;
      return insertDynamicSupply({
        sku,
        afterSupplyId: 's_left',
        currentStep: 3,
        newSupplyId: 's_left_new',
        newSupplyKey: getNextUnusedSupplyKey(sku),
      });
    });

    // 验收点 1：anchor (sku_left.s_left) selectedSupplyKey 保持
    expect(step3AfterInsert[0].selectedSupplyKey).toBe('一供');
    // 验收点 2：sku_left supplies 数量 = 2（新 supply 已插入）
    expect(step3AfterInsert[0].supplies).toHaveLength(2);
    // 验收点 3：sku_right 完全不变（不动其他 SKU）
    expect(step3AfterInsert[1].id).toBe('sku_right');
    expect(step3AfterInsert[1].supplies).toHaveLength(1);
    expect(step3AfterInsert[1].supplies[0].id).toBe('s_right');
    expect(step3AfterInsert[1].supplies[0].values.mb_id).toBe('B2');

    // Step 4: 切到 Step 4 投影
    const step4View = projectSkusForStep(step3AfterInsert, 4);

    // 验收点 4：Step 4 视图每个 SKU 仍能看到 1 个 supply（selectedSupplyKey）
    expect(step4View).toHaveLength(2);
    expect(step4View[0].supplies).toHaveLength(1);
    expect(step4View[0].supplies[0].id).toBe('s_left');  // sku_left 看到 anchor (B1)
    expect(step4View[0].supplies[0].values.mb_id).toBe('B1');
    expect(step4View[1].supplies).toHaveLength(1);
    expect(step4View[1].supplies[0].id).toBe('s_right');  // sku_right 不变 (B2)
    expect(step4View[1].supplies[0].values.mb_id).toBe('B2');
  });

  it('Scenario 2: 2 SKU Step 3 view, insert at second SKU (anchor=right), switch to Step 4 → left SKU supply preserved', () => {
    const skuData = makeTwoSkuData();
    const step3View = projectSkusForStep(skuData, 3);

    // 在第二个 SKU (sku_right) 后插入
    const step3AfterInsert = step3View.map((sku) => {
      if (sku.id !== 'sku_right') return sku;
      return insertDynamicSupply({
        sku,
        afterSupplyId: 's_right',
        currentStep: 3,
        newSupplyId: 's_right_new',
        newSupplyKey: getNextUnusedSupplyKey(sku),
      });
    });

    // 验收：sku_left 完全不变
    expect(step3AfterInsert[0].supplies[0].id).toBe('s_left');
    expect(step3AfterInsert[0].supplies[0].values.mb_id).toBe('B1');
    // 验收：sku_right 现在有 2 个 supply
    expect(step3AfterInsert[1].supplies).toHaveLength(2);
    expect(step3AfterInsert[1].selectedSupplyKey).toBe('一供');

    // Step 4 投影
    const step4View = projectSkusForStep(step3AfterInsert, 4);
    expect(step4View[0].supplies[0].id).toBe('s_left');
    expect(step4View[0].supplies[0].values.mb_id).toBe('B1');  // 左侧 SKU 保留
    expect(step4View[1].supplies[0].id).toBe('s_right');  // 右侧 SKU 仍看到 anchor
    expect(step4View[1].supplies[0].values.mb_id).toBe('B2');
  });

  it('Scenario 3: insert 3 supplies into same SKU at Step 3, switch to Step 4 → all original data preserved', () => {
    // 验证单 SKU 多次插入 + Step 4 投影后，selectedSupplyKey 对应的 supply 保留
    const skuData: SKUData[] = [
      {
        id: 'sku_a', stage: 'EVB', orderNo: '', project: 'Multi', selectedSupplyKey: '一供',
        supplies: [
          { id: 'a1', supplyKey: '一供', label: '一供', values: { project: 'Multi', mb_id: 'A1' } },
          { id: 'a2', supplyKey: '二供', label: '二供', values: { project: 'Multi', mb_id: 'A2' } },
        ],
      },
    ];

    // Step 3 视图：a1 (selectedSupplyKey)
    const step3View = projectSkuForStep(skuData[0], 3);
    expect(step3View.supplies).toHaveLength(1);
    expect(step3View.supplies[0].id).toBe('a1');

    // 在 Step 3 视图上插入新 supply (anchor=a1, 插入到 a1 之后)
    const step3AfterInsert = insertDynamicSupply({
      sku: step3View,
      afterSupplyId: 'a1',
      currentStep: 3,
      newSupplyId: 'a3',
      newSupplyKey: '三供',
    });

    // 验收：a1 保持 selectedSupplyKey，supplies = [a1, a3]
    expect(step3AfterInsert.selectedSupplyKey).toBe('一供');
    expect(step3AfterInsert.supplies).toHaveLength(2);
    expect(step3AfterInsert.supplies[0].id).toBe('a1');
    expect(step3AfterInsert.supplies[1].id).toBe('a3');

    // Step 4 投影：a1 保留
    const step4View = projectSkuForStep(step3AfterInsert, 4);
    expect(step4View.supplies[0].id).toBe('a1');
    expect(step4View.supplies[0].values.mb_id).toBe('A1');
  });
});

function projectSkusForStep(skus: SKUData[], step: number): SKUData[] {
  return skus.map((sku) => projectSkuForStep(sku, step));
}
