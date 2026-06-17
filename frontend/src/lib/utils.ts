import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx-js-style';
import type { PcbaOption, PcbaSourceRow, PcbaWorkbookParseResult, LcdSupplyOption, ManagedMaterialWorkbook } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripVendorSuffix(text: string): string {
  let result = text;

  // Remove company suffixes
  result = result.replace(/科技有限公司/g, '');
  result = result.replace(/有限公司/g, '');
  result = result.replace(/公司/g, '');

  // Remove province/city names with suffix
  result = result.replace(/[\u4e00-\u9fa5]{1,4}省/g, '');
  result = result.replace(/[\u4e00-\u9fa5]{1,4}市/g, '');
  result = result.replace(/[\u4e00-\u9fa5]{1,4}县/g, '');
  result = result.replace(/[\u4e00-\u9fa5]{1,4}区/g, '');

  // Remove standalone province/city names (common ones)
  const provinceCityNames = [
    '北京', '天津', '上海', '重庆',
    '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南', '陕西', '甘肃', '青海',
    '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆',
    '香港', '澳门',
    '石家庄', '唐山', '秦皇岛', '邯郸', '邢台', '保定', '张家口', '承德', '沧州', '廊坊', '衡水',
    '太原', '大同', '阳泉', '长治', '晋城', '朔州', '晋中', '运城', '忻州', '临汾', '吕梁',
    '呼和浩特', '包头', '乌海', '赤峰', '通辽', '鄂尔多斯', '呼伦贝尔', '巴彦淖尔', '乌兰察布',
    '沈阳', '大连', '鞍山', '抚顺', '本溪', '丹东', '锦州', '营口', '阜新', '辽阳', '盘锦', '铁岭', '朝阳', '葫芦岛',
    '长春', '吉林', '四平', '辽源', '通化', '白山', '松原', '白城',
    '哈尔滨', '齐齐哈尔', '鸡西', '鹤岗', '双鸭山', '大庆', '伊春', '佳木斯', '七台河', '牡丹江', '黑河', '绥化',
    '南京', '无锡', '徐州', '常州', '苏州', '南通', '连云港', '淮安', '盐城', '扬州', '镇江', '泰州', '宿迁',
    '杭州', '宁波', '温州', '嘉兴', '湖州', '绍兴', '金华', '衢州', '舟山', '台州', '丽水',
    '合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '淮北', '铜陵', '安庆', '黄山', '滁州', '阜阳', '宿州', '六安', '亳州', '池州', '宣城',
    '福州', '厦门', '莆田', '三明', '泉州', '漳州', '南平', '龙岩', '宁德',
    '南昌', '景德镇', '萍乡', '九江', '新余', '鹰潭', '赣州', '吉安', '宜春', '抚州', '上饶',
    '济南', '青岛', '淄博', '枣庄', '东营', '烟台', '潍坊', '济宁', '泰安', '威海', '日照', '临沂', '德州', '聊城', '滨州', '菏泽',
    '郑州', '开封', '洛阳', '平顶山', '安阳', '鹤壁', '新乡', '焦作', '濮阳', '许昌', '漯河', '三门峡', '南阳', '商丘', '信阳', '周口', '驻马店',
    '武汉', '黄石', '十堰', '宜昌', '襄阳', '鄂州', '荆门', '孝感', '荆州', '黄冈', '咸宁', '随州',
    '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德', '张家界', '益阳', '郴州', '永州', '怀化', '娄底',
    '广州', '韶关', '深圳', '珠海', '汕头', '佛山', '江门', '湛江', '茂名', '肇庆', '惠州', '梅州', '汕尾', '河源', '阳江', '清远', '东莞', '中山', '潮州', '揭阳', '云浮',
    '南宁', '柳州', '桂林', '梧州', '北海', '防城港', '钦州', '贵港', '玉林', '百色', '贺州', '河池', '来宾', '崇左',
    '海口', '三亚', '三沙', '儋州',
    '成都', '自贡', '攀枝花', '泸州', '德阳', '绵阳', '广元', '遂宁', '内江', '乐山', '南充', '眉山', '宜宾', '广安', '达州', '雅安', '巴中', '资阳',
    '贵阳', '六盘水', '遵义', '安顺', '毕节', '铜仁',
    '昆明', '曲靖', '玉溪', '保山', '昭通', '丽江', '普洱', '临沧',
    '拉萨', '日喀则', '昌都', '林芝', '山南', '那曲',
    '西安', '铜川', '宝鸡', '咸阳', '渭南', '延安', '汉中', '榆林', '安康', '商洛',
    '兰州', '嘉峪关', '金昌', '白银', '天水', '武威', '张掖', '平凉', '酒泉', '庆阳', '定西', '陇南',
    '西宁', '海东',
    '银川', '石嘴山', '吴忠', '固原', '中卫',
    '乌鲁木齐', '克拉玛依', '吐鲁番', '哈密',
  ];

  for (const name of provinceCityNames) {
    result = result.replace(new RegExp(`^${name}`, 'g'), '');
    result = result.replace(new RegExp(`${name}(?=[\\u4e00-\\u9fa5])`, 'g'), '');
  }

  return result.trim();
}

