# Field Visibility By Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据当前步骤（Step2/3/4）自动过滤显示字段，Step1 获取类字段始终显示，Auto 类字段在 Step3 隐藏，Manual 类字段在 Step2 隐藏。

**Architecture:** 在 `FieldDefinition` 接口添加 `fieldCategory` 属性标注字段类别，在 `buildTrialProductionSheetModel` 中按 `currentStep` 过滤 `activeFields`，模型层过滤后渲染层自动适配。

**Tech Stack:** TypeScript, Vitest, Univer Sheets

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/types.ts:38-44` | Modify | `FieldDefinition` 添加 `fieldCategory` 属性 |
| `frontend/src/constants.ts:18-126` | Modify | 每个字段标注 `fieldCategory` |
| `frontend/src/lib/univerTrialProductionSheet.ts:30-55` | Modify | 添加 `filterFieldsByStep` 并在模型构建时调用 |
| `frontend/src/lib/univerTrialProductionSheet.test.ts` | Modify | 添加字段过滤测试用例 |

---

## Task 1: 添加 `fieldCategory` 类型定义

**Files:**
- Modify: `frontend/src/types.ts:38-44`

- [ ] **Step 1: 在 `FieldDefinition` 接口添加 `fieldCategory` 属性**

```typescript
export interface FieldDefinition {
  id: string;
  label: string;
  group: string;
  behavior: FieldBehavior;
  fieldCategory?: 'step1' | 'auto' | 'manual';
  wait?: boolean;
}
```

- [ ] **Step 2: 运行类型检查**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend && npm run lint`
Expected: PASS（新增可选属性不影响现有代码）

