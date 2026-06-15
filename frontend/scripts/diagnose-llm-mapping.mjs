// 深入排查：检查关键的映射关系
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

const trialMaterialDir = '/Volumes/PortableSSD/tin/trial-material';

function normalizeHeader(value) {
  return String(value ?? '').replace(/\s+/g, '');
}

// 1. 关键物料模板的 category2List
const keyMatPath = join(trialMaterialDir, '项目(V633A)-关键物料选型模板-天珑2026-05-19.xlsx');
const keyMatBuf = readFileSync(keyMatPath);
const keyMatWb = XLSX.read(keyMatBuf, { type: 'buffer' });
const keyMatWs = keyMatWb.Sheets[keyMatWb.SheetNames[0]];
const keyMatRows = XLSX.utils.sheet_to_json(keyMatWs, { header: 1, defval: '' });

const keyMatHeader = keyMatRows[0].map(normalizeHeader);
const category2Idx = keyMatHeader.findIndex(h => h === '分类2');

// 收集所有 category2
const category2List = new Set();
for (let r = 1; r < keyMatRows.length; r++) {
  const cat2 = String(keyMatRows[r][category2Idx] ?? '').trim();
  if (cat2) category2List.add(cat2);
}

console.log('=== 关键物料模板 category2List (前 30) ===');
console.log([...category2List].slice(0, 30));
console.log();
console.log('是否包含 "电池":', category2List.has('电池'));
console.log('是否包含 "指纹模组":', category2List.has('指纹模组'));
console.log();

// 2. 关键物料模板的 matchCategory2WithLLM 是用 LLM 匹配，这一步如果失败会用 fallback
// 检查 fallbackMatchCategory2 能否匹配到
function fallbackMatchCategory2(fieldId, category2List) {
  const patterns = {
    battery: [/电池/],
    speaker: [/喇叭|扬声器|BOX|SPK/i],
    receiver: [/听筒|receiver|earpiece/i],
    mic: [/^MIC$|麦克风/i],
    motor: [/马达|振子|motor/i],
    fingerprint: [/指纹|fingerprint|FP.*module/i],
  };
  const fieldPatterns = patterns[fieldId];
  if (!fieldPatterns) return undefined;
  for (const pattern of fieldPatterns) {
    const found = category2List.find(name => pattern.test(name));
    if (found) return found;
  }
  return undefined;
}

console.log('=== fallbackMatchCategory2 验证 ===');
console.log(`battery → ${fallbackMatchCategory2('battery', [...category2List])}`);
console.log(`fingerprint → ${fallbackMatchCategory2('fingerprint', [...category2List])}`);
console.log();

// 3. 管控表的 materialNames
const managedMatPath = join(trialMaterialDir, 'X6728传音管控物料表_V3.5-2025-10-10.xlsx');
const managedMatBuf = readFileSync(managedMatPath);
const managedMatWb = XLSX.read(managedMatBuf, { type: 'buffer' });

let managedMaterialNames = new Set();
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

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const matName = String(aoa[r][matIdx] ?? '').trim();
    if (matName) managedMaterialNames.add(matName);
  }
  break;
}

console.log('=== 管控表 materialNames ===');
console.log([...managedMaterialNames].sort());
console.log();

console.log('=== deriveManagedMaterialDescFieldMap 验证 ===');
function fallbackMatchDescField(key, materialNames) {
  const DESC_MATCH_PATTERNS = {
    battery: [/电池/],
    speaker: [/喇叭|扬声器|BOX|SPK/i],
    receiver: [/听筒|receiver|earpiece/i],
    mic: [/^MIC$|麦克风/i],
    motor: [/马达|振子|motor/i],
    fingerprint: [/指纹|fingerprint|FP.*module/i],
    spk_fpc: [/spk.*fpc|喇叭.*fpc/i],
    sidekey_fpc: [/sidekey.*fpc|侧键.*fpc/i],
    ir_fpc: [/ir.*fpc/i],
    lens: [/镜片|lens/i],
    housing: [/壳料|housing|后壳|中框/i],
    battery_cover: [/电池盖|battery.*cover|后盖/i],
    sim_tray: [/卡托|sim.*tray/i],
    side_key: [/侧键|side[\s_-]+key/i],
    aux_material: [/辅料/i],
    cooling: [/散热|导热|石墨|vc/i],
  };
  const patterns = DESC_MATCH_PATTERNS[key];
  for (const pattern of patterns) {
    const found = materialNames.find(name => pattern.test(name));
    if (found) return found;
  }
  return undefined;
}

console.log(`battery → ${fallbackMatchDescField('battery', [...managedMaterialNames])}`);
console.log(`fingerprint → ${fallbackMatchDescField('fingerprint', [...managedMaterialNames])}`);
console.log();

console.log('=== 实际 buildManagedDescFieldOptions 后会怎样 ===');
// 模拟: materialNameByDescField.battery = "电池"
//      buildManagedDescFieldOptions 找 materialName="电池" 的行
//      一供 ATL → text="一供ATL电池"
//      二供 锂威 → text="二供锂威电池"
console.log('预期的 managedOptions.battery:');
console.log('  { supply: "一供", text: "一供ATL电池" }');
console.log('  { supply: "二供", text: "二供锂威电池" }');
console.log();

console.log('=== 关键物料的 keyOptions.battery: ===');
console.log('  { supply: "一供", text: "一供锂威聚合物_BL-58HX_5850mAh_CB_LW" }');
console.log('  { supply: "二供", text: "二供ATL聚合物_BL-58HX_5850mAh_CB_ATL" }');
console.log();

console.log('=== 对比 writeValue (同 supply 内) ===');
// 同 supply "一供":
//   Key: "一供锂威聚合物..."   (供应商是锂威)
//   Managed: "一供ATL电池"      (供应商是 ATL)
// 两者不等 → 触发冲突
// 同 supply "二供":
//   Key: "二供ATL聚合物..."    (供应商是 ATL)
//   Managed: "二供锂威电池"     (供应商是 锂威)
// 两者不等 → 触发冲突
console.log('理论上冲突应该触发!');
console.log();
console.log('=== 检查关键物料解析时, vendor 是否被正确读取 ===');
// 关键物料模板 vendorIdx = 9, 但是该列实际是"硬件配置"
// 让我重新检查
console.log('Header:', keyMatHeader);
console.log('  分类2 idx:', category2Idx);
console.log('  物料描述 idx:', keyMatHeader.findIndex(h => h === '物料描述'));
console.log('  品牌 idx:', keyMatHeader.findIndex(h => h === '品牌'));
console.log('  供应商 idx:', keyMatHeader.findIndex(h => h === '供应商'));
console.log('  主二供 idx:', keyMatHeader.findIndex(h => h === '主二供'));
console.log();
console.log('=== 关键物料模板实际行示例 ===');
for (let r = 1; r < 10; r++) {
  const row = keyMatRows[r];
  console.log(`R${r}:`, row.slice(0, 13));
}
