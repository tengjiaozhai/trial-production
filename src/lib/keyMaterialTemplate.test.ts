import * as XLSX from 'xlsx';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseKeyMaterialTemplate, matchCategory2WithLLM, buildOptionsByField } from './keyMaterialTemplate';
import type { ParsedKeyMaterialTemplate } from './keyMaterialTemplate';

function makeFileFromWorkbook(name: string, wb: XLSX.WorkBook) {
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('parseKeyMaterialTemplate', () => {
  it('returns null when file name does not contain key material keyword', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['分类2']]), '关键物料选项模版');
    const file = makeFileFromWorkbook('普通文件.xlsx', wb);
    const result = await parseKeyMaterialTemplate(file);
    expect(result).toBeNull();
  });

  it('returns null when first sheet name does not contain key material keyword', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['分类2']]), '其他Sheet');
    const file = makeFileFromWorkbook('关键物料选项模版.xlsx', wb);
    const result = await parseKeyMaterialTemplate(file);
    expect(result).toBeNull();
  });

  it('returns null when required columns are missing', async () => {
    const wb = XLSX.utils.book_new();
    // Missing '主二供' column
    const sheet = XLSX.utils.aoa_to_sheet([
      ['分类1', '分类2', '物料描述', '品牌', '供应商'],
      ['结构件', '电池', '5000mAh', 'ATL', 'ATL'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, '关键物料选项模版');
    const file = makeFileFromWorkbook('关键物料选项模版.xlsx', wb);
    const result = await parseKeyMaterialTemplate(file);
    expect(result).toBeNull();
  });

  it('parses first sheet rows with required columns', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['分类1', '分类2', '物料描述', '品牌', '供应商', '主二供'],
      ['结构件', '电池', '5000mAh', 'ATL', 'ATL', '一供'],
      ['结构件', '电池', '5000mAh', 'DESAY', '德赛', '二供'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, '项目(V633A)-关键物料选项模版-天珑2026-05-19');
    const file = makeFileFromWorkbook('项目(V633A)-关键物料选项模版-天珑2026-05-19.xlsx', wb);

    const result = await parseKeyMaterialTemplate(file);
    expect(result).not.toBeNull();
    expect(result!.category2List).toContain('电池');
    expect(result!.rows).toHaveLength(2);
  });

  it('ignores rows with empty category2', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['分类1', '分类2', '物料描述', '品牌', '供应商', '主二供'],
      ['结构件', '电池', '5000mAh', 'ATL', 'ATL', '一供'],
      ['结构件', '', '空行', 'XX', 'YY', '二供'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, '关键物料选项模版');
    const file = makeFileFromWorkbook('关键物料选型模板.xlsx', wb);

    const result = await parseKeyMaterialTemplate(file);
    expect(result).not.toBeNull();
    expect(result!.rows).toHaveLength(1);
  });

  it('supports all three keyword variants', async () => {
    const variants = [
      '关键物料选项模版',
      '关键物料选项模板',
      '关键物料选型模板',
    ];
    for (const keyword of variants) {
      const wb = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([
        ['分类1', '分类2', '物料描述', '品牌', '供应商', '主二供'],
        ['结构件', '喇叭', 'SPK', 'AAC', 'AAC', '一供'],
      ]);
      XLSX.utils.book_append_sheet(wb, sheet, keyword);
      const file = makeFileFromWorkbook(`项目-${keyword}.xlsx`, wb);
      const result = await parseKeyMaterialTemplate(file);
      expect(result, `keyword: ${keyword}`).not.toBeNull();
      expect(result!.category2List).toContain('喇叭');
    }
  });

  it('parses sheet with dirty headers (spaces/newlines in column names)', async () => {
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['分类1', '分类2 ', '物料描述\n', '品牌', '供应商', ' 主二供'],
      ['结构件', '电池', '5000mAh', 'ATL', 'ATL', '一供'],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, '关键物料选项模版');
    const file = makeFileFromWorkbook('关键物料选项模版.xlsx', wb);
    const result = await parseKeyMaterialTemplate(file);
    expect(result).not.toBeNull();
    expect(result!.category2List).toContain('电池');
  });
});

