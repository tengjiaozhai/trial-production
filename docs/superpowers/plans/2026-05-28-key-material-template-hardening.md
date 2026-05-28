# 关键物料模板字段兜底强化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `电池、喇叭、听筒、MIC、马达、spk FPC、Sidekey FPC、IR FPC、镜片、壳料、电池盖、卡托、侧键、辅料、散热、PCB、小板` 在关键物料模板上传后稳定自动获取，不再因为大模型超时、返回值不规范或轻微命名差异而整体留空。

**Architecture:** 复用核心器件修复思路，但不改业务出口。`src/lib/keyMaterialTemplate.ts` 继续负责“解析模板 -> 匹配分类2 -> 组装选项”，只是把匹配阶段从“单次 LLM 成功才有值”升级为“LLM 主匹配 + 缺失字段重试 + 本地关键词兜底”。输出结构仍然是 `category2ByField` 和 `optionsByField`，调用方 [App.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/App.tsx:419) 不改协议。

**Tech Stack:** TypeScript, xlsx, fetch, Vitest

---

## 现状判断

- 当前解析入口在 [keyMaterialTemplate.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/keyMaterialTemplate.ts:26)，只认“文件名命中 + 第一张 sheet 名命中 + 第一行就是表头”。
- 当前大模型匹配在 [keyMaterialTemplate.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/keyMaterialTemplate.ts:96)，只有一次请求，且只接受“LLM 返回值与候选分类2完全一致”。
- 当前组装逻辑在 [keyMaterialTemplate.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/keyMaterialTemplate.ts:156)，一旦 `category2ByField[fieldId]` 为空，字段就整项留空。
- 这和核心器件修复前是同一类问题：不是取值规则错了，而是“匹配阶段太脆弱”，上游一空，下游全空。

## 修改范围

- Modify: [src/lib/keyMaterialTemplate.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/keyMaterialTemplate.ts)
- Modify: [src/lib/keyMaterialTemplate.test.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/keyMaterialTemplate.test.ts)
- Verify only: [src/App.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/App.tsx:419)
- Reuse as-is: [src/config/keyMaterialLLM.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/config/keyMaterialLLM.ts)

## 核心修改点

### Task 1: 先补失败测试，锁定这次要修的真实问题

**Files:**
- Modify: `src/lib/keyMaterialTemplate.test.ts`

- [ ] **Step 1: 为 LLM 返回值不完全一致的情况补失败测试**

用例要覆盖这些场景：
- LLM 返回带引号、空格、换行的分类2值。
- LLM 返回“候选值的子串/近似值”，例如候选是 `喇叭BOX`，返回 `喇叭`。
- LLM 只返回部分字段，剩余字段为空。

期望：
- 旧实现失败。
- 新实现能把值清洗并映射回真实候选分类2。

- [ ] **Step 2: 为 LLM 失败时的本地兜底补失败测试**

模拟 `fetch` 抛错或超时，验证这些字段仍能从 `category2List` 本地命中：
- `电池`
- `喇叭`
- `听筒`
- `MIC`
- `马达`
- `spk FPC`
- `Sidekey FPC`
- `IR FPC`
- `镜片`
- `壳料`
- `电池盖`
- `卡托`
- `侧键`
- `辅料`
- `散热`
- `PCB`
- `小板`

期望：
- `matchCategory2WithLLM()` 不再整包返回 `{}`。

- [ ] **Step 3: 为表头轻微脏数据补失败测试**

补一个模板用例，把首行列名写成：
- `分类2 `
- `物料描述\n`
- ` 主二供`

期望：
- 解析阶段仍能拿到正确列索引，不因空格/换行直接 `return null`。

### Task 2: 强化模板解析，不再死卡“首行完全干净”

**Files:**
- Modify: `src/lib/keyMaterialTemplate.ts`

- [ ] **Step 1: 增加表头归一化函数**

在解析阶段增加类似核心器件的 `normalizeHeader()`：
- 去空格
- 去换行
- 保留中文正文

然后把 `分类2 / 物料描述 / 品牌 / 供应商 / 主二供` 的索引查找改成基于归一化结果。

- [ ] **Step 2: 保持“只解析第一张业务 sheet”的边界，不引入多路径**

这次不要照搬核心器件的“多 sheet 扫描”整套逻辑。关键物料模板的业务前提已经明确是第一张 sheet，所以这里只做表头容错，不做 sheet 策略扩展，避免引入多入口。

### Task 3: 把 LLM 调用从一次性命中改成三层收敛

**Files:**
- Modify: `src/lib/keyMaterialTemplate.ts`

- [ ] **Step 1: 抽出与核心器件一致的请求辅助函数**

参考核心器件实现，把以下逻辑抽成私有辅助函数：
- `requestJsonObjectFromLLM(prompt)`
- `pickAllowedName(value, allowed)`

要求：
- 超时仍走 `KEY_MATERIAL_LLM_CONFIG.timeoutMs`
- 非 200、JSON 解析失败、Abort 都统一返回空对象
- 清洗掉引号、首尾空白
- 支持“返回值包含候选”或“候选包含返回值”的容错匹配

- [ ] **Step 2: 给目标字段补提示词 hint，减少模型误判**

把 [keyMaterialTemplate.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/keyMaterialTemplate.ts:76) 的目标表扩成“显示名 + hint”结构，例如：
- `speaker`: `喇叭（扬声器/BOX/SPK）`
- `receiver`: `听筒（Receiver/Earpiece）`
- `mic`: `MIC（麦克风）`
- `motor`: `马达（振子/Motor）`
- `pcb`: `PCB（主板）`
- `sub_board`: `小板（Sub Board）`

