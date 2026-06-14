/**
 * End-to-end test for Step 5 column alignment.
 * Imports the same lib functions the app uses, runs them with synthetic SKU data,
 * and asserts the 6 critical invariants of the 1+N layout.
 */
import { describe, expect, it } from 'vitest';
import { buildTrialProductionSheetModel } from './univerTrialProductionSheet';
import { getSheetDataBounds, buildWorkbookSnapshot } from '../components/TrialProductionSheet';
import { buildTrialProductionWorkbook } from './trialProductionWorkbook';
import type { FieldDefinition, SKUData } from '../types';

const activeFields: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto' },
  { id: 'stage', label: '试产阶段', group: '基础信息', behavior: 'auto' },
  { id: 'color', label: '颜色', group: '产品规格', behavior: 'manual' },
  { id: 'storage', label: '存储', group: '产品规格', behavior: 'auto' },
  { id: 'hw_eng', label: '硬件', group: '内部样机需求', behavior: 'manual' },
];

const skuData: SKUData[] = [
  {
    id: 'sku1',
    stage: 'EVB',
    orderNo: '',
    project: 'X6728',
    selectedSupplyKey: '一供',
    supplies: [
      { id: 's1', supplyKey: '一供', label: '一供', values: { project: 'X6728', stage: 'EVB', color: 'Black', storage: '128G+4G', hw_eng: '8' } },
      { id: 's2', supplyKey: '二供', label: '二供', values: { project: 'X6728', stage: 'EVB', color: 'White', storage: '128G+4G', hw_eng: '8' } },
    ],
  },
];

describe('Step 5 column alignment end-to-end', () => {
  const model = buildTrialProductionSheetModel({ activeFields, skuData, currentStep: 5 });
  const bounds = getSheetDataBounds(model);
  const snap = buildWorkbookSnapshot(model, skuData, activeFields, 5);
  const wb = buildTrialProductionWorkbook({ projectName: 'X6728', activeFields, skuData });
  const ws = wb.Sheets['搭配表'];

  it('S1: A 列 is field label (not "01"/"02")', () => {
    expect(snap.sheets.sheet1.cellData[1]?.[0]?.v).toBe('项目名称');
    expect(ws['A2']?.v).toBe('项目名称');
    expect(ws['A2']?.v).not.toBe('01');
  });

  it('S2: bounds.lastCol = columns.length (1+N, not 2+N)', () => {
    expect(bounds.lastCol).toBe(2);
    expect(model.step5Model!.columns.length).toBe(2);
    expect(bounds.lastCol).toBe(model.step5Model!.columns.length);
  });

  it('S3: data values in cols 1+ (not 2+)', () => {
    expect(snap.sheets.sheet1.cellData[1]?.[1]?.v).toBe('X6728');
    expect(snap.sheets.sheet1.cellData[4]?.[1]?.v).toBe('Black');
    expect(snap.sheets.sheet1.cellData[4]?.[2]?.v).toBe('White');
    expect(snap.sheets.sheet1.cellData[4]?.[3]?.v).toBeUndefined();
  });

  it('S4: workbook A 列 width adapts to label length', () => {
    const wch = ws['!cols']?.[0]?.wch as number;
    expect(wch).toBeGreaterThanOrEqual(18);
    expect(wch).not.toBe(4);
  });

  it('S5: eFuse / wide label "硬件" works in A 列', () => {
    const rows = snap.sheets.sheet1.cellData;
    const hwRow = Object.values(rows).find((r) => r?.[0]?.v === '硬件');
    expect(hwRow).toBeDefined();
    expect(hwRow?.[1]?.v).toBe('8');
    expect(hwRow?.[2]?.v).toBe('8');
  });

  it('S6: storage colSpan=2 (跨 SKU 字段保持横向合并)', () => {
    const storageRow = Object.values(snap.sheets.sheet1.cellData).find((r) => r?.[0]?.v === '存储');
    expect(storageRow).toBeDefined();
    expect(storageRow?.[1]?.v).toBe('128G+4G');
    const merge = snap.sheets.sheet1.mergeData.find((m) => m.startColumn === 1 && m.endColumn === 2);
    expect(merge).toBeDefined();
  });
});
