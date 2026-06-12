import { describe, expect, it } from 'vitest';
import {
  buildSupplyKey,
  compareSupplyKeys,
  getNextUnusedSupplyKeyFromKeys,
  parseSupplyOrdinal,
  sortSupplyKeys,
} from './supplyKeys';

describe('parseSupplyOrdinal', () => {
  it('returns null for the empty string', () => {
    expect(parseSupplyOrdinal('')).toBeNull();
  });

  it('returns null when the suffix is missing', () => {
    expect(parseSupplyOrdinal('一')).toBeNull();
    expect(parseSupplyOrdinal('供X')).toBeNull();
    expect(parseSupplyOrdinal('X供Y')).toBeNull();
  });

  it('returns null for a 供 suffix with no prefix', () => {
    expect(parseSupplyOrdinal('供')).toBeNull();
  });

  it('parses single-digit ordinals 一 through 九', () => {
    expect(parseSupplyOrdinal('一供')).toBe(1);
    expect(parseSupplyOrdinal('二供')).toBe(2);
    expect(parseSupplyOrdinal('两供')).toBe(2);
    expect(parseSupplyOrdinal('三供')).toBe(3);
    expect(parseSupplyOrdinal('九供')).toBe(9);
  });

  it('parses 十 (10) without an explicit leading 一', () => {
    expect(parseSupplyOrdinal('十供')).toBe(10);
  });

  it('parses 十一 through 十九', () => {
    expect(parseSupplyOrdinal('十一供')).toBe(11);
    expect(parseSupplyOrdinal('十九供')).toBe(19);
  });

  it('parses tens like 二十, 三十, 九十', () => {
    expect(parseSupplyOrdinal('二十供')).toBe(20);
    expect(parseSupplyOrdinal('三十供')).toBe(30);
    expect(parseSupplyOrdinal('九十供')).toBe(90);
  });

  it('parses composite numbers like 五十五 and 九十九', () => {
    expect(parseSupplyOrdinal('五十五供')).toBe(55);
    expect(parseSupplyOrdinal('九十九供')).toBe(99);
  });

  it('parses hundreds like 一百, 一百零一, 一百二十, 二百', () => {
    expect(parseSupplyOrdinal('一百供')).toBe(100);
    expect(parseSupplyOrdinal('一百零一供')).toBe(101);
    expect(parseSupplyOrdinal('一百一十供')).toBe(110);
    expect(parseSupplyOrdinal('一百二十供')).toBe(120);
    expect(parseSupplyOrdinal('二百供')).toBe(200);
  });

  it('parses thousands', () => {
    expect(parseSupplyOrdinal('一千供')).toBe(1000);
    expect(parseSupplyOrdinal('一千零一供')).toBe(1001);
    expect(parseSupplyOrdinal('一千二百三十四供')).toBe(1234);
  });

  it('returns null for 零供 (zero is not a valid ordinal)', () => {
    expect(parseSupplyOrdinal('零供')).toBeNull();
  });

  it('returns null when the prefix contains non-Chinese-digit characters', () => {
    expect(parseSupplyOrdinal('abc供')).toBeNull();
    expect(parseSupplyOrdinal('三a供')).toBeNull();
    expect(parseSupplyOrdinal('1供')).toBeNull();
  });

  it('drops trailing units because parseChineseNumeral ignores leftover digits', () => {
    expect(parseSupplyOrdinal('一二三供')).toBe(3);
  });
});

describe('buildSupplyKey', () => {
  it('builds single-digit supply keys', () => {
    expect(buildSupplyKey(1)).toBe('一供');
    expect(buildSupplyKey(4)).toBe('四供');
    expect(buildSupplyKey(9)).toBe('九供');
  });

  it('builds 十 as a single character (no leading 一)', () => {
    expect(buildSupplyKey(10)).toBe('十供');
  });

  it('builds 十一 through 二十', () => {
    expect(buildSupplyKey(11)).toBe('十一供');
    expect(buildSupplyKey(15)).toBe('十五供');
    expect(buildSupplyKey(20)).toBe('二十供');
  });

  it('builds composite tens and hundreds', () => {
    expect(buildSupplyKey(99)).toBe('九十九供');
    expect(buildSupplyKey(100)).toBe('一百供');
    expect(buildSupplyKey(101)).toBe('一百零一供');
    expect(buildSupplyKey(110)).toBe('一百一十供');
    expect(buildSupplyKey(120)).toBe('一百二十供');
    expect(buildSupplyKey(200)).toBe('二百供');
  });

  it('builds thousands with a single 千 and 零 separator for sub-1000 parts', () => {
    expect(buildSupplyKey(1000)).toBe('一千供');
    expect(buildSupplyKey(1001)).toBe('一千零一供');
    expect(buildSupplyKey(1234)).toBe('一千二百三十四供');
  });

  it('throws on zero, negative, or non-integer inputs', () => {
    expect(() => buildSupplyKey(0)).toThrow();
    expect(() => buildSupplyKey(-1)).toThrow();
    expect(() => buildSupplyKey(1.5)).toThrow();
    expect(() => buildSupplyKey(Number.NaN)).toThrow();
  });
});

