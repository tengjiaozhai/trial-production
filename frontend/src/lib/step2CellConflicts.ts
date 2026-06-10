import type {
  ManagedMaterialCoreMatch,
  ManagedMaterialCoreRow,
  ManagedMaterialDescFieldId,
  PcbaSourceRow,
  SKUData,
  SplitFieldOption,
  SplitOptionFieldId,
  SupplyTag,
} from '../types';
import { FIELD_DEFS } from '../constants';
import { deriveManagedMaterialDescFieldMap } from './managedMaterialCore';

export type Step2CellConflictCandidateSource = 'key_material' | 'managed_material';

export interface Step2CellConflictCandidate {
  source: Step2CellConflictCandidateSource;
  sourceLabel?: '关键物料' | '管控物料';
  supplyTag: string;
  vendor: string;
  materialName: string;
  writeValue: string;
  label: string;
}

export interface Step2CellConflict {
  kind: 'cell_conflict';
  scope: 'sku' | 'supply';
  cellId: string;
  skuId: string;
  supplyId?: string;
  fieldId: string;
  fieldLabel: string;
  pcba: string;
  supplyLabel: string;
  candidates: Step2CellConflictCandidate[];
}

const SKU_SCOPED_FIELD_IDS = new Set(['band', 'storage', 'project', 'stage', 'mb_id']);
const DESC_FIELD_IDS: ManagedMaterialDescFieldId[] = [
  'battery',
  'speaker',
  'receiver',
  'mic',
  'motor',
  'fingerprint',
  'spk_fpc',
  'sidekey_fpc',
  'ir_fpc',
  'lens',
  'housing',
  'battery_cover',
  'sim_tray',
  'side_key',
  'aux_material',
  'cooling',
];

const SUPPLY_ORDER: Record<SupplyTag, number> = { '一供': 1, '二供': 2, '三供': 3, '四供': 4, '': 99 };

function toSupplyTag(raw: string): SupplyTag {
  return raw === '一供' || raw === '二供' || raw === '三供' || raw === '四供' ? raw : '';
}

function getFieldCandidate(fieldId: string, row: PcbaSourceRow): string {
  if (fieldId === 'project') {
    return String(row.values.projectName ?? '').trim();
  }

  if (fieldId === 'storage') {
    const ddrNum = String(row.values.ddr ?? '').match(/\d+/)?.[0] ?? '';
    const emmcNum = String(row.values.emmc ?? '').match(/\d+/)?.[0] ?? '';
    return ddrNum && emmcNum ? `${ddrNum}+${emmcNum}` : '';
  }

  return String(row.values[fieldId] ?? '').trim();
}

function getFieldLabel(fieldId: string): string {
  return FIELD_DEFS.find((field) => field.id === fieldId)?.label ?? fieldId;
}

function createKeyMaterialCandidate(value: string): Step2CellConflictCandidate {
  return {
    source: 'key_material',
    sourceLabel: '关键物料',
    supplyTag: '',
    vendor: '',
    materialName: value,
    writeValue: value,
    label: value,
  };
}

function createKeyMaterialCandidateFromOption(option: SplitFieldOption): Step2CellConflictCandidate {
  return {
    source: 'key_material',
    sourceLabel: '关键物料',
    supplyTag: option.supply,
    vendor: '',
    materialName: option.sourceCategory2,
    writeValue: option.text,
    label: option.text,
  };
}

function createManagedMaterialCandidate(
  row: ManagedMaterialCoreRow,
  supplyTag: SupplyTag,
  materialName: string
): Step2CellConflictCandidate {
  const writeValue = `${row.supply}${row.vendor}${materialName}`;
  return {
    source: 'managed_material',
    sourceLabel: '管控物料',
    supplyTag,
    vendor: row.vendor,
    materialName,
    writeValue,
    label: row.vendor ? `${row.supply} · ${row.vendor} · ${materialName}` : `${row.supply} · ${materialName}`,
  };
}

function normalizeCompareValue(value: string | undefined): string {
  return String(value ?? '').trim();
}

function matchesAnyCandidateValue(value: string | undefined, candidates: Step2CellConflictCandidate[]): boolean {
  const normalized = normalizeCompareValue(value);
  if (!normalized) return false;
  return candidates.some((candidate) => normalizeCompareValue(candidate.writeValue) === normalized);
}

function isSkuConflictResolved(
  sku: SKUData,
  fieldId: string,
  candidates: Step2CellConflictCandidate[],
  respectCurrentValues: boolean
): boolean {
  if (!respectCurrentValues || sku.supplies.length === 0) return false;
  const currentValues = sku.supplies.map((supply) => normalizeCompareValue(supply.values[fieldId]));
  const firstValue = currentValues[0];
  if (!firstValue) return false;
  if (currentValues.some((value) => value !== firstValue)) return false;
  return matchesAnyCandidateValue(firstValue, candidates);
}

function isSupplyConflictResolved(
  currentValue: string | undefined,
  candidates: Step2CellConflictCandidate[],
  respectCurrentValues: boolean
): boolean {
  if (!respectCurrentValues) return false;
  return matchesAnyCandidateValue(currentValue, candidates);
}

