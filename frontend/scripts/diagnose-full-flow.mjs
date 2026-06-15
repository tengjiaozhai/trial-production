// 综合排查脚本：模拟 LLM 成功和失败两种情况下，二供冲突的检测结果
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

const trialMaterialDir = '/Volumes/PortableSSD/tin/trial-material';

function normalizeHeader(value) {
  return String(value ?? '').replace(/\s+/g, '');
}

function toSupplyTag(raw) {
  return raw === '一供' || raw === '二供' || raw === '三供' || raw === '四供' ? raw : '';
}

// =================== 1. 读取关键物料模板 ===================
const keyMatPath = join(trialMaterialDir, '项目(V633A)-关键物料选型模板-天珑2026-05-19.xlsx');
const keyMatWb = XLSX.read(readFileSync(keyMatPath), { type: 'buffer' });
const keyMatRows = XLSX.utils.sheet_to_json(keyMatWb.Sheets[keyMatWb.SheetNames[0]], { header: 1, defval: '' });
const keyMatHeader = keyMatRows[0].map(normalizeHeader);
const kmCat2Idx = keyMatHeader.findIndex(h => h === '分类2');
const kmDescIdx = keyMatHeader.findIndex(h => h === '物料描述');
const kmVendorIdx = keyMatHeader.findIndex(h => h === '供应商');
const kmMainSupplyIdx = keyMatHeader.findIndex(h => h === '主二供');

// 收集 category2List
const category2List = [];
const seen = new Set();
for (let r = 1; r < keyMatRows.length; r++) {
  const cat2 = String(keyMatRows[r][kmCat2Idx] ?? '').trim();
  if (cat2 && !seen.has(cat2)) { seen.add(cat2); category2List.push(cat2); }
}

// =================== 2. 读取管控物料表 ===================
const managedMatWb = XLSX.read(readFileSync(join(trialMaterialDir, 'X6728传音管控物料表_V3.5-2025-10-10.xlsx')), { type: 'buffer' });
const managedAoA = XLSX.utils.sheet_to_json(managedMatWb.Sheets['X6728'], { header: 1, defval: '' });
let managedHeaderIdx = -1;
for (let r = 0; r < 15; r++) {
  const n = managedAoA[r].map(normalizeHeader);
  if (n.includes('物料名称') && n.some(c => /编码/.test(c)) && n.includes('供应商')) { managedHeaderIdx = r; break; }
}
const managedHeader = managedAoA[managedHeaderIdx].map(normalizeHeader);
const mMatIdx = managedHeader.indexOf('物料名称');
const mCodeIdx = managedHeader.findIndex(c => /编码/.test(c));
const mVendorIdx = managedHeader.indexOf('供应商');
const mSupplyIdx = managedHeader.indexOf('一/二供');

const managedRows = [];
const managedMaterialNames = [];
const seenMat = new Set();
for (let r = managedHeaderIdx + 1; r < managedAoA.length; r++) {
  const matName = String(managedAoA[r][mMatIdx] ?? '').trim();
  if (!matName) continue;
  if (!seenMat.has(matName)) { seenMat.add(matName); managedMaterialNames.push(matName); }
  managedRows.push({
    materialName: matName,
    code: String(managedAoA[r][mCodeIdx] ?? '').trim(),
    vendor: String(managedAoA[r][mVendorIdx] ?? '').trim(),
    supply: String(managedAoA[r][mSupplyIdx] ?? '').trim(),
  });
}

// =================== 3. 模拟 LLM 成功/失败 ===================
// 模拟 LLM 返回的 category2ByField
const llmCategory2ByField = {
  battery: '电池',           // LLM 正确
  fingerprint: '指纹模组',   // LLM 正确
};

// fallback 的 category2ByField (用 Array.find 第一个匹配)
function fallbackMatchCategory2(fieldId, list) {
  const patterns = {
    battery: [/电池/],
    fingerprint: [/指纹|fingerprint|FP.*module/i],
  };
  const p = patterns[fieldId];
  if (!p) return undefined;
  return list.find(name => p.some(re => re.test(name)));
}
const fallbackCategory2ByField = {
  battery: fallbackMatchCategory2('battery', category2List),
  fingerprint: fallbackMatchCategory2('fingerprint', category2List),
};

console.log('=== category2ByField 对比 ===');
console.log('LLM 成功:');
console.log(`  battery → ${llmCategory2ByField.battery}`);
console.log(`  fingerprint → ${llmCategory2ByField.fingerprint}`);
console.log('Fallback:');
console.log(`  battery → ${fallbackCategory2ByField.battery}`);
console.log(`  fingerprint → ${fallbackCategory2ByField.fingerprint}`);
console.log();

