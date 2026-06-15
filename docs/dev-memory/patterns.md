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

## Univer 单元格值规范化模式
- 任何进入 `Univer` 的单元格值都先做纯文本化，再做字段级约束。
- 历史加载、复制粘贴、编辑回写、snapshot 输出都走同一条规范化函数，避免对象值、`[object Object]` 和非法枚举值互相污染。
- 对枚举字段（如 `prod_loc`）优先采用“非法即清空”的策略，保留下拉和人工选择的单一权威路径。

## Playwright E2E 测试模式

### 何时用
- 验证 Univer canvas 渲染（jsdom 捕获不了 canvas 绘制）
- 验证首挂载时序（React effect + StrictMode + setTimeout）
- 端到端回归保护（Step1→2、历史加载等完整链路）

### 环境
- Chromium 路径：`/Users/shenmingjie/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- Playwright 包：`/Users/shenmingjie/.nvm/versions/node/v24.13.1/lib/node_modules/@playwright/cli/node_modules/playwright`
- 输出目录：`/Volumes/PortableSSD/tin/trial-production/output/trial-production/`

### 可复用脚本
| 脚本 | 覆盖路径 | 断言 |
|---|---|---|
| `frontend/scripts/e2e-step1-to-step2.cjs` | Step1 填表 → 点"开始自动解析" → Step2 | canvas >= 1 |
| `frontend/scripts/e2e-history-load-step5.cjs` | localStorage 注入 Step5 历史 → 加载 | canvas >= 1 |

### 脚本模板要点
```js
const { chromium } = require('/Users/shenmingjie/.nvm/versions/node/v24.13.1/lib/node_modules/@playwright/cli/node_modules/playwright');
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Users/shenmingjie/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
});
// 断言核心：canvas 数量 >= 1（Univer 渲染了 cell data）
const canvasCount = await page.locator('[data-testid="trial-production-sheet"] canvas').count();
```

### 注意
- `data-u-comp="workbench-container"` 不是有效的 Univer 属性，不要用它做断言
- dummy xlsx 只需 PK 头（4 bytes），足够触发文件上传，不需要有效 xlsx 内容
- Univer 渲染需要额外等待 2-3s（canvas 创建是异步的）
- 开发态会出 `Attempted to synchronously unmount a root` 警告，是 Vite HMR 特有，不影响生产

## React 19 + StrictMode 下 useEffect 行为

### 关键规则
- `useEffect` 依赖比较是 `Object.is`，依赖未变则不重跑
- `setUniverReady(true)` 在 `setTimeout(0)` 里调用，翻转后**不会**让依赖不含 `univerReady` 的 effect 重跑
- StrictMode 首次 mount：effect 1 跑 → cleanup → effect 1 再跑 → setTimeout 触发 setState → **不会**自动重跑 effect 2

### 实践结论
- 如果 effect 函数体第一行读了某个 state（`if (!x) return;`），该 state **必须**在 deps 数组里，否则 state 翻转后 effect 不会重跑
- 子智能体隔离复现脚本：`src/components/univerReady-strictmode-repro.test.tsx`（可参考写法）
