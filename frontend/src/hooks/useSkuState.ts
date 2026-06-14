import { useState } from 'react';
import type { SKUData, FieldDefinition, ValidationResult } from '../types';
import type { Step5LayoutSnapshot } from '../lib/trialProductionWorkbook';
import type { CopiedSku } from '../lib/tableOperations';
import { FIELD_DEFS } from '../constants';

export function useSkuState() {
  const [skuData, setSkuData] = useState<SKUData[]>([]);
  const [activeFields, setActiveFields] = useState<FieldDefinition[]>(FIELD_DEFS);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isFlowComplete, setIsFlowComplete] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isExportDisabled, setIsExportDisabled] = useState(true);
  const [step5Layout, setStep5Layout] = useState<Step5LayoutSnapshot | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [copiedSku, setCopiedSku] = useState<CopiedSku | null>(null);
  return {
    skuData, setSkuData,
    activeFields, setActiveFields,
    selectedRows, setSelectedRows,
    isFlowComplete, setIsFlowComplete,
    validationResults, setValidationResults,
    isExportDisabled, setIsExportDisabled,
    step5Layout, setStep5Layout,
    selectedSkuId, setSelectedSkuId,
    copiedSku, setCopiedSku,
  };
}
