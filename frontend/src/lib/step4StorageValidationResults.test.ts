import { describe, expect, it } from 'vitest';
import { buildStep4StorageValidationResults } from './step4StorageValidationResults';

describe('buildStep4StorageValidationResults', () => {
  it('returns one pass card when storage matches', () => {
    expect(
      buildStep4StorageValidationResults({
        skuId: 'sku_1',
        supplyId: 's_1',
        prefix: '[X6728 · 一供] ',
        storage: '4+128',
        validationResult: {
          ok: true,
          reasons: [],
          mismatches: [],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1',
        title: '存储核验通过',
        detail: '[X6728 · 一供] 存储与 flash EMMC/flash DDR 匹配。',
        amReference: 'Rule-2',
        level: 'pass',
        fieldId: 'storage',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('returns one emmc-targeted card for emmc-only mismatch', () => {
    expect(
      buildStep4StorageValidationResults({
        skuId: 'sku_1',
        supplyId: 's_1',
        prefix: '[X6728 · 一供] ',
        storage: '4+128',
        validationResult: {
          ok: false,
          reasons: ['flash EMMC 不匹配'],
          mismatches: [{ targetFieldId: 'emmc', reason: 'flash EMMC 不匹配', kind: 'mismatch' }],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1-emmc',
        title: '存储与 flash EMMC 冲突',
        detail: '[X6728 · 一供] 存储(4+128)与flash EMMC 不匹配冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'emmc',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('returns one ddr-targeted card for ddr-only mismatch', () => {
    expect(
      buildStep4StorageValidationResults({
        skuId: 'sku_1',
        supplyId: 's_1',
        prefix: '[X6728 · 一供] ',
        storage: '4+128',
        validationResult: {
          ok: false,
          reasons: ['flash DDR 不匹配'],
          mismatches: [{ targetFieldId: 'ddr', reason: 'flash DDR 不匹配', kind: 'mismatch' }],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1-ddr',
        title: '存储与 flash DDR 冲突',
        detail: '[X6728 · 一供] 存储(4+128)与flash DDR 不匹配冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'ddr',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('returns emmc then ddr cards when both mismatch', () => {
    expect(
      buildStep4StorageValidationResults({
        skuId: 'sku_1',
        supplyId: 's_1',
        prefix: '[X6728 · 一供] ',
        storage: '4+128',
        validationResult: {
          ok: false,
          reasons: ['flash EMMC 不匹配', 'flash DDR 不匹配'],
          mismatches: [
            { targetFieldId: 'emmc', reason: 'flash EMMC 不匹配', kind: 'mismatch' },
            { targetFieldId: 'ddr', reason: 'flash DDR 不匹配', kind: 'mismatch' },
          ],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1-emmc',
        title: '存储与 flash EMMC 冲突',
        detail: '[X6728 · 一供] 存储(4+128)与flash EMMC 不匹配冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'emmc',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
      {
        id: 'RULE-STORAGE-sku_1-s_1-ddr',
        title: '存储与 flash DDR 冲突',
        detail: '[X6728 · 一供] 存储(4+128)与flash DDR 不匹配冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'ddr',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('returns a single storage-targeted card for format errors', () => {
    expect(
      buildStep4StorageValidationResults({
        skuId: 'sku_1',
        supplyId: 's_1',
        prefix: '[X6728 · 一供] ',
        storage: 'bad-storage',
        validationResult: {
          ok: false,
          reasons: ['存储格式错误'],
          mismatches: [],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1',
        title: '存储配置冲突',
        detail: '[X6728 · 一供] 存储(bad-storage)与存储格式错误冲突。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });

  it('returns an unfilled card for emmc kind=unfilled', () => {
    expect(
      buildStep4StorageValidationResults({
        skuId: 'sku_1',
        supplyId: 's_1',
        prefix: '[X6728 · 一供] ',
        storage: '4+128',
        validationResult: {
          ok: false,
          reasons: ['flash EMMC 未填'],
          mismatches: [{ targetFieldId: 'emmc', reason: 'flash EMMC 未填', kind: 'unfilled' }],
        },
      })
    ).toEqual([
      {
        id: 'RULE-STORAGE-sku_1-s_1-emmc',
        title: 'flash EMMC 未填',
        detail: '[X6728 · 一供] flash EMMC 字段未填写，无法核验存储(4+128)。',
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        targetFieldId: 'emmc',
        skuId: 'sku_1',
        supplyId: 's_1',
      },
    ]);
  });
});
