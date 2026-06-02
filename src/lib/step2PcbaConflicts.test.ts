import { describe, it, expect } from 'vitest';
import { buildStep2PcbaConflicts } from './step2PcbaConflicts';
import type { PcbaOption, SKUData } from '../types';

const duplicatePcbaOption: PcbaOption = {
  pcba: 'A1',
  projectName: 'X6728',
  band: '华南',
  bandConflict: false,
  duplicateConflict: true,
  duplicateCount: 2,
  emmc: '128G',
  ddr: '4G',
};

const skuData: Array<Pick<SKUData, 'id' | 'project'>> = [
  { id: 'sku-1', project: 'A1' },
  { id: 'sku-2', project: 'A1' },
  { id: 'sku-3', project: 'B1' },
];

describe('buildStep2PcbaConflicts', () => {
  it('returns one conflict per selected SKU when the selected PCBA is duplicated', () => {
    const result = buildStep2PcbaConflicts({
      pcbaOptions: [duplicatePcbaOption],
      checkedPcbaOptions: ['A1'],
      skuData,
    });

    expect(result).toEqual([
      {
        kind: 'duplicate_pcba',
        pcba: 'A1',
        duplicateCount: 2,
        skuId: 'sku-1',
        detail: '主板标识 A1 在配置表中出现 2 次，请人工确认。',
      },
    ]);
  });

  it('does not surface duplicate PCBAs that were not selected', () => {
    const result = buildStep2PcbaConflicts({
      pcbaOptions: [duplicatePcbaOption],
      checkedPcbaOptions: [],
      skuData,
    });

    expect(result).toEqual([]);
  });
});
