import { describe, expect, it } from 'vitest';
import {
  parseStoragePair,
  extractTrailingSize,
  validateStorageAgainstComponents,
  validateColorAgainstBom,
  validateUnitIdVsMbId,
} from './step4ValidationRules';

describe('parseStoragePair', () => {
  it('parses 4+128 into ddr/emmc tokens', () => {
    expect(parseStoragePair('4+128')).toEqual({ ddr: '4', emmc: '128' });
  });

  it('supports optional G suffix', () => {
    expect(parseStoragePair('4G+128G')).toEqual({ ddr: '4', emmc: '128' });
  });
});

describe('extractTrailingSize', () => {
  it('extracts last size token from flash strings', () => {
    expect(extractTrailingSize('14201661一供宏芯宇128G')).toBe('128');
    expect(extractTrailingSize('14201579一供三星4G')).toBe('4');
  });
});

describe('validateStorageAgainstComponents', () => {
  it('passes when storage matches flash EMMC and flash DDR', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇128G',
        ddr: '14201579一供三星4G',
      })
    ).toEqual({ ok: true, reasons: [], mismatches: [] });
  });

  it('reports emmc-only mismatch metadata', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇64G',
        ddr: '14201579一供三星4G',
      })
    ).toEqual({
      ok: false,
      reasons: ['flash EMMC 不匹配'],
      mismatches: [{ targetFieldId: 'emmc', reason: 'flash EMMC 不匹配' }],
    });
  });

  it('reports ddr-only mismatch metadata', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇128G',
        ddr: '14201579一供三星8G',
      })
    ).toEqual({
      ok: false,
      reasons: ['flash DDR 不匹配'],
      mismatches: [{ targetFieldId: 'ddr', reason: 'flash DDR 不匹配' }],
    });
  });

  it('reports emmc then ddr mismatch metadata in order', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '14201661一供宏芯宇64G',
        ddr: '14201579一供三星8G',
      })
    ).toEqual({
      ok: false,
      reasons: ['flash EMMC 不匹配', 'flash DDR 不匹配'],
      mismatches: [
        { targetFieldId: 'emmc', reason: 'flash EMMC 不匹配' },
        { targetFieldId: 'ddr', reason: 'flash DDR 不匹配' },
      ],
    });
  });

  it('returns empty mismatches for storage format errors', () => {
    expect(
      validateStorageAgainstComponents({
        storage: 'bad-storage',
        emmc: '14201661一供宏芯宇128G',
        ddr: '14201579一供三星4G',
      })
    ).toEqual({ ok: false, reasons: ['存储格式错误'], mismatches: [] });
  });

  it('skips emmc when empty, only reports ddr mismatch', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '',
        ddr: '14201579一供三星8G',
      })
    ).toEqual({
      ok: false,
      reasons: ['flash DDR 不匹配'],
      mismatches: [{ targetFieldId: 'ddr', reason: 'flash DDR 不匹配' }],
    });
  });

  it('returns no mismatches when both emmc and ddr are empty', () => {
    expect(
      validateStorageAgainstComponents({
        storage: '4+128',
        emmc: '',
        ddr: '',
      })
    ).toEqual({ ok: true, reasons: [], mismatches: [] });
  });
});

describe('validateColorAgainstBom', () => {
  it('passes when MBOM matches even if PBOM is NA', () => {
    expect(
      validateColorAgainstBom({
        color: '钛银色',
        mbom: 'V633A-MBOM-TSN_A1_钛银色_128+4_誉鑫_PR2-1-试产',
        pbom: 'NA',
      })
    ).toEqual({ ok: true });
  });

  it('fails when MBOM and PBOM both do not contain color', () => {
    expect(
      validateColorAgainstBom({
        color: '钛银色',
        mbom: 'V633A-MBOM-TSN_A1_深蓝色_128+4_誉鑫_PR2-1-试产',
        pbom: 'PBOM-黑色',
      })
    ).toEqual({ ok: false });
  });
});

describe('validateUnitIdVsMbId', () => {
  it('passes when unit_id contains mb_id', () => {
    expect(validateUnitIdVsMbId({ unitId: 'PR1-A1', mbId: 'A1' })).toEqual({ ok: true });
  });

  it('fails when unit_id does not contain mb_id', () => {
    expect(validateUnitIdVsMbId({ unitId: 'PR1-B2', mbId: 'A1' })).toEqual({ ok: false });
  });
});
