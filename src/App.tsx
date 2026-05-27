import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, FileText, Download, CheckCircle, Play, Plus, X, RotateCw, Save, History, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { arrayMove } from '@dnd-kit/sortable';

import { StepsIndicator } from './components/StepsIndicator';
import { Sidebar } from './components/Sidebar';
import { TrialProductionTable } from './components/TrialProductionTable';
import { HistoryModal } from './components/HistoryModal';
import { 
  ProjectInfo, 
  Template, 
  Stage, 
  StepId, 
  SKUData, 
  ValidationResult,
  FieldDefinition,
  ValidationLevel,
  HistoryEntry
} from './types';
import { 
  TEMPLATE_STAGES, 
  FIELD_DEFS, 
  MOCK_COLUMNS, 
  AM_RULE_DEFS,
  FIELD_GROUPS
} from './constants';
import { cn, extractPcbaOptions } from './lib/utils';

export default function App() {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    name: '',
    customer: '',
    stage: '',
    files: [],
  });

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [skuData, setSkuData] = useState<SKUData[]>([]);
  const [activeFields, setActiveFields] = useState<FieldDefinition[]>(FIELD_DEFS);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isFlowComplete, setIsFlowComplete] = useState(false);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [isExportDisabled, setIsExportDisabled] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [createNewPrompt, setCreateNewPrompt] = useState(false);
  const [manualPcbaInput, setManualPcbaInput] = useState("");

  // Compute step 2 conflicts based on activeFields and skuData
  const getStep2Conflicts = () => {
    if (currentStep !== 2) return [];
    const step2Ids = [
      'order_no', 'band', 'storage', 
      'lcd', 'front_cam', 'main_cam', 'sub_cam', 'fingerprint', 'battery', 'speaker', 'receiver', 'mic', 'motor', 'spk_fpc', 'sidekey_fpc', 'ir_fpc', 'lens', 'housing', 'battery_cover', 'sim_tray', 'side_key', 'aux_material', 'cooling', 
      'cpu', 'emmc', 'ddr', 'pmu', 'tx', 'rf_transceiver', 'nfc', 'pcb', 'sub_board', 'reliability', 'field_test', 'fan_sample', 'ce_cert',
      'hw_eng', 'hw_test', 'sw_eng', 'sw_test', 'struct_eng', 'reliability_eng', 'pressure_test', 'image_eng', 'npm', 'ux', 'parts', 'pm'
    ];
    const conflicts: { fieldId: string; fieldLabel: string; supplyLabel: string }[] = [];
    skuData.forEach(sku => {
      sku.supplies.forEach(sup => {
        step2Ids.forEach(fId => {
          const field = activeFields.find(f => f.id === fId);
          if (field && field.behavior !== 'calc') {
            if (!sup.values[fId] || String(sup.values[fId]).trim() === '') {
               conflicts.push({ fieldId: fId, fieldLabel: field.label, supplyLabel: `${sku.project}-${sup.label}` });
            }
          }
        });
      });
    });
    return conflicts;
  };

  const step2Conflicts = getStep2Conflicts();

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('trial_production_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const handleSaveToHistoryAction = (action: 'overwrite' | 'new', isExport = false, cb?: () => void) => {
    let baseId = `history_${Date.now()}`;
    let version = 1;

    const existingSameName = history.filter(h => h.name === projectInfo.name);
    
    if (existingSameName.length > 0) {
      if (action === 'overwrite') {
        const latestExisting = existingSameName.sort((a, b) => b.timestamp - a.timestamp)[0];
        baseId = latestExisting.id;
        version = latestExisting.version || 1;
      } else {
        version = Math.max(...existingSameName.map(h => h.version || 1)) + 1;
      }
    }

    const entry: HistoryEntry = {
      id: baseId,
      timestamp: Date.now(),
      name: projectInfo.name || '未命名试产单',
      version,
      projectInfo,
      skuData,
      currentStep,
      activeFields,
      isFlowComplete: isExport || isFlowComplete,
      isArchived: isExport || isFlowComplete
    };

    let newHistory = [...history];
    const existingIndex = newHistory.findIndex(h => h.id === baseId);
    
    if (existingIndex !== -1) {
      newHistory[existingIndex] = entry;
      // if (!isExport) alert(`已更新覆盖历史记录: ${entry.name} V${version}`);
    } else {
      newHistory = [entry, ...newHistory];
      // if (!isExport) alert(`已保存为新版本: V${version}`);
    }
    
    setHistory(newHistory);
    localStorage.setItem('trial_production_history', JSON.stringify(newHistory));
    
    if (cb) cb();
  };

  const handleIntendSave = (isExport = false, cb?: () => void) => {
    handleSaveToHistoryAction('new', isExport, () => {
       if (isExport) performExport();
       if (cb) cb();
    });
  };

  const doResetForNew = () => {
    setProjectInfo({
      name: '',
      mainboardId: '',
      pcbaOptions: [],
      checkedPcbaOptions: [],
      customer: '',
      stage: '',
      files: []
    });
    setSkuData([]);
    setCurrentStep(1);
    setValidationResults([]);
    setIsFlowComplete(false);
  };

  const handleCreateNew = () => {
    if (projectInfo.name || skuData.length > 0) {
      setCreateNewPrompt(true);
    } else {
      doResetForNew();
    }
  };

  const performExport = () => {
    const wb = XLSX.utils.book_new();
    const dataRows: any[][] = [];
    
    const h1 = ['', '阶段', ...skuData.flatMap(s => s.supplies.map(() => s.stage))];
    dataRows.push(h1);

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(wb, ws, '搭配表');
    
    // Find highest version for this project to append to filename
    const existingSameName = history.filter(h => h.name === projectInfo.name);
    const maxVersion = existingSameName.length > 0 ? Math.max(...existingSameName.map(h => h.version || 1)) : 1;
    
    XLSX.writeFile(wb, `搭配表_${projectInfo.name}_V${maxVersion}.xlsx`);

    setIsFlowComplete(true);
  };

  const handleExport = () => {
    handleIntendSave(true);
  };

  const loadHistoryItem = (item: HistoryEntry) => {
    setProjectInfo(item.projectInfo);
    setSkuData(item.skuData);
    setCurrentStep(item.currentStep);
    setActiveFields(item.activeFields);
    setIsFlowComplete(item.isFlowComplete);
    setShowHistory(false);
  };

  const copyHistoryItem = (item: HistoryEntry) => {
    setProjectInfo({
      ...item.projectInfo,
      name: item.projectInfo.name,
      isCopied: true
    });
    setSkuData(item.skuData.map((sku, i) => ({
      ...sku,
      id: `sku_copy_${Date.now()}_${i}`,
      supplies: sku.supplies.map((s, j) => ({
        ...s,
        id: `s_copy_${Date.now()}_${i}_${j}`
      }))
    })));
    setCurrentStep(1); // Set to step 1 so they can review and auto-fetch
    setActiveFields(item.activeFields);
    setIsFlowComplete(false);
    setShowHistory(false);
  };

  const deleteHistoryItem = (id: string) => {
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('trial_production_history', JSON.stringify(newHistory));
  };

  // Reorder Fields
  const handleReorderFields = (activeId: string, overId: string) => {
    setActiveFields(prev => {
      const activeIdx = prev.findIndex(f => f.id === activeId);
      const overIdx = prev.findIndex(f => f.id === overId);
      return arrayMove(prev, activeIdx, overIdx);
    });
  };

  // Reorder SKUs
  const handleReorderSkus = (activeId: string, overId: string) => {
    setSkuData(prev => {
      const activeIdx = prev.findIndex(sku => sku.id === activeId);
      const overIdx = prev.findIndex(sku => sku.id === overId);
      return arrayMove(prev, activeIdx, overIdx);
    });
  };

  // Reorder Supplies within SKU
  const handleReorderSupplies = (skuId: string, activeId: string, overId: string) => {
    setSkuData(prev => prev.map(sku => {
      if (sku.id !== skuId) return sku;
      const activeIdx = sku.supplies.findIndex(s => s.id === activeId);
      const overIdx = sku.supplies.findIndex(s => s.id === overId);
      return { ...sku, supplies: arrayMove(sku.supplies, activeIdx, overIdx) };
    }));
  };

  // Insert Field at Position
  const handleInsertFieldAt = (index: number) => {
     const name = prompt('请输入新字段名：');
     if (!name) return;
     const newField: FieldDefinition = {
       id: `custom_${Date.now()}`,
       label: name,
       group: index > 0 ? activeFields[index - 1].group : '基本信息',
       behavior: 'manual'
     };
     setActiveFields(prev => {
       const next = [...prev];
       next.splice(index, 0, newField);
       return next;
     });
     setIsExportDisabled(true);
  };

  // Insert Supply at Position
  const handleAddSupplyAt = (skuId: string, index?: number) => {
    setSkuData(prev => prev.map(sku => {
      if (sku.id === skuId) {
        const newSup = { id: `s_${Date.now()}`, label: '新供应', values: {} };
        const nextSupplies = [...sku.supplies];
        if (typeof index === 'number') nextSupplies.splice(index, 0, newSup);
        else nextSupplies.push(newSup);
        return { ...sku, supplies: nextSupplies };
      }
      return sku;
    }));
  };

  // Add SKU at position (not explicitly handled in UI yet, but API should be there)
  const handleAddSkuAt = (index?: number) => {
    const newSku: SKUData = {
      id: `sku_${Date.now()}`,
      stage: projectInfo.stage,
      orderNo: '',
      project: projectInfo.name,
      supplies: [{ id: 's1', label: '一供', values: {} }]
    };
    setSkuData(prev => {
       const next = [...prev];
       if (typeof index === 'number') next.splice(index, 0, newSku);
       else next.push(newSku);
       return next;
    });
  };

  // Step 1: Form Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files);
    // 重置 input value，确保同一文件可以再次触发 onChange
    e.target.value = '';

    const newFiles = fileList.map((file: File) => {
      let type = '其他';
      if (file.name.includes('配置')) type = '配置表';
      else if (file.name.includes('关键物料') || file.name.includes('选型') || file.name.includes('CCL')) type = '关键物料选型模板';
      else if (file.name.includes('样机') || file.name.includes('收集表')) type = '样机收集表';
      else if (file.name.includes('管控') || file.name.includes('物料表')) type = '物料表';
      return { 
        id: `f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: file.name, 
        type 
      };
    });

    setProjectInfo(prev => ({
      ...prev,
      files: [...prev.files, ...newFiles],
    }));

    // 检测配置表文件，异步解析 PCBA 选项
    const configFiles = fileList.filter((f: File) => f.name.includes('配置'));
    for (const configFile of configFiles) {
      const options = await extractPcbaOptions(configFile as File);
      if (options.length > 0) {
        setProjectInfo(prev => ({
          ...prev,
          pcbaOptions: options,
          checkedPcbaOptions: prev.checkedPcbaOptions && prev.checkedPcbaOptions.length > 0
            ? prev.checkedPcbaOptions
            : [],
        }));
        break; // 取第一个有效配置表
      }
    }
  };

  const handleDeleteFile = (fileId: string) => {
    setProjectInfo(prev => {
      const deletedFile = prev.files.find(f => f.id === fileId);
      const nextFiles = prev.files.filter(f => f.id !== fileId);
      // 如果删除的是配置表，且剩余文件中没有其他配置表，则清除 PCBA 选项
      const hasRemainingConfig = nextFiles.some(f => f.type === '配置表');
      if (deletedFile?.type === '配置表' && !hasRemainingConfig) {
        return { ...prev, files: nextFiles, pcbaOptions: [], checkedPcbaOptions: [] };
      }
      return { ...prev, files: nextFiles };
    });
  };

  const isStep1Complete = projectInfo.isCopied || (projectInfo.name && projectInfo.customer && projectInfo.stage && projectInfo.files.length > 0 && (projectInfo.checkedPcbaOptions && projectInfo.checkedPcbaOptions.length > 0));

  // Step 2: Auto Calculation Logic
  const startAutoCalc = async () => {
    setLoading(true);
    const timeline = [
      '读取数据源...',
      '匹配项目型号与关键物料...',
      '解析选型模板 (EBOM/MBOM)...',
      '提取物料规格与频段信息...',
      '计算需求数量与生产良率...',
      '数据同步完成'
    ];
    for (const text of timeline) {
      setLoadingText(text);
      await new Promise(r => setTimeout(r, 600));
    }

    // Logic based on types of files uploaded
    const hasConfig = projectInfo.files.some(f => f.type === '配置表');
    const hasCCL = projectInfo.files.some(f => f.type === '关键物料选型模板');
    
    let baseData: SKUData[] = [];
    if (projectInfo.checkedPcbaOptions && projectInfo.checkedPcbaOptions.length > 0) {
      baseData = projectInfo.checkedPcbaOptions.map((pcbaId, idx) => {
        const opt = (projectInfo.pcbaOptions || []).find(o => o.pcba === pcbaId);
        const bandValue = opt && !opt.bandConflict ? opt.band : '';
        const storageValue = (() => {
          if (!opt) return '';
          const ddrRaw  = (opt.ddr  || '').replace(/[Gg]/g, '').trim();
          const emmcRaw = (opt.emmc || '').replace(/[Gg]/g, '').trim();
          if (!ddrRaw || !emmcRaw) return '';
          return `${ddrRaw}+${emmcRaw}`;
        })();
        return {
          id: `sku_${Date.now()}_${idx}`,
          stage: projectInfo.stage,
          orderNo: '',
          project: pcbaId,
          supplies: [
            { id: `s_${Date.now()}_${idx}_1`, label: '主供', values: { storage: storageValue, lcd: '', band: bandValue } }
          ]
        };
      });
    } else {
      // Fallback
      baseData = MOCK_COLUMNS.map(sku => ({ ...sku, project: projectInfo.name, stage: projectInfo.stage }));
    }

    baseData = baseData.map(sku => ({
      ...sku,
      project: sku.project,
      stage: projectInfo.stage,
      supplies: sku.supplies.map(sup => {
        const newValues = { 
          ...sup.values,
          project: projectInfo.name,
          stage: projectInfo.stage,
          mb_id: sku.project
        };
        
        // Dynamic matching simulation based on files
        projectInfo.files.forEach(f => {
          if (f.name.toLowerCase().includes('ccl')) {
            newValues['cpu'] = f.name.includes('MTK') ? 'MT6761' : 'T606';
          }
        });
        
        // Force a conflict for demonstration purposes on 'battery' or 'lcd'
        if (Math.random() > 0.3) {
           newValues['lcd'] = ''; // triggers conflict
        }
        
        return { ...sup, values: newValues };
      })
    }));

    setSkuData(baseData);
    setLoading(false);
    setCurrentStep(2);
  };

  // Step 4: Validation Engine
  const runValidation = () => {
    const results: ValidationResult[] = [];
    
    skuData.forEach(sku => {
      sku.supplies.forEach((sup) => {
        const prefix = `[${sku.project} · ${sup.label}] `;
        const vals = sup.values;

        // --- Rule 1: Color consistency (Color vs MBOM vs PBOM) ---
        const color = String(vals['color'] || '').trim();
        const mbom = String(vals['mbom'] || '').trim();
        const pbom = String(vals['pbom'] || '').trim();
        
        if (!color) {
          results.push({
            id: `RULE-COLOR-${sku.id}-${sup.id}`,
            title: '颜色项待填',
            amReference: 'Rule-1',
            detail: `${prefix}未填写颜色，无法执行一致性校验。`,
            level: 'warn',
            fieldId: 'color'
          });
        } else {
          const mbomMatch = !mbom || mbom.includes(color);
          const pbomMatch = !pbom || pbom.includes(color);
          
          if (!mbomMatch || !pbomMatch) {
            results.push({
              id: `RULE-COLOR-${sku.id}-${sup.id}`,
              title: '颜色不一致',
              amReference: 'Rule-1',
              detail: `${prefix}颜色(${color})与 MBOM/PBOM 中的描述不匹配。`,
              level: 'error',
              fieldId: 'color'
            });
          } else {
            results.push({
              id: `RULE-COLOR-${sku.id}-${sup.id}`,
              title: '颜色一致性核验通过',
              amReference: 'Rule-1',
              detail: `${prefix}颜色与物料清单描述匹配。`,
              level: 'pass',
              fieldId: 'color'
            });
          }
        }

        // --- Rule 2: Storage vs EBOM vs eMMC/DDR ---
        const storage = String(vals['storage'] || '').toLowerCase(); // e.g. "4+128g"
        const ebom = String(vals['ebom'] || '').toLowerCase();
        const emmc = String(vals['emmc'] || '').toLowerCase();
        const ddr = String(vals['ddr'] || '').toLowerCase();

        const storageMatch = storage.match(/(\d+)\+(\d+)/);
        if (!storageMatch) {
          results.push({
            id: `RULE-STORAGE-${sku.id}-${sup.id}`,
            title: '存储规则待核',
            amReference: 'Rule-2',
            detail: `${prefix}存储格式需为 "DDR+EMMC" (如 4+128)。`,
            level: 'error',
            fieldId: 'storage'
          });
        } else {
          const expectedDDR = storageMatch[1];
          const expectedEMMC = storageMatch[2];
          
          let storageIssues = [];
          if (ebom && (!ebom.includes(expectedDDR) || !ebom.includes(expectedEMMC))) storageIssues.push('EBOM 不匹配');
          if (emmc && !emmc.includes(expectedEMMC)) storageIssues.push('EMMC 字段值不符');
          if (ddr && !ddr.includes(expectedDDR)) storageIssues.push('DDR 字段值不符');

          if (storageIssues.length > 0) {
            results.push({
              id: `RULE-STORAGE-${sku.id}-${sup.id}`,
              title: '存储配置冲突',
              amReference: 'Rule-2',
              detail: `${prefix}配置(${storage})与以下项冲突: ${storageIssues.join('、')}`,
              level: 'error',
              fieldId: 'storage'
            });
          } else {
            results.push({
              id: `RULE-STORAGE-${sku.id}-${sup.id}`,
              title: '存储核验通过',
              amReference: 'Rule-2',
              detail: `${prefix}存储配置与 EBOM/芯片规格匹配。`,
              level: 'pass',
              fieldId: 'storage'
            });
          }
        }

        // --- Rule 3: ID Suffix (Unit ID hyphen char vs MB ID vs EBOM) ---
        const unitId = String(vals['unit_id'] || '').trim();
        const mbId = String(vals['mb_id'] || '').trim();
        
        if (unitId && unitId.includes('-')) {
          const suffix = unitId.split('-').pop() || '';
          let suffixIssues = [];
          if (mbId && mbId !== suffix) suffixIssues.push(`与主板标识(${mbId})不一致`);
          if (ebom && !ebom.includes(suffix)) suffixIssues.push('EBOM 中未发现该标识');

          if (suffixIssues.length > 0) {
            results.push({
              id: `RULE-SUFFIX-${sku.id}-${sup.id}`,
              title: '整机标识异常',
              amReference: 'Rule-3',
              detail: `${prefix}后缀(${suffix}) ${suffixIssues.join('且')}`,
              level: 'error'
            });
          } else {
            results.push({
              id: `RULE-SUFFIX-${sku.id}-${sup.id}`,
              title: '标识后缀核验通过',
              amReference: 'Rule-3',
              detail: `${prefix}后缀与主板及 EBOM 确认一致。`,
              level: 'pass'
            });
          }
        } else {
          results.push({
            id: `RULE-SUFFIX-${sku.id}-${sup.id}`,
            title: '整机标识待完善',
            amReference: 'Rule-3',
            detail: `${prefix}请填写带横杠的整机标识以执行后缀校验。`,
            level: 'warn'
          });
        }
      });
    });

    setValidationResults(results);
    const hasError = results.some(r => r.level === 'error');
    setIsExportDisabled(hasError);
  };

  useEffect(() => {
    if (currentStep === 4) {
      runValidation();
    }
  }, [currentStep, isFlowComplete, skuData]);

  const handleUpdateValue = (skuId: string, supplyId: string, fieldId: string, value: string) => {
    setSkuData(prev => {
      const next = prev.map(sku => {
        if (sku.id !== skuId) return sku;
        return {
          ...sku,
          supplies: sku.supplies.map(sup => {
            if (sup.id !== supplyId) return sup;
            const newValues = { ...sup.values, [fieldId]: value };

            // Step 4 Calculations & Dynamic Validation
            const getNum = (fid: string) => Number(newValues[fid] || 0);

            // 1. Customer Sample Demand = Reliability + Field Test + Fan + CE
            const customerSampleReq = getNum('reliability') + getNum('field_test') + getNum('fan_sample') + getNum('ce_cert');
            newValues['customer_sample_req'] = customerSampleReq > 0 ? customerSampleReq.toString() : (newValues['customer_sample_req'] || '');

            // 2. T-Long R&D Total = Sum of responsible teams
            const tLongFields = ['hw_eng', 'hw_test', 'sw_eng', 'sw_test', 'struct_eng', 'reliability_eng', 'pressure_test', 'image_eng', 'npm', 'ux', 'parts', 'pm'];
            const tLongTotal = tLongFields.reduce((sum, fid) => sum + getNum(fid), 0);
            newValues['t_long_rd_total'] = tLongTotal > 0 ? tLongTotal.toString() : (newValues['t_long_rd_total'] || '');

            // 3. Total = Customer + T-Long
            const totalQty = customerSampleReq + tLongTotal;
            newValues['total_qty'] = totalQty > 0 ? totalQty.toString() : (newValues['total_qty'] || '');

            // 4. Assembly Qty = Total / Yield
            const yieldRate = Number(newValues['prod_yield'] || 0.98); 
            const assemblyQty = totalQty > 0 ? Math.ceil(totalQty / yieldRate) : 0;
            if (assemblyQty > 0) newValues['assembly_qty'] = assemblyQty.toString();

            // 5. PCBA = strictly greater closest multiple of 4 > (board_adj + assembly)
            const boardAdj = getNum('board_adj_qty');
            if (boardAdj > 0 || assemblyQty > 0) {
              const pcbaBase = boardAdj + assemblyQty;
              const pcba = (Math.floor(pcbaBase / 4) + 1) * 4;
              newValues['pcba'] = pcba.toString();
              newValues['sub_board_qty'] = pcba.toString();
            }

            return { ...sup, values: newValues };
          })
        };
      });
      return next;
    });
    setIsExportDisabled(true);
  };

  const handleUpdateSkuHeader = (skuId: string, part: 'stage' | 'order' | 'project', val: string) => {
    setSkuData(prev => prev.map(sku => {
      if (sku.id === skuId) {
        if (part === 'stage') return { ...sku, stage: val };
        if (part === 'order') return { ...sku, orderNo: val };
        if (part === 'project') return { ...sku, project: val };
      }
      return sku;
    }));
  };

  const handleAddSku = () => {
    const newSku: SKUData = {
      id: `sku_${Date.now()}`,
      stage: projectInfo.stage,
      orderNo: '',
      project: projectInfo.name,
      supplies: [{ id: 's1', label: '一供', values: {} }]
    };
    setSkuData(prev => [...prev, newSku]);
  };

  const handleAddSupply = (skuId: string) => {
    setSkuData(prev => prev.map(sku => {
      if (sku.id === skuId) {
        const newSup = { id: `s_${Date.now()}`, label: '新供应', values: {} };
        return { ...sku, supplies: [...sku.supplies, newSup] };
      }
      return sku;
    }));
  };

  const handleDeleteSupply = (skuId: string, supplyId: string) => {
    setSkuData(prev => prev.map(sku => {
      if (sku.id === skuId) {
        return { ...sku, supplies: sku.supplies.filter(s => s.id !== supplyId) };
      }
      return sku;
    }));
  };

  const handleAddField = () => {
    handleInsertFieldAt(activeFields.length);
  };



  const goBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as StepId);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f7f9] text-slate-800 font-sans overflow-hidden">
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-[110]">
        <div className="flex items-center gap-6">
          <div className="font-black text-xl tracking-tight text-[#0f2e4a] flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#0f2e4a] flex items-center justify-center text-white shrink-0">
               <CheckCircle size={14} strokeWidth={3} />
            </div>
            试产搭配表智能生成助手
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 text-white bg-[#0f2e4a] hover:bg-[#1a4269] rounded transition-all text-xs font-bold"
          >
            <Plus size={16} />
            <span>新建试产阶段</span>
          </button>
          <div className="w-[1px] h-4 bg-slate-200 mx-1" />
          <button 
            onClick={() => setShowHistory(true)}
            className="group flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-all text-xs font-medium"
          >
            <History size={16} className="group-hover:rotate-12 transition-transform" />
            <span>历史记录</span>
            {history.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] rounded-full font-black">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>
      
      <StepsIndicator currentStep={currentStep} />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          currentStep={currentStep} 
          projectInfo={projectInfo} 
          skuData={skuData}
          validationResults={validationResults}
          onBackToEdit={() => setCurrentStep(3)}
          onGoBack={goBack}
          isFlowComplete={isFlowComplete}
          setIsFlowComplete={setIsFlowComplete}
          onRunValidation={runValidation}
          step2Conflicts={step2Conflicts}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 scroll-smooth">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto space-y-6"
              >
                <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200">
                  <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-800">项目基本信息</h2>
                      <p className="text-xs text-slate-400">设置项目的基本信息和阶段</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400">项目名称 <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        placeholder="例如: X6728"
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-bold bg-slate-50/30"
                        value={projectInfo.name}
                        onChange={e => setProjectInfo(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400">模板选择 <span className="text-rose-500">*</span></label>
                      <select
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/30 transition-all text-sm font-bold appearance-none cursor-pointer"
                        value={projectInfo.customer}
                        onChange={e => {
                          const customer = e.target.value as Template;
                          setProjectInfo(prev => ({ ...prev, customer, stage: '' }));
                        }}
                      >
                        <option value="">请选择项目模板类型</option>
                        <option value="标准">标准模板</option>
                        <option value="传音">传音模板</option>
                        <option value="中兴">中兴模板</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400">试产阶段 <span className="text-rose-500">*</span></label>
                      <select
                        className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none bg-slate-50/30 transition-all text-sm font-bold appearance-none cursor-pointer"
                        value={projectInfo.stage}
                        disabled={!projectInfo.customer}
                        onChange={e => setProjectInfo(prev => ({ ...prev, stage: e.target.value as Stage }))}
                      >
                        <option value="">请选择试产阶段</option>
                        {projectInfo.customer && TEMPLATE_STAGES[projectInfo.customer].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200">
                  <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Upload size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-800">数据源上传</h2>
                      <p className="text-xs text-slate-400">上传配置表、物料表等核心文件执行解析</p>
                    </div>
                  </div>

                  <div className="relative group">
                    <input 
                      type="file" 
                      multiple 
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={handleFileUpload}
                    />
                    <div className="border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center group-hover:bg-slate-50 group-hover:border-blue-400 transition-all">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all mb-3">
                        <Upload size={24} />
                      </div>
                      <p className="text-sm font-bold text-slate-800 tracking-tight">点击或拖拽文件至此</p>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">可上传物料表、样机收集表、配置表或关键物料选型模板</p>
                    </div>
                  </div>

                  {projectInfo.files.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-500">已解析文件列表 ({projectInfo.files.length})</h4>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {projectInfo.files.map((file) => (
                           <motion.div 
                             layout
                             initial={{ opacity: 0, scale: 0.9 }}
                             animate={{ opacity: 1, scale: 1 }}
                             key={file.id} 
                             className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 group/file hover:bg-white hover:border-blue-200 hover:shadow-md transition-all"
                           >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-7 h-7 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                                <FileText size={14} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-bold text-slate-700 truncate">{file.name}</span>
                                <span className="text-[9px] font-black text-blue-500">{file.type}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteFile(file.id)}
                              className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/file:opacity-100"
                            >
                              <X size={14} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!projectInfo.pcbaOptions || projectInfo.pcbaOptions.length === 0) ? (
                    <div className="mt-6 border border-blue-100 bg-blue-50/30 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-slate-800 mb-3">请添加主板标识 <span className="text-rose-500">*</span></h4>
                      <p className="text-[11px] text-slate-500 mb-4">未检测到配置表，请手动添加或上传相关文件</p>
                      
                      <div className="flex gap-2 mb-4">
                        <input 
                          type="text" 
                          className="flex-1 h-10 px-3 rounded-lg border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm transition-all"
                          placeholder="输入主板标识并按回车或点击添加"
                          value={manualPcbaInput}
                          onChange={(e) => setManualPcbaInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = manualPcbaInput.trim();
                              if (val && !projectInfo.checkedPcbaOptions?.includes(val)) {
                                setProjectInfo(prev => ({
                                  ...prev,
                                  checkedPcbaOptions: [...(prev.checkedPcbaOptions || []), val]
                                }));
                                setManualPcbaInput('');
                              }
                            }
                          }}
                        />
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            const val = manualPcbaInput.trim();
                            if (val && !projectInfo.checkedPcbaOptions?.includes(val)) {
                              setProjectInfo(prev => ({
                                ...prev,
                                checkedPcbaOptions: [...(prev.checkedPcbaOptions || []), val]
                              }));
                              setManualPcbaInput('');
                            }
                          }}
                          className="px-4 h-10 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-all text-xs"
                        >
                          添加
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {projectInfo.checkedPcbaOptions?.map(pcba => (
                          <div key={pcba} className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm">
                            <span className="text-xs font-bold text-slate-700">{pcba}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                setProjectInfo(prev => ({
                                  ...prev,
                                  checkedPcbaOptions: prev.checkedPcbaOptions?.filter(c => c !== pcba)
                                }));
                              }}
                              className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 border border-blue-100 bg-blue-50/30 rounded-xl p-4 flex flex-col h-full max-h-[400px]">
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">请选择主板标识 <span className="text-rose-500">*</span></h4>
                          <p className="text-[11px] text-slate-500 mt-1">从配置表中提取到以下 PCBA 规格，将根据勾选进行生成</p>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs font-bold transition-all hover:border-blue-300">
                          <input 
                            type="checkbox"
                            className="rounded text-blue-600 w-3.5 h-3.5"
                            checked={
                              projectInfo.pcbaOptions.length > 0 &&
                              projectInfo.checkedPcbaOptions?.length === projectInfo.pcbaOptions.length
                            }
                            onChange={(e) => {
                              setProjectInfo(prev => ({
                                ...prev,
                                checkedPcbaOptions: e.target.checked ? (prev.pcbaOptions || []).map(o => o.pcba) : []
                              }))
                            }}
                          />
                          <span>全选</span>
                        </label>
                      </div>
                      <div className="overflow-y-auto mt-2">
                        <div className="flex flex-wrap gap-2">
                          {projectInfo.pcbaOptions.map(opt => (
                            <label 
                              key={opt.pcba} 
                              className={cn(
                                "flex items-center justify-center gap-2 bg-white px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors relative border border-slate-200 rounded-lg shadow-sm min-w-[60px]",
                                projectInfo.checkedPcbaOptions?.includes(opt.pcba) ? 'bg-blue-50/50 border-blue-400' : ''
                              )}
                            >
                              <input 
                                type="checkbox" 
                                className="w-3.5 h-3.5 text-blue-600 rounded shrink-0"
                                checked={projectInfo.checkedPcbaOptions?.includes(opt.pcba)}
                                onChange={(e) => {
                                  setProjectInfo(prev => {
                                    const c = new Set(prev.checkedPcbaOptions || []);
                                    if (e.target.checked) c.add(opt.pcba); else c.delete(opt.pcba);
                                    return { ...prev, checkedPcbaOptions: Array.from(c) };
                                  });
                                }}
                              />
                              <div className="flex flex-col items-center min-w-0">
                                <span className="text-[13px] font-bold text-slate-800 truncate" title={opt.pcba}>{opt.pcba}</span>
                                {opt.band && !opt.bandConflict && (
                                  <span className="text-[10px] text-slate-400 font-medium">{opt.band}</span>
                                )}
                                {opt.bandConflict && (
                                  <span className="text-[10px] text-amber-500 font-bold">多市场冲突</span>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {currentStep >= 2 && (
              <motion.div
                key="table-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-end pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                  </div>
                </div>

                <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                  <TrialProductionTable 
                    currentStep={currentStep}
                    skuData={skuData}
                    efuseConfigs={projectInfo.efuseConfigs}
                    onUpdateEfuse={(id, val) => setProjectInfo(prev => ({ ...prev, efuseConfigs: { ...prev.efuseConfigs, [id]: val } }))}
                    onUpdateValue={handleUpdateValue}
                    onUpdateSkuHeader={handleUpdateSkuHeader}
                    onAddSku={handleAddSkuAt}
                    onAddSupply={handleAddSupplyAt}
                    onDeleteSupply={handleDeleteSupply}
                    activeFields={activeFields} 
                    onReorderFields={handleReorderFields}
                    onReorderSkus={handleReorderSkus}
                    onReorderSupplies={handleReorderSupplies}
                    onInsertRowAt={handleInsertFieldAt}
                    onUpdateFieldLabel={(id, label) => setActiveFields(flds => flds.map(f => f.id === id ? { ...f, label } : f))}
                    onDeleteRow={id => {
                       setActiveFields(prev => prev.filter(f => f.id !== id));
                    }}
                  />
                </div>

                {currentStep === 4 && (
                  <div className="flex justify-start">
                    <button 
                      onClick={handleAddField}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all shadow-sm active:scale-95"
                    >
                      <Plus size={18} />
                      新增业务自定义行
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {loading && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-12">
            <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-2xl space-y-6 text-center">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                <motion.div 
                  className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play size={32} className="text-blue-600 animate-pulse ml-1" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">AI 正在深度解析...</h3>
                <p className="text-xs font-mono text-slate-400 h-4">{loadingText}</p>
              </div>
            </div>
          </div>
        )}

        {/* Fixed Footer Actions */}
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-end px-8 z-[105] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4">
            {currentStep > 1 && (
              <>
                <button
                  onClick={goBack}
                  className="px-6 py-2 border border-slate-300 text-slate-600 rounded font-bold text-[13px] hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                >
                  上一步
                </button>
                <button
                  onClick={() => handleIntendSave(false)}
                  className="px-6 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold text-[13px] hover:bg-amber-100 transition-all active:scale-95 flex items-center gap-2"
                >
                  暂存
                </button>
              </>
            )}

            {currentStep === 1 ? (
              <button
                disabled={!isStep1Complete}
                onClick={startAutoCalc}
                className={cn(
                  "px-6 py-2 rounded font-bold text-[13px] text-white transition-all flex items-center gap-2",
                  isStep1Complete 
                    ? "bg-[#0f2e4a] hover:bg-[#1a4269]" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                点此开始解析
                <Play size={16} fill="currentColor" />
              </button>
            ) : currentStep === 5 ? (
              <button 
                disabled={isExportDisabled}
                onClick={handleExport}
                className={cn(
                  "px-6 py-2 rounded flex items-center gap-2 font-bold text-[13px] transition-all",
                  isExportDisabled ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-[#2e7d32] text-white hover:bg-[#1b5e20] active:scale-95"
                )}
              >
                <Download size={16} />
                完成并导出
              </button>
            ) : (
              <button 
                onClick={() => setCurrentStep((currentStep + 1) as StepId)}
                className="px-6 py-2 bg-[#00897b] text-white rounded font-bold text-[13px] hover:bg-[#00796b] transition-all active:scale-95 flex items-center gap-2"
              >
                下一步: {currentStep === 2 ? '要素补全' : currentStep === 3 ? '规则引擎核验' : '导出预览'}
              </button>
            )}
          </div>
        </div>
      </div>

      <HistoryModal 
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onLoad={loadHistoryItem}
        onCopy={copyHistoryItem}
        onDelete={deleteHistoryItem}
      />

      <AnimatePresence>
        {createNewPrompt && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCreateNewPrompt(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
             <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
                <h3 className="text-lg font-black text-slate-800">新建试产配置</h3>
                <p className="text-sm text-slate-600 font-medium">
                   当前页面包含未保存的内容，是否在新建前进行保存？
                </p>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                   <button onClick={() => {
                     setCreateNewPrompt(false);
                     doResetForNew();
                   }} className="px-5 py-2.5 text-sm text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all">
                     不保存直接新建
                   </button>
                   <button onClick={() => {
                      setCreateNewPrompt(false);
                      handleIntendSave(false, () => {
                        doResetForNew();
                      });
                   }} className="px-5 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all">
                     保存并新建
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
