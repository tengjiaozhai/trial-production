import { FieldDefinition } from './types';

export const FIELD_GROUPS = [
  '基本信息',
  '常用项',
  '存储/PCBA',
  '核心器件',
  '器件规格',
  '工艺辅料',
  'BOM信息',
  '负责团队',
  '样机需求',
  '统计汇总'
];

export const FIELD_DEFS: FieldDefinition[] = [
  // 基本信息
  { id: 'project', label: '项目名称', group: '基本信息', behavior: 'auto' },
  { id: 'stage', label: '试产阶段', group: '基本信息', behavior: 'auto' },
  { id: 'mb_id', label: '主板标识', group: '基本信息', behavior: 'manual' },
  { id: 'order_no', label: '订单号', group: '基本信息', behavior: 'manual' },

  // 常用项
  { id: 'prod_order', label: '生产顺序', group: '常用项', behavior: 'manual' },
  { id: 'software', label: '软件', group: '常用项', behavior: 'manual' },
  { id: 'online_time', label: '上线时间', group: '常用项', behavior: 'manual' },
  { id: 'assembly_time', label: '组装时间', group: '常用项', behavior: 'manual' },
  { id: 'prod_loc', label: '试产地点', group: '常用项', behavior: 'manual' },
  { id: 'color', label: '颜色', group: '常用项', behavior: 'manual' },
  { id: 'unit_id', label: '整机标识', group: '常用项', behavior: 'manual' },
  { id: 'cal_file', label: '校准文件', group: '常用项', behavior: 'manual' },
  { id: 'band', label: '频段', group: '常用项', behavior: 'auto' },

  // 存储/PCBA
  { id: 'storage', label: '存储', group: '存储/PCBA', behavior: 'auto' },
  { id: 'pcba', label: 'PCBA', group: '存储/PCBA', behavior: 'calc' },
  { id: 'sub_board_qty', label: '小板数量', group: '存储/PCBA', behavior: 'calc' },
  { id: 'board_adj_qty', label: '调板数量', group: '存储/PCBA', behavior: 'manual' },
  { id: 'assembly_qty', label: '组装数量', group: '存储/PCBA', behavior: 'calc' },

  // 核心器件
  { id: 'cpu', label: 'CPU', group: '核心器件', behavior: 'auto' },
  { id: 'emmc', label: 'flash EMMC', group: '核心器件', behavior: 'auto' },
  { id: 'ddr', label: 'flash DDR', group: '核心器件', behavior: 'auto' },
  { id: 'pmu', label: '电源管理', group: '核心器件', behavior: 'auto' },
  { id: 'tx', label: '无线发射', group: '核心器件', behavior: 'auto' },
  { id: 'rf_transceiver', label: '射频收发器', group: '核心器件', behavior: 'auto' },
  { id: 'nfc', label: 'NFC', group: '核心器件', behavior: 'auto' },
  { id: 'pcb', label: 'PCB', group: '核心器件', behavior: 'auto' },
  { id: 'sub_board', label: '小板', group: '核心器件', behavior: 'auto' },

  // 器件规格
  { id: 'lcd', label: 'LCD', group: '器件规格', behavior: 'auto' },
  { id: 'front_cam', label: '前CAM', group: '器件规格', behavior: 'auto' },
  { id: 'main_cam', label: '主CAM', group: '器件规格', behavior: 'auto' },
  { id: 'sub_cam', label: '副CAM', group: '器件规格', behavior: 'auto' },
  { id: 'fingerprint', label: '指纹', group: '器件规格', behavior: 'auto' },
  { id: 'battery', label: '电池', group: '器件规格', behavior: 'auto' },
  { id: 'speaker', label: '喇叭', group: '器件规格', behavior: 'auto' },
  { id: 'receiver', label: '听筒', group: '器件规格', behavior: 'auto' },
  { id: 'mic', label: 'MIC', group: '器件规格', behavior: 'auto' },
  { id: 'motor', label: '马达', group: '器件规格', behavior: 'auto' },
  { id: 'spk_fpc', label: 'spk FPC', group: '器件规格', behavior: 'auto' },
  { id: 'sidekey_fpc', label: 'Sidekey FPC', group: '器件规格', behavior: 'auto' },
  { id: 'ir_fpc', label: 'IR FPC', group: '器件规格', behavior: 'auto' },
  { id: 'lens', label: '镜片', group: '器件规格', behavior: 'auto' },
  { id: 'housing', label: '壳料', group: '器件规格', behavior: 'auto' },
  { id: 'battery_cover', label: '电池盖', group: '器件规格', behavior: 'auto' },
  { id: 'sim_tray', label: '卡托', group: '器件规格', behavior: 'auto' },
  { id: 'side_key', label: '侧键', group: '器件规格', behavior: 'auto' },
  { id: 'aux_material', label: '辅料', group: '器件规格', behavior: 'auto' },
  { id: 'cooling', label: '散热', group: '器件规格', behavior: 'auto' },
  { id: 'pkg_process', label: '包装流程', group: '器件规格', behavior: 'manual' },

  // 工艺辅料
  { id: 'copy_mold', label: '复制模互配', group: '工艺辅料', behavior: 'manual' },
  { id: 'underfill', label: '底填', group: '工艺辅料', behavior: 'manual' },
  { id: 'thermal_gel_mb', label: '主板导热凝胶', group: '工艺辅料', behavior: 'manual' },
  { id: 'usb_glue', label: 'USB点胶状态', group: '工艺辅料', behavior: 'manual' },
  { id: 'solder_paste', label: '锡膏', group: '工艺辅料', behavior: 'manual' },
  { id: 'thermal_gel_front', label: '面壳导热凝胶', group: '工艺辅料', behavior: 'manual' },
  { id: 'tp_hotmelt', label: 'TP热熔胶', group: '工艺辅料', behavior: 'manual' },

  // BOM信息
  { id: 'ebom', label: 'EBOM', group: 'BOM信息', behavior: 'manual' },
  { id: 'sub_bom', label: '小板BOM', group: 'BOM信息', behavior: 'manual' },
  { id: 'lda', label: 'LDA组件', group: 'BOM信息', behavior: 'manual' },
  { id: 'mbom', label: 'MBOM', group: 'BOM信息', behavior: 'manual' },
  { id: 'pbom', label: 'PBOM', group: 'BOM信息', behavior: 'manual' },

  // 负责团队
  { id: 'hw_eng', label: '硬件', group: '负责团队', behavior: 'auto' },
  { id: 'hw_test', label: '硬测', group: '负责团队', behavior: 'auto' },
  { id: 'sw_eng', label: '软件', group: '负责团队', behavior: 'auto' },
  { id: 'sw_test', label: '软测', group: '负责团队', behavior: 'auto' },
  { id: 'struct_eng', label: '结构', group: '负责团队', behavior: 'auto' },
  { id: 'reliability_eng', label: '可靠性', group: '负责团队', behavior: 'auto' },
  { id: 'pressure_test', label: '压测', group: '负责团队', behavior: 'auto' },
  { id: 'image_eng', label: '影像', group: '负责团队', behavior: 'auto' },
  { id: 'npm', label: 'NPM', group: '负责团队', behavior: 'auto' },
  { id: 'ux', label: '体验', group: '负责团队', behavior: 'auto' },
  { id: 'parts', label: '器件', group: '负责团队', behavior: 'auto' },
  { id: 'pm', label: '产品', group: '负责团队', behavior: 'auto' },

  // 样机需求
  { id: 'reliability', label: '可靠性', group: '样机需求', behavior: 'auto' },
  { id: 'field_test', label: '场测样机', group: '样机需求', behavior: 'auto' },
  { id: 'fan_sample', label: '粉丝样机', group: '样机需求', behavior: 'auto' },
  { id: 'ce_cert', label: 'CE认证样机', group: '样机需求', behavior: 'auto' },
  { id: 'customer_sample_req', label: '客户样机需求', group: '样机需求', behavior: 'calc' },
  { id: 'backup_unit', label: '备料样机', group: '样机需求', behavior: 'manual' },

  // 统计汇总
  { id: 't_long_rd_total', label: '天珑研发样机总计', group: '统计汇总', behavior: 'calc' },
  { id: 'total_qty', label: '总计', group: '统计汇总', behavior: 'calc' },
  { id: 'prod_yield', label: '生产良率', group: '统计汇总', behavior: 'manual' },
];

