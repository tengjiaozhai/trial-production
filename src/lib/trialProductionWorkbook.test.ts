import * as XLSX from 'xlsx';
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
});
