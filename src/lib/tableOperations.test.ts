import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, SKUData } from '../types';
import {
  insertFieldAfter,
  createInsertedField,
  createBlankSkuFromTemplate,
  buildNewFieldId,
  buildNewSupplyId,
  buildNewSkuId,
  captureCopyFromSku,
  pasteCopiedIntoTarget,
  type CopiedSku,
} from './tableOperations';

function makeField(overrides: Partial<FieldDefinition>): FieldDefinition {
  return {
    id: 'f',
    label: '默认',
    group: '基本信息',
    behavior: 'manual',
    ...overrides,
  };
}

function makeSku(overrides: Partial<SKUData>): SKUData {
  return {
    id: 'sku1',
    stage: 'PR1',
    orderNo: 'O1',
    project: 'X6728',
    supplies: [
      { id: 's1', supplyKey: '一供', label: '一供', values: { storage: '4+128', band: 'SSA' } },
      { id: 's2', supplyKey: '二供', label: '二供', values: { storage: '4+128', band: 'SSA' } },
    ],
    ...overrides,
  };
}

describe('insertFieldAfter', () => {
  it('places the new field immediately after the target id', () => {
    const fields = [
      makeField({ id: 'a', group: '基本信息' }),
      makeField({ id: 'b', group: '基本信息' }),
      makeField({ id: 'c', group: '物料' }),
    ];
    const newField = makeField({ id: 'x', label: '新' });
    const result = insertFieldAfter(fields, 'a', newField);
    expect(result.map(f => f.id)).toEqual(['a', 'x', 'b', 'c']);
  });

  it('appends to the end when afterFieldId is the last field', () => {
    const fields = [makeField({ id: 'a' }), makeField({ id: 'b' })];
    const newField = makeField({ id: 'x' });
    const result = insertFieldAfter(fields, 'b', newField);
    expect(result.map(f => f.id)).toEqual(['a', 'b', 'x']);
    expect(result).toHaveLength(3);
  });

  it('returns a new array (does not mutate input)', () => {
    const fields = [makeField({ id: 'a' }), makeField({ id: 'b' })];
    const original = [...fields];
    const newField = makeField({ id: 'x' });
    insertFieldAfter(fields, 'a', newField);
    expect(fields).toEqual(original);
  });

  it('preserves the new field group (caller decides group)', () => {
    const fields = [makeField({ id: 'a', group: 'G1' })];
    const newField = makeField({ id: 'x', group: 'G2' });
    const result = insertFieldAfter(fields, 'a', newField);
    expect(result[1].group).toBe('G2');
  });
});

describe('createInsertedField', () => {
  it('reuses the group of the after field and uses the provided label', () => {
    const fields = [
      makeField({ id: 'a', group: 'G1' }),
      makeField({ id: 'b', group: 'G2' }),
    ];
    const result = createInsertedField('a', fields, '自定义标题');
    expect(result.group).toBe('G1');
    expect(result.label).toBe('自定义标题');
  });

  it('uses the fallback group "基本信息" when afterFieldId is missing', () => {
    const fields = [makeField({ id: 'a', group: '物料' })];
    const result = createInsertedField('not-exists', fields, '新标题');
    expect(result.group).toBe('基本信息');
  });

  it('uses manual behavior, not calc', () => {
    const fields = [makeField({ id: 'a' })];
    const result = createInsertedField('a', fields, '标题');
    expect(result.behavior).toBe('manual');
  });

  it('generates a non-empty unique id', () => {
    const fields = [makeField({ id: 'a' })];
    const r1 = createInsertedField('a', fields, '标题1');
    const r2 = createInsertedField('a', fields, '标题2');
    expect(r1.id).toBeTruthy();
    expect(r1.id).not.toBe(r2.id);
  });
});