目的：
- 不改最终字段 ID。
- 只增强 prompt 的可判别性。

- [ ] **Step 3: 增加“只针对缺失字段”的第二次重试**

第一次请求跑完整字段集合。
如果返回后仍有缺失字段，只对缺失字段再发一次更聚焦的 prompt。

要求：
- 第二次 prompt 只携带缺失字段。
- 不要重跑已命中的字段。
- 第二次结果只增量覆盖空位。

- [ ] **Step 4: 增加本地 fallbackMatchCategory2()**

当两轮 LLM 后仍有缺失字段，按字段写死本地关键词兜底，从 `category2List` 中找第一个最合理候选。例如：
- `battery`: `/电池/`
- `speaker`: `/喇叭|扬声器|BOX|SPK/i`
- `receiver`: `/听筒|receiver|earpiece/i`
- `mic`: `/^MIC$|麦克风/i`
- `motor`: `/马达|振子|motor/i`
- `spk_fpc`: `/spk.*fpc|喇叭.*fpc/i`
- `sidekey_fpc`: `/sidekey.*fpc|侧键.*fpc/i`
- `ir_fpc`: `/ir.*fpc/i`
- `lens`: `/镜片|lens/i`
- `housing`: `/壳料|housing|后壳|中框/i`
- `battery_cover`: `/电池盖|battery.*cover|后盖/i`
- `sim_tray`: `/卡托|sim.*tray/i`
- `side_key`: `/侧键|side.*key/i`
- `aux_material`: `/辅料/i`
- `cooling`: `/散热|导热|石墨|vc/i`
- `pcb`: `/^PCB$|主板/i`
- `sub_board`: `/小板|sub.*board/i`

要求：
- 只兜底当前这一批字段。
- 只从 `category2List` 里选，不造新值。
- 仍然返回真实候选字符串。

### Task 4: 保持现有取值规则，不碰业务拼接格式

**Files:**
- Modify: `src/lib/keyMaterialTemplate.ts`

- [ ] **Step 1: 明确 `buildOptionsByField()` 不改规则，只吃更稳定的上游映射**

保留现有分支：
- `battery ~ cooling` 继续使用 `主二供 + 供应商 + 物料描述`
- `pcb / sub_board` 继续只取 `品牌`

这一步只确认不要误改 [keyMaterialTemplate.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/keyMaterialTemplate.ts:173) 到 [keyMaterialTemplate.ts](/Users/shenmingjie/tinno/trial-production/trial-production/src/lib/keyMaterialTemplate.ts:190) 的输出格式。

- [ ] **Step 2: 补一个端到端用例，验证选项组装没有被兜底逻辑破坏**

至少覆盖：
- 一个 `desc` 字段有一供/二供两行。
- 一个 `brand` 字段只有一行。

期望：
- `optionsByField.battery` 是两个小选项。
- `optionsByField.pcb` 只有品牌值，不夹带 `主二供` 和 `物料描述`。

### Task 5: 回归上传链路与 UI 状态

**Files:**
- Verify: `src/App.tsx`

- [ ] **Step 1: 确认调用链不变**

上传时仍然走：
1. [App.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/App.tsx:419) `parseKeyMaterialTemplate(parsed.category2List)`
2. [App.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/App.tsx:420) `matchCategory2WithLLM(...)`
3. [App.tsx](/Users/shenmingjie/tinno/trial-production/trial-production/src/App.tsx:421) `buildOptionsByField(...)`

要求：
- 不改 `projectInfo.keyMaterialTemplate` 的结构。
- 不新增第二套 key material 状态。

- [ ] **Step 2: 浏览器手工验证**

使用现有 4 个上传文件，观察：
- 上传阶段 loading 会停留到关键物料匹配完成。
- Step1 结束后，“点此开始解析”才放开。
- Step2 中这 17 个字段不再整体空白。

## 注意点

- 只把“匹配阶段”做强，不要把 `keyMaterialTemplate` 复制成第二套 `managedMaterialKeyV2` 之类的路径。
- 不要为了兜底去修改 `SplitFieldOption` 结构；这次不是渲染协议问题。
- 本地 fallback 只能选现有 `category2List` 中的值，不能自己拼一个“看起来像”的分类2。
- `PCB` 和 `小板` 仍然走 `brand` 输出，不能套用 `供应商 + 物料描述` 规则。
- 不要把核心器件的 `emmc/ddr` 容量逻辑抄进来，这批字段没有容量维度。
- 不要为了“更稳”引入第三次、第四次 LLM 请求。两次足够，剩下交给本地规则。
- 任何新增 helper 都放在 `src/lib/keyMaterialTemplate.ts` 内部，先不要抽公共 util；当前只有这一处使用，抽早了只会加复杂度。
- 测试要优先覆盖“LLM 不可用”和“返回值不规范”，这才是这次空值问题的根因候选。

## 最小验证命令

- [ ] `npm run test -- src/lib/keyMaterialTemplate.test.ts`
- [ ] `npm run lint`

## 完成标准

- 上传关键物料模板后，即使 LLM 超时或只返回部分字段，这 17 个字段也不会整批留空。
- `category2ByField` 中已命中的字段必须来自真实候选 `category2List`。
- `optionsByField` 的拼接格式与当前业务规则完全一致。
