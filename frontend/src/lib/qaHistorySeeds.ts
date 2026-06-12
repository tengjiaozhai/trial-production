import type { FieldDefinition, HistoryEntry, SKUData } from '../types';

const QA_ACTIVE_FIELDS: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'stage', label: '试产阶段', group: '基础信息', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'supply_select', label: '一供/二供', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'prod_loc', label: '试产地点', group: '基础信息', behavior: 'manual', fieldCategory: 'step1' },
  { id: 'order_no', label: '订单号', group: '基础信息', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'mb_id', label: '主板标识', group: '产品规格', behavior: 'manual', fieldCategory: 'manual' },
  { id: 'band', label: '频段', group: '产品规格', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'storage', label: '存储', group: '产品规格', behavior: 'auto', fieldCategory: 'step1' },
  { id: 'f_custom_seed', label: '自定义字段1', group: '产品规格', behavior: 'manual' },
];

function buildStep3SkuData(): SKUData[] {
  return [
    {
      id: 'sku-a1',
      stage: 'PR1',
      orderNo: '',
      project: 'A1',
      selectedSupplyKey: '二供',
      supplies: [
        {
          id: 'sup-1',
          supplyKey: '一供',
          label: '一供',
          values: {
            project: 'Seed-Step3',
            stage: 'PR1',
            prod_loc: '宜宾',
            mb_id: 'A1',
            band: 'SSA',
            storage: '4+128',
            order_no: 'SO-1',
            f_custom_seed: 'alpha',
          },
        },
        {
          id: 'sup-2',
          supplyKey: '二供',
          label: '二供',
          values: {
            project: 'Seed-Step3',
            stage: 'PR1',
            prod_loc: '南昌',
            mb_id: 'A1',
            band: 'LATAM',
            storage: '6+128',
            order_no: 'SO-2',
            f_custom_seed: 'beta',
          },
        },
      ],
    },
  ];
}

function buildSeedEntry(currentStep: 3 | 5): HistoryEntry {
  const isComplete = currentStep === 5;

  return {
    id: `history_seed_step${currentStep}`,
    timestamp: Date.now(),
    name: `Seed-Step${currentStep}`,
    version: 1,
    projectInfo: {
      name: `Seed-Step${currentStep}`,
      mainboardId: 'A1',
      checkedPcbaOptions: ['A1'],
      customer: '传音',
      stage: 'PR1',
      files: [],
    },
    skuData: buildStep3SkuData(),
    currentStep,
    activeFields: QA_ACTIVE_FIELDS,
    isFlowComplete: isComplete,
    isArchived: isComplete,
  };
}

export function shouldAllowQaSeed(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

export function getQaSeedEntries(search: string): HistoryEntry[] | null {
  const params = new URLSearchParams(search);
  const qaSeed = params.get('qaSeed');

  if (qaSeed === 'step3') {
    return [buildSeedEntry(3)];
  }

  if (qaSeed === 'step5') {
    return [buildSeedEntry(5)];
  }

  return null;
}
