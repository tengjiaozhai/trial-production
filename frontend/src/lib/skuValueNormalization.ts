import type { HistoryEntry, SKUData } from '../types';

export const PROD_LOC_OPTIONS = ['宜宾', '南昌', '河源', '越南', '自定义'] as const;

const PROD_LOC_VALUE_SET = new Set<string>(['', ...PROD_LOC_OPTIONS]);

function stripTrailingNewline(value: string): string {
  return value.replace(/\r?\n$/, '');
}

function cleanText(value: string): string {
  const normalized = stripTrailingNewline(value);
  return normalized === '[object Object]' ? '' : normalized;
}

export function normalizeBusinessValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return cleanText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    if ('toPlainText' in value) {
      const toPlainText = (value as { toPlainText?: () => string }).toPlainText;
      if (typeof toPlainText === 'function') {
        return cleanText(toPlainText.call(value));
      }
    }

    if ('v' in value) {
      return normalizeBusinessValue((value as { v?: unknown }).v);
    }

    const dataStream = (value as { body?: { dataStream?: unknown } }).body?.dataStream;
    if (typeof dataStream === 'string') {
      return cleanText(dataStream);
    }

    const richTextDataStream = (value as { p?: { body?: { dataStream?: unknown } } }).p?.body?.dataStream;
    if (typeof richTextDataStream === 'string') {
      return cleanText(richTextDataStream);
    }

    return '';
  }

  return '';
}

export function normalizeFieldValue(fieldId: string, value: unknown): string {
  const normalized = normalizeBusinessValue(value);

  if (fieldId === 'prod_loc') {
    return PROD_LOC_VALUE_SET.has(normalized) ? normalized : '';
  }

  return normalized;
}

export function normalizeSupplyValues(values: Record<string, unknown>): {
  changed: boolean;
  values: Record<string, string>;
} {
  let changed = false;
  const normalizedValues: Record<string, string> = {};

  for (const [fieldId, rawValue] of Object.entries(values)) {
    const normalizedValue = normalizeFieldValue(fieldId, rawValue);
    normalizedValues[fieldId] = normalizedValue;
    if (normalizedValue !== rawValue) {
      changed = true;
    }
  }

  return {
    changed,
    values: normalizedValues,
  };
}

export function normalizeSkuDataValues(skuData: SKUData[]): {
  changed: boolean;
  skuData: SKUData[];
} {
  let changed = false;

  const normalizedSkuData = skuData.map((sku) => {
    let skuChanged = false;

    const normalizedSupplies = sku.supplies.map((supply) => {
      const normalized = normalizeSupplyValues(supply.values as Record<string, unknown>);
      if (normalized.changed) {
        skuChanged = true;
      }

      return normalized.changed
        ? {
            ...supply,
            values: normalized.values,
          }
        : supply;
    });

    if (skuChanged) {
      changed = true;
      return {
        ...sku,
        supplies: normalizedSupplies,
      };
    }

    return sku;
  });

  return {
    changed,
    skuData: normalizedSkuData,
  };
}

export function normalizeHistoryEntry(entry: HistoryEntry): {
  changed: boolean;
  entry: HistoryEntry;
} {
  const normalized = normalizeSkuDataValues(entry.skuData);
  if (!normalized.changed) {
    return {
      changed: false,
      entry,
    };
  }

  return {
    changed: true,
    entry: {
      ...entry,
      skuData: normalized.skuData,
    },
  };
}

export function normalizeHistoryEntries(entries: HistoryEntry[]): {
  changed: boolean;
  entries: HistoryEntry[];
} {
  let changed = false;

  const normalizedEntries = entries.map((entry) => {
    const normalized = normalizeHistoryEntry(entry);
    if (normalized.changed) {
      changed = true;
    }
    return normalized.entry;
  });

  return {
    changed,
    entries: normalizedEntries,
  };
}