describe('createBlankSkuFromTemplate', () => {
  it('uses the provided newId and keeps stage/orderNo', () => {
    const template = makeSku({ stage: 'PR2', orderNo: 'O-9', selectedSupplyKey: '二供' as const });
    const result = createBlankSkuFromTemplate(template, 'sku_new');
    expect(result.id).toBe('sku_new');
    expect(result.stage).toBe('PR2');
    expect(result.orderNo).toBe('O-9');
    expect(result.selectedSupplyKey).toBe('二供');
  });

  it('copies the same number of supplies with the same supplyKey and label', () => {
    const template = makeSku({});
    const result = createBlankSkuFromTemplate(template, 'sku_new');
    expect(result.supplies).toHaveLength(template.supplies.length);
    result.supplies.forEach((sup, i) => {
      expect(sup.supplyKey).toBe(template.supplies[i].supplyKey);
      expect(sup.label).toBe(template.supplies[i].label);
    });
  });

  it('empties values for all supplies', () => {
    const template = makeSku({});
    const result = createBlankSkuFromTemplate(template, 'sku_new');
    result.supplies.forEach(sup => {
      expect(sup.values).toEqual({});
    });
  });

  it('does not collide with the source sku id or supply ids', () => {
    const template = makeSku({});
    const result = createBlankSkuFromTemplate(template, 'sku_new');
    expect(result.id).not.toBe(template.id);
    result.supplies.forEach((sup, i) => {
      expect(sup.id).not.toBe(template.supplies[i].id);
    });
  });

  it('drops fieldOptions from the template (caller can re-resolve later)', () => {
    const template = makeSku({
      fieldOptions: { lcd: [{ supply: '一供', text: 'foo', sourceCategory2: 'LCD' }] },
    });
    const result = createBlankSkuFromTemplate(template, 'sku_new');
    expect(result.fieldOptions).toBeUndefined();
  });

  it('does not share any reference with the source supply values', () => {
    const template = makeSku({});
    const result = createBlankSkuFromTemplate(template, 'sku_new');
    expect(result.supplies[0].values).not.toBe(template.supplies[0].values);
  });
});

