import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { extractPcbaOptions, normalizeStorage, extractManagedMaterialWorkbook, resolveLcdOptionsForProject, serializeLcdOptions } from './utils';

function makeXlsxFile(aoa: (string | null)[][]): File {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'PCBA配置表');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('extractPcbaOptions', () => {
  it('normal: each PCBA has one market -> returns list with band', async () => {
    const aoa = [
      ['PCBA配置', '出货市场', '其他列'],
      ['A1', 'SSA', 'x'],
      ['B1', 'LATAM', 'y'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false, emmc: '', ddr: '' });
    expect(result[1]).toEqual({ pcba: 'B1', band: 'LATAM', bandConflict: false, emmc: '', ddr: '' });
  });

  it('conflict: same PCBA has multiple rows -> uses first occurrence band', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['A1', 'SSA'],
      ['A1', 'LATAM'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false, emmc: '', ddr: '' });
  });

  it('same PCBA multiple rows same market -> not a conflict', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['A1', 'SSA'],
      ['A1', 'SSA'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false, emmc: '', ddr: '' });
  });

  it('no market column -> band="", bandConflict=false', async () => {
    const aoa = [
      ['PCBA配置', '其他列'],
      ['A1', 'x'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: '', bandConflict: false, emmc: '', ddr: '' });
  });

  it('ignores title cells like "PCBA配置表" and matches exact "PCBA配置" header row', async () => {
    const aoa = [
      [null, null, null, null, null, 'Infinix X6728 项目 PCBA配置表'],
      ['PCBA配置', null, null, null, null, 'PCBA 配置', null, null, null, '出货市场', null, 'EMMC', 'DDR'],
      [null, null, null, null, null, 'A1', null, null, null, 'SSA', null, '128G', '4G'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false, emmc: '128G', ddr: '4G' });
  });

  it('no PCBA配置表 sheet -> return []', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['A', 'B']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const result = await extractPcbaOptions(file);
    expect(result).toEqual([]);
  });

  it('skip rows with Chinese chars (separator rows)', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['单板规格', null],
      ['A1', 'SSA'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result).toHaveLength(1);
    expect(result[0].pcba).toBe('A1');
  });

  it('extracts emmc and ddr from dedicated columns', async () => {
    const aoa = [
      ['PCBA配置', '出货市场', 'EMMC', 'DDR'],
      ['A1', 'SSA', '128G', '4G'],
      ['B1', 'LATAM', '256G', '8G'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false, emmc: '128G', ddr: '4G' });
    expect(result[1]).toEqual({ pcba: 'B1', band: 'LATAM', bandConflict: false, emmc: '256G', ddr: '8G' });
  });

  it('emmc/ddr columns absent -> emmc and ddr are empty strings', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['A1', 'SSA'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false, emmc: '', ddr: '' });
  });

  it('same PCBA with duplicate rows -> uses first occurrence EMMC/DDR', async () => {
    const aoa = [
      ['PCBA配置', '出货市场', 'EMMC', 'DDR'],
      ['A1', 'SSA', '128G', '4G'],
      ['A1', 'SSA', '256G', '4G'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result[0].emmc).toBe('128G');
    expect(result[0].ddr).toBe('4G');
  });
});

describe('normalizeStorage', () => {
  it('canonical order: smaller first', () => {
    expect(normalizeStorage('4+128')).toBe('4+128');
  });

  it('reversed input equals canonical', () => {
    expect(normalizeStorage('128+4')).toBe('4+128');
  });

  it('strips trailing G', () => {
    expect(normalizeStorage('128G+4G')).toBe('4+128');
  });

  it('strips trailing g (lowercase)', () => {
    expect(normalizeStorage('4g+128g')).toBe('4+128');
  });

  it('returns empty string for single number', () => {
    expect(normalizeStorage('128')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeStorage('')).toBe('');
  });

  it('returns empty string for non-numeric string', () => {
    expect(normalizeStorage('V633A-EBOM')).toBe('');
  });

  it('real ebom_desc: 4+128 stays 4+128', () => {
    expect(normalizeStorage('4+128')).toBe('4+128');
  });

  it('real pcba storage: 128+4 normalizes to same as 4+128', () => {
    expect(normalizeStorage('128+4')).toBe(normalizeStorage('4+128'));
  });

  it('real pcba storage with G: 128G+4G normalizes to 4+128', () => {
    expect(normalizeStorage('128G+4G')).toBe('4+128');
  });

  it('8+256 and 256+8 are equal', () => {
    expect(normalizeStorage('8+256')).toBe(normalizeStorage('256+8'));
  });
});