describe('parseSupplyOrdinal / buildSupplyKey roundtrip', () => {
  it('parseSupplyOrdinal(buildSupplyKey(n)) === n for n in [1, 200]', () => {
    for (let n = 1; n <= 200; n += 1) {
      const key = buildSupplyKey(n);
      expect(parseSupplyOrdinal(key), `roundtrip for n=${n} key=${key}`).toBe(n);
    }
  });
});

describe('compareSupplyKeys', () => {
  it('returns 0 for the same key', () => {
    expect(compareSupplyKeys('一供', '一供')).toBe(0);
    expect(compareSupplyKeys('', '')).toBe(0);
  });

  it('keeps the empty string sorted last in both directions', () => {
    expect(compareSupplyKeys('', '一供')).toBe(1);
    expect(compareSupplyKeys('一供', '')).toBe(-1);
  });

  it('orders parseable keys by numeric ordinal', () => {
    expect(Math.sign(compareSupplyKeys('一供', '二供'))).toBe(-1);
    expect(Math.sign(compareSupplyKeys('二供', '一供'))).toBe(1);
    expect(Math.sign(compareSupplyKeys('九供', '十供'))).toBe(-1);
    expect(Math.sign(compareSupplyKeys('十供', '二十供'))).toBe(-1);
    expect(Math.sign(compareSupplyKeys('一百供', '九十九供'))).toBe(1);
  });

  it('sorts unparseable keys after all parseable ones', () => {
    expect(compareSupplyKeys('abc供', '一供')).toBe(1);
    expect(compareSupplyKeys('一供', 'abc供')).toBe(-1);
  });

  it('falls back to localeCompare between two unparseable keys', () => {
    const result = compareSupplyKeys('abc供', 'xyz供');
    expect(result).toBeLessThan(0);
  });
});

describe('sortSupplyKeys', () => {
  it('returns an empty array for an empty input', () => {
    expect(sortSupplyKeys([])).toEqual([]);
  });

  it('moves the empty key to the end', () => {
    expect(sortSupplyKeys(['', '一供'])).toEqual(['一供', '']);
    expect(sortSupplyKeys(['一供', '二供', '', '三供'])).toEqual(['一供', '二供', '三供', '']);
  });

  it('sorts keys in numeric ordinal order regardless of input order', () => {
    expect(sortSupplyKeys(['六供', '一供', '四供', '二供', '三供', '五供'])).toEqual([
      '一供', '二供', '三供', '四供', '五供', '六供',
    ]);
  });

  it('keeps sort stable by deferring unparseable keys to the end', () => {
    expect(sortSupplyKeys(['abc供', '一供', 'xyz供', '二供'])).toEqual(['一供', '二供', 'abc供', 'xyz供']);
  });
});

describe('getNextUnusedSupplyKeyFromKeys', () => {
  it('returns 一供 when no keys are used', () => {
    expect(getNextUnusedSupplyKeyFromKeys([])).toBe('一供');
  });

  it('returns the smallest missing ordinal, filling gaps before appending', () => {
    expect(getNextUnusedSupplyKeyFromKeys(['一供'])).toBe('二供');
    expect(getNextUnusedSupplyKeyFromKeys(['一供', '二供'])).toBe('三供');
    expect(getNextUnusedSupplyKeyFromKeys(['一供', '三供', '五供'])).toBe('二供');
    expect(getNextUnusedSupplyKeyFromKeys(['二供', '三供', '四供'])).toBe('一供');
  });

  it('appends the next ordinal when the lower range is already used', () => {
    expect(getNextUnusedSupplyKeyFromKeys(['一供', '二供', '三供', '四供', '五供', '六供'])).toBe('七供');
  });

  it('ignores keys whose prefix is not a positive ordinal', () => {
    expect(getNextUnusedSupplyKeyFromKeys([''])).toBe('一供');
    expect(getNextUnusedSupplyKeyFromKeys(['零供'])).toBe('一供');
    expect(getNextUnusedSupplyKeyFromKeys(['abc供'])).toBe('一供');
  });

  it('does not get stuck when the only used key is a higher ordinal', () => {
    expect(getNextUnusedSupplyKeyFromKeys(['十供'])).toBe('一供');
    expect(getNextUnusedSupplyKeyFromKeys(['一百供'])).toBe('一供');
  });
});
