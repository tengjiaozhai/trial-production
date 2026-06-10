# Patterns

## 解析多层表头模板时的列定位模式
- 对关键字段列不要只做"首次命中"，先收集候选，再基于数据区有效值密度选择最终列。
- 对标题类文本使用精确匹配，避免把"说明标题"误当表头。
- 当原始单元格包含业务修饰词（如"128GB 一供"）时，进入主流程前先做最小规范化（如提取数字并标准化为 `4+128`）。

## Step2 冲突判定的阅读要点
- 当前 Step2 冲突逻辑以"字段值是否为空"为准，不做来源级置信度区分。
- 因此上游解析缺值会被直接放大为冲突；定位此类问题应先查数据提取链路，再查渲染层。

## 配色方案

### 背景配色
- **主背景色**: `#f6f9ff`
- **渐变效果**:
  - 左上蓝色光晕: `radial-gradient(circle at 8% 10%, rgba(37, 99, 235, 0.16), transparent 28%)`
  - 右上青色光晕: `radial-gradient(circle at 92% 6%, rgba(6, 182, 212, 0.18), transparent 30%)`
  - 主渐变: `linear-gradient(135deg, #eef6ff 0%, #f9fbff 48%, #edf7f4 100%)`

### 表格 AB 配色方案
表格采用 ABAB 交替配色方案，用于区分不同的字段组：

#### CSS 变量定义（`src/index.css`）
```css
:root {
  --block-a-title: #EAF3FF;
  --block-a-body: #F7FBFF;
  --block-a-accent: #2F6BDE;
  
  --block-b-title: #EAFBF7;
  --block-b-body: #F6FFFC;
  --block-b-accent: #1D8F6A;
}
```

#### Univer 表格样式（`src/components/TrialProductionSheet.tsx`）
```typescript
// ABAB color scheme
const BLOCK_A = {
  title: { bg: { rgb: '#EAF3FF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 },
  body: { bg: { rgb: '#F7FBFF' }, ht: 2, vt: 2, tb: 2 },
};
const BLOCK_B = {
  title: { bg: { rgb: '#EAFBF7' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 },
  body: { bg: { rgb: '#F6FFFC' }, ht: 2, vt: 2, tb: 2 },
};

const getStyleForGroup = (groupIndex: number | undefined, isTitle: boolean) => {
  const block = (groupIndex ?? 0) % 2 === 0 ? BLOCK_A : BLOCK_B;
  return isTitle ? block.title : block.body;
};
```

#### 配色说明
- **BLOCK_A**（偶数组，groupIndex % 2 === 0）:
  - 标题行: 浅蓝色背景 `#EAF3FF`，加粗，字号 14
  - 内容行: 极浅蓝色背景 `#F7FBFF`
  - 强调色: 蓝色 `#2F6BDE`

- **BLOCK_B**（奇数组，groupIndex % 2 === 1）:
  - 标题行: 浅绿色背景 `#EAFBF7`，加粗，字号 14
  - 内容行: 极浅绿色背景 `#F6FFFC`
  - 强调色: 绿色 `#1D8F6A`

#### 应用方式
在 `buildWorkbookSnapshot` 函数中，根据 `row.groupIndex` 的奇偶性选择对应的配色方案：
- 组标题行（`kind === 'title'` 或 `kind === 'group'`）使用 `block.title` 样式
- 字段行（`kind === 'field'`）使用 `block.body` 样式
