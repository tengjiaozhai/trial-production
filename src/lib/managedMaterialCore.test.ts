import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  parseManagedMaterialCoreWorkbook,
  buildManagedMaterialCoreFieldOptions,
} from './managedMaterialCore';

function makeWorkbookFile(
  name: string,
  sheets: Array<{ name: string; rows: any[][]; hidden?: 0 | 1 }>
) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Sheets: [] as any[] };
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
    wb.Workbook!.Sheets!.push({ Hidden: sheet.hidden ?? 0 });
  }
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('parseManagedMaterialCoreWorkbook', () => {
  it('returns null when file name does not include guankong-wuliao', async () => {
    const file = makeWorkbookFile('other.xlsx', [
      { name: 'Sheet1', rows: [['a']], hidden: 0 },
    ]);
    expect(await parseManagedMaterialCoreWorkbook(file)).toBeNull();
  });

  it('skips hidden sheets and picks the first visible business sheet', async () => {
    const file = makeWorkbookFile('X6728传音管控物料表.xlsx', [
      { name: '保密级别', rows: [[''], ['']], hidden: 0 },
      { name: 'Change List', rows: [[''], ['']], hidden: 0 },
      {
        name: 'X6728',
        hidden: 0,
        rows: [
          [''],
          ['传音管控物料表'],
          ['品牌:', 'Infinix'],
          ['研发填写'],
          ['序号', '物料名称', '传音编码', '物料描述', '供应商型号', '供应商', '用量', '物料颜色', '传音是否已封样', '物料通用性', '平台是否已认证', 'MOQ', 'MPQ', '试产LT', '量产LT', '一/二供'],
          [1, 'CPU',         '15600178', 'MTK主芯片',   'MT6769V/CBZA',       'MTK',                   1, '/', '是', '标准件', '是', 3000, 3000, 28, 14, '一供'],
          [2, '电源管理',    '15700056', '电源管理器',  'MT6358W/AN',         'MTK',                   1, '/', '是', '标准件', '是', 3000, 3000, 28, 14, '一供'],
          [3, '128GB EMMC',  '14201661', 'EMMC_128G',   'HAC19-1280BSAC',     'HAC19-1280BSAC',        1, '/', '是', '标准件', '是', 3000, 3000, 28, 14, '一供'],
          [4, 'LPD4X 4GB',  '14201579', 'LPDDR_4G',    'K4UBE3D4AM_SGCL',    'K4UBE3D4AM_SGCL',       1, '/', '是', '标准件', '是', 3000, 3000, 28, 14, '一供'],
        ],
      },
      { name: 'X6728B', rows: [['hidden']], hidden: 1 },
    ]);

    const result = await parseManagedMaterialCoreWorkbook(file);
    expect(result).not.toBeNull();
    expect(result!.sourceSheetName).toBe('X6728');
    expect(result!.rows.map((r) => r.materialName)).toContain('CPU');
    expect(result!.rows.map((r) => r.materialName)).toContain('128GB EMMC');
    expect(result!.rows).toHaveLength(4);
  });

  it('returns null when required header columns are missing', async () => {
    const file = makeWorkbookFile('X6728传音管控物料表.xlsx', [
      {
        name: 'X6728',
        hidden: 0,
        rows: [
          ['传音管控物料表'],
          ['序号', '物料名称', '供应商'],
          [1, 'CPU', 'MTK'],
        ],
      },
    ]);
    const result = await parseManagedMaterialCoreWorkbook(file);
    expect(result).toBeNull();
  });
});

describe('buildManagedMaterialCoreFieldOptions', () => {
  const baseMatch = {
    sourceFileName: 'X6728传音管控物料表.xlsx',
    sourceSheetName: 'X6728',
    materialNames: ['CPU', '128GB EMMC', 'LPD4X 4GB', '电源管理', 'PA-4G', '射频收发器', 'NFC'],
    rows: [
      { materialName: 'CPU',        code: '15600178', vendor: 'MTK',              supply: '一供' },
      { materialName: '128GB EMMC', code: '14201661', vendor: 'HAC19-1280BSAC',   supply: '一供' },
      { materialName: '128GB EMMC', code: '14201611', vendor: 'FEMDNN128G-A3V01', supply: '二供' },
      { materialName: 'LPD4X 4GB', code: '14201579', vendor: 'K4UBE3D4AM_SGCL',  supply: '一供' },
      { materialName: '电源管理',   code: '15700056', vendor: 'MTK',              supply: '一供' },
      { materialName: 'PA-4G',      code: '33600023', vendor: 'FX5627Y',          supply: '一供' },
      { materialName: '射频收发器', code: '15700052', vendor: 'MT6177MV/BC',      supply: '一供' },
      { materialName: 'NFC',        code: '34200031', vendor: 'SL6550A-X6728专用',supply: '一供' },
    ],
    materialNameByStaticField: {
      cpu:            'CPU',
      pmu:            '电源管理',
      tx:             'PA-4G',
      rf_transceiver: '射频收发器',
      nfc:            'NFC',
    },
    materialNameByEmmcSize: { '128': '128GB EMMC' },
    materialNameByDdrSize:  { '4':   'LPD4X 4GB'  },
  };

  const pcbaOpt = {
    pcba: 'A1', projectName: 'X6728', band: 'SSA',
    bandConflict: false, emmc: '128G', ddr: '4G',
  };

  it('builds cpu field as code-only', () => {
    const result = buildManagedMaterialCoreFieldOptions(baseMatch, pcbaOpt);
    expect(result.cpu?.[0].text).toBe('15600178');
  });

  it('builds emmc with code+supply+vendor+size for each supply row', () => {
    const result = buildManagedMaterialCoreFieldOptions(baseMatch, pcbaOpt);
    const texts = result.emmc?.map((item) => item.text);
    expect(texts).toEqual([
      '14201661一供HAC19-1280BSAC128G',
      '14201611二供FEMDNN128G-A3V01128G',
    ]);
  });

  it('builds ddr with code+supply+vendor+size', () => {
    const result = buildManagedMaterialCoreFieldOptions(baseMatch, pcbaOpt);
    expect(result.ddr?.[0].text).toBe('14201579一供K4UBE3D4AM_SGCL4G');
  });

  it('builds pmu/tx/rf/nfc as code+supply', () => {
    const result = buildManagedMaterialCoreFieldOptions(baseMatch, pcbaOpt);
    expect(result.pmu?.[0].text).toBe('15700056一供');
    expect(result.tx?.[0].text).toBe('33600023一供');
    expect(result.rf_transceiver?.[0].text).toBe('15700052一供');
    expect(result.nfc?.[0].text).toBe('34200031一供');
  });

  it('returns empty arrays when pcba emmc/ddr size does not match', () => {
    const result = buildManagedMaterialCoreFieldOptions(baseMatch, {
      ...pcbaOpt, emmc: '256G', ddr: '6G',
    });
    expect(result.emmc ?? []).toHaveLength(0);
    expect(result.ddr ?? []).toHaveLength(0);
  });
});