describe('id generators', () => {
  it('buildNewFieldId returns a non-empty unique string', () => {
    const a = buildNewFieldId();
    const b = buildNewFieldId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('buildNewSupplyId returns a non-empty unique string', () => {
    const a = buildNewSupplyId();
    const b = buildNewSupplyId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('buildNewSkuId returns a non-empty unique string', () => {
    const a = buildNewSkuId();
    const b = buildNewSkuId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe('captureCopyFromSku', () => {
  it('extracts every supply with its supplyKey, label, and values', () => {
    const sku = makeSku({
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { storage: '4+128', band: 'SSA' } },
        { id: 's2', supplyKey: '二供', label: '二供', values: { storage: '4+128', band: 'SSA' } },
      ],
    });
    const copy = captureCopyFromSku(sku);
    expect(copy.sourceSkuId).toBe('sku1');
    expect(copy.supplies).toHaveLength(2);
    expect(copy.supplies[0]).toMatchObject({
      supplyKey: '一供',
      label: '一供',
      values: { storage: '4+128', band: 'SSA' },
    });
    expect(copy.supplies[1]).toMatchObject({
      supplyKey: '二供',
      label: '二供',
      values: { storage: '4+128', band: 'SSA' },
    });
  });

  it('omits empty-string values from the captured copy', () => {
    const sku = makeSku({
      supplies: [
        { id: 's1', supplyKey: '一供', label: '一供', values: { storage: '4+128', band: '', lcd: 'BOE' } },
      ],
    });
    const copy = captureCopyFromSku(sku);
    expect(copy.supplies[0].values).toEqual({ storage: '4+128', lcd: 'BOE' });
    expect('band' in copy.supplies[0].values).toBe(false);
  });

  it('does not retain supply id in the captured copy', () => {
    const sku = makeSku({
      supplies: [
        { id: 'src-s1', supplyKey: '一供', label: '一供', values: { x: '1' } },
      ],
    });
    const copy = captureCopyFromSku(sku);
    expect((copy.supplies[0] as { id?: string }).id).toBeUndefined();
  });
});

describe('pasteCopiedIntoTarget', () => {
  function makeCopy(): CopiedSku {
    return {
      sourceSkuId: 'src',
      supplies: [
        { supplyKey: '一供', label: '一供', values: { storage: '6+256', lcd: 'BOE' } },
        { supplyKey: '二供', label: '二供', values: { storage: '6+256', lcd: 'CSOT' } },
      ],
    };
  }

  it('overwrites target supply values with the copied values and uses the provided new sku id', () => {
    const target = makeSku({ stage: 'PR2', orderNo: 'O-9' });
    const result = pasteCopiedIntoTarget(target, makeCopy(), 'sku_paste', () => 'should-not-be-used');
    expect(result.id).toBe('sku_paste');
    expect(result.stage).toBe('PR2');
    expect(result.orderNo).toBe('O-9');
    expect(result.supplies).toHaveLength(2);
    expect(result.supplies[0].supplyKey).toBe('一供');
    expect(result.supplies[0].values).toEqual({ storage: '6+256', lcd: 'BOE' });
    expect(result.supplies[1].supplyKey).toBe('二供');
    expect(result.supplies[1].values).toEqual({ storage: '6+256', lcd: 'CSOT' });
  });

  it('regenerates supply ids via the supplied id builder and does not collide with source ids', () => {
    const target = makeSku({
      supplies: [
        { id: 'tgt-s1', supplyKey: '一供', label: '一供', values: { old: 'v' } },
        { id: 'tgt-s2', supplyKey: '二供', label: '二供', values: { old: 'v' } },
      ],
    });
    const copy = makeCopy();
    const builder = vi.fn().mockReturnValueOnce('new-s1').mockReturnValueOnce('new-s2');
    const result = pasteCopiedIntoTarget(target, copy, 'sku_paste', builder);
    expect(builder).toHaveBeenCalledTimes(2);
    expect(result.supplies[0].id).toBe('new-s1');
    expect(result.supplies[1].id).toBe('new-s2');
    expect(result.supplies[0].id).not.toBe('tgt-s1');
  });

  it('keeps the original supply count when copy is shorter, filling blanks for the missing slots', () => {
    const target = makeSku({
      supplies: [
        { id: 'tgt-s1', supplyKey: '一供', label: '一供', values: { x: '1' } },
        { id: 'tgt-s2', supplyKey: '二供', label: '二供', values: { y: '2' } },
        { id: 'tgt-s3', supplyKey: '三供', label: '三供', values: { z: '3' } },
      ],
    });
    const copy: CopiedSku = {
      sourceSkuId: 'src',
      supplies: [{ supplyKey: '一供', label: '一供', values: { x: 'NEW' } }],
    };
    const ids = ['n1', 'n2', 'n3'];
    const builder = vi.fn(() => ids.shift() as string);
    const result = pasteCopiedIntoTarget(target, copy, 'sku_paste', builder);
    expect(result.supplies).toHaveLength(3);
    expect(result.supplies[0].supplyKey).toBe('一供');
    expect(result.supplies[0].values).toEqual({ x: 'NEW' });
    expect(result.supplies[1].supplyKey).toBe('二供');
    expect(result.supplies[1].values).toEqual({});
    expect(result.supplies[2].supplyKey).toBe('三供');
    expect(result.supplies[2].values).toEqual({});
  });

  it('truncates to the target supply count when copy is longer', () => {
    const target = makeSku({
      supplies: [
        { id: 'tgt-s1', supplyKey: '一供', label: '一供', values: {} },
      ],
    });
    const copy = makeCopy();
    const builder = vi.fn(() => 'only');
    const result = pasteCopiedIntoTarget(target, copy, 'sku_paste', builder);
    expect(result.supplies).toHaveLength(1);
    expect(builder).toHaveBeenCalledTimes(1);
    expect(result.supplies[0].supplyKey).toBe('一供');
  });
});