describe('matchCategory2WithLLM', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pickAllowedName: LLM returns substring of actual candidate', async () => {
    // LLM returns "喇叭" but actual candidate is "喇叭BOX"
    // We simulate this by having LLM return the substring value
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ speaker: '喇叭' }) } }],
      }),
    };
    // Mock all fetch calls (round 1 + round 2 retry) to avoid real network requests
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);

    const result = await matchCategory2WithLLM(['喇叭BOX', '电池', 'PCB']);
    // pickAllowedName should fuzzy-match "喇叭" to "喇叭BOX"
    expect(result.speaker).toBe('喇叭BOX');
  });

  it('local fallback when fetch throws: returns matched values from category2List', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    const category2List = [
      '电池',
      '喇叭',
      '听筒',
      'MIC',
      '马达',
      '指纹模组',
      'SPK FPC',
      'Sidekey FPC',
      'IR FPC',
      '镜片',
      '壳料',
      '电池盖',
      '卡托',
      '侧键',
      '辅料',
      '散热',
      'PCB',
      '小板',
    ];
    const result = await matchCategory2WithLLM(category2List);
    // Should not return empty object - local fallback should pick up values
    expect(result.battery).toBe('电池');
    expect(result.speaker).toBe('喇叭');
    expect(result.fingerprint).toBe('指纹模组');
    expect(result.pcb).toBe('PCB');
    expect(result.sub_board).toBe('小板');
  });
});

describe('buildOptionsByField', () => {
  it('battery field: two rows produce two options with supply+vendor+desc text', () => {
    const parsed: ParsedKeyMaterialTemplate = {
      sourceFileName: 'test.xlsx',
      sourceSheetName: '关键物料选项模版',
      category2List: ['电池'],
      rows: [
        { category2: '电池', description: '5000mAh', brand: 'ATL', vendor: 'ATL', supply: '一供' },
        { category2: '电池', description: '5000mAh', brand: 'DESAY', vendor: '德赛', supply: '二供' },
      ],
    };
    const category2ByField = { battery: '电池' };
    const options = buildOptionsByField(parsed, category2ByField);
    expect(options.battery).toHaveLength(2);
    expect(options.battery![0].text).toBe('一供ATL5000mAh');
    expect(options.battery![1].text).toBe('二供德赛5000mAh');
  });

  it('pcb field: one row produces one option with brand only (no supply/vendor/desc)', () => {
    const parsed: ParsedKeyMaterialTemplate = {
      sourceFileName: 'test.xlsx',
      sourceSheetName: '关键物料选项模版',
      category2List: ['PCB'],
      rows: [
        { category2: 'PCB', description: '主板描述', brand: 'qualcomm', vendor: '骁龙', supply: '一供' },
      ],
    };
    const category2ByField = { pcb: 'PCB' };
    const options = buildOptionsByField(parsed, category2ByField);
    expect(options.pcb).toHaveLength(1);
    expect(options.pcb![0].text).toBe('qualcomm');
    // Must not contain supply or vendor
    expect(options.pcb![0].text).not.toContain('一供');
    expect(options.pcb![0].text).not.toContain('骁龙');
  });

  it('fingerprint field: two rows produce two options with supply+vendor+desc text', () => {
    const parsed: ParsedKeyMaterialTemplate = {
      sourceFileName: 'test.xlsx',
      sourceSheetName: '关键物料选项模版',
      category2List: ['指纹模组'],
      rows: [
        { category2: '指纹模组', description: 'FP-128', brand: 'Goodix', vendor: '汇顶', supply: '一供' },
        { category2: '指纹模组', description: 'FP-128', brand: 'Silead', vendor: '思立微', supply: '二供' },
      ],
    };
    const category2ByField = { fingerprint: '指纹模组' };
    const options = buildOptionsByField(parsed, category2ByField);
    expect(options.fingerprint).toHaveLength(2);
    expect(options.fingerprint![0].text).toBe('一供汇顶FP-128');
    expect(options.fingerprint![1].text).toBe('二供思立微FP-128');
  });
});