- [ ] **Step 3: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
git add src/types.ts
git commit -m "feat: add fieldCategory to FieldDefinition"
```

---

## Task 2: 标注 `constants.ts` 中所有字段的 `fieldCategory`

**Files:**
- Modify: `frontend/src/constants.ts:18-126`

- [ ] **Step 1: 为所有字段添加 `fieldCategory` 标注**

按以下规则标注：
- **step1**: 基础信息、产品规格、生产配置、汇总统计中的计算字段
- **auto**: 电子物料、结构物料、核心元器件、样机需求
- **manual**: 包装工艺、辅料清单、结构层级清单、备料/良率

```typescript
export const FIELD_DEFS: FieldDefinition[] = [
  // 基础信息
  { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'stage', label: '试产阶段', group: '基础信息', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'supply_select', label: '一供/二供', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'prod_loc', label: '试产地点', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'order_no', label: '订单号', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'prod_order', label: '生产顺序', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'software', label: '软件', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'online_time', label: '上线时间', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'assembly_time', label: '组装时间', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },

  // 产品规格
  { id: 'color', label: '颜色', group: '产品规格', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'unit_id', label: '整机标识', group: '产品规格', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'mb_id', label: '主板标识', group: '产品规格', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'cal_file', label: '校准文件', group: '产品规格', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'band', label: '频段', group: '产品规格', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'storage', label: '存储', group: '产品规格', behavior: 'auto', fieldCategory: 'step1' },

  // 生产配置
  { id: 'pcba', label: 'PCBA', group: '生产配置', behavior: 'calc', fieldCategory: 'step1' },
  { id: 'sub_board_qty', label: '小板数量', group: '生产配置', behavior: 'calc', fieldCategory: 'step1' },
  { id: 'board_adj_qty', label: '调板数量', group: '生产配置', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'assembly_qty', label: '组装数量', group: '生产配置', behavior: 'calc', fieldCategory: 'step1' },

  // 电子物料
  { id: 'lcd', label: 'LCD', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'front_cam', label: '前CAM', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'main_cam', label: '主CAM', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'sub_cam', label: '副CAM', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'fingerprint', label: '指纹', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'battery', label: '电池', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'speaker', label: '喇叭', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'receiver', label: '听筒', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'mic', label: 'MIC', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'motor', label: '马达', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'spk_fpc', label: 'spk FPC', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'sidekey_fpc', label: 'Sidekey FPC', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'ir_fpc', label: 'IR FPC', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },

  // 结构物料
  { id: 'lens', label: '镜片', group: '结构物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'housing', label: '壳料', group: '结构物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'battery_cover', label: '电池盖', group: '结构物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'sim_tray', label: '卡托', group: '结构物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'side_key', label: '侧键', group: '结构物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'aux_material', label: '辅料', group: '结构物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'cooling', label: '散热', group: '结构物料', behavior: 'auto', fieldCategory: 'auto' },

  // 包装工艺
  { id: 'pkg_process', label: '包装流程', group: '包装工艺', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'copy_mold', label: '复制模互配', group: '包装工艺', behavior: 'manual', fieldCategory: 'manual' },

  // 辅料清单
  { id: 'underfill', label: '底填', group: '辅料清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'thermal_gel_mb', label: '主板导热凝胶', group: '辅料清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'usb_glue', label: 'USB点胶状态', group: '辅料清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'solder_paste', label: '锡膏', group: '辅料清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'thermal_gel_front', label: '面壳导热凝胶', group: '辅料清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'tp_hotmelt', label: 'TP热熔胶', group: '辅料清单', behavior: 'manual', fieldCategory: 'manual' },

  // 结构层级清单
  { id: 'ebom', label: 'EBOM（料号）', group: '结构层级清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'ebom_desc', label: 'EBOM（描述）', group: '结构层级清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'sub_bom', label: '小板BOM（料号）', group: '结构层级清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'sub_bom_desc', label: '小板BOM（描述）', group: '结构层级清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'lda', label: 'LDA组件', group: '结构层级清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'mbom', label: 'MBOM', group: '结构层级清单', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'pbom', label: 'PBOM', group: '结构层级清单', behavior: 'manual', fieldCategory: 'manual' },

  // 核心元器件
  { id: 'cpu', label: 'CPU', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'emmc', label: 'flash EMMC', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'ddr', label: 'flash DDR', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'pmu', label: '电源管理', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'tx', label: '无线发射', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'rf_transceiver', label: '射频收发器', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'nfc', label: 'NFC', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'pcb', label: 'PCB', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'sub_board', label: '小板', group: '核心元器件', behavior: 'auto', fieldCategory: 'auto' },

  // 客户样机需求
  { id: 'reliability', label: '可靠性（客户）', group: '客户样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'field_test', label: '场测样机', group: '客户样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'fan_sample', label: '粉丝样机', group: '客户样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'ce_cert', label: 'CE认证样机', group: '客户样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'customer_sample_req', label: '客户样机需求', group: '客户样机需求', behavior: 'calc', fieldCategory: 'auto' },

  // 内部样机需求
  { id: 'hw_eng', label: '硬件', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'hw_test', label: '硬测', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'sw_eng', label: '软件', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'sw_test', label: '软测', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'struct_eng', label: '结构', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'reliability_eng', label: '可靠性（内部）', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'pressure_test', label: '压测', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'image_eng', label: '影像', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'npm', label: 'NPM', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'ux', label: '体验', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'parts', label: '器件', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'pm', label: '产品', group: '内部样机需求', behavior: 'auto', fieldCategory: 'auto' },
  { id: 't_long_rd_total', label: '天珑研发样机总计', group: '内部样机需求', behavior: 'calc', fieldCategory: 'step1' },

  // 汇总统计
  { id: 'backup_unit', label: '备料样机', group: '汇总统计', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'total_qty', label: '总计', group: '汇总统计', behavior: 'calc', fieldCategory: 'step1' },
  { id: 'prod_yield', label: '生产良率', group: '汇总统计', behavior: 'manual', fieldCategory: 'manual' },
];
```

- [ ] **Step 2: 运行类型检查**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend && npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
git add src/constants.ts
git commit -m "feat: annotate all fields with fieldCategory"
```

---

## Task 3: 实现字段过滤逻辑

**Files:**
- Modify: `frontend/src/lib/univerTrialProductionSheet.ts:1-4` (imports), `36-55` (过滤调用)

- [ ] **Step 1: 添加 `filterFieldsByStep` 函数**

在 `univerTrialProductionSheet.ts` 文件顶部（`buildTrialProductionSheetModel` 之前）添加：

```typescript
/**
 * 根据当前步骤过滤字段：
 * - Step1 类字段：始终显示
 * - Auto 类字段：Step2 显示，Step3 隐藏
 * - Manual 类字段：Step2 隐藏，Step3 显示
 * - Step4/5：全部显示
 */
export function filterFieldsByStep(fields: FieldDefinition[], step: StepId): FieldDefinition[] {
  if (step === 4 || step === 5) return fields;
  return fields.filter((f) => {
    if (f.fieldCategory === 'auto') return step === 2;
    if (f.fieldCategory === 'manual') return step === 3;
    return true; // step1 和未标注的默认显示
  });
}
```

- [ ] **Step 2: 在 `buildTrialProductionSheetModel` 中调用过滤**

修改 `buildTrialProductionSheetModel` 函数，在 Step 5 分支之后、构建 columns 之前，添加过滤逻辑：

```typescript
export function buildTrialProductionSheetModel(args: {
  activeFields: FieldDefinition[];
  skuData: SKUData[];
  currentStep: StepId;
  step2Conflicts?: Step2CellConflict[];
  efuseConfigs?: Record<string, string>;
}): TrialProductionSheetModel {
  const { activeFields, skuData, currentStep, step2Conflicts, efuseConfigs } = args;

  // Step 5 uses the existing Step5TableModel
  if (currentStep === 5) {
    const step5Model = buildStep5TableModel({
      activeFields,
      skuData,
      efuseConfigs,
    });

    return {
      columns: step5Model.columns,
      rows: [],
      cellMap: {},
      conflictCellKeys: new Set(),
      readOnly: true,
      step5Model,
    };
  }

  // Filter fields by current step
  const visibleFields = filterFieldsByStep(activeFields, currentStep);

  // Build columns from skuData
  const columns = skuData.flatMap((sku) =>
    sku.supplies.map((supply) => ({
      skuId: sku.id,
      supplyId: supply.id,
      label: supply.label,
    }))
  );

  // Build rows grouped by field group
  const rows: SheetRow[] = [];
  const cellMap: Record<string, TrialProductionCellKey> = {};
  let rowIndex = 0;

  const groups = Array.from(new Set(visibleFields.map((f) => f.group)));
  // ... rest of the function uses visibleFields instead of activeFields
```

关键改动：将第 71 行和第 75 行的 `activeFields` 替换为 `visibleFields`。

- [ ] **Step 3: 运行类型检查**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
git add src/lib/univerTrialProductionSheet.ts
git commit -m "feat: implement filterFieldsByStep for step-based field visibility"
```

---

## Task 4: 添加字段过滤测试

**Files:**
- Modify: `frontend/src/lib/univerTrialProductionSheet.test.ts`

- [ ] **Step 1: 添加带 `fieldCategory` 的测试数据**

在测试文件中添加：

```typescript
const fieldsWithCategory: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'band', label: '频段', group: '产品规格', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'lcd', label: 'LCD', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'battery', label: '电池', group: '电子物料', behavior: 'auto', fieldCategory: 'auto' },
  { id: 'pkg_process', label: '包装流程', group: '包装工艺', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'ebom', label: 'EBOM（料号）', group: '结构层级清单', behavior: 'manual', fieldCategory: 'manual' },
];
```

- [ ] **Step 2: 添加 Step2 过滤测试**

```typescript
describe('filterFieldsByStep', () => {
  it('shows step1 + auto fields in step2, hides manual', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fieldsWithCategory,
      skuData: singleSku,
      currentStep: 2,
    });

    const fieldRows = model.rows.filter((r) => r.kind === 'field');
    const fieldIds = fieldRows.map((r) => r.fieldId);

    expect(fieldIds).toContain('project');
    expect(fieldIds).toContain('band');
    expect(fieldIds).toContain('lcd');
    expect(fieldIds).toContain('battery');
    expect(fieldIds).not.toContain('pkg_process');
    expect(fieldIds).not.toContain('ebom');
  });
