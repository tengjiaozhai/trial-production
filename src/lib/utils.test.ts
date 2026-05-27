import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { extractPcbaOptions } from './utils';
import { normalizeStorage } from './utils';

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

  it('conflict: same PCBA has multiple different markets -> bandConflict=true, band=""', async () => {
    const aoa = [
      ['PCBA配置', '出货市场'],
      ['A1', 'SSA'],
      ['A1', 'LATAM'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: '', bandConflict: true, emmc: '', ddr: '' });
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

  it('same PCBA with conflicting EMMC rows -> emmc is empty string', async () => {
    const aoa = [
      ['PCBA配置', '出货市场', 'EMMC', 'DDR'],
      ['A1', 'SSA', '128G', '4G'],
      ['A1', 'SSA', '256G', '4G'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result[0].emmc).toBe('');
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
