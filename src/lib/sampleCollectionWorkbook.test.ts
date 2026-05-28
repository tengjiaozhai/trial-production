import * as XLSX from 'xlsx';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  parseSampleCollectionWorkbook,
  matchSampleCollectionRowsWithLLM,
  buildSampleCollectionFieldOptions,
} from './sampleCollectionWorkbook';
import type { SampleCollectionWorkbookData } from '../types';

function makeFile(name: string, sheets: Array<{ name: string; aoa: unknown[][]; hidden?: boolean }>) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Sheets: [] as any[] };
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.aoa), s.name);
    (wb.Workbook!.Sheets! as any[]).push({ Hidden: s.hidden ? 1 : 0 });
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const SAMPLE_AOA = [
  // row0: stage (fill-forward via merged cells simulation)
  ['行名', 'PR1', '', ''],
  // row1: supply
  ['',     '一供', '二供', ''],
  // row2: pcba
  ['',     'A1',  'A1',   'B1'],
  // data rows
  ['硬件测试', '5', '3', ''],
  ['软件',    '4', '2', ''],
  ['体验试用', '1', '',  ''],
  ['可靠性测试','2','1', ''],
  ['压力测试', '3', '2', ''],
];

describe('parseSampleCollectionWorkbook', () => {
  it('returns null when file name does not include sample keyword', async () => {
    const file = makeFile('other.xlsx', [{ name: '样机', aoa: [['a']] }]);
    expect(await parseSampleCollectionWorkbook(file)).toBeNull();
  });

  it('returns null when no sheet name contains sample keyword', async () => {
    const file = makeFile('X6728样机收集表.xlsx', [{ name: 'Sheet1', aoa: [['a']] }]);
    expect(await parseSampleCollectionWorkbook(file)).toBeNull();
  });

  it('skips hidden sheets', async () => {
    const file = makeFile('X6728样机收集表.xlsx', [
      { name: '样机PR1', aoa: SAMPLE_AOA, hidden: true },
    ]);
    expect(await parseSampleCollectionWorkbook(file)).toBeNull();
  });

  it('parses visible sample sheet and fills forward stage row', async () => {
    const file = makeFile('X6728样机收集表.xlsx', [{ name: '样机PR1', aoa: SAMPLE_AOA }]);
    const result = await parseSampleCollectionWorkbook(file);
    expect(result).not.toBeNull();
    expect(result!.sheets).toHaveLength(1);
    const sheet = result!.sheets[0];
    expect(sheet.sheetName).toBe('样机PR1');
    // After fill-forward, col1 stage='PR1', col2 stage='PR1' (carried over), col3 stage=''
    expect(sheet.colHeaders[0].stage).toBe('PR1');
    expect(sheet.colHeaders[1].stage).toBe('PR1');
    expect(sheet.rowNames).toContain('硬件测试');
    expect(sheet.rowNames).toContain('软件');
  });

  it('extracts cells keyed by stage__supply__pcba', async () => {
    const file = makeFile('X6728样机收集表.xlsx', [{ name: '样机PR1', aoa: SAMPLE_AOA }]);
    const result = await parseSampleCollectionWorkbook(file);
    const row = result!.sheets[0].rows.find(r => r.rowName === '硬件测试');
    expect(row).toBeDefined();
    expect(row!.cells['PR1__一供__A1']).toBe('5');
    expect(row!.cells['PR1__二供__A1']).toBe('3');
  });
});

describe('matchSampleCollectionRowsWithLLM', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('local fallback when fetch throws: matches hw_eng/hw_test/reliability_eng/pressure_test', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const rowNames = ['硬件', '硬件测试', '软件', '软测', '结构', '可靠性测试', '压力测试', '影像', 'NPM', '体验', '器件', '产品'];
    const result = await matchSampleCollectionRowsWithLLM(rowNames);
    expect(result.hw_eng).toBe('硬件');
    expect(result.hw_test).toBe('硬件测试');
    expect(result.reliability_eng).toBe('可靠性测试');
    expect(result.pressure_test).toBe('压力测试');
    expect(result.npm).toBe('NPM');
  });

  it('picks candidate via substring match from LLM partial response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ hw_test: '硬测' }) } }] }),
    } as any);
    const result = await matchSampleCollectionRowsWithLLM(['硬件测试', '软件']);
    // "硬测" is substring of "硬件测试" -> fuzzy match
    expect(result.hw_test).toBe('硬件测试');
  });
});

describe('buildSampleCollectionFieldOptions', () => {
  const baseData: SampleCollectionWorkbookData = {
    sourceFileName: 'test.xlsx',
    sheets: [{
      sheetName: '样机PR1',
      colHeaders: [
        { colIndex: 1, stage: 'PR1', supply: '一供', pcba: 'A1' },
        { colIndex: 2, stage: 'PR1', supply: '二供', pcba: 'A1' },
      ],
      rows: [
        { rowName: '硬件测试', cells: { 'PR1__一供__A1': '5', 'PR1__二供__A1': '3' } },
        { rowName: '体验试用', cells: { 'PR1__一供__A1': '1', 'PR1__二供__A1': '' } },
      ],
      rowNames: ['硬件测试', '体验试用'],
    }],
    rowNameByField: { hw_test: '硬件测试', ux: '体验试用' },
  };

  it('splits one/two supply into two SplitFieldOptions', () => {
    const result = buildSampleCollectionFieldOptions(baseData, 'PR1', 'A1');
    expect(result.hw_test).toHaveLength(2);
    expect(result.hw_test![0]).toMatchObject({ supply: '一供', text: '5' });
    expect(result.hw_test![1]).toMatchObject({ supply: '二供', text: '3' });
  });

  it('skips empty cell, returns single option for ux', () => {
    const result = buildSampleCollectionFieldOptions(baseData, 'PR1', 'A1');
    expect(result.ux).toHaveLength(1);
    expect(result.ux![0]).toMatchObject({ supply: '一供', text: '1' });
  });

  it('returns empty when stage does not match', () => {
    const result = buildSampleCollectionFieldOptions(baseData, 'T0', 'A1');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns empty when pcba does not match', () => {
    const result = buildSampleCollectionFieldOptions(baseData, 'PR1', 'B1');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('extracts number from mixed text like "12台"', () => {
    const data: SampleCollectionWorkbookData = {
      ...baseData,
      sheets: [{
        ...baseData.sheets[0],
        rows: [{ rowName: '硬件测试', cells: { 'PR1__一供__A1': '12台', 'PR1__二供__A1': '5pcs' } }],
      }],
    };
    const result = buildSampleCollectionFieldOptions(data, 'PR1', 'A1');
    expect(result.hw_test![0].text).toBe('12');
    expect(result.hw_test![1].text).toBe('5');
  });
});
