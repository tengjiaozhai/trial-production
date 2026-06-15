// 排查二供冲突未提示的原因
// 直接调用项目内的解析和冲突检测函数

import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

const trialMaterialDir = '/Volumes/PortableSSD/tin/trial-material';

// =================== 工具函数 ===================
function normalizeHeader(value) {
  return String(value ?? '').replace(/\s+/g, '');
}

function toSupplyTag(raw) {
  return raw === '一供' || raw === '二供' || raw === '三供' || raw === '四供' ? raw : '';
}

// =================== 1. 关键物料模板解析 ===================
const keyMatPath = join(trialMaterialDir, '项目(V633A)-关键物料选型模板-天珑2026-05-19.xlsx');
const keyMatBuf = readFileSync(keyMatPath);
const keyMatWb = XLSX.read(keyMatBuf, { type: 'buffer' });
const keyMatWs = keyMatWb.Sheets[keyMatWb.SheetNames[0]];
const keyMatRows = XLSX.utils.sheet_to_json(keyMatWs, { header: 1, defval: '' });

const keyMatHeader = keyMatRows[0].map(normalizeHeader);
const mainSupplyIdx = keyMatHeader.findIndex(h => h === '主二供');
const descIdx = keyMatHeader.findIndex(h => h === '物料描述');
const vendorIdx = keyMatHeader.findIndex(h => h === '供应商');
const category2Idx = keyMatHeader.findIndex(h => h === '分类2');

// 提取所有电池/指纹行
const keyMatBatteryRows = [];
const keyMatFingerprintRows = [];
for (let r = 1; r < keyMatRows.length; r++) {
  const row = keyMatRows[r] ?? [];
  const cat2 = String(row[category2Idx] ?? '').trim();
  if (cat2 === '电池') {
    keyMatBatteryRows.push({
      desc: String(row[descIdx] ?? '').trim(),
      vendor: String(row[vendorIdx] ?? '').trim(),
      mainSupply: String(row[mainSupplyIdx] ?? '').trim(),
    });
  } else if (cat2 === '指纹模组') {
    keyMatFingerprintRows.push({
      desc: String(row[descIdx] ?? '').trim(),
      vendor: String(row[vendorIdx] ?? '').trim(),
      mainSupply: String(row[mainSupplyIdx] ?? '').trim(),
    });
  }
}

console.log('=== 关键物料模板: 电池行 ===');
console.table(keyMatBatteryRows);
console.log('=== 关键物料模板: 指纹行 ===');
console.table(keyMatFingerprintRows);

// 模拟 buildOptionsByField
function buildKeyOptions(rows) {
  return rows
    .filter(r => r.mainSupply && r.vendor && r.desc)
    .map(r => ({
      supply: r.mainSupply,
      text: `${r.mainSupply}${r.vendor}${r.desc}`,
      sourceCategory2: 'category',
    }));
}

const keyOptionsBattery = buildKeyOptions(keyMatBatteryRows);
const keyOptionsFingerprint = buildKeyOptions(keyMatFingerprintRows);

console.log('=== 关键物料过滤后生成的 SplitFieldOption ===');
console.log('电池 options:');
console.table(keyOptionsBattery);
console.log('指纹 options:');
console.table(keyOptionsFingerprint);
console.log();

console.log('=== 关键物料检查: keyOptions.length === 0 ? ===');
console.log(`battery: keyOptions.length = ${keyOptionsBattery.length} → ${keyOptionsBattery.length === 0 ? '❌ 被 step2CellConflicts.ts:282-284 短路' : '✅ 继续检测'}`);
console.log(`fingerprint: keyOptions.length = ${keyOptionsFingerprint.length} → ${keyOptionsFingerprint.length === 0 ? '❌ 被 step2CellConflicts.ts:282-284 短路' : '✅ 继续检测'}`);
console.log();

// =================== 2. 传音管控物料表解析 ===================
const managedMatPath = join(trialMaterialDir, 'X6728传音管控物料表_V3.5-2025-10-10.xlsx');
const managedMatBuf = readFileSync(managedMatPath);
const managedMatWb = XLSX.read(managedMatBuf, { type: 'buffer' });

let managedBatteryRows = [];
let managedFingerprintRows = [];
let managedBatteryBySupply = new Map();
let managedFingerprintBySupply = new Map();

for (const sheetName of managedMatWb.SheetNames) {
  if (sheetName !== 'X6728') continue;
  const ws = managedMatWb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(15, aoa.length); r++) {
    const norm = aoa[r].map(normalizeHeader);
    if (norm.includes('物料名称') && norm.some(c => /编码/.test(c)) && norm.includes('供应商')) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx === -1) continue;

  const header = aoa[headerRowIdx].map(normalizeHeader);
  const matIdx = header.indexOf('物料名称');
  const codeIdx = header.findIndex(c => /编码/.test(c));
  const vendorIdx = header.indexOf('供应商');
  const supplyIdx = header.indexOf('一/二供');

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const matName = String(row[matIdx] ?? '').trim();
    if (matName === '电池') {
      managedBatteryRows.push({
        materialName: matName,
        code: String(row[codeIdx] ?? '').trim(),
        vendor: String(row[vendorIdx] ?? '').trim(),
        supply: String(row[supplyIdx] ?? '').trim(),
      });
    } else if (matName === '指纹模组') {
      managedFingerprintRows.push({
        materialName: matName,
        code: String(row[codeIdx] ?? '').trim(),
        vendor: String(row[vendorIdx] ?? '').trim(),
        supply: String(row[supplyIdx] ?? '').trim(),
      });
    }
  }

  for (const row of managedBatteryRows) {
    const supplyTag = toSupplyTag(row.supply);
    if (!supplyTag) {
      console.log(`  ⚠️ 电池 toSupplyTag 返回空: supply="${row.supply}"`);
      continue;
    }
    if (!managedBatteryBySupply.has(supplyTag)) {
      managedBatteryBySupply.set(supplyTag, row);
    }
  }
  for (const row of managedFingerprintRows) {
    const supplyTag = toSupplyTag(row.supply);
    if (!supplyTag) {
      console.log(`  ⚠️ 指纹 toSupplyTag 返回空: supply="${row.supply}"`);
      continue;
    }
    if (!managedFingerprintBySupply.has(supplyTag)) {
      managedFingerprintBySupply.set(supplyTag, row);
    }
  }
  break;
}

