import { describe, it, expect } from 'vitest';
import { buildStep2CellConflicts } from './step2CellConflicts';

it('emits one unresolved supply cell conflict when duplicate source rows produce two different candidates', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { lcd: 'BOE', emmc: '128G' } },
      { pcba: 'A1', sourceIndex: 1, values: { lcd: 'CSOT', emmc: '128G' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { lcd: '' } },
        ],
      },
    ],
  });

  expect(result).toEqual([
    {
      kind: 'cell_conflict',
      scope: 'supply',
      cellId: 'step2-cell-sku-1-sup-1-lcd',
      skuId: 'sku-1',
      supplyId: 'sup-1',
      fieldId: 'lcd',
      fieldLabel: 'LCD',
      pcba: 'A1',
      supplyLabel: '一供',
      candidates: [
        {
          source: 'key_material',
          sourceLabel: '关键物料',
          supplyTag: '',
          vendor: '',
          materialName: 'BOE',
          writeValue: 'BOE',
          label: 'BOE',
        },
        {
          source: 'key_material',
          sourceLabel: '关键物料',
          supplyTag: '',
          vendor: '',
          materialName: 'CSOT',
          writeValue: 'CSOT',
          label: 'CSOT',
        },
      ],
    },
  ]);
});

it('does not emit a conflict when the current cell already has a resolved non-empty value', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { stage: 'PR1' } },
      { pcba: 'A1', sourceIndex: 1, values: { stage: 'PR2' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { stage: 'PR1' } },
        ],
      },
    ],
  });

  expect(result).toEqual([]);
});

it('keeps a duplicate-row conflict when the current cell is non-empty but does not match any candidate', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { stage: 'PR1' } },
      { pcba: 'A1', sourceIndex: 1, values: { stage: 'PR2' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { stage: '手工值' } },
        ],
      },
    ],
  });

  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    scope: 'sku',
    fieldId: 'stage',
  });
});

it('emits one sku-scoped conflict for band instead of one per supply', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['D1'],
    pcbaRows: [
      { pcba: 'D1', sourceIndex: 0, values: { band: '拉美' } },
      { pcba: 'D1', sourceIndex: 1, values: { band: '沙特（艾为PD IC）' } },
    ],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'D1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { band: '' } },
          { id: 'sup-2', supplyKey: '二供', label: '二供', values: { band: '' } },
          { id: 'sup-3', supplyKey: '三供', label: '三供', values: { band: '' } },
        ],
      },
    ],
  });

  expect(result).toEqual([
    {
      kind: 'cell_conflict',
      scope: 'sku',
      cellId: 'step2-cell-sku-1-band',
      skuId: 'sku-1',
      fieldId: 'band',
      fieldLabel: '频段',
      pcba: 'D1',
      supplyLabel: '整列',
      candidates: [
        {
          source: 'key_material',
          sourceLabel: '关键物料',
          supplyTag: '',
          vendor: '',
          materialName: '拉美',
          writeValue: '拉美',
          label: '拉美',
        },
        {
          source: 'key_material',
          sourceLabel: '关键物料',
          supplyTag: '',
          vendor: '',
          materialName: '沙特（艾为PD IC）',
          writeValue: '沙特（艾为PD IC）',
          label: '沙特（艾为PD IC）',
        },
      ],
    },
  ]);
});

it('emits a managed material conflict for the same supply when key and managed desc values diverge', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { battery: '' } },
        ],
      },
    ],
    keyMaterialFieldOptions: {
      battery: [
        { supply: '一供', text: '一供ATL5000mAh', sourceCategory2: '电池' },
      ],
    },
    managedMaterialCore: {
      sourceFileName: 'X6728管控物料表.xlsx',
      sourceSheetName: 'X6728',
      rows: [
        { materialName: '电池', code: 'M-01', vendor: 'BYD', supply: '一供' },
        { materialName: '电池', code: 'M-02', vendor: 'BYD', supply: '二供' },
      ],
      materialNames: ['电池'],
      materialNameByStaticField: {},
      materialNameByDescField: { battery: '电池' },
      materialNameByEmmcSize: {},
      materialNameByDdrSize: {},
    },
  } as any);

  expect(result).toEqual([
    {
      kind: 'cell_conflict',
      scope: 'supply',
      cellId: 'step2-cell-sku-1-sup-1-battery',
      skuId: 'sku-1',
      supplyId: 'sup-1',
      fieldId: 'battery',
      fieldLabel: '电池',
      pcba: 'A1',
      supplyLabel: '一供',
      candidates: [
        {
          source: 'key_material',
          sourceLabel: '关键物料',
          supplyTag: '一供',
          vendor: '',
          materialName: '电池',
          writeValue: '一供ATL5000mAh',
          label: '一供ATL5000mAh',
        },
        {
          source: 'managed_material',
          sourceLabel: '管控物料',
          supplyTag: '一供',
          vendor: 'BYD',
          materialName: '电池',
          writeValue: '一供BYD电池',
          label: '一供 · BYD · 电池',
        },
      ],
    },
  ]);
});

