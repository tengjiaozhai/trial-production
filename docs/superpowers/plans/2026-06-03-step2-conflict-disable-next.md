# 第二步冲突时禁用下一步按钮实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当第二步存在冲突时，禁用"下一步"按钮，防止用户在未解决冲突的情况下进入下一步

**Architecture:** 修改App.tsx中的disableNextToPreview变量，使其在第二步有冲突时也为true，并在按钮外层添加工具提示

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## 文件结构

- Modify: `src/App.tsx` - 修改禁用逻辑和按钮工具提示

## 任务分解

### Task 1: 修改禁用逻辑

**Files:**
- Modify: `src/App.tsx:848`

- [ ] **Step 1: 修改disableNextToPreview变量**

在`src/App.tsx`第848行，将：
```typescript
const disableNextToPreview = currentStep === 4 && isExportDisabled;
```
修改为：
```typescript
const disableNextToPreview = 
  (currentStep === 4 && isExportDisabled) || 
  (currentStep === 2 && step2Conflicts.length > 0);
```

- [ ] **Step 2: 验证修改**

检查`disableNextToPreview`变量是否正确定义，确保语法正确。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: disable next button when step2 has conflicts"
```

### Task 2: 添加工具提示

**Files:**
- Modify: `src/App.tsx:1309-1323`

- [ ] **Step 1: 修改按钮代码**

在`src/App.tsx`第1309-1323行，将：
```typescript
<button
  disabled={disableNextToPreview}
  onClick={() => {
    if (disableNextToPreview) return;
    setCurrentStep((currentStep + 1) as StepId);
  }}
  className={cn(
    "px-6 py-2 rounded font-bold text-[13px] transition-all flex items-center gap-2",
    disableNextToPreview
      ? "bg-[#DDE7F3] text-[#64748B] cursor-not-allowed"
      : "bg-[#06B6D4] text-white hover:bg-[#0891B2] active:scale-95"
  )}
>
  下一步: {currentStep === 2 ? '要素补全' : currentStep === 3 ? '规则引擎核验' : '导出预览'}
</button>
```
修改为：
```typescript
<div title={disableNextToPreview && currentStep === 2 ? '存在冲突，请先解决冲突' : undefined}>
  <button
    disabled={disableNextToPreview}
    onClick={() => {
      if (disableNextToPreview) return;
      setCurrentStep((currentStep + 1) as StepId);
    }}
    className={cn(
      "px-6 py-2 rounded font-bold text-[13px] transition-all flex items-center gap-2",
      disableNextToPreview
        ? "bg-[#DDE7F3] text-[#64748B] cursor-not-allowed"
        : "bg-[#06B6D4] text-white hover:bg-[#0891B2] active:scale-95"
    )}
  >
    下一步: {currentStep === 2 ? '要素补全' : currentStep === 3 ? '规则引擎核验' : '导出预览'}
  </button>
</div>
```

- [ ] **Step 2: 验证修改**

检查按钮代码是否正确修改，确保工具提示逻辑正确。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add tooltip for disabled next button"
```

### Task 3: 测试验证

**Files:**
- None (手动测试)

- [ ] **Step 1: 测试无冲突场景**

1. 启动应用：`npm run dev`
2. 进入第二步，确保没有PCBA冲突
3. 验证"下一步"按钮可点击

- [ ] **Step 2: 测试有冲突场景**

1. 进入第二步，确保有PCBA冲突（step2Conflicts.length > 0）
2. 验证"下一步"按钮禁用（灰色不可点击）
3. 鼠标悬停在按钮上，验证显示工具提示："存在冲突，请先解决冲突"

- [ ] **Step 3: 测试其他步骤**

1. 进入第三步或第四步
2. 验证"下一步"按钮行为不受影响

- [ ] **Step 4: 测试第四步禁用逻辑**

1. 进入第四步，确保有验证错误（isExportDisabled为true）
2. 验证"下一步"按钮禁用

- [ ] **Step 5: 最终Commit**

```bash
git add src/App.tsx
git commit -m "feat: complete step2 conflict disable next button feature"
```

## 测试场景

1. **无冲突场景**：第二步无冲突时，按钮应正常可点击
2. **有冲突场景**：第二步有冲突时，按钮应禁用并显示工具提示
3. **其他步骤**：其他步骤的按钮行为不应受影响
4. **第四步禁用**：第四步的原有禁用逻辑应保持不变