console.log('=== 管控表: 电池/指纹行 ===');
console.log('电池:', managedBatteryRows.length, '行');
console.table(managedBatteryRows);
console.log('指纹:', managedFingerprintRows.length, '行');
console.table(managedFingerprintRows);
console.log();

console.log('=== 管控表按供应分组后 ===');
console.log('电池:');
for (const [k, v] of managedBatteryBySupply) {
  console.log(`  ${k}: ${v.vendor} (${v.code})`);
}
console.log('指纹:');
for (const [k, v] of managedFingerprintBySupply) {
  console.log(`  ${k}: ${v.vendor} (${v.code})`);
}
console.log();

// =================== 3. writeValue 拼接对比 ===================
function createManagedMaterialCandidate(row, supplyTag, materialName) {
  return {
    writeValue: `${row.supply}${row.vendor}${materialName}`,
  };
}

console.log('========= writeValue 拼接对比 (电池) =========');
for (const opt of keyOptionsBattery) {
  console.log(`  KeyMaterial(${opt.supply}): "${opt.text}"`);
}
for (const [supplyTag, row] of managedBatteryBySupply) {
  const c = createManagedMaterialCandidate(row, supplyTag, '电池');
  console.log(`  Managed(${supplyTag}): "${c.writeValue}"`);
}

console.log('========= writeValue 拼接对比 (指纹) =========');
for (const opt of keyOptionsFingerprint) {
  console.log(`  KeyMaterial(${opt.supply}): "${opt.text}"`);
}
for (const [supplyTag, row] of managedFingerprintBySupply) {
  const c = createManagedMaterialCandidate(row, supplyTag, '指纹模组');
  console.log(`  Managed(${supplyTag}): "${c.writeValue}"`);
}
console.log();

// =================== 4. 模拟完整冲突检测 ===================
function normalizeCompareValue(value) {
  return String(value ?? '').trim();
}

function isSupplyConflictResolved(currentValue, candidates) {
  const normalized = normalizeCompareValue(currentValue);
  if (!normalized) return false;
  return candidates.some(c => normalizeCompareValue(c.writeValue) === normalized);
}

console.log('========= 模拟二供冲突检测 =========');
// 电池: 模拟 SKU 的 supplies 有 一供/二供 两列
for (const [supplyTag, managedRow] of managedBatteryBySupply) {
  const keyOption = keyOptionsBattery.find(o => o.supply === supplyTag);
  if (!keyOption) {
    console.log(`  电池 ${supplyTag}: ❌ keyOption 不存在 (keyOptions 中没有 supply=${supplyTag})`);
    continue;
  }
  const managedCand = createManagedMaterialCandidate(managedRow, supplyTag, '电池');
  const keyCand = { writeValue: keyOption.text };
  const candidates = [keyCand, managedCand];

  console.log(`  电池 ${supplyTag}: keyOption="${keyOption.text}" vs managedRow="${managedRow.code}|${managedRow.vendor}"`);
  console.log(`    Key writeValue: "${keyCand.writeValue}"`);
  console.log(`    Managed writeValue: "${managedCand.writeValue}"`);
  console.log(`    是否相等: ${keyCand.writeValue === managedCand.writeValue ? '✅ 相等，无冲突' : '⚠️ 不等，候选冲突'}`);
  if (keyCand.writeValue !== managedCand.writeValue) {
    console.log(`    → 应当触发冲突`);
  }
  // 检查 current value (假设 SKU 二供列已填了值)
  const fakeCurrentValue = keyOption.text;  // 假设用户已经选了
  console.log(`    当前值: "${fakeCurrentValue}" → isSupplyConflictResolved: ${isSupplyConflictResolved(fakeCurrentValue, candidates)}`);
}

console.log();
for (const [supplyTag, managedRow] of managedFingerprintBySupply) {
  const keyOption = keyOptionsFingerprint.find(o => o.supply === supplyTag);
  if (!keyOption) {
    console.log(`  指纹 ${supplyTag}: ❌ keyOption 不存在`);
    continue;
  }
  const managedCand = createManagedMaterialCandidate(managedRow, supplyTag, '指纹模组');
  const keyCand = { writeValue: keyOption.text };
  const candidates = [keyCand, managedCand];

  console.log(`  指纹 ${supplyTag}: keyOption="${keyOption.text}" vs managedRow="${managedRow.code}|${managedRow.vendor}"`);
  console.log(`    Key writeValue: "${keyCand.writeValue}"`);
  console.log(`    Managed writeValue: "${managedCand.writeValue}"`);
  console.log(`    是否相等: ${keyCand.writeValue === managedCand.writeValue ? '✅ 相等，无冲突' : '⚠️ 不等，候选冲突'}`);
  if (keyCand.writeValue !== managedCand.writeValue) {
    console.log(`    → 应当触发冲突`);
  }
}
