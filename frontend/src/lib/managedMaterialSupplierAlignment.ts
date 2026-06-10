import type {
  ManagedMaterialAlignmentCandidate,
  ManagedMaterialSupplierAlignmentInput,
  ManagedMaterialSupplierAlignmentResult,
  SplitFieldOption,
  SplitOptionFieldId,
  SupplyTag,
} from '../types';

export type {
  ManagedMaterialAlignmentCandidate,
  ManagedMaterialAlignmentSource,
  ManagedMaterialSupplierAlignmentInput,
  ManagedMaterialSupplierAlignmentResult,
} from '../types';

const SUPPLY_ORDER: Record<string, number> = { '一供': 1, '二供': 2, '三供': 3, '四供': 4 };

function toSupplyTag(raw: string): SupplyTag {
  return raw === '一供' || raw === '二供' || raw === '三供' || raw === '四供' ? raw : '';
}

function toSourceAwareCandidate(
  option: SplitFieldOption,
  source: ManagedMaterialAlignmentCandidate['source']
): ManagedMaterialAlignmentCandidate {
  return {
    ...option,
    source,
    sourceLabel: source === 'key-material' ? '关键物料' : '管控物料',
    writeValue: option.text,
  };
}

function buildManagedDescFieldOptions(match: ManagedMaterialSupplierAlignmentInput['managedMaterialMatch']): Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> {
  const result: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> = {};
  const descMatches = match.materialNameByDescField ?? {};

  for (const [fieldId, materialName] of Object.entries(descMatches) as Array<[SplitOptionFieldId, string]>) {
    if (!materialName) continue;

    const rows = match.rows
      .filter((row) => row.materialName === materialName)
      .sort((a, b) => (SUPPLY_ORDER[a.supply] ?? 99) - (SUPPLY_ORDER[b.supply] ?? 99));

    const options = rows
      .map((row) => ({
        supply: toSupplyTag(row.supply),
        text: `${row.supply}${row.vendor}${materialName}`,
        sourceCategory2: materialName,
      }))
      .filter((row) => row.text.trim() !== '');

    if (options.length > 0) result[fieldId] = options;
  }

  return result;
}

export function buildManagedMaterialSupplierAlignment(
  input: ManagedMaterialSupplierAlignmentInput
): ManagedMaterialSupplierAlignmentResult {
  const managedDescOptions = buildManagedDescFieldOptions(input.managedMaterialMatch);
  const managedFieldOptions: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>> = managedDescOptions;

  const conflictCandidatesByField: ManagedMaterialSupplierAlignmentResult['conflictCandidatesByField'] = {};
  const managedOnlySupplyAdditionsByField: ManagedMaterialSupplierAlignmentResult['managedOnlySupplyAdditionsByField'] = {};

  const fieldIds = new Set<SplitOptionFieldId>([
    ...Object.keys(input.keyMaterialFieldOptions),
    ...Object.keys(managedFieldOptions),
  ] as SplitOptionFieldId[]);

  for (const fieldId of fieldIds) {
    const keyOptions = input.keyMaterialFieldOptions[fieldId] ?? [];
    const managedOptions = managedFieldOptions[fieldId] ?? [];
    const keySupplies = new Set(keyOptions.map((option) => option.supply).filter(Boolean));
    const overlappingManagedOptions = keyOptions.length === 0
      ? []
      : managedOptions.filter((option) => option.supply && keySupplies.has(option.supply));

    if (keyOptions.length > 0 && overlappingManagedOptions.length > 0) {
      conflictCandidatesByField[fieldId] = [
        ...keyOptions.map((option) => toSourceAwareCandidate(option, 'key-material')),
        ...overlappingManagedOptions.map((option) => toSourceAwareCandidate(option, 'managed-material')),
      ];
    }

    if (managedOptions.length > 0) {
      const additions = keyOptions.length === 0
        ? managedOptions
        : managedOptions.filter((option) => !option.supply || !keySupplies.has(option.supply));

      if (additions.length > 0) {
        managedOnlySupplyAdditionsByField[fieldId] = additions.map((option) =>
          toSourceAwareCandidate(option, 'managed-material')
        );
      }
    }
  }

  return {
    conflictCandidatesByField,
    managedOnlySupplyAdditionsByField,
  };
}