describe('extractPcbaOptions - projectName', () => {
  it('extracts projectName from the PCBA config row', async () => {
    const aoa = [
      [null, null, null, null, null, 'PCBA \u914d\u7f6e', null, '\u9879\u76ee\u540d', null, '\u51fa\u8d27\u5e02\u573a', null, 'EMMC', 'DDR'],
      [null, null, null, null, null, 'A1', null, 'X6728', null, 'SSA', null, '128GB \u4e00\u4f9b', '4GB \u4e00\u4f9b'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result[0]).toMatchObject({
      pcba: 'A1',
      projectName: 'X6728',
      band: 'SSA',
      emmc: '128GB \u4e00\u4f9b',
      ddr: '4GB \u4e00\u4f9b',
    });
  });
});

describe('extractManagedMaterialWorkbook', () => {
  it('extracts visible-sheet LCD supply rows, skips hidden sheets', async () => {
    const wb = XLSX.utils.book_new();

    const visibleSheet = XLSX.utils.aoa_to_sheet([
      ['\u4f20\u97f3\u7ba1\u63a7\u7269\u6599\u8868'],
      ['\u54c1\u724c:', 'Infinix'],
      ['\u7814\u53d1\u586b\u5199'],
      ['\u5e8f\u53f7', '\u7269\u6599\u540d\u79f0', '\u4f20\u97f3\u7f16\u7801', '\u7269\u6599\u63cf\u8ff0', '\u4f9b\u5e94\u5546\u578b\u53f7', '\u4f9b\u5e94\u5546', '\u7528\u91cf', '\u7269\u6599\u989c\u8272', '\u4f20\u97f3\u662f\u5426\u5df2\u5c01\u6837', '\u7269\u6599\u901a\u7528\u6027', '\u5e73\u53f0\u662f\u5426\u5df2\u8ba4\u8bc1', 'MOQ', 'MPQ', '\u8bd5\u4ea7LT', '\u91cf\u4ea7LT', '\u4e00/\u4e8c\u4f9b'],
      [37, 'LCM', '17401942', 'desc', 'TM19+ICNL9916X', '\u5929\u9a6c', 1, '/', '\u5426', '\u65b0\u5f00', '\u5426', 1, 1, 60, 60, '\u4e00\u4f9b'],
      [38, '\u663e\u793a\u5c4f', '17401941', 'desc', 'HKC+TD4160B', '\u5fb7\u666e\u7279', 1, '/', '\u5426', '\u65b0\u5f00', '\u5426', 1, 1, 60, 60, '\u4e8c\u4f9b'],
    ]);
    const hiddenSheet = XLSX.utils.aoa_to_sheet([
      ['\u4f20\u97f3\u7ba1\u63a7\u7269\u6599\u8868'],
      ['\u54c1\u724c:', 'Infinix'],
      ['\u7814\u53d1\u586b\u5199'],
      ['\u5e8f\u53f7', '\u7269\u6599\u540d\u79f0', '\u4f20\u97f3\u7f16\u7801', '\u4f9b\u5e94\u5546', '\u4e00/\u4e8c\u4f9b'],
      [1, 'LCM', '99999999', '\u9690\u85cf\u4f9b\u5e94\u5546', '\u4e00\u4f9b'],
    ]);

    XLSX.utils.book_append_sheet(wb, visibleSheet, 'X6728');
    XLSX.utils.book_append_sheet(wb, hiddenSheet, 'X6728B');
    wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'X6728\u4f20\u97f3\u7ba1\u63a7\u7269\u6599\u8868.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const result = await extractManagedMaterialWorkbook(file);
    expect(result.lcdBySheet['X6728']).toEqual([
      { supply: '\u4e00\u4f9b', code: '17401942', vendor: '\u5929\u9a6c', text: '17401942 \u4e00\u4f9b \u5929\u9a6c' },
      { supply: '\u4e8c\u4f9b', code: '17401941', vendor: '\u5fb7\u666e\u7279', text: '17401941 \u4e8c\u4f9b \u5fb7\u666e\u7279' },
    ]);
    expect(result.lcdBySheet['X6728B']).toBeUndefined();
  });
});

describe('resolveLcdOptionsForProject + serializeLcdOptions', () => {
  it('resolves and serializes lcd options', () => {
    const workbook = {
      lcdBySheet: {
        X6728: [
          { supply: '\u4e00\u4f9b' as const, code: '17401942', vendor: '\u5929\u9a6c', text: '17401942 \u4e00\u4f9b \u5929\u9a6c' },
          { supply: '\u4e8c\u4f9b' as const, code: '17401941', vendor: '\u5fb7\u666e\u7279', text: '17401941 \u4e8c\u4f9b \u5fb7\u666e\u7279' },
        ],
      },
    };
    expect(resolveLcdOptionsForProject('X6728', workbook)).toHaveLength(2);
    expect(serializeLcdOptions(resolveLcdOptionsForProject('X6728', workbook))).toBe(
      '17401942 \u4e00\u4f9b \u5929\u9a6c / 17401941 \u4e8c\u4f9b \u5fb7\u666e\u7279'
    );
  });

  it('returns empty array when project not found', () => {
    expect(resolveLcdOptionsForProject('X9999', undefined)).toEqual([]);
    expect(serializeLcdOptions([])).toBe('');
  });
});
