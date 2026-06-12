import type { FieldDefinition, StepId } from '../types';

export interface StructureKeyInput {
  currentStep: StepId;
  activeFields: FieldDefinition[];
  efuseConfigs: Record<string, string> | undefined;
}

export function buildStructureKey(input: StructureKeyInput): string {
  const fieldIds = input.activeFields.map((f) => f.id).join('|');
  const efuseKeys = Object.keys(input.efuseConfigs ?? {}).sort().join('|');
  return `${input.currentStep}::${fieldIds}::${efuseKeys}`;
}