/**
 * Normalize a storage string like "4+128", "128+4", "128G+4G" into
 * a canonical "smaller+larger" form without G suffix.
 * Returns "" if the input does not contain two numeric tokens separated by "+".
 */
export function normalizeStorage(raw: string): string {
  const match = raw.replace(/[Gg]/g, '').match(/(\d+)\+(\d+)/);
  if (!match) return '';
  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);
  return `${Math.min(a, b)}+${Math.max(a, b)}`;
}

/**
 * 从上传的配置表文件中提取 PCBA 配置选项，同时解析出货市场信息。
 *
 * 策略：
 * 1. 遍历所有 sheet，找名称包含 "PCBA配置表" 的 sheet。
 * 2. 将该 sheet 转为 AOA（rows × cols，空格均保留为 null）。
 * 3. 扫描行，找到某一行中有单元格文字匹配 "PCBA 配置" / "PCBA配置" 的行作为表头行。
 * 4. 在表头行中查找匹配 /出货\s*市场/ 的列作为 marketColIdx。
 * 5. 从表头行下一行开始逐行读取：
 *    - 跳过 null / 空字符串
 *    - 跳过分隔行：包含中文字符或含空格
 *    - market 统计所有出现行，用于 bandConflict 判断
 *    - projectName / EMMC / DDR 只取首次出现行
 * 6. 取 market 值：
 *    - 无值 -> {pcba, band:'', bandConflict:false}
 *    - 有值 -> {pcba, band:value, bandConflict:false}
 */