export const TEMPLATE_STAGES: Record<string, string[]> = {
  '标准': ['EVB', 'EVT', 'DVT1', 'DVT2', 'PVT', 'MP'],
  '传音': ['T0', 'PR0', 'PR1', 'PR2', 'PIR', 'MP'],
  '中兴': ['T0', 'T1', 'T2', 'T3', 'NPI', 'MP'],
};

export const MOCK_COLUMNS = [
  { 
    id: 'sku1', 
    stage: 'EVT', 
    orderNo: '', 
    project: 'X6728 Standard',
    supplies: [
      { id: 's1', label: '一供', values: { band: 'Full Band', storage: '4+64', lcd: 'BOE', cpu: 'MT8766', hw_eng: '5', reliability: '2' } }
    ]
  },
  { 
    id: 'sku2', 
    stage: 'PR1', 
    orderNo: '', 
    project: 'V633 Transsion',
    supplies: [
      { id: 's1', label: '一供', values: { band: 'SSA', storage: '8+128', lcd: 'CSOT', cpu: 'MT8788', hw_eng: '8', reliability: '5' } },
      { id: 's2', label: '二供', values: { band: 'LATAM', storage: '8+128', lcd: 'Tianma', cpu: 'MT8788', hw_eng: '8', reliability: '3' } }
    ]
  },
];

export const AM_RULE_DEFS = [
  {
    id: 'R-COLOR-001',
    title: '颜色与 MBOM/PBOM 一致',
    amReference: '完成后需要校验，与本表中MBOM和PBOM中的颜色是否一致，不一致的都要给出提示',
    requiresFlowComplete: true,
  },
  {
    id: 'R-PN-001',
    title: 'CCL 料号 vs 管控表',
    amReference: '主板/屏/内存/闪存 P/N：CCL 值与管控 mock 不一致需给出提示',
    requiresFlowComplete: false,
  },
  {
    id: 'R-MEM-001',
    title: '内存闪存组合',
    amReference: '组合可疑（内存/闪存配比异常）时给出警告',
    requiresFlowComplete: false,
  },
  {
    id: 'R-QTY-001',
    title: '搭配数量逻辑',
    amReference: '搭配数量 > 试产数量时给出错误',
    requiresFlowComplete: false,
  },
  {
    id: 'R-PBOM-001',
    title: 'PBOM 包装 vs 包装标签',
    amReference: 'PBOM 包装与包装标签不一致时提示',
    requiresFlowComplete: false,
  },
  {
    id: 'R-HOUSING-001',
    title: '壳体 MBOM vs 器件规格',
    amReference: 'MBOM 壳体与器件规格壳体不一致时提示',
    requiresFlowComplete: false,
  }
];
