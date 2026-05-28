
export type Template = '标准' | '传音' | '中兴';
export type Stage = string;

export type FieldBehavior = 'auto' | 'calc' | 'manual' | 'order_no';

export type SplitOptionFieldId =
  | 'lcd' | 'front_cam' | 'main_cam' | 'sub_cam'
  | 'cpu' | 'emmc' | 'ddr' | 'pmu' | 'tx' | 'rf_transceiver' | 'nfc'
  | 'battery' | 'speaker' | 'receiver' | 'mic' | 'motor' | 'fingerprint'
  | 'spk_fpc' | 'sidekey_fpc' | 'ir_fpc' | 'lens' | 'housing'
  | 'battery_cover' | 'sim_tray' | 'side_key' | 'aux_material'
  | 'cooling' | 'pcb' | 'sub_board'
  | 'hw_eng' | 'hw_test' | 'sw_eng' | 'sw_test' | 'struct_eng'
  | 'reliability_eng' | 'pressure_test' | 'image_eng'
  | 'npm' | 'ux' | 'parts' | 'pm';

export type SampleCollectionFieldId =
  | 'hw_eng' | 'hw_test' | 'sw_eng' | 'sw_test' | 'struct_eng'
  | 'reliability_eng' | 'pressure_test' | 'image_eng'
  | 'npm' | 'ux' | 'parts' | 'pm';

export type SupplyTag = '一供' | '二供' | '三供' | '';

export interface SplitFieldOption {
  supply: SupplyTag;
  text: string;
  sourceCategory2: string;
}

export interface KeyMaterialTemplateMatch {
  sourceFileName: string;
  sourceSheetName: string;
  category2ByField: Partial<Record<SplitOptionFieldId, string>>;
  optionsByField: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>>;
}

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

export interface LcdSupplyOption {
  supply: '一供' | '二供';
  code: string;
  vendor: string;
  text: string;
}

export interface ManagedMaterialWorkbook {
  lcdBySheet: Record<string, LcdSupplyOption[]>;
  frontCamBySheet: Record<string, LcdSupplyOption[]>;
  mainCamBySheet: Record<string, LcdSupplyOption[]>;
  subCamBySheet: Record<string, LcdSupplyOption[]>;
}

export interface SKUData {
  id: string;
  stage: string;
  orderNo: string;
  project: string;
  fieldOptions?: Partial<Record<SplitOptionFieldId, SplitFieldOption[]>>;
  supplies: SkuSupply[];
}

export interface SkuSupply {
  id: string;
  supplyKey: SupplyTag | '';
  label: string;
  values: Record<string, string>;
}

export interface PcbaOption {
  pcba: string;          // PCBA 标识，如 "A1"、"U1"
  projectName: string;   // 项目名，如 "X6728"；列不存在时为 ""
  band: string;          // 出货市场（即频段）；冲突时为空字符串 ""
  bandConflict: boolean; // true 表示该 PCBA 对应配置表中多个不同出货市场
  emmc: string;          // EMMC 列原始值，如 "128G"；列不存在或冲突时为 ""
  ddr: string;           // DDR 列原始值，如 "4G"；列不存在或冲突时为 ""
}

export interface ManagedMaterialCoreRow {
  materialName: string;
  code: string;
  vendor: string;
  supply: string;
}

export interface ManagedMaterialCoreMatch {
  sourceFileName: string;
  sourceSheetName: string;
  rows: ManagedMaterialCoreRow[];
  materialNames: string[];
  materialNameByStaticField: Partial<Record<'cpu' | 'pmu' | 'tx' | 'rf_transceiver' | 'nfc', string>>;
  materialNameByEmmcSize: Record<string, string>;
  materialNameByDdrSize: Record<string, string>;
}

export interface SampleCollectionRow {
  rowName: string;  // 原始行名（大ToB-原型列的值）
  cells: Record<string, string>;  // colKey -> raw cell value，colKey 格式: "{stage}_{supply}_{pcba}"
}

export interface SampleCollectionSheet {
  sheetName: string;
  // 列头信息：colIndex -> { stage, supply, pcba }
  colHeaders: Array<{ colIndex: number; stage: string; supply: string; pcba: string }>;
  rows: SampleCollectionRow[];
  rowNames: string[];  // 所有非空行名列表，供 LLM 匹配用
}

export interface SampleCollectionWorkbookData {
  sourceFileName: string;
  sheets: SampleCollectionSheet[];
  // LLM 匹配结果：fieldId -> 命中的原始行名
  rowNameByField: Partial<Record<SampleCollectionFieldId, string>>;
}

export interface ProjectInfo {
  name: string;
  mainboardId?: string;
  pcbaOptions?: PcbaOption[]; // The extracted PCBA configs with band info
  checkedPcbaOptions?: string[]; // The ones selected by user
  materialWorkbook?: ManagedMaterialWorkbook;
  keyMaterialTemplate?: KeyMaterialTemplateMatch;
  managedMaterialCore?: ManagedMaterialCoreMatch;
  sampleCollection?: SampleCollectionWorkbookData;
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