export function buildStep2CellConflicts(input: {
  checkedPcbaOptions: string[];
  pcbaRows: PcbaSourceRow[];
  skuData: SKUData[];
  keyMaterialFieldOptions?: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>>;
  managedMaterialCore?: ManagedMaterialCoreMatch;
  respectCurrentValues?: boolean;
}): Step2CellConflict[] {
  const {
    checkedPcbaOptions,
    pcbaRows,
    skuData,
    keyMaterialFieldOptions = {},
    managedMaterialCore,
    respectCurrentValues = true,
  } = input;

  // 1. Group raw rows by PCBA
  const rowsByPcba = new Map<string, PcbaSourceRow[]>();
  for (const row of pcbaRows) {
    if (!checkedPcbaOptions.includes(row.pcba)) continue;
    const existing = rowsByPcba.get(row.pcba) ?? [];
    existing.push(row);
    rowsByPcba.set(row.pcba, existing);
  }

  const conflicts: Step2CellConflict[] = [];

  // 2. For each selected PCBA with duplicates
  for (const [pcba, rows] of rowsByPcba) {
    if (rows.length < 2) continue;

    // 3. Find matching SKU
    const sku = skuData.find((s) => s.project === pcba);
    if (!sku) continue;

    // 4. Collect unique non-empty candidates per field
    const fieldsToCheck = FIELD_DEFS.filter(
      (f) => f.behavior === 'auto' || f.behavior === 'calc'
    );

    for (const field of fieldsToCheck) {
      const candidates = new Set<string>();

      for (const row of rows) {
        const val = getFieldCandidate(field.id, row);
        if (val) {
          candidates.add(val);
        }
      }

      // Skip if only one unique candidate (auto-fill case)
      if (candidates.size <= 1) continue;

      const conflictCandidates = [...candidates].map(createKeyMaterialCandidate);

      if (SKU_SCOPED_FIELD_IDS.has(field.id)) {
        if (isSkuConflictResolved(sku, field.id, conflictCandidates, respectCurrentValues)) continue;

        conflicts.push({
          kind: 'cell_conflict',
          scope: 'sku',
          cellId: `step2-cell-${sku.id}-${field.id}`,
          skuId: sku.id,
          fieldId: field.id,
          fieldLabel: field.label,
          pcba,
          supplyLabel: '整列',
          candidates: conflictCandidates,
        });
        continue;
      }

      // Find supply-scoped conflicts
      for (const supply of sku.supplies) {
        const currentVal = supply.values[field.id];
        if (isSupplyConflictResolved(currentVal, conflictCandidates, respectCurrentValues)) continue;

        const cellId = `step2-cell-${sku.id}-${supply.id}-${field.id}`;
        conflicts.push({
          kind: 'cell_conflict',
          scope: 'supply',
          cellId,
          skuId: sku.id,
          supplyId: supply.id,
          fieldId: field.id,
          fieldLabel: field.label,
          pcba,
          supplyLabel: supply.label,
          candidates: conflictCandidates,
        });
      }
    }
  }

  // 5. Compare key-material desc options with managed-material desc options
  if (managedMaterialCore) {
    const descFieldMap =
      managedMaterialCore.materialNameByDescField ??
      deriveManagedMaterialDescFieldMap(managedMaterialCore.materialNames);

    for (const sku of skuData) {
      if (!checkedPcbaOptions.includes(sku.project)) continue;

      for (const fieldId of DESC_FIELD_IDS) {
        const materialName = descFieldMap[fieldId];
        if (!materialName) continue;

        const keyOptions = keyMaterialFieldOptions[fieldId] ?? [];
        if (keyOptions.length === 0) continue;

        const managedRows = managedMaterialCore.rows
          .filter((row) => row.materialName === materialName)
          .sort((a, b) => (SUPPLY_ORDER[toSupplyTag(a.supply)] ?? 99) - (SUPPLY_ORDER[toSupplyTag(b.supply)] ?? 99));

        if (managedRows.length === 0) continue;

        const managedBySupply = new Map<SupplyTag, ManagedMaterialCoreRow>();
        for (const row of managedRows) {
          const supplyTag = toSupplyTag(row.supply);
          if (!supplyTag || managedBySupply.has(supplyTag)) continue;
          managedBySupply.set(supplyTag, row);
        }

        const keyBySupply = new Map<SupplyTag, SplitFieldOption>();
        for (const option of keyOptions) {
          const supplyTag = toSupplyTag(option.supply);
          if (!supplyTag || keyBySupply.has(supplyTag)) continue;
          keyBySupply.set(supplyTag, option);
        }

        for (const supply of sku.supplies) {
          const supplyTag = toSupplyTag(supply.supplyKey);
          if (!supplyTag) continue;

          const keyOption = keyBySupply.get(supplyTag);
          const managedRow = managedBySupply.get(supplyTag);
          if (!keyOption || !managedRow) continue;

          const keyCandidate = createKeyMaterialCandidateFromOption(keyOption);
          const managedCandidate = createManagedMaterialCandidate(managedRow, supplyTag, materialName);
          const candidates = [keyCandidate, managedCandidate];

          // Intentionally compare by the same supply tag only.
          // If key-material 一供/二供 is swapped against managed-material, that remains a conflict.
          if (keyCandidate.writeValue === managedCandidate.writeValue) continue;
          if (isSupplyConflictResolved(supply.values[fieldId], candidates, respectCurrentValues)) continue;

          conflicts.push({
            kind: 'cell_conflict',
            scope: 'supply',
            cellId: `step2-cell-${sku.id}-${supply.id}-${fieldId}`,
            skuId: sku.id,
            supplyId: supply.id,
            fieldId,
            fieldLabel: getFieldLabel(fieldId),
            pcba: sku.project,
            supplyLabel: supply.label,
            candidates,
          });
        }
      }
    }
  }

  return conflicts;
}