it('keeps conflicts when key and managed battery vendors are swapped between first and second supply', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { battery: '' } },
          { id: 'sup-2', supplyKey: '二供', label: '二供', values: { battery: '' } },
        ],
      },
    ],
    keyMaterialFieldOptions: {
      battery: [
        { supply: '一供', text: '一供锂威聚合物_BL-58HX_5850mAh_CB_LW', sourceCategory2: '电池' },
        { supply: '二供', text: '二供ATL聚合物_BL-58HX_5850mAh_CB_ATL', sourceCategory2: '电池' },
      ],
    },
    managedMaterialCore: {
      sourceFileName: 'X6728管控物料表.xlsx',
      sourceSheetName: 'X6728',
      rows: [
        { materialName: '电池', code: 'M-01', vendor: 'ATL', supply: '一供' },
        { materialName: '电池', code: 'M-02', vendor: '锂威', supply: '二供' },
      ],
      materialNames: ['电池'],
      materialNameByStaticField: {},
      materialNameByDescField: { battery: '电池' },
      materialNameByEmmcSize: {},
      materialNameByDdrSize: {},
    },
  } as any);

  expect(result).toEqual([
    {
      kind: 'cell_conflict',
      scope: 'supply',
      cellId: 'step2-cell-sku-1-sup-1-battery',
      skuId: 'sku-1',
      supplyId: 'sup-1',
      fieldId: 'battery',
      fieldLabel: '电池',
      pcba: 'A1',
      supplyLabel: '一供',
      candidates: [
        {
          source: 'key_material',
          sourceLabel: '关键物料',
          supplyTag: '一供',
          vendor: '',
          materialName: '电池',
          writeValue: '一供锂威聚合物_BL-58HX_5850mAh_CB_LW',
          label: '一供锂威聚合物_BL-58HX_5850mAh_CB_LW',
        },
        {
          source: 'managed_material',
          sourceLabel: '管控物料',
          supplyTag: '一供',
          vendor: 'ATL',
          materialName: '电池',
          writeValue: '一供ATL电池',
          label: '一供 · ATL · 电池',
        },
      ],
    },
    {
      kind: 'cell_conflict',
      scope: 'supply',
      cellId: 'step2-cell-sku-1-sup-2-battery',
      skuId: 'sku-1',
      supplyId: 'sup-2',
      fieldId: 'battery',
      fieldLabel: '电池',
      pcba: 'A1',
      supplyLabel: '二供',
      candidates: [
        {
          source: 'key_material',
          sourceLabel: '关键物料',
          supplyTag: '二供',
          vendor: '',
          materialName: '电池',
          writeValue: '二供ATL聚合物_BL-58HX_5850mAh_CB_ATL',
          label: '二供ATL聚合物_BL-58HX_5850mAh_CB_ATL',
        },
        {
          source: 'managed_material',
          sourceLabel: '管控物料',
          supplyTag: '二供',
          vendor: '锂威',
          materialName: '电池',
          writeValue: '二供锂威电池',
          label: '二供 · 锂威 · 电池',
        },
      ],
    },
  ]);
});

it('still emits swapped battery conflicts when managed material state is missing desc match metadata for initial conflict clearing', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { battery: '一供锂威聚合物_BL-58HX_5850mAh_CB_LW' } },
          { id: 'sup-2', supplyKey: '二供', label: '二供', values: { battery: '二供ATL聚合物_BL-58HX_5850mAh_CB_ATL' } },
        ],
      },
    ],
    keyMaterialFieldOptions: {
      battery: [
        { supply: '一供', text: '一供锂威聚合物_BL-58HX_5850mAh_CB_LW', sourceCategory2: '电池' },
        { supply: '二供', text: '二供ATL聚合物_BL-58HX_5850mAh_CB_ATL', sourceCategory2: '电池' },
      ],
    },
    managedMaterialCore: {
      sourceFileName: 'X6728管控物料表.xlsx',
      sourceSheetName: 'X6728',
      rows: [
        { materialName: '电池', code: 'M-01', vendor: 'ATL', supply: '一供' },
        { materialName: '电池', code: 'M-02', vendor: '锂威', supply: '二供' },
      ],
      materialNames: ['电池'],
      materialNameByStaticField: {},
      materialNameByEmmcSize: {},
      materialNameByDdrSize: {},
    },
    respectCurrentValues: false,
  } as any);

  expect(result.filter((item) => item.fieldId === 'battery')).toHaveLength(2);
});

