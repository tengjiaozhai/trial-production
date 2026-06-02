import type { PcbaOption, SKUData } from '../types';

export interface Step2PcbaConflict {
  kind: 'duplicate_pcba';
  pcba: string;
  duplicateCount: number;
  skuId: string;
  detail: string;
}

export function buildStep2PcbaConflicts(
  input: {
    pcbaOptions: PcbaOption[];
    checkedPcbaOptions?: string[];
    skuData: Array<Pick<SKUData, 'id' | 'project'>>;
  }
): Step2PcbaConflict[] {
  const pcbaOptions = input.pcbaOptions ?? [];
  const checkedPcbaOptions = input.checkedPcbaOptions ?? [];
  const skuData = input.skuData ?? [];
  const selectedPcbaSet = new Set(checkedPcbaOptions);
  const pcbaOptionById = new Map(pcbaOptions.map((option) => [option.pcba, option] as const));

  return checkedPcbaOptions
    .map((pcba) => {
      const option = pcbaOptionById.get(pcba);
      if (!option || !selectedPcbaSet.has(pcba) || !option.duplicateConflict || option.duplicateCount < 2) {
        return null;
      }

      const sku = skuData.find((item) => item.project === pcba);
      if (!sku) return null;

      return {
        kind: 'duplicate_pcba' as const,
        pcba,
        duplicateCount: option.duplicateCount,
        skuId: sku.id,
        detail: `主板标识 ${pcba} 在配置表中出现 ${option.duplicateCount} 次，请人工确认。`,
      };
    })
    .filter((conflict): conflict is Step2PcbaConflict => conflict !== null);
}