export async function extractPcbaOptions(file: File): Promise<PcbaOption[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // Step 1: find target sheet
  const targetSheetName = wb.SheetNames.find(name => name.includes('PCBA配置表'));
  if (!targetSheetName) return [];

  const ws = wb.Sheets[targetSheetName];

  // Convert to AOA, keep blank cells as null
  const aoa: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: true,
  }) as (string | number | null | undefined)[][];

  if (!aoa.length) return [];

  // Step 2: collect all header candidates (exact match "PCBA配置" or "PCBA 配置"),
  // then pick the one whose column contains the most valid PCBA data rows below.
  let headerRowIdx = -1;
  let headerColIdx = -1;
  let marketColIdx = -1;

  const headerCandidates: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] ?? '').trim();
      if (/^PCBA\s*配置$/.test(val)) {
        headerCandidates.push({ row: r, col: c });
      }
    }
  }

  if (headerCandidates.length === 0) return [];

  // Score each candidate by counting valid (non-separator, non-empty) data rows below it
  let bestCandidate: { row: number; col: number; score: number } | null = null;
  for (const cand of headerCandidates) {
    let score = 0;
    for (let r = cand.row + 1; r < aoa.length; r++) {
      const rawVal = aoa[r]?.[cand.col];
      if (rawVal === null || rawVal === undefined) continue;
      const v = String(rawVal).trim();
      if (!v) continue;
      const isSep = /[一-龥]/.test(v) || /\s/.test(v);
      if (isSep) continue;
      score++;
    }
    if (!bestCandidate || score > bestCandidate.score ||
        (score === bestCandidate.score && cand.col > bestCandidate.col)) {
      bestCandidate = { ...cand, score };
    }
  }

  if (!bestCandidate || bestCandidate.score === 0) return [];
  headerRowIdx = bestCandidate.row;
  headerColIdx = bestCandidate.col;

  // Step 3: find market column in the same header row
  const headerRow = aoa[headerRowIdx];
  for (let c = 0; c < headerRow.length; c++) {
    const val = String(headerRow[c] ?? '').trim();
    if (/出货\s*市场/.test(val)) {
      marketColIdx = c;
      break;
    }
  }

  // Find EMMC, DDR, and projectName columns
  let emmcColIdx = -1;
  let ddrColIdx = -1;
  let projectNameColIdx = -1;
  for (let c = 0; c < headerRow.length; c++) {
    const raw = String(headerRow[c] ?? '').trim();
    const upper = raw.toUpperCase();
    if (upper === 'EMMC') emmcColIdx = c;
    if (upper === 'DDR')  ddrColIdx  = c;
    if (raw === '项目名' || raw === '项目名称') projectNameColIdx = c;
  }

  // Step 4: collect data rows, build map of pcba -> Set<market>
  const pcbaMarkets = new Map<string, Set<string>>();
  const pcbaEmmcValues = new Map<string, string>();
  const pcbaDdrValues  = new Map<string, string>();
  const pcbaProjectNames = new Map<string, string>();
  const pcbaOrder: string[] = [];
  const pcbaCounts = new Map<string, number>();

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const row = aoa[r];
    const rawVal = row[headerColIdx];
    if (rawVal === null || rawVal === undefined) continue;

    const val = String(rawVal).trim();
    if (!val) continue;

    // Detect separator/merged row: contains Chinese chars or whitespace
    const isMergedRow = /[一-龥]/.test(val) || /\s/.test(val);
    if (isMergedRow) continue;

    pcbaCounts.set(val, (pcbaCounts.get(val) ?? 0) + 1);
    if (!pcbaMarkets.has(val)) {
      pcbaMarkets.set(val, new Set<string>());
      pcbaOrder.push(val);
    }

    // Collect market values from all occurrences so bandConflict stays accurate.
    if (marketColIdx !== -1) {
      const marketRaw = row[marketColIdx];
      if (marketRaw !== null && marketRaw !== undefined) {
        const market = String(marketRaw).trim();
        if (market) {
          pcbaMarkets.get(val)!.add(market);
        }
      }
    }

    // Collect projectName from first occurrence only.
    if (pcbaProjectNames.has(val) === false && projectNameColIdx !== -1) {
      const pnRaw = row[projectNameColIdx];
      if (pnRaw !== null && pnRaw !== undefined) {
        const pn = String(pnRaw).trim();
        if (pn) pcbaProjectNames.set(val, pn);
      }
    }

    // Collect EMMC/DDR from first occurrence only.
    const collectFirst = (colIdx: number, map: Map<string, string>) => {
      if (colIdx === -1) return;
      const raw = row[colIdx];
      if (raw === null || raw === undefined) return;
      const v = String(raw).trim();
      if (!v) return;
      if (!map.has(val)) map.set(val, v);
    };
    collectFirst(emmcColIdx, pcbaEmmcValues);
    collectFirst(ddrColIdx,  pcbaDdrValues);
  }

  // Step 5: build result
  const results: PcbaOption[] = pcbaOrder.map(pcba => {
    const markets     = pcbaMarkets.get(pcba)!;
    const emmc        = pcbaEmmcValues.get(pcba) ?? '';
    const ddr         = pcbaDdrValues.get(pcba) ?? '';
    const projectName = pcbaProjectNames.get(pcba) ?? '';
    const duplicateCount = pcbaCounts.get(pcba) ?? 1;
    if (markets.size === 0) {
      return { pcba, projectName, band: '', bandConflict: false, duplicateConflict: duplicateCount > 1, duplicateCount, emmc, ddr };
    } else if (markets.size === 1) {
      return { pcba, projectName, band: [...markets][0], bandConflict: false, duplicateConflict: duplicateCount > 1, duplicateCount, emmc, ddr };
    } else {
      return { pcba, projectName, band: '', bandConflict: true, duplicateConflict: duplicateCount > 1, duplicateCount, emmc, ddr };
    }
  });

  return results;
}

export function normalizeMaterialName(raw: string): string {
  const compact = String(raw ?? '').replace(/\s+/g, '').replace(/[()（）_\-/]/g, '').trim().toUpperCase();
  if (compact === 'LCD' || compact === 'LCM' || compact === '\u663e\u793a\u5c4f') return 'LCD';
  // 前CAM：CAM(前摄)-8M -> CAM前摄8M
  if (compact.startsWith('CAM') && compact.includes('\u524d\u6444')) return 'FRONT_CAM';
  // 主CAM：CAM(后摄)-50M -> CAM后摄50M（含数字表示像素）
  if (compact.startsWith('CAM') && compact.includes('\u540e\u6444') && /\d/.test(compact)) return 'MAIN_CAM';
  // 副CAM：CAM(后摄)-AI -> CAM后摄AI（不含数字）
  if (compact.startsWith('CAM') && compact.includes('\u540e\u6444') && !(/\d/.test(compact))) return 'SUB_CAM';
  return compact;
}

