import { describe, expect, it } from 'vitest';
import * as dynamicStructureModule from './dynamicStructure';
import type { FieldDefinition, SKUData } from '../types';
import { buildNextCustomFieldLabel, insertDynamicSupply, updateCustomFieldLabel } from './dynamicStructure';
import { projectSkusForStep } from './supplyProjection';

const makeSku = (): SKUData => ({
  id: 'sku-1',
  stage: 'PR1',
  orderNo: '',
  project: 'A1',
  selectedSupplyKey: '一供',
  supplies: [
    {
      id: 'sup-1',
      supplyKey: '一供',
      label: '一供',
      values: {
        project: 'X6728',
        stage: 'PR1',
        mb_id: 'A1',
        storage: '4+128',
        band: 'SSA',
        prod_loc: '宜宾',
        lcd: 'BOE',
      },
    },
    {
      id: 'sup-2',
      supplyKey: '二供',
      label: '二供',
      values: {
        project: 'X6728',
        stage: 'PR1',
        mb_id: 'A1',
        storage: '4+128',
        band: 'SSA',
        prod_loc: '南昌',
        lcd: 'CSOT',
      },
    },
  ],
});

describe('insertDynamicSupply', () => {
  it('inserts the new supply immediately after the anchor supply', () => {
    const sku = makeSku();

    const result = insertDynamicSupply({
      sku,
      afterSupplyId: 'sup-1',
      currentStep: 2,
      newSupplyId: 'sup-3',
      newSupplyKey: '三供',
    });

    expect(result.supplies.map((supply) => supply.id)).toEqual(['sup-1', 'sup-3', 'sup-2']);
    expect(result.supplies[1].label).toBe('三供');
  });

  it('copies only sku-scoped values into the inserted supply', () => {
    const sku = makeSku();

    const result = insertDynamicSupply({
      sku,
      afterSupplyId: 'sup-2',
      currentStep: 2,
      newSupplyId: 'sup-3',
      newSupplyKey: '三供',
    });

    expect(result.supplies[2].values).toEqual({
      project: 'X6728',
      stage: 'PR1',
      mb_id: 'A1',
      storage: '4+128',
      band: 'SSA',
    });
  });

  it('keeps the current selectedSupplyKey when inserting a new supply from step 3 onward', () => {
    const sku = makeSku();

    const result = insertDynamicSupply({
      sku,
      afterSupplyId: 'sup-2',
      currentStep: 4,
      newSupplyId: 'sup-3',
      newSupplyKey: '三供',
    });

    expect(result.selectedSupplyKey).toBe('一供');
  });

  it('keeps the current selectedSupplyKey in step 2', () => {
    const sku = makeSku();

    const result = insertDynamicSupply({
      sku,
      afterSupplyId: 'sup-2',
      currentStep: 2,
      newSupplyId: 'sup-3',
      newSupplyKey: '三供',
    });

    expect(result.selectedSupplyKey).toBe('一供');
  });
});

describe('insertStructureColumn', () => {
  it('keeps step 2 column insertion as a supply insertion inside the anchor sku', () => {
    const insertStructureColumn = (dynamicStructureModule as Record<string, unknown>).insertStructureColumn as
      | ((args: {
          skuData: SKUData[];
          currentStep: number;
          position: 'before' | 'after';
          anchorSkuId: string;
          anchorSupplyId: string;
          newSupplyId: string;
          newSupplyKey: string;
        }) => SKUData[])
      | undefined;

    expect(insertStructureColumn).toBeTypeOf('function');

    const skuData = [
      makeSku(),
      {
        ...makeSku(),
        id: 'sku-2',
        project: 'B1',
        supplies: [
          {
            id: 'sup-3',
            supplyKey: '一供' as const,
            label: '一供',
            values: { project: 'X6728', stage: 'PR1', mb_id: 'B1' },
          },
        ],
      },
    ];

    const result = insertStructureColumn!({
      skuData,
      currentStep: 2,
      position: 'before',
      anchorSkuId: 'sku-1',
      anchorSupplyId: 'sup-2',
      newSupplyId: 'sup-new',
      newSupplyKey: '三供',
    });

    expect(result).toHaveLength(2);
    expect(result[0].supplies.map((supply) => supply.id)).toEqual(['sup-1', 'sup-new', 'sup-2']);
    expect(result[1].id).toBe('sku-2');
  });

  it('creates a new visible sku column in step 3 instead of a hidden extra supply', () => {
    const insertStructureColumn = (dynamicStructureModule as Record<string, unknown>).insertStructureColumn as
      | ((args: {
          skuData: SKUData[];
          currentStep: number;
          position: 'before' | 'after';
          anchorSkuId: string;
          anchorSupplyId: string;
          newSkuId: string;
        }) => SKUData[])
      | undefined;

    expect(insertStructureColumn).toBeTypeOf('function');

    const skuData = [
      {
        ...makeSku(),
        id: 'sku-a1',
        selectedSupplyKey: '二供',
      },
      {
        ...makeSku(),
        id: 'sku-b1',
        project: 'B1',
        selectedSupplyKey: '一供',
        supplies: [
          {
            id: 'sup-b1',
            supplyKey: '一供' as const,
            label: '一供',
            values: { project: 'X6728', stage: 'PR1', mb_id: 'B1', storage: '6+128' },
          },
        ],
      },
    ];

    const result = insertStructureColumn!({
      skuData,
      currentStep: 3,
      position: 'before',
      anchorSkuId: 'sku-b1',
      anchorSupplyId: 'sup-b1',
      newSkuId: 'sku-new',
    });

    expect(result.map((sku) => sku.id)).toEqual(['sku-a1', 'sku-new', 'sku-b1']);
    expect(result[1].supplies).toHaveLength(1);
    expect(result[1].selectedSupplyKey).toBe('一供');
    expect(projectSkusForStep(result, 4).map((sku) => sku.id)).toEqual(['sku-a1', 'sku-new', 'sku-b1']);
  });
});

describe('updateCustomFieldLabel', () => {
  const fields: FieldDefinition[] = [
    { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto', fieldCategory: 'step1' },
    { id: 'f_custom_1', label: '旧标题', group: '基础信息', behavior: 'manual' },
  ];

  it('updates labels for custom dynamic fields', () => {
    const result = updateCustomFieldLabel(fields, 'f_custom_1', '新标题');

    expect(result[1].label).toBe('新标题');
    expect(result[0].label).toBe('项目名称');
  });

  it('ignores edits for built-in fields', () => {
    const result = updateCustomFieldLabel(fields, 'project', '被忽略');

    expect(result).toEqual(fields);
  });
});

describe('buildNextCustomFieldLabel', () => {
  it('increments after the existing custom-field count', () => {
    const fields: FieldDefinition[] = [
      { id: 'project', label: '项目名称', group: '基础信息', behavior: 'auto', fieldCategory: 'step1' },
      { id: 'f_custom_1', label: '自定义字段1', group: '基础信息', behavior: 'manual' },
      { id: 'f_custom_2', label: '别名', group: '基础信息', behavior: 'manual' },
    ];

    expect(buildNextCustomFieldLabel(fields)).toBe('自定义字段3');
  });
});
