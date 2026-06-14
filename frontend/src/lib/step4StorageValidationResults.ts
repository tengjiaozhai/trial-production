import type { ValidationResult } from '../types';
import type { StorageMismatch } from './step4ValidationRules';

type StorageValidationResult = {
  ok: boolean;
  reasons: string[];
  mismatches: StorageMismatch[];
};

export function buildStep4StorageValidationResults(args: {
  skuId: string;
  supplyId: string;
  prefix: string;
  storage: string;
  validationResult: StorageValidationResult;
}): ValidationResult[] {
  const { skuId, supplyId, prefix, storage, validationResult } = args;

  if (validationResult.ok) {
    return [
      {
        id: `RULE-STORAGE-${skuId}-${supplyId}`,
        title: '存储核验通过',
        detail: `${prefix}存储与 flash EMMC/flash DDR 匹配。`,
        amReference: 'Rule-2',
        level: 'pass',
        fieldId: 'storage',
        skuId,
        supplyId,
      },
    ];
  }

  if (validationResult.mismatches.length === 0) {
    return [
      {
        id: `RULE-STORAGE-${skuId}-${supplyId}`,
        title: '存储配置冲突',
        detail: `${prefix}存储(${storage})与${validationResult.reasons.join('、')}冲突。`,
        amReference: 'Rule-2',
        level: 'error',
        fieldId: 'storage',
        skuId,
        supplyId,
      },
    ];
  }

  return validationResult.mismatches.map((mismatch) => ({
    id: `RULE-STORAGE-${skuId}-${supplyId}-${mismatch.targetFieldId}`,
    title: mismatch.targetFieldId === 'emmc' ? '存储与 flash EMMC 冲突' : '存储与 flash DDR 冲突',
    detail: `${prefix}存储(${storage})与${mismatch.reason}冲突。`,
    amReference: 'Rule-2',
    level: 'error',
    fieldId: 'storage',
    targetFieldId: mismatch.targetFieldId,
    skuId,
    supplyId,
  }));
}