it('should not detect conflict for 三供/四供 when 一供 or 二供 resolved', () => {
  const skuData = [
    {
      id: 'sku-1',
      stage: 'PR1',
      orderNo: '',
      project: 'A1',
      supplies: [
        { id: 'sup-1', supplyKey: '一供' as const, label: '一供', values: { battery: '思立微' } },
        { id: 'sup-2', supplyKey: '二供' as const, label: '二供', values: { battery: '汇顶' } },
        { id: 'sup-3', supplyKey: '三供' as const, label: '三供', values: { battery: '' } },
        { id: 'sup-4', supplyKey: '四供' as const, label: '四供', values: { battery: '' } },
      ],
    },
  ];

  const conflicts = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { battery: '思立微' } },
      { pcba: 'A1', sourceIndex: 1, values: { battery: '汇顶' } },
    ],
    skuData,
    respectCurrentValues: true,
  });

  // 一供和二供已经解决冲突，三供四供不应该有冲突
  const supplyConflicts = conflicts.filter(c => c.scope === 'supply');
  expect(supplyConflicts).toHaveLength(0);
});

it('should detect conflict for 三供/四供 when 一供 and 二供 not resolved', () => {
  const skuData = [
    {
      id: 'sku-1',
      stage: 'PR1',
      orderNo: '',
      project: 'A1',
      supplies: [
        { id: 'sup-1', supplyKey: '一供' as const, label: '一供', values: { battery: '' } },
        { id: 'sup-2', supplyKey: '二供' as const, label: '二供', values: { battery: '' } },
        { id: 'sup-3', supplyKey: '三供' as const, label: '三供', values: { battery: '' } },
        { id: 'sup-4', supplyKey: '四供' as const, label: '四供', values: { battery: '' } },
      ],
    },
  ];

  const conflicts = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [
      { pcba: 'A1', sourceIndex: 0, values: { battery: '思立微' } },
      { pcba: 'A1', sourceIndex: 1, values: { battery: '汇顶' } },
    ],
    skuData,
    respectCurrentValues: true,
  });

  // 一供和二供都未解决，所有供应都应该有冲突
  const supplyConflicts = conflicts.filter(c => c.scope === 'supply');
  expect(supplyConflicts).toHaveLength(4);
});

it('keeps swapped battery conflicts when current values are non-empty but do not match either candidate', () => {
  const result = buildStep2CellConflicts({
    checkedPcbaOptions: ['A1'],
    pcbaRows: [],
    skuData: [
      {
        id: 'sku-1',
        stage: 'PR1',
        orderNo: '',
        project: 'A1',
        supplies: [
          { id: 'sup-1', supplyKey: '一供', label: '一供', values: { battery: '手工一供' } },
          { id: 'sup-2', supplyKey: '二供', label: '二供', values: { battery: '手工二供' } },
        ],
      },
    ],
    keyMaterialFieldOptions: {
      battery: [
        { supply: '一供', text: '一供锂威聚合物_BL-58HX_5850mAh_CB_LW', sourceCategory2: '电池' },
        { supply: '二供', text: '二供ATL聚合物_BL-58HX_5850mAh_CB_ATL', sourceCategory2: '电池' },
      ],
    },
    managedMaterialCore: {
      sourceFileName: 'X6728管控物料表.xlsx',
      sourceSheetName: 'X6728',
      rows: [
        { materialName: '电池', code: 'M-01', vendor: 'ATL', supply: '一供' },
        { materialName: '电池', code: 'M-02', vendor: '锂威', supply: '二供' },
      ],
      materialNames: ['电池'],
      materialNameByStaticField: {},
      materialNameByDescField: { battery: '电池' },
      materialNameByEmmcSize: {},
      materialNameByDdrSize: {},
    },
  } as any);

  expect(result.filter((item) => item.fieldId === 'battery')).toHaveLength(2);
});
