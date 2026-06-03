# 第二步冲突时禁用下一步按钮设计文档

## 背景

当前系统中，第二步（自动获取）存在PCBA重复冲突检测逻辑。当配置表中某个PCBA标识出现多次时，系统会生成冲突记录并在侧边栏显示。然而，用户仍然可以点击"下一步"按钮进入第三步，这可能导致数据不一致。

## 需求

当第二步存在冲突时，禁用"下一步"按钮，防止用户在未解决冲突的情况下进入下一步。

### 具体要求：
1. 当 `step2Conflicts.length > 0` 且 `currentStep === 2` 时，禁用"下一步"按钮
2. 按钮应显示为灰色不可点击状态
3. 鼠标悬停时显示工具提示："存在冲突，请先解决冲突"
4. 仅禁用按钮，不显示额外提示信息

## 设计方案

### 方案选择

经过分析，推荐**方案1：修改disableNextToPreview变量**，因为：
- 最简单直接
- 符合现有代码结构
- 最小化改动

### 实现细节

#### 1. 修改禁用逻辑

在 `src/App.tsx` 中修改 `disableNextToPreview` 变量：

```typescript
// 当前代码 (第848行)
const disableNextToPreview = currentStep === 4 && isExportDisabled;

// 修改为
const disableNextToPreview = 
  (currentStep === 4 && isExportDisabled) || 
  (currentStep === 2 && step2Conflicts.length > 0);
```

#### 2. 添加工具提示

在"下一步"按钮外层包裹一个 `div`，使用 `title` 属性添加工具提示：

```typescript
// 当前按钮代码 (第1309-1323行)
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

// 修改为
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

## 影响分析

### 正面影响：
1. 防止用户在冲突未解决时进入下一步
2. 提高数据一致性
3. 用户体验更清晰

### 潜在风险：
1. 无负面影响，仅增加验证逻辑

## 测试场景

1. **无冲突场景**：第二步无冲突时，按钮应正常可点击
2. **有冲突场景**：第二步有冲突时，按钮应禁用并显示工具提示
3. **其他步骤**：其他步骤的按钮行为不应受影响
4. **第四步禁用**：第四步的原有禁用逻辑应保持不变

## 实现步骤

1. 修改 `src/App.tsx` 第848行的 `disableNextToPreview` 变量
2. 修改 `src/App.tsx` 第1309-1323行的按钮代码，添加工具提示
3. 测试各种场景确保功能正常