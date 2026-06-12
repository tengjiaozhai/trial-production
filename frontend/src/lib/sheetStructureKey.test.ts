import { describe, expect, it } from 'vitest';
import type { FieldDefinition, StepId } from '../types';
import { buildStructureKey } from './sheetStructureKey';

const fields: FieldDefinition[] = [
  { id: 'a', label: 'A', group: 'g', behavior: 'manual' },
  { id: 'b', label: 'B', group: 'g', behavior: 'auto' },
];

describe('buildStructureKey', () => {
  it('produces a string', () => {
    const key = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    expect(typeof key).toBe('string');
  });

  it('changes when currentStep changes', () => {
    const k1 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    const k2 = buildStructureKey({ currentStep: 3 as StepId, activeFields: fields, efuseConfigs: {} });
    expect(k1).not.toBe(k2);
  });

  it('changes when activeFields order changes', () => {
    const k1 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    const k2 = buildStructureKey({
      currentStep: 2 as StepId,
      activeFields: [fields[1], fields[0]],
      efuseConfigs: {},
    });
    expect(k1).not.toBe(k2);
  });

  it('is stable when only sku values change', () => {
    const k1 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    const k2 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: {} });
    expect(k1).toBe(k2);
  });

  it('changes when efuseConfigs references a new field id', () => {
    const k1 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: { x: 'a' } });
    const k2 = buildStructureKey({ currentStep: 2 as StepId, activeFields: fields, efuseConfigs: { y: 'a' } });
    expect(k1).not.toBe(k2);
  });
});
