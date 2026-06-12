import type { SupplyTag } from '../types';

const CHINESE_DIGITS: Record<string, number> = {
  '零': 0,
  '一': 1,
  '二': 2,
  '两': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
};

const CHINESE_UNITS: Record<string, number> = {
  '十': 10,
  '百': 100,
  '千': 1000,
};

const CHINESE_DIGIT_LIST = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

function parseChineseNumeral(value: string): number | null {
  if (!value) return null;

  let total = 0;
  let current = 0;

  for (const char of value) {
    const digit = CHINESE_DIGITS[char];
    if (digit !== undefined) {
      current = digit;
      continue;
    }

    const unit = CHINESE_UNITS[char];
    if (unit !== undefined) {
      total += (current || 1) * unit;
      current = 0;
      continue;
    }

    return null;
  }

  return total + current;
}

export function parseSupplyOrdinal(supplyKey: string): number | null {
  if (supplyKey === '') return null;

  const match = /^(.*)供$/.exec(supplyKey);
  if (!match) return null;

  const ordinal = parseChineseNumeral(match[1]);
  return ordinal && ordinal > 0 ? ordinal : null;
}

export function compareSupplyKeys(a: SupplyTag, b: SupplyTag): number {
  if (a === b) return 0;
  if (a === '') return 1;
  if (b === '') return -1;

  const left = parseSupplyOrdinal(a);
  const right = parseSupplyOrdinal(b);

  if (left != null && right != null) return left - right;
  if (left != null) return -1;
  if (right != null) return 1;

  return a.localeCompare(b, 'zh-Hans-CN');
}

export function sortSupplyKeys(keys: Iterable<SupplyTag>): SupplyTag[] {
  return [...keys].sort(compareSupplyKeys);
}

function formatChineseNumeral(value: number): string {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid supply ordinal: ${value}`);
  }

  const digits = String(value).split('').map(Number);
  const units = ['', '十', '百', '千'];
  let result = '';
  let zeroPending = false;

  for (let index = 0; index < digits.length; index += 1) {
    const digit = digits[index];
    const unitIndex = digits.length - index - 1;

    if (digit === 0) {
      zeroPending = result.length > 0;
      continue;
    }

    if (zeroPending) {
      result += CHINESE_DIGIT_LIST[0];
      zeroPending = false;
    }

    if (!(digit === 1 && unitIndex === 1 && result.length === 0)) {
      result += CHINESE_DIGIT_LIST[digit];
    }

    result += units[unitIndex];
  }

  return result;
}

export function buildSupplyKey(ordinal: number): SupplyTag {
  return `${formatChineseNumeral(ordinal)}供`;
}

export function getNextUnusedSupplyKeyFromKeys(keys: Iterable<SupplyTag>): SupplyTag {
  const usedOrdinals = new Set<number>();

  for (const key of keys) {
    const ordinal = parseSupplyOrdinal(key);
    if (ordinal != null) usedOrdinals.add(ordinal);
  }

  let nextOrdinal = 1;
  while (usedOrdinals.has(nextOrdinal)) {
    nextOrdinal += 1;
  }

  return buildSupplyKey(nextOrdinal);
}
