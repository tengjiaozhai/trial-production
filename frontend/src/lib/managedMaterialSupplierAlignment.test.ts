import { describe, expect, it } from 'vitest';
import type { ManagedMaterialCoreMatch, PcbaOption, SplitFieldOption } from '../types';
import { buildManagedMaterialSupplierAlignment } from './managedMaterialSupplierAlignment';

describe('buildManagedMaterialSupplierAlignment', () => {
  it('returns source-aware conflict candidates and managed-only supply additions for desc fields', () => {
    const pcbaOption: PcbaOption = {
      pcba: 'A1',
      projectName: 'X6728',
      band: 'SSA',
      bandConflict: false,
      duplicateConflict: false,
      duplicateCount: 1,
      emmc: '128G',
      ddr: '4G',
    };

    const managedMatch = {
      sourceFileName: 'X6728管控物料表.xlsx',
      sourceSheetName: 'X6728',
      rows: [
        { materialName: '电池', code: 'M-01', vendor: 'ATL', supply: '一供' },
        { materialName: '电池', code: 'M-02', vendor: 'BYD', supply: '二供' },
        { materialName: '喇叭', code: 'S-01', vendor: 'AAC', supply: '一供' },
      ],
      materialNames: ['电池', '喇叭'],
      materialNameByStaticField: {},
      materialNameByDescField: {
        battery: '电池',
        speaker: '喇叭',
      },
      materialNameByEmmcSize: {},
      materialNameByDdrSize: {},
    } as ManagedMaterialCoreMatch;

    const keyMaterialFieldOptions: Partial<Record<string, SplitFieldOption[]>> = {
      battery: [
        { supply: '一供', text: '一供ATL5000mAh', sourceCategory2: '电池' },
      ],
      speaker: [
        { supply: '一供', text: '一供AACBOX', sourceCategory2: '喇叭' },
      ],
    };

    const result = buildManagedMaterialSupplierAlignment({
      keyMaterialFieldOptions,
      managedMaterialMatch: managedMatch,
      pcbaOption,
    });

    expect(result.conflictCandidatesByField.battery).toEqual([
      {
        source: 'key-material',
        sourceLabel: '关键物料',
        supply: '一供',
        text: '一供ATL5000mAh',
        sourceCategory2: '电池',
        writeValue: '一供ATL5000mAh',
      },
      {
        source: 'managed-material',
        sourceLabel: '管控物料',
        supply: '一供',
        text: '一供ATL电池',
        sourceCategory2: '电池',
        writeValue: '一供ATL电池',
      },
    ]);

    expect(result.managedOnlySupplyAdditionsByField.battery).toEqual([
      {
        source: 'managed-material',
        sourceLabel: '管控物料',
        supply: '二供',
        text: '二供BYD电池',
        sourceCategory2: '电池',
        writeValue: '二供BYD电池',
      },
    ]);
  });
});