export async function extractManagedMaterialWorkbook(file: File): Promise<ManagedMaterialWorkbook> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const lcdBySheet: Record<string, LcdSupplyOption[]> = {};
  const frontCamBySheet: Record<string, LcdSupplyOption[]> = {};
  const mainCamBySheet: Record<string, LcdSupplyOption[]> = {};
  const subCamBySheet: Record<string, LcdSupplyOption[]> = {};

  const sheetVisibility = wb.Workbook?.Sheets ?? [];

  for (let si = 0; si < wb.SheetNames.length; si++) {
    const sheetName = wb.SheetNames[si];
    const sheetMeta = sheetVisibility[si];
    if (sheetMeta && (sheetMeta.Hidden === 1 || sheetMeta.Hidden === 2)) continue;

    const ws = wb.Sheets[sheetName];
    const aoa: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      blankrows: true,
    }) as (string | number | null | undefined)[][];

    // Find header row in first 10 rows
    let headerRowIdx = -1;
    let materialColIdx = -1;
    let codeColIdx = -1;
    let vendorColIdx = -1;
    let supplyColIdx = -1;

    for (let r = 0; r < Math.min(10, aoa.length); r++) {
      const row = aoa[r];
      let mCol = -1, cdCol = -1, vCol = -1, sCol = -1;
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] ?? '').replace(/\s+/g, '').trim();
        if (cell === '\u7269\u6599\u540d\u79f0') mCol = c;
        if (/\u7f16\u7801/.test(cell)) cdCol = c;
        if (cell === '\u4f9b\u5e94\u5546') vCol = c;
        if (/[\u4e00]\/[\n\r]?[\u4e8c]\u4f9b|[\u4e00\u4e8c]\u4f9b/.test(cell) ||
            cell === '\u4e00/\u4e8c\u4f9b') sCol = c;
      }
      if (mCol !== -1 && cdCol !== -1 && vCol !== -1 && sCol !== -1) {
        headerRowIdx = r;
        materialColIdx = mCol;
        codeColIdx = cdCol;
        vendorColIdx = vCol;
        supplyColIdx = sCol;
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    // Per-category accumulators
    const buckets: Record<string, { options: LcdSupplyOption[]; seen: Set<string> }> = {
      LCD:       { options: [], seen: new Set() },
      FRONT_CAM: { options: [], seen: new Set() },
      MAIN_CAM:  { options: [], seen: new Set() },
      SUB_CAM:   { options: [], seen: new Set() },
    };

    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const row = aoa[r];
      const materialRaw = String(row[materialColIdx] ?? '').trim();
      if (!materialRaw) continue;

      const category = normalizeMaterialName(materialRaw);
      const bucket = buckets[category];
      if (!bucket) continue;

      const supplyRaw = String(row[supplyColIdx] ?? '').replace(/\s+/g, '').trim();
      if (supplyRaw !== '\u4e00\u4f9b' && supplyRaw !== '\u4e8c\u4f9b') continue;
      if (bucket.seen.has(supplyRaw)) continue;
      bucket.seen.add(supplyRaw);

      const code = String(row[codeColIdx] ?? '').trim();
      const vendor = String(row[vendorColIdx] ?? '').trim();
      const supply = supplyRaw as '\u4e00\u4f9b' | '\u4e8c\u4f9b';
      bucket.options.push({ supply, code, vendor, text: `${code} ${supply} ${vendor}` });
    }

    // Sort each bucket: 一供 before 二供, then store if non-empty
    const sort = (opts: LcdSupplyOption[]) => opts.sort((a, b) => a.supply === '\u4e00\u4f9b' ? -1 : 1);

    if (buckets.LCD.options.length > 0)       lcdBySheet[sheetName]      = sort(buckets.LCD.options);
    if (buckets.FRONT_CAM.options.length > 0) frontCamBySheet[sheetName] = sort(buckets.FRONT_CAM.options);
    if (buckets.MAIN_CAM.options.length > 0)  mainCamBySheet[sheetName]  = sort(buckets.MAIN_CAM.options);
    if (buckets.SUB_CAM.options.length > 0)   subCamBySheet[sheetName]   = sort(buckets.SUB_CAM.options);
  }

  return { lcdBySheet, frontCamBySheet, mainCamBySheet, subCamBySheet };
}