```

- [ ] **Step 3: 添加 Step3 过滤测试**

```typescript
  it('shows step1 + manual fields in step3, hides auto', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fieldsWithCategory,
      skuData: singleSku,
      currentStep: 3,
    });

    const fieldRows = model.rows.filter((r) => r.kind === 'field');
    const fieldIds = fieldRows.map((r) => r.fieldId);

    expect(fieldIds).toContain('project');
    expect(fieldIds).toContain('band');
    expect(fieldIds).toContain('pkg_process');
    expect(fieldIds).toContain('ebom');
    expect(fieldIds).not.toContain('lcd');
    expect(fieldIds).not.toContain('battery');
  });
```

- [ ] **Step 4: 添加 Step4 全量显示测试**

```typescript  it('shows all fields in step4', () => {
    const model = buildTrialProductionSheetModel({
      activeFields: fieldsWithCategory,
      skuData: singleSku,
      currentStep: 4,
    });

    const fieldRows = model.rows.filter((r) => r.kind === 'field');
    const fieldIds = fieldRows.map((r) => r.fieldId);

    expect(fieldIds).toContain('project');
    expect(fieldIds).toContain('band');
    expect(fieldIds).toContain('lcd');
    expect(fieldIds).toContain('battery');
    expect(fieldIds).toContain('pkg_process');
    expect(fieldIds).toContain('ebom');
  });
```

- [ ] **Step 5: 添加未标注字段默认显示测试**

```typescript  it('shows fields without fieldCategory in all steps', () => {
    const fieldsWithoutCategory: FieldDefinition[] = [
      { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
      { id: 'lcd', label: 'LCD', group: '电子物料', behavior: 'auto' },
    ];

    const model = buildTrialProductionSheetModel({
      activeFields: fieldsWithoutCategory,
      skuData: singleSku,
      currentStep: 3,
    });

    const fieldRows = model.rows.filter((r) => r.kind === 'field');
    const fieldIds = fieldRows.map((r) => r.fieldId);

    expect(fieldIds).toContain('project');
    expect(fieldIds).toContain('lcd');
  });
});
```

- [ ] **Step 6: 运行测试**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend && npm test -- src/lib/univerTrialProductionSheet.test.ts`
Expected: 全部通过

- [ ] **Step 7: Commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
git add src/lib/univerTrialProductionSheet.test.ts
git commit -m "test: add field visibility by step tests"
```

---

## Task 5: 全量验证

- [ ] **Step 1: 运行全量测试**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend && npm test`
Expected: 所有测试通过（已知的 11 个预存失败不受影响）

- [ ] **Step 2: 运行类型检查**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend && npm run lint`
Expected: PASS

- [ ] **Step 3: 运行 dev server 手动验证**

Run: `cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend && npm run dev`
验证：
- Step2：应显示 step1 + auto 字段（约 70 个），manual 字段（包装工艺、辅料清单等）不可见
- Step3：应显示 step1 + manual 字段（约 39 个），auto 字段（电子物料、结构物料等）不可见
- Step4：全部 87 个字段可见

- [ ] **Step 4: Final commit**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production/frontend
git add -A
git commit -m "feat: implement step-based field visibility"
```
