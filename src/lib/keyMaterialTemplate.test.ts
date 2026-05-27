import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseKeyMaterialTemplate } from './keyMaterialTemplate';

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
});
