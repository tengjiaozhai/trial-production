import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { extractPcbaOptions } from './utils';

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
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false });
    expect(result[1]).toEqual({ pcba: 'B1', band: 'LATAM', bandConflict: false });
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
    expect(result[0]).toEqual({ pcba: 'A1', band: '', bandConflict: true });
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
    expect(result[0]).toEqual({ pcba: 'A1', band: 'SSA', bandConflict: false });
  });

  it('no market column -> band="", bandConflict=false', async () => {
    const aoa = [
      ['PCBA配置', '其他列'],
      ['A1', 'x'],
    ];
    const file = makeXlsxFile(aoa);
    const result = await extractPcbaOptions(file);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ pcba: 'A1', band: '', bandConflict: false });
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
});
