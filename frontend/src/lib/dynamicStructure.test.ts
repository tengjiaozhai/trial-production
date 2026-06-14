import { describe, expect, it } from 'vitest';
import type { FieldDefinition, SKUData } from '../types';
import { buildNextCustomFieldLabel, insertDynamicSupply, updateCustomFieldLabel } from './dynamicStructure';

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
