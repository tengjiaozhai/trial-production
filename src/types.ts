
export type Template = '标准' | '传音' | '中兴';
export type Stage = string;

export type FieldBehavior = 'auto' | 'calc' | 'manual' | 'order_no';

export interface FieldDefinition {
  id: string;
  label: string;
  group: string;
  behavior: FieldBehavior;
  wait?: boolean;
}

export interface SupplyValue {
  id: string;
  label: string; // e.g., '一供', '二供'
  value: string;
}

export interface SKUData {
  id: string;
  stage: string;
  orderNo: string;
  project: string;
  supplies: {
    id: string;
    label: string;
    values: Record<string, string>;
  }[];
}

export interface PcbaOption {
  pcba: string;          // PCBA 标识，如 "A1"、"U1"
  band: string;          // 出货市场（即频段）；冲突时为空字符串 ""
  bandConflict: boolean; // true 表示该 PCBA 对应配置表中多个不同出货市场
  emmc: string;          // EMMC 列原始值，如 "128G"；列不存在或冲突时为 ""
  ddr: string;           // DDR 列原始值，如 "4G"；列不存在或冲突时为 ""
}

export interface ProjectInfo {
  name: string;
  mainboardId?: string;
  pcbaOptions?: PcbaOption[]; // The extracted PCBA configs with band info
  checkedPcbaOptions?: string[]; // The ones selected by user
  efuseConfigs?: Record<string, string>;
  isCopied?: boolean;
  customer: Template | '';
  stage: Stage | '';
  files: { id: string; name: string; type: string }[];
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  name: string;
  version?: number;
  projectInfo: ProjectInfo;
  skuData: SKUData[];
  currentStep: StepId;
  activeFields: FieldDefinition[];
  isFlowComplete: boolean;
  isArchived: boolean;
}

export type ValidationLevel = 'error' | 'warn' | 'skip' | 'pass';

export interface ValidationResult {
  id: string;
  title: string;
  detail: string;
  amReference: string;
  level: ValidationLevel;
  fieldId?: string;
}

export type StepId = 1 | 2 | 3 | 4 | 5;