export function resolveLcdOptionsForProject(
  projectName: string,
  workbook?: ManagedMaterialWorkbook
): LcdSupplyOption[] {
  return projectName && workbook?.lcdBySheet[projectName]
    ? workbook.lcdBySheet[projectName]
    : [];
}

export function resolveFrontCamOptionsForProject(
  projectName: string,
  workbook?: ManagedMaterialWorkbook
): LcdSupplyOption[] {
  return projectName && workbook?.frontCamBySheet[projectName]
    ? workbook.frontCamBySheet[projectName]
    : [];
}

export function resolveMainCamOptionsForProject(
  projectName: string,
  workbook?: ManagedMaterialWorkbook
): LcdSupplyOption[] {
  return projectName && workbook?.mainCamBySheet[projectName]
    ? workbook.mainCamBySheet[projectName]
    : [];
}

export function resolveSubCamOptionsForProject(
  projectName: string,
  workbook?: ManagedMaterialWorkbook
): LcdSupplyOption[] {
  return projectName && workbook?.subCamBySheet[projectName]
    ? workbook.subCamBySheet[projectName]
    : [];
}

export function serializeLcdOptions(options: LcdSupplyOption[]): string {
  return options.map(o => o.text).join(' / ');
}

export async function extractPcbaWorkbookData(file: File): Promise<PcbaWorkbookParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  // Step 1: find target sheet
  const targetSheetName = wb.SheetNames.find(name => name.includes('PCBA配置表'));
  if (!targetSheetName) return { pcbaOptions: [], pcbaRows: [] };

  const ws = wb.Sheets[targetSheetName];

  // Convert to AOA, keep blank cells as null
  const aoa: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    blankrows: true,
  }) as (string | number | null | undefined)[][];

  if (!aoa.length) return { pcbaOptions: [], pcbaRows: [] };

  // Step 2: collect all header candidates (exact match "PCBA配置" or "PCBA 配置"),
  // then pick the one whose column contains the most valid PCBA data rows below.
  let headerRowIdx = -1;
  let headerColIdx = -1;
  let marketColIdx = -1;

  const headerCandidates: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] ?? '').trim();
      if (/^PCBA\s*配置$/.test(val)) {
        headerCandidates.push({ row: r, col: c });
      }
    }
  }

  if (headerCandidates.length === 0) return { pcbaOptions: [], pcbaRows: [] };

  // Score each candidate by counting valid (non-separator, non-empty) data rows below it
  let bestCandidate: { row: number; col: number; score: number } | null = null;
  for (const cand of headerCandidates) {
    let score = 0;
    for (let r = cand.row + 1; r < aoa.length; r++) {
      const rawVal = aoa[r]?.[cand.col];
      if (rawVal === null || rawVal === undefined) continue;
      const v = String(rawVal).trim();
      if (!v) continue;
      const isSep = /[一-龥]/.test(v) || /\s/.test(v);
      if (isSep) continue;
      score++;
    }
    if (!bestCandidate || score > bestCandidate.score ||
        (score === bestCandidate.score && cand.col > bestCandidate.col)) {
      bestCandidate = { ...cand, score };
    }
  }

  if (!bestCandidate || bestCandidate.score === 0) return { pcbaOptions: [], pcbaRows: [] };
  headerRowIdx = bestCandidate.row;
  headerColIdx = bestCandidate.col;

  // Step 3: find market column in the same header row
  const headerRow = aoa[headerRowIdx];
  for (let c = 0; c < headerRow.length; c++) {
    const val = String(headerRow[c] ?? '').trim();
    if (/出货\s*市场/.test(val)) {
      marketColIdx = c;
      break;
    }
  }

  // Find EMMC, DDR, and projectName columns
  let emmcColIdx = -1;
  let ddrColIdx = -1;
  let projectNameColIdx = -1;
  for (let c = 0; c < headerRow.length; c++) {
    const raw = String(headerRow[c] ?? '').trim();
    const upper = raw.toUpperCase();
    if (upper === 'EMMC') emmcColIdx = c;
    if (upper === 'DDR')  ddrColIdx  = c;
    if (raw === '项目名' || raw === '项目名称') projectNameColIdx = c;
  }

  // Step 4: collect data rows, build map of pcba -> Set<market>
  const pcbaMarkets = new Map<string, Set<string>>();
  const pcbaEmmcValues = new Map<string, string>();
  const pcbaDdrValues  = new Map<string, string>();
  const pcbaProjectNames = new Map<string, string>();
  const pcbaOrder: string[] = [];
  const pcbaCounts = new Map<string, number>();
  const pcbaRows: PcbaSourceRow[] = [];

  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const row = aoa[r];
    const rawVal = row[headerColIdx];
    if (rawVal === null || rawVal === undefined) continue;

    const val = String(rawVal).trim();
    if (!val) continue;

    // Detect separator/merged row: contains Chinese chars or whitespace
    const isMergedRow = /[一-龥]/.test(val) || /\s/.test(val);
    if (isMergedRow) continue;

    pcbaCounts.set(val, (pcbaCounts.get(val) ?? 0) + 1);
    if (!pcbaMarkets.has(val)) {
      pcbaMarkets.set(val, new Set<string>());
      pcbaOrder.push(val);
    }

    // Collect market values from all occurrences so bandConflict stays accurate.
    if (marketColIdx !== -1) {
      const marketRaw = row[marketColIdx];
      if (marketRaw !== null && marketRaw !== undefined) {
        const market = String(marketRaw).trim();
        if (market) {
          pcbaMarkets.get(val)!.add(market);
        }
      }
    }

    // Collect projectName from first occurrence only.
    if (pcbaProjectNames.has(val) === false && projectNameColIdx !== -1) {
      const pnRaw = row[projectNameColIdx];
      if (pnRaw !== null && pnRaw !== undefined) {
        const pn = String(pnRaw).trim();
        if (pn) pcbaProjectNames.set(val, pn);
      }
    }

    // Collect EMMC/DDR from first occurrence only.
    const collectFirst = (colIdx: number, map: Map<string, string>) => {
      if (colIdx === -1) return;
      const raw = row[colIdx];
      if (raw === null || raw === undefined) return;
      const v = String(raw).trim();
      if (!v) return;
      if (!map.has(val)) map.set(val, v);
    };
    collectFirst(emmcColIdx, pcbaEmmcValues);
    collectFirst(ddrColIdx,  pcbaDdrValues);

    // Build raw row data
    const values: Record<string, string> = {};
    if (projectNameColIdx !== -1) {
      const pnRaw = row[projectNameColIdx];
      if (pnRaw !== null && pnRaw !== undefined) {
        values.projectName = String(pnRaw).trim();
      }
    }
    if (marketColIdx !== -1) {
      const marketRaw = row[marketColIdx];
      if (marketRaw !== null && marketRaw !== undefined) {
        values.band = String(marketRaw).trim();
      }
    }
    if (emmcColIdx !== -1) {
      const emmcRaw = row[emmcColIdx];
      if (emmcRaw !== null && emmcRaw !== undefined) {
        values.emmc = String(emmcRaw).trim();
      }
    }
    if (ddrColIdx !== -1) {
      const ddrRaw = row[ddrColIdx];
      if (ddrRaw !== null && ddrRaw !== undefined) {
        values.ddr = String(ddrRaw).trim();
      }
    }

    pcbaRows.push({
      pcba: val,
      sourceIndex: r - headerRowIdx - 1,
      values,
    });
  }

  // Step 5: build result
  const pcbaOptions: PcbaOption[] = pcbaOrder.map(pcba => {
    const markets     = pcbaMarkets.get(pcba)!;
    const emmc        = pcbaEmmcValues.get(pcba) ?? '';
    const ddr         = pcbaDdrValues.get(pcba) ?? '';
    const projectName = pcbaProjectNames.get(pcba) ?? '';
    const duplicateCount = pcbaCounts.get(pcba) ?? 1;
    if (markets.size === 0) {
      return { pcba, projectName, band: '', bandConflict: false, duplicateConflict: duplicateCount > 1, duplicateCount, emmc, ddr };
    } else if (markets.size === 1) {
      return { pcba, projectName, band: [...markets][0], bandConflict: false, duplicateConflict: duplicateCount > 1, duplicateCount, emmc, ddr };
    } else {
      return { pcba, projectName, band: '', bandConflict: true, duplicateConflict: duplicateCount > 1, duplicateCount, emmc, ddr };
    }
  });

  return { pcbaOptions, pcbaRows };
}
