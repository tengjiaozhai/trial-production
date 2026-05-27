# BOM 描述字段拆分实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 EBOM 和小板 BOM 各拆分成两行（料号 + 描述），使用户可以分别输入 BOM 料号和描述信息

**Architecture:** 在 constants.ts 中添加两个新字段 `ebom_desc` 和 `sub_bom_desc`，更新步骤过滤逻辑和侧边栏提示

**Tech Stack:** React 19 + TypeScript + Tailwind CSS

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/constants.ts` | Modify | 添加 `ebom_desc` 和 `sub_bom_desc` 字段定义 |
| `src/components/TrialProductionTable.tsx` | Modify | 更新 step3Ids 过滤列表 |
| `src/components/Sidebar.tsx` | Modify | 更新侧边栏提示文本 |

---

### Task 1: 添加 BOM 描述字段定义

**Files:**
- Modify: `src/constants.ts:84-89`

- [ ] **Step 1: 在 BOM 信息组中添加两个新字段**

打开 `src/constants.ts`，将第 84-89 行替换为：

```typescript
// BOM信息
{ id: 'ebom', label: 'EBOM', group: 'BOM信息', behavior: 'manual' },
{ id: 'ebom_desc', label: 'EBOM（描述）', group: 'BOM信息', behavior: 'manual' },
{ id: 'sub_bom', label: '小板BOM', group: 'BOM信息', behavior: 'manual' },
{ id: 'sub_bom_desc', label: '小板BOM（描述）', group: 'BOM信息', behavior: 'manual' },
{ id: 'lda', label: 'LDA组件', group: 'BOM信息', behavior: 'manual' },
{ id: 'mbom', label: 'MBOM', group: 'BOM信息', behavior: 'manual' },
{ id: 'pbom', label: 'PBOM', group: 'BOM信息', behavior: 'manual' },
```

- [ ] **Step 2: 验证字段添加成功**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production && npm run typecheck 2>&1 | head -20
```

预期: 无类型错误

- [ ] **Step 3: 提交更改**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production && git add src/constants.ts && git commit -m "feat: add ebom_desc and sub_bom_desc fields to BOM info"
```

---

### Task 2: 更新步骤 3 过滤逻辑

**Files:**
- Modify: `src/components/TrialProductionTable.tsx:434-441`

- [ ] **Step 1: 更新 step3Ids 数组**

打开 `src/components/TrialProductionTable.tsx`，将第 434-441 行的 `step3Ids` 数组修改为：

```typescript
if (currentStep === 3) {
  const step3Ids = [
    'project', 'stage', 'order_no', 'prod_order', 'board_adj_qty', 'backup_unit', 'prod_yield', 'test_yield',
    'software', 'online_time', 'assembly_time', 'prod_loc', 'color', 'unit_id', 'mb_id', 'cal_file',
    'pkg_process', 'copy_mold', 'underfill', 'thermal_gel_mb', 'usb_glue', 'solder_paste', 'thermal_gel_front', 'tp_hotmelt',
    'ebom', 'ebom_desc', 'sub_bom', 'sub_bom_desc', 'lda', 'mbom', 'pbom'
  ];
  return fields.filter(f => step3Ids.includes(f.id));
}
```

- [ ] **Step 2: 验证过滤逻辑**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production && npm run typecheck 2>&1 | head -20
```

预期: 无类型错误

- [ ] **Step 3: 提交更改**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production && git add src/components/TrialProductionTable.tsx && git commit -m "feat: add ebom_desc and sub_bom_desc to step3 visible fields"
```

---

### Task 3: 更新侧边栏提示文本

**Files:**
- Modify: `src/components/Sidebar.tsx:122-126`

- [ ] **Step 1: 更新侧边栏分组提示**

打开 `src/components/Sidebar.tsx`，将第 122-126 行的数组修改为：

```tsx
{currentStep === 3 && (
  <div className="space-y-6">
    <h3 className="text-sm font-black text-[#0f2e4a] flex items-center gap-2">
      <AlertCircle size={18} className="text-[#0f2e4a]" /> 待完善要素
    </h3>
    <p className="text-[13px] text-slate-500 font-medium leading-relaxed italic opacity-80">系统检测到以下关键要素配置不全，请在右侧表格中进行手动补充：</p>
    
    <div className="space-y-3">
      {[
        { title: '基础业务信息', items: ['订单号', '生产顺序', '试产地点'] },
        { title: '关键交付属性', items: ['软件版本', '上线时间', '颜色/整机标识'] },
        { title: '工艺辅料与BOM', items: ['锡膏', '导热凝胶', 'EBOM/小板BOM（料号+描述）', 'MBOM/PBOM'] }
      ].map((group, i) => (
        <div key={i} className="bg-white p-4 rounded border border-slate-200 space-y-3 hover:border-[#00897b] transition-all">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-[#00897b] rounded-full" />
            <span className="text-[13px] font-black text-slate-800">{group.title}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.items.map(it => (
              <span key={it} className="px-3 py-1 bg-slate-50 text-[12px] font-bold text-slate-500 border border-slate-100 rounded transition-all">
                {it}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: 验证侧边栏更新**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production && npm run typecheck 2>&1 | head -20
```

预期: 无类型错误

- [ ] **Step 3: 提交更改**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production && git add src/components/Sidebar.tsx && git commit -m "feat: update sidebar to show BOM desc fields in step3"
```

---

### Task 4: 验证整体功能

- [ ] **Step 1: 运行开发服务器**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production && npm run dev
```

- [ ] **Step 2: 测试步骤 3 显示**

1. 打开浏览器访问 http://localhost:5173
2. 完成步骤 1 和步骤 2
3. 进入步骤 3
4. 验证表格中显示以下字段：
   - EBOM（料号）
   - EBOM（描述）
   - 小板BOM（料号）
   - 小板BOM（描述）
5. 验证可以分别编辑每个字段

- [ ] **Step 3: 验证侧边栏提示**

确认侧边栏显示"EBOM/小板BOM（料号+描述）"

- [ ] **Step 4: 提交最终更改（如有）**

```bash
cd /Users/shenmingjie/tinno/trial-production/trial-production && git add . && git commit -m "feat: complete BOM desc field implementation"
```

---

## 变更总结

| 变更 | 文件 | 行号 |
|------|------|------|
| 添加字段定义 | `src/constants.ts` | 84-91 |
| 更新步骤过滤 | `src/components/TrialProductionTable.tsx` | 434-441 |
| 更新侧边栏 | `src/components/Sidebar.tsx` | 122-126 |

**新增字段:**
- `ebom_desc`: EBOM（描述）
- `sub_bom_desc`: 小板BOM（描述）

**数据结构影响:**
- `SKUData.supplies[].values` 中将新增两个 key: `'ebom_desc'` 和 `'sub_bom_desc'`
- 类型为 `Record<string, string>`，无需修改类型定义

---

## 执行选项

**Plan complete and saved to `docs/superpowers/plans/2026-05-27-bom-desc-fields.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
