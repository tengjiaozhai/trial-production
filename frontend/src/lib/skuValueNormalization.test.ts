import { describe, expect, it } from 'vitest';
import type { HistoryEntry, SKUData } from '../types';
import {
  normalizeBusinessValue,
  normalizeFieldValue,
  normalizeHistoryEntry,
  PROD_LOC_OPTIONS,
} from './skuValueNormalization';

function makeSku(overrides: Partial<SKUData> = {}): SKUData {
  return {
    id: 'sku-a1',
    stage: 'PR1',
    orderNo: '',
    project: 'X6728',
    selectedSupplyKey: '一供',
    supplies: [
      {
        id: 's1',
        supplyKey: '一供',
        label: '一供',
        values: {},
      },
    ],
    ...overrides,
  };
}

function makeHistoryEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'history-1',
    timestamp: 1,
    name: 'trial',
    version: 1,
    projectInfo: {
      name: 'X6728',
      customer: '',
      stage: '',
      files: [],
    },
    skuData: [makeSku()],
    currentStep: 3,
    activeFields: [],
    isFlowComplete: false,
    isArchived: false,
    ...overrides,
  };
}

describe('normalizeBusinessValue', () => {
  it('extracts plain text from nested Univer cell payloads', () => {
    expect(
      normalizeBusinessValue({
        v: {
          p: {
            body: {
              dataStream: '宜宾\r\n',
            },
          },
        },
      })
    ).toBe('宜宾');
  });

  it('extracts plain text from objects with toPlainText', () => {
    expect(
      normalizeBusinessValue({
        toPlainText: () => '南昌\r\n',
      })
    ).toBe('南昌');
  });

  it('returns empty string for opaque objects', () => {
    expect(normalizeBusinessValue({ foo: 'bar' })).toBe('');
  });

  it('returns empty string for literal [object Object]', () => {
    expect(normalizeBusinessValue('[object Object]')).toBe('');
  });
});

describe('normalizeFieldValue', () => {
  it('keeps allowed prod_loc values', () => {
    for (const option of PROD_LOC_OPTIONS) {
      expect(normalizeFieldValue('prod_loc', option)).toBe(option);
    }
  });

  it('clears unsupported prod_loc values', () => {
    expect(normalizeFieldValue('prod_loc', '深圳')).toBe('');
    expect(normalizeFieldValue('prod_loc', { foo: 'bar' })).toBe('');
  });
});

describe('normalizeHistoryEntry', () => {
  it('repairs prod_loc object values and reports the entry as changed', () => {
    const entry = makeHistoryEntry({
      skuData: [
        makeSku({
          supplies: [
            {
              id: 's1',
              supplyKey: '一供',
              label: '一供',
              values: {
                prod_loc: {
                  v: {
                    p: {
                      body: {
                        dataStream: '河源\r\n',
                      },
                    },
                  },
                } as any,
                note: {
                  p: {
                    body: {
                      dataStream: '手填说明\r\n',
                    },
                  },
                } as any,
              } as any,
            },
          ],
        }),
      ],
    });

    const result = normalizeHistoryEntry(entry);

    expect(result.changed).toBe(true);
    expect(result.entry.skuData[0].supplies[0].values.prod_loc).toBe('河源');
    expect(result.entry.skuData[0].supplies[0].values.note).toBe('手填说明');
  });

  it('clears invalid prod_loc values during history repair', () => {
    const entry = makeHistoryEntry({
      skuData: [
        makeSku({
          supplies: [
            {
              id: 's1',
              supplyKey: '一供',
              label: '一供',
              values: {
                prod_loc: '[object Object]',
              } as any,
            },
          ],
        }),
      ],
    });

    const result = normalizeHistoryEntry(entry);

    expect(result.entry.skuData[0].supplies[0].values.prod_loc).toBe('');
  });
});