// =================== 4. 模拟 buildOptionsByField ===================
function buildKeyOptions(category2) {
  const opts = [];
  for (let r = 1; r < keyMatRows.length; r++) {
    const row = keyMatRows[r];
    if (String(row[kmCat2Idx] ?? '').trim() !== category2) continue;
    const desc = String(row[kmDescIdx] ?? '').trim();
    const vendor = String(row[kmVendorIdx] ?? '').trim();
    const mainSupply = String(row[kmMainSupplyIdx] ?? '').trim();
    if (!mainSupply || !vendor || !desc) continue;
    opts.push({ supply: mainSupply, text: `${mainSupply}${vendor}${desc}`, sourceCategory2: category2 });
  }
  return opts;
}

console.log('=== buildKeyOptions 结果对比 ===');
console.log('【LLM 成功】');
const llmBatteryOpts = buildKeyOptions(llmCategory2ByField.battery);
const llmFingerprintOpts = buildKeyOptions(llmCategory2ByField.fingerprint);
console.log(`  battery: ${llmBatteryOpts.length} 个`);
console.table(llmBatteryOpts);
console.log(`  fingerprint: ${llmFingerprintOpts.length} 个`);
console.table(llmFingerprintOpts);
console.log();

console.log('【Fallback】');
const fbBatteryOpts = buildKeyOptions(fallbackCategory2ByField.battery);
const fbFingerprintOpts = buildKeyOptions(fallbackCategory2ByField.fingerprint);
console.log(`  battery → ${fallbackCategory2ByField.battery}: ${fbBatteryOpts.length} 个`);
console.table(fbBatteryOpts);
console.log(`  fingerprint → ${fallbackCategory2ByField.fingerprint}: ${fbFingerprintOpts.length} 个`);
console.table(fbFingerprintOpts);
console.log();

// =================== 5. 模拟 buildManagedDescFieldOptions ===================
// materialNameByDescField 来自 matchManagedMaterialNamesWithLLM
// 它在 managedMaterialCore.ts:309 fallback 用 deriveManagedMaterialDescFieldMap
// 这里走的是同样的 fallbackMatchDescField (见前面诊断)，结果正确
const managedBatteryBySupply = new Map();
const managedFingerprintBySupply = new Map();
for (const row of managedRows) {
  if (row.materialName !== '电池' && row.materialName !== '指纹模组') continue;
  const supplyTag = toSupplyTag(row.supply);
  if (!supplyTag) continue;
  const map = row.materialName === '电池' ? managedBatteryBySupply : managedFingerprintBySupply;
  if (!map.has(supplyTag)) map.set(supplyTag, row);
}

function buildManagedOptions(matName) {
  return Array.from(
    (matName === '电池' ? managedBatteryBySupply : managedFingerprintBySupply).entries()
  ).map(([supply, row]) => ({
    supply,
    text: `${row.supply}${row.vendor}${matName}`,
    sourceCategory2: matName,
  }));
}

const managedBatteryOpts = buildManagedOptions('电池');
const managedFingerprintOpts = buildManagedOptions('指纹模组');

console.log('=== buildManagedOptions (管控表) ===');
console.log('电池:');
console.table(managedBatteryOpts);
console.log('指纹:');
console.table(managedFingerprintOpts);
console.log();

// =================== 6. 模拟 buildManagedMaterialSupplierAlignment ===================
function buildAlignment(keyOpts, managedOpts) {
  const keySupplies = new Set(keyOpts.map(o => o.supply).filter(Boolean));
  const overlap = keyOpts.length === 0 ? [] : managedOpts.filter(o => o.supply && keySupplies.has(o.supply));
  const additions = managedOpts.length === 0 ? [] :
    keyOpts.length === 0 ? managedOpts : managedOpts.filter(o => !o.supply || !keySupplies.has(o.supply));
  return { overlap, additions };
}

console.log('=== managedMaterialSupplierAlignment 对比 ===');
console.log('【LLM 成功】');
const llmBatteryAlign = buildAlignment(llmBatteryOpts, managedBatteryOpts);
console.log(`  battery: overlap=${llmBatteryAlign.overlap.length} 个, additions=${llmBatteryAlign.additions.length} 个`);
console.log('  overlap:', llmBatteryAlign.overlap.map(o => o.supply));
console.log('  additions:', llmBatteryAlign.additions.map(o => o.supply));

const llmFingerprintAlign = buildAlignment(llmFingerprintOpts, managedFingerprintOpts);
console.log(`  fingerprint: overlap=${llmFingerprintAlign.overlap.length} 个, additions=${llmFingerprintAlign.additions.length} 个`);
console.log('  overlap:', llmFingerprintAlign.overlap.map(o => o.supply));
console.log('  additions:', llmFingerprintAlign.additions.map(o => o.supply));
console.log();

