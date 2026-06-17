import * as XLSX from 'xlsx-js-style';
import { describe, expect, it } from 'vitest';
import { buildTrialProductionWorkbook } from './trialProductionWorkbook';
import type { FieldDefinition, SKUData } from '../types';

const activeFields: FieldDefinition[] = [
  { id: 'project', label: 'Project', group: 'Basic', behavior: 'manual' },
  { id: 'stage', label: 'Stage', group: 'Basic', behavior: 'manual' },
  { id: 'storage', label: 'Storage', group: 'Basic', behavior: 'manual' },
  { id: 'emmc', label: 'flash EMMC', group: 'Storage/Board', behavior: 'manual' },
];

const skuData: SKUData[] = [
  {
    id: 'sku_1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    fieldOptions: {},
    supplies: [
      {
        id: 's1',
        supplyKey: '一供',
        label: 'Supply A',
        values: { project: 'X6728', stage: 'PR1', storage: '4+128', emmc: 'emmc-a-128G' },
      },
      {
        id: 's2',
        supplyKey: '二供',
        label: 'Supply B',
        values: { project: 'X6728', stage: 'PR1', storage: '4+128', emmc: 'emmc-b-128G' },
      },
    ],
  },
];

describe('buildTrialProductionWorkbook', () => {
  it('creates a workbook with sheet named correctly', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    expect(wb.SheetNames).toContain('搭配表');
  });

  it('sheet has merges defined', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    const ws = wb.Sheets['搭配表'];
    expect(ws['!merges']).toBeDefined();
    expect((ws['!merges'] as XLSX.Range[]).length).toBeGreaterThan(0);
  });

  it('first cell has a group title value', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    const ws = wb.Sheets['搭配表'];
    expect(ws['A1']?.v).toBeTruthy();
  });

  it('writes efuse suffixes into exported field labels', () => {
    const wb = buildTrialProductionWorkbook({
      projectName: 'X6728',
      activeFields: [
        { id: 'hw_eng', label: '硬件', group: '内部样机需求', behavior: 'manual' },
      ],
      skuData: [
        {
          id: 'sku_1',
          stage: 'PR1',
          orderNo: '',
          project: 'X6728',
          fieldOptions: {},
          supplies: [
            {
              id: 's1',
              supplyKey: '一供',
              label: 'Supply A',
              values: { hw_eng: '8' },
            },
          ],
        },
      ],
      efuseConfigs: { hw_eng: 'efuse' },
    });

    const ws = wb.Sheets['搭配表'];
    expect(ws['A2']?.v).toBe('硬件(efuse)');
  });

  it('applies ABCDE 5-color scheme to title rows', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    const ws = wb.Sheets['搭配表'];

    // First group title (groupIndex 0) → A: EAF3FF
    const a1 = ws['A1'];
    expect(a1?.s?.fill?.fgColor?.rgb).toBe('EAF3FF');
    expect(a1?.s?.font?.bold).toBe(true);
    expect(a1?.s?.font?.sz).toBe(14);
  });

  it('applies ABCDE 5-color body row colors', () => {
    const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
    const ws = wb.Sheets['搭配表'];

    // First field row (groupIndex 0) → A body: F7FBFF
    const a2 = ws['A2'];
    expect(a2?.s?.fill?.fgColor?.rgb).toBe('F7FBFF');
  });

  it('cycles 5 colors across 6+ groups (A→B→C→D→E→A)', () => {
    const sixGroupFields: FieldDefinition[] = [
      { id: 'p', label: 'P', group: 'G1', behavior: 'manual' },
      { id: 'q', label: 'Q', group: 'G2', behavior: 'manual' },
      { id: 'r', label: 'R', group: 'G3', behavior: 'manual' },
      { id: 's', label: 'S', group: 'G4', behavior: 'manual' },
      { id: 't', label: 'T', group: 'G5', behavior: 'manual' },
      { id: 'u', label: 'U', group: 'G6', behavior: 'manual' },
    ];
    const wb = buildTrialProductionWorkbook({ projectName: 'X', activeFields: sixGroupFields, skuData });
    const ws = wb.Sheets['搭配表'];

    // Each group starts with a title row. With 6 groups, expect 5 distinct title colors.
    // (Note: G1 emits a __supplier__ row in buildTrialProductionWorkbook's includeSupplierRow mode,
    //  so G2's title lands at A4 instead of A3.)
    const titleAddresses = ['A1', 'A4', 'A6', 'A8', 'A10', 'A12'];
    const titleColors = titleAddresses.map((a) => ws[a]?.s?.fill?.fgColor?.rgb);
    expect(titleColors).toEqual(['EAF3FF', 'EAFBF7', 'F3EEFF', 'FFF1E6', 'EAF8F0', 'EAF3FF']);
  });
});
