# 搭配表数据拆解 Excel 结构分析

## 文件信息
- 文件名: `搭配表数据拆解（最终）.xls`
- Sheet: `PR2-1搭配表 (复制模互配)`
- 行数: 97 行
- 列数: 39 列

## 分组结构

### 1. 基本信息 (Row 1-9)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 2 | stage | 阶段 | 试产阶段 |
| 3 | order_no | 订单号 | BPM下试产订单后获取 |
| 4 | project | 项目 | 项目名字 |
| 5 | prod_order | 生产顺序 | 变量，不固定 |
| 6 | software | 软件 | |
| 7 | online_time | 上线时间 | |
| 8 | assembly_time | 组装时间 | |
| 9 | prod_loc | 试产地点 | 宜宾、南昌、河源、越南、自定义 |

### 2. 常用项 (Row 10-16)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 11 | color | 颜色 | 样机颜色，需与MBOM/PBOM校验 |
| 12 | unit_id | 整机标识 | 需校验横杠后标识与主板标识一致 |
| 13 | mb_id | 主板标识 | 来源配置表 |
| 14 | cal_file | 校准文件 | 依托于频段差异 |
| 15 | band | 频段 | 来源配置表，自动获取 |
| 16 | storage | 存储 | 来源配置表，自动获取 |

### 3. 存储/PCBA (Row 17-21)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 18 | pcba | PCBA | 样机需求表或自定义，自动计算 |
| 19 | sub_board_qty | 小板数量 | 等于PCBA |
| 20 | board_adj_qty | 调板数量 | 自定义填写 |
| 21 | assembly_qty | 组装数量 | 总计/生产良率 |

### 4. 核心器件 (Row 62-71)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 63 | cpu | CPU | |
| 64 | emmc | flash EMMC | |
| 65 | ddr | flash DDR | |
| 66 | pmu | 电源管理 | |
| 67 | tx | 无线发射 | |
| 68 | rf_transceiver | 射频收发器 | |
| 69 | nfc | NFC | |
| 70 | pcb | PCB | |
| 71 | sub_board | 小板 | |

### 5. 常规器件 (Row 22-45)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 23 | lcd | LCD | 来源客户器件表和CCL清单 |
| 24 | front_cam | 前CAM | |
| 25 | main_cam | 主CAM | |
| 26 | sub_cam | 副CAM | |
| 27 | fingerprint | 指纹 | |
| 28 | battery | 电池 | |
| 29 | speaker | 喇叭 | |
| 30 | receiver | 听筒 | |
| 31 | mic | MIC | |
| 32 | motor | 马达 | |
| 33 | spk_fpc | spk FPC | 模厂组装 |
| 34 | sidekey_fpc | Sidekey FPC | |
| 35 | ir_fpc | IR FPC | |
| 37 | lens | 镜片 | |
| 38 | housing | 壳料 | |
| 39 | battery_cover | 电池盖 | |
| 40 | sim_tray | 卡托 | |
| 41 | side_key | 侧键 | |
| 42 | aux_material | 辅料 | |
| 43 | cooling | 散热 | |
| 45 | pkg_process | 包装流程 | |

### 6. 工艺辅料 (Row 46-53)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 46 | copy_mold | 复制模互配 | |
| 48 | underfill | 底填 | |
| 49 | thermal_gel_mb | 主板导热凝胶 | |
| 50 | usb_glue | USB点胶状态 | |
| 51 | solder_paste | 锡膏 | |
| 52 | thermal_gel_front | 面壳导热凝胶 | |
| 53 | tp_hotmelt | TP热熔胶 | |

### 7. BOM信息 (Row 54-61)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 55 | ebom | EBOM（料号） | |
| 56 | ebom_desc | EBOM（描述） | |
| 57 | sub_bom | 小板BOM（料号） | |
| 58 | sub_bom_desc | 小板BOM（描述） | |
| 59 | lda | LDA组件 | 来源BPM料号 |
| 60 | mbom | MBOM | |
| 61 | pbom | PBOM | 来源BPM料号 |

### 8. 客户样机需求 (Row 72-77)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 73 | reliability | 可靠性（客户） | |
| 74 | field_test | 场测样机 | |
| 75 | fan_sample | 粉丝样机 | 来源客户样机需求表 |
| 76 | ce_cert | CE认证样机 | |
| 77 | customer_sample_req | 客户样机需求 | |

### 9. 内部样机需求 (Row 78-92)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 79 | hw_eng | 硬件 | |
| 80 | hw_test | 硬测 | |
| 81 | sw_eng | 软件 | |
| 82 | sw_test | 软测 | |
| 84 | struct_eng | 结构 | |
| 85 | reliability_eng | 可靠性（内部） | |
| 86 | pressure_test | 压测 | |
| 87 | image_eng | 影像 | |
| 88 | npm | NPM | |
| 89 | ux | 体验 | |
| 90 | parts | 器件 | |
| 91 | pm | 产品 | |
| 92 | t_long_rd_total | 天珑研发样机总计 | |

### 10. 统计汇总 (Row 93-96)
| Row | 字段ID | 标签 | 说明 |
|-----|--------|------|------|
| 94 | backup_unit | 备料样机 | |
| 95 | total_qty | 总计 | |
| 96 | prod_yield | 生产良率 | |

## 与现有 constants.ts 的差异

### 字段分组变化
1. **基本信息组**：新增 `prod_order`、`software`、`online_time`、`assembly_time`、`prod_loc`
2. **常用项组**：`mb_id` 从基本信息移到常用项，`storage` 从存储/PCBA 移到常用项
3. **统计汇总组**：新增 `backup_unit`

### 字段总数
- Excel 提取: 75 个字段
- 现有 constants.ts: 72 个字段
- 新增: 3 个字段 (`prod_order`, `software`, `online_time`, `assembly_time`, `prod_loc`, `backup_unit`)
- 移动: 2 个字段 (`mb_id`, `storage`)