console.log('【Fallback】');
const fbBatteryAlign = buildAlignment(fbBatteryOpts, managedBatteryOpts);
console.log(`  battery: overlap=${fbBatteryAlign.overlap.length} 个, additions=${fbBatteryAlign.additions.length} 个`);
console.log('  overlap:', fbBatteryAlign.overlap.map(o => o.supply));
console.log('  additions:', fbBatteryAlign.additions.map(o => o.supply));

const fbFingerprintAlign = buildAlignment(fbFingerprintOpts, managedFingerprintOpts);
console.log(`  fingerprint: overlap=${fbFingerprintAlign.overlap.length} 个, additions=${fbFingerprintAlign.additions.length} 个`);
console.log('  overlap:', fbFingerprintAlign.overlap.map(o => o.supply));
console.log('  additions:', fbFingerprintAlign.additions.map(o => o.supply));
console.log();

// =================== 7. 模拟 deriveSupplyColumnsFromFieldOptions ===================
function deriveSupplyColumns(fieldOptions) {
  const supplySet = new Set();
  for (const options of Object.values(fieldOptions)) {
    if (!options) continue;
    for (const opt of options) {
      if (opt.supply) supplySet.add(opt.supply);
    }
  }
  return ['一供', '二供', '三供', '四供', ''].filter(s => supplySet.has(s));
}

console.log('=== 合并后的 fieldOptions 对比 ===');
console.log('【LLM 成功】');
const llmMergedBattery = [...llmBatteryOpts, ...managedBatteryOpts.filter(m => !llmBatteryOpts.find(k => k.supply === m.supply))];
const llmMergedFingerprint = [...llmFingerprintOpts, ...managedFingerprintOpts.filter(m => !llmFingerprintOpts.find(k => k.supply === m.supply))];
console.log(`  battery supplies: ${deriveSupplyColumns({ battery: llmMergedBattery })}`);
console.log(`  fingerprint supplies: ${deriveSupplyColumns({ fingerprint: llmMergedFingerprint })}`);
console.log();

console.log('【Fallback】');
const fbMergedBattery = [...fbBatteryOpts, ...fbBatteryAlign.additions];
const fbMergedFingerprint = [...fbFingerprintOpts, ...fbFingerprintAlign.additions];
console.log(`  battery fieldOptions: ${fbMergedBattery.length} 个, supplies: ${deriveSupplyColumns({ battery: fbMergedBattery })}`);
console.log(`  fingerprint fieldOptions: ${fbMergedFingerprint.length} 个, supplies: ${deriveSupplyColumns({ fingerprint: fbMergedFingerprint })}`);
console.log();

// =================== 8. 模拟 buildStep2CellConflicts ===================
function simulateStep2Conflicts(keyOpts, managedOpts) {
  // 模拟 step2CellConflicts.ts:271-338
  const conflicts = [];
  if (managedOpts.length === 0) return conflicts;

  const keyBySupply = new Map();
  for (const o of keyOpts) {
    if (!o.supply || keyBySupply.has(o.supply)) continue;
    keyBySupply.set(o.supply, o);
  }
  const managedBySupply = new Map();
  for (const o of managedOpts) {
    if (!o.supply || managedBySupply.has(o.supply)) continue;
    managedBySupply.set(o.supply, o);
  }

  const supplies = ['一供', '二供', '三供', '四供', ''].filter(s => keyBySupply.has(s) || managedBySupply.has(s));
  for (const supply of supplies) {
    const keyOption = keyBySupply.get(supply);
    const managedOption = managedBySupply.get(supply);
    if (!keyOption || !managedOption) continue;
    if (keyOption.text === managedOption.text) continue;
    conflicts.push({ supply, key: keyOption.text, managed: managedOption.text });
  }
  return conflicts;
}

console.log('=== 实际冲突检测结果对比 ===');
console.log('【LLM 成功】');
const llmBatteryConflicts = simulateStep2Conflicts(llmBatteryOpts, managedBatteryOpts);
console.log(`  battery 冲突: ${llmBatteryConflicts.length} 个`);
console.table(llmBatteryConflicts);
const llmFingerprintConflicts = simulateStep2Conflicts(llmFingerprintOpts, managedFingerprintOpts);
console.log(`  fingerprint 冲突: ${llmFingerprintConflicts.length} 个`);
console.table(llmFingerprintConflicts);
console.log();

console.log('【Fallback】');
const fbBatteryConflicts = simulateStep2Conflicts(fbBatteryOpts, managedBatteryOpts);
console.log(`  battery 冲突: ${fbBatteryConflicts.length} 个`);
console.table(fbBatteryConflicts);
const fbFingerprintConflicts = simulateStep2Conflicts(fbFingerprintOpts, managedFingerprintOpts);
console.log(`  fingerprint 冲突: ${fbFingerprintConflicts.length} 个`);
console.table(fbFingerprintConflicts);
