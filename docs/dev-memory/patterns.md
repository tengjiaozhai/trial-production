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

### 表格 ABCDE 配色方案
表格采用 5 色循环配色方案 `COLOR_SCHEME`，用于区分不同的字段组：

#### Univer 表格样式（`src/components/TrialProductionSheet.tsx`）
```typescript
const COLOR_SCHEME = [
  { title: { bg: { rgb: '#EAF3FF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#F7FBFF' }, ht: 2, vt: 2, tb: 2 } }, // A: 浅蓝
  { title: { bg: { rgb: '#EAFBF7' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#F6FFFC' }, ht: 2, vt: 2, tb: 2 } }, // B: 浅青绿
  { title: { bg: { rgb: '#F3EEFF' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#FAF8FF' }, ht: 2, vt: 2, tb: 2 } }, // C: 浅紫
  { title: { bg: { rgb: '#FFF1E6' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#FFF8F3' }, ht: 2, vt: 2, tb: 2 } }, // D: 浅橙
  { title: { bg: { rgb: '#EAF8F0' }, ht: 2, vt: 2, tb: 2, bl: 1, fs: 14 }, body: { bg: { rgb: '#F6FCF8' }, ht: 2, vt: 2, tb: 2 } }, // E: 浅薄荷绿
];

const getStyleForGroup = (groupIndex: number | undefined, isTitle: boolean) => {
  const colorIndex = (groupIndex ?? 0) % COLOR_SCHEME.length;
  const block = COLOR_SCHEME[colorIndex];
  return isTitle ? block.title : block.body;
};
```

#### 配色说明
| 色块 | 标题背景 | 内容背景 | 配色名 |
|------|---------|---------|--------|
| A | `#EAF3FF` | `#F7FBFF` | 浅蓝 |
| B | `#EAFBF7` | `#F6FFFC` | 浅青绿 |
| C | `#F3EEFF` | `#FAF8FF` | 浅紫 |
| D | `#FFF1E6` | `#FFF8F3` | 浅橙 |
| E | `#EAF8F0` | `#F6FCF8` | 浅薄荷绿 |

#### 应用方式
在 `buildWorkbookSnapshot` 函数中，根据 `row.groupIndex` 从 `COLOR_SCHEME` 数组中循环取色（`groupIndex % 5`）：
- 组标题行（`kind === 'title'` 或 `kind === 'group'`）使用 `block.title` 样式
- 字段行（`kind === 'field'`）使用 `block.body` 样式
