import React, { useState, useEffect, useMemo } from 'react';
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
import { cn, extractPcbaOptions, extractPcbaWorkbookData, normalizeStorage, extractManagedMaterialWorkbook, resolveLcdOptionsForProject, serializeLcdOptions, resolveFrontCamOptionsForProject, resolveMainCamOptionsForProject, resolveSubCamOptionsForProject } from './lib/utils';
import { parseKeyMaterialTemplate, matchCategory2WithLLM, buildOptionsByField } from './lib/keyMaterialTemplate';
import { parseManagedMaterialCoreWorkbook, matchManagedMaterialNamesWithLLM, buildManagedMaterialCoreFieldOptions } from './lib/managedMaterialCore';
import { parseSampleCollectionWorkbook, matchSampleCollectionRowsWithLLM, buildSampleCollectionFieldOptions } from './lib/sampleCollectionWorkbook';
import { buildSupplyValuesForSupplyKey, deriveSupplyColumnsFromFieldOptions, recomputeStep4Values } from './lib/step4SampleCalc';
import { buildStep2CellConflicts } from './lib/step2CellConflicts';
import {
  validateColorAgainstBom,
  validateStorageAgainstComponents,
  validateUnitIdVsMbId,
} from './lib/step4ValidationRules';
import type { SplitOptionFieldId } from './types';
import { buildTrialProductionWorkbook } from './lib/trialProductionWorkbook';
import type { Step5LayoutSnapshot } from './lib/trialProductionWorkbook';
import { normalizeSelectedSupplyKey, projectSkuForStep, projectSkusForStep, listSupplyKeys } from './lib/supplyProjection';
import { insertFieldAfter, createInsertedField, createBlankSkuFromTemplate, buildNewSkuId, captureCopyFromSku, pasteCopiedIntoTarget, buildNewSupplyId } from './lib/tableOperations';
import type { CopiedSku } from './lib/tableOperations';

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
  const [loadingPhase, setLoadingPhase] = useState<'upload' | 'calc'>('calc');
  const [isUploadResolving, setIsUploadResolving] = useState(false);
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
  const [step5Layout, setStep5Layout] = useState<Step5LayoutSnapshot | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stepsCollapsed, setStepsCollapsed] = useState(false);
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
  const [copiedSku, setCopiedSku] = useState<CopiedSku | null>(null);
  const [step1Errors, setStep1Errors] = useState<Record<string, boolean>>({});

  const step2Conflicts = useMemo(
    () =>
      buildStep2CellConflicts({
        checkedPcbaOptions: projectInfo.checkedPcbaOptions ?? [],
        pcbaRows: projectInfo.pcbaRows ?? [],
        skuData,
      }),
    [projectInfo.checkedPcbaOptions, projectInfo.pcbaRows, skuData]
  );

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('trial_production_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory) as HistoryEntry[];
        const compatible = parsed.filter((entry) =>
          entry.skuData.every((sku) =>
            sku.supplies.every((sup) => typeof (sup as any).supplyKey === 'string')
          )
        );
        setHistory(compatible);
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
      materialWorkbook: undefined,
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
    const visibleSkuData = projectSkusForStep(skuData, currentStep);
    const wb = buildTrialProductionWorkbook({
      projectName: projectInfo.name ?? 'trial',
      activeFields,
      skuData: visibleSkuData,
      layout: step5Layout ?? undefined,
      efuseConfigs: projectInfo.efuseConfigs,
    });

    const existingSameName = history.filter((item) => item.name === (projectInfo.name ?? 'trial'));
    const maxVersion =
      existingSameName.length > 0
        ? Math.max(...existingSameName.map((item) => item.version || 1))
        : 1;

    XLSX.writeFile(wb, `搭配表_${projectInfo.name ?? 'trial'}_V${maxVersion}.xlsx`, { cellStyles: true });
    setIsFlowComplete(true);
  };

  const handleExport = () => {
    handleIntendSave(true);
  };

  const loadHistoryItem = (item: HistoryEntry) => {
    setProjectInfo(item.projectInfo);
    setSkuData(item.skuData.map(normalizeSelectedSupplyKey));
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
    })).map(normalizeSelectedSupplyKey));
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

  // Insert Field after the given field id
  const handleInsertFieldAt = (afterFieldId: string) => {
    const title = window.prompt('请输入新增行标题：')?.trim();
    if (!title) return;

    setActiveFields(prev => {
      const newField = createInsertedField(afterFieldId, prev, title);
      return insertFieldAfter(prev, afterFieldId, newField);
    });
    setIsExportDisabled(true);
  };

  // Add a blank SKU cloned from the last SKU's structure; at end by default
  const handleAddSkuAt = (index?: number) => {
    setSkuData(prev => {
      if (prev.length === 0) return prev;
      const template = prev[prev.length - 1];
      const newSku = createBlankSkuFromTemplate(template, buildNewSkuId());
      const next = [...prev];
      if (typeof index === 'number') next.splice(index, 0, newSku);
      else next.push(newSku);
      return next;
    });
  };

  const handleAddSupplyAt = (skuId: string, index?: number) => {
    setSkuData(prev => prev.map(sku => {
      if (sku.id !== skuId) return sku;
      const newSup = { id: `s_${Date.now()}`, supplyKey: '', label: '新供应', values: {} };
      const nextSupplies = [...sku.supplies];
      if (typeof index === 'number') nextSupplies.splice(index, 0, newSup);
      else nextSupplies.push(newSup);
      return { ...sku, supplies: nextSupplies };
    }));
    setIsExportDisabled(true);
  };

  const handleInsertSkuAfter = (afterSkuId: string) => {
    setSkuData(prev => {
      if (prev.length === 0) return prev;
      const anchorIdx = prev.findIndex(sku => sku.id === afterSkuId);
      const anchor = anchorIdx === -1 ? prev[prev.length - 1] : prev[anchorIdx];
      const projectedAnchor = projectSkuForStep(anchor, 4);
      const newSku = createBlankSkuFromTemplate(projectedAnchor, buildNewSkuId());
      const next = [...prev];
      if (anchorIdx === -1) next.push(newSku);
      else next.splice(anchorIdx + 1, 0, newSku);
      return next;
    });
    setIsExportDisabled(true);
  };

  const handleDeleteSku = (skuId: string) => {
    setSkuData(prev => prev.filter(sku => sku.id !== skuId));
    setSelectedSkuId(prev => (prev === skuId ? null : prev));
    setIsExportDisabled(true);
  };

  // Toggle SKU selection
  const handleSelectSku = (skuId: string) => {
    setSelectedSkuId(prev => (prev === skuId ? null : skuId));
  };

  // Capture a copy of the currently selected SKU
  const handleCopySelectedSku = () => {
    if (!selectedSkuId) return;
    const sku = skuData.find(s => s.id === selectedSkuId);
    if (!sku) return;
    setCopiedSku(captureCopyFromSku(sku));
  };

  // Insert a blank SKU right after the selected one, then paste the copied values in
  const handlePasteIntoNewSku = () => {
    if (!selectedSkuId || !copiedSku) return;
    setSkuData(prev => {
      const idx = prev.findIndex(s => s.id === selectedSkuId);
      if (idx === -1) return prev;
      const template = prev[idx];
      const newId = buildNewSkuId();
      const blank = createBlankSkuFromTemplate(template, newId);
      const pasted = pasteCopiedIntoTarget(blank, copiedSku, newId, buildNewSupplyId);
      const next = [...prev.slice(0, idx + 1), pasted, ...prev.slice(idx + 1)];
      return next;
    });
    setIsExportDisabled(true);
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

    // 判断本次是否存在需要 LLM 的文件
    const hasMaterialFile = fileList.some((f: File) => f.name.includes('管控物料表'));
    const hasKeyMaterialFile = fileList.some((f: File) =>
      /关键物料选项模版|关键物料选项模板|关键物料选型模板/.test(f.name)
    );
    const hasSampleFile = fileList.some((f: File) => f.name.includes('样机收集表'));
    const hasAnyLLMFile = hasMaterialFile || hasKeyMaterialFile || hasSampleFile;

    if (hasAnyLLMFile) {
      setLoadingPhase('upload');
      setLoading(true);
      setIsUploadResolving(true);
      setLoadingText('读取上传文件...');
    }

    try {
      // 检测配置表文件，异步解析 PCBA 选项
      let parsedPcbaOptions: import('./types').PcbaOption[] = [];
      const configFiles = fileList.filter((f: File) => f.name.includes('配置'));
      if (configFiles.length > 0) {
        if (hasAnyLLMFile) setLoadingText('解析配置表并提取PCBA...');
        for (const configFile of configFiles) {
          const parsed = await extractPcbaWorkbookData(configFile as File);
          if (parsed.pcbaOptions.length > 0) {
            parsedPcbaOptions = parsed.pcbaOptions;
            setProjectInfo(prev => ({
              ...prev,
              pcbaOptions: parsed.pcbaOptions,
              pcbaRows: parsed.pcbaRows,
              checkedPcbaOptions: prev.checkedPcbaOptions && prev.checkedPcbaOptions.length > 0
                ? prev.checkedPcbaOptions
                : [],
            }));
            break; // 取第一个有效配置表
          }
        }
      }

      // 也尝试从当前 projectInfo 中获取已解析的 pcbaOptions（配置表可能在本次上传前已上传）
      const allPcbaOptions = parsedPcbaOptions.length > 0
        ? parsedPcbaOptions
        : (projectInfo.pcbaOptions ?? []);
      const emmcSizes: string[] = Array.from(new Set(allPcbaOptions.map(item => item.emmc.match(/\d+/)?.[0] ?? '').filter((s): s is string => s !== '')));
      const ddrSizes: string[] = Array.from(new Set(allPcbaOptions.map(item => item.ddr.match(/\d+/)?.[0] ?? '').filter((s): s is string => s !== '')));

      // 检测管控物料表，异步解析 LCD 选项 + 核心器件 LLM 匹配
      const materialFiles = fileList.filter((f: File) => f.name.includes('管控物料表'));
      for (const materialFile of materialFiles) {
        setLoadingText('解析管控物料表...');
        const workbook = await extractManagedMaterialWorkbook(materialFile as File);
        if (Object.keys(workbook.lcdBySheet).length > 0) {
          setProjectInfo(prev => ({ ...prev, materialWorkbook: workbook }));
        }

        const coreRaw = await parseManagedMaterialCoreWorkbook(materialFile as File);
        if (coreRaw) {
          setLoadingText('核心器件大模型匹配中...');
          const coreMatch = await matchManagedMaterialNamesWithLLM({
            materialNames: coreRaw.materialNames,
            emmcSizes,
            ddrSizes,
          });
          setProjectInfo(prev => ({
            ...prev,
            managedMaterialCore: {
              sourceFileName: coreRaw.sourceFileName,
              sourceSheetName: coreRaw.sourceSheetName,
              rows: coreRaw.rows,
              materialNames: coreRaw.materialNames,
              materialNameByStaticField: coreMatch.materialNameByStaticField,
              materialNameByEmmcSize: coreMatch.materialNameByEmmcSize,
              materialNameByDdrSize: coreMatch.materialNameByDdrSize,
            },
          }));
        }

        break; // 取第一个有效物料表
      }

      // 检测关键物料选型模板，异步解析并调用 LLM 匹配分类2
      const keyMaterialFile = fileList.find((f: File) =>
        /关键物料选项模版|关键物料选项模板|关键物料选型模板/.test(f.name)
      );
      if (keyMaterialFile) {
        setLoadingText('关键物料大模型匹配中...');
        const parsed = await parseKeyMaterialTemplate(keyMaterialFile as File);
        if (parsed) {
          const category2ByField = await matchCategory2WithLLM(parsed.category2List);
          const optionsByField = buildOptionsByField(parsed, category2ByField);
          setProjectInfo(prev => ({
            ...prev,
            keyMaterialTemplate: {
              sourceFileName: parsed.sourceFileName,
              sourceSheetName: parsed.sourceSheetName,
              category2ByField,
              optionsByField,
            },
          }));
        }
      }

      // 检测样机收集表，解析并调用 LLM 匹配内部样机需求行名
      const sampleFile = fileList.find((f: File) => f.name.includes('样机收集表'));
      if (sampleFile) {
        setLoadingText('样机收集表大模型匹配中...');
        const sampleRaw = await parseSampleCollectionWorkbook(sampleFile as File);
        if (sampleRaw) {
          // Collect all unique row names across sheets for LLM matching
          const allRowNames = Array.from(new Set(sampleRaw.sheets.flatMap(s => s.rowNames)));
          const rowNameByField = await matchSampleCollectionRowsWithLLM(allRowNames);
          setProjectInfo(prev => ({
            ...prev,
            sampleCollection: { ...sampleRaw, rowNameByField },
          }));
        }
      }

      if (hasAnyLLMFile) setLoadingText('写入解析结果...');
    } finally {
      if (hasAnyLLMFile) {
        setLoading(false);
        setIsUploadResolving(false);
        setLoadingText('');
      }
    }
  };

  const handleDeleteFile = (fileId: string) => {
    setProjectInfo(prev => {
      const deletedFile = prev.files.find(f => f.id === fileId);
      const nextFiles = prev.files.filter(f => f.id !== fileId);
      // 如果删除的是配置表，且剩余文件中没有其他配置表，则清除 PCBA 选项
      const hasRemainingConfig = nextFiles.some(f => f.type === '配置表');
      // 如果删除的是物料表，且剩余文件中没有其他物料表，则清除 materialWorkbook
      const hasRemainingMaterial = nextFiles.some(f => f.type === '物料表');
      // 如果删除的是关键物料选型模板，则清除 keyMaterialTemplate
      const hasRemainingKeyMaterial = nextFiles.some(f => f.type === '关键物料选型模板');
      let next = { ...prev, files: nextFiles };
      if (deletedFile?.type === '配置表' && !hasRemainingConfig) {
        next = { ...next, pcbaOptions: [], checkedPcbaOptions: [] };
      }
      if (deletedFile?.type === '物料表' && !hasRemainingMaterial) {
        next = { ...next, materialWorkbook: undefined, managedMaterialCore: undefined };
      }
      if (deletedFile?.type === '关键物料选型模板' && !hasRemainingKeyMaterial) {
        next = { ...next, keyMaterialTemplate: undefined };
      }
      const hasRemainingSample = nextFiles.some(f => f.type === '样机收集表');
      if (deletedFile?.type === '样机收集表' && !hasRemainingSample) {
        next = { ...next, sampleCollection: undefined };
      }
      return next;
    });
  };

  const isStep1Complete = projectInfo.isCopied || (projectInfo.name && projectInfo.customer && projectInfo.stage && projectInfo.files.length > 0 && (projectInfo.checkedPcbaOptions && projectInfo.checkedPcbaOptions.length > 0));

  // Step 2: Auto Calculation Logic
  const startAutoCalc = async () => {
    const errors: Record<string, boolean> = {};
    if (!projectInfo.name) errors.name = true;
    if (!projectInfo.customer) errors.customer = true;
    if (!projectInfo.stage) errors.stage = true;
    if (!projectInfo.files || projectInfo.files.length === 0) errors.files = true;
    if (!projectInfo.checkedPcbaOptions || projectInfo.checkedPcbaOptions.length === 0) errors.pcba = true;
    
    if (Object.keys(errors).length > 0) {
      setStep1Errors(errors);
      return;
    }
    
    setStep1Errors({});
    setLoadingPhase('calc');
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

    let baseData: SKUData[] = [];
    if (projectInfo.checkedPcbaOptions && projectInfo.checkedPcbaOptions.length > 0) {
      baseData = projectInfo.checkedPcbaOptions.map((pcbaId, idx) => {
        const opt = (projectInfo.pcbaOptions || []).find(o => o.pcba === pcbaId);
        const bandValue = opt && !opt.bandConflict ? opt.band : '';
        const storageValue = (() => {
          if (!opt) return '';
          const ddrNum = (opt.ddr || '').match(/\d+/)?.[0] || '';
          const emmcNum = (opt.emmc || '').match(/\d+/)?.[0] || '';
          if (!ddrNum || !emmcNum) return '';
          return `${ddrNum}+${emmcNum}`;
        })();

        // Build fieldOptions from managed material workbook (LCD/CAM) and key material template
        const lcdRaw      = resolveLcdOptionsForProject(opt?.projectName || '', projectInfo.materialWorkbook);
        const frontCamRaw = resolveFrontCamOptionsForProject(opt?.projectName || '', projectInfo.materialWorkbook);
        const mainCamRaw  = resolveMainCamOptionsForProject(opt?.projectName || '', projectInfo.materialWorkbook);
        const subCamRaw   = resolveSubCamOptionsForProject(opt?.projectName || '', projectInfo.materialWorkbook);

        const toLcdSplitOptions = (opts: typeof lcdRaw, category2: string) =>
          opts.map(o => ({ supply: o.supply as import('./types').SupplyTag, text: o.text, sourceCategory2: category2 }));

        const keyMaterialOptions = projectInfo.keyMaterialTemplate?.optionsByField ?? {};
        const coreOptions = projectInfo.managedMaterialCore
          ? buildManagedMaterialCoreFieldOptions(projectInfo.managedMaterialCore, opt)
          : {};
        const sampleOptions = projectInfo.sampleCollection
          ? buildSampleCollectionFieldOptions(projectInfo.sampleCollection, projectInfo.stage, pcbaId)
          : {};

        const fieldOptions: SKUData['fieldOptions'] = {
          lcd:       lcdRaw.length > 0 ? toLcdSplitOptions(lcdRaw, 'LCD') : keyMaterialOptions.lcd,
          front_cam: frontCamRaw.length > 0 ? toLcdSplitOptions(frontCamRaw, 'FRONT_CAM') : keyMaterialOptions.front_cam,
          main_cam:  mainCamRaw.length > 0 ? toLcdSplitOptions(mainCamRaw, 'MAIN_CAM') : keyMaterialOptions.main_cam,
          sub_cam:   subCamRaw.length > 0 ? toLcdSplitOptions(subCamRaw, 'SUB_CAM') : keyMaterialOptions.sub_cam,
          // Core components from managed material workbook take priority over key material template
          ...Object.fromEntries(
            (Object.keys(keyMaterialOptions) as import('./types').SplitOptionFieldId[])
              .filter(k => !['lcd', 'front_cam', 'main_cam', 'sub_cam'].includes(k))
              .map(k => [k, keyMaterialOptions[k]])
          ),
          ...coreOptions,
          // Sample collection team fields (lowest priority, merged last for team fields)
          ...sampleOptions,
        };

        const supplyColumns = deriveSupplyColumnsFromFieldOptions(fieldOptions);
        const supplies = supplyColumns.map((col, colIndex) => {
          const values: Record<string, string> = {
            storage: storageValue,
            band: bandValue,
            ...buildSupplyValuesForSupplyKey(fieldOptions, col.supplyKey),
          };
          if (!values.customer_sample_req) values.customer_sample_req = '';
          const computed = recomputeStep4Values(values);
          return {
            id: `s_${Date.now()}_${idx}_${colIndex + 1}`,
            supplyKey: col.supplyKey,
            label: col.label,
            values: computed,
          };
        });

        return {
          id: `sku_${Date.now()}_${idx}`,
          stage: projectInfo.stage,
          orderNo: '',
          project: pcbaId,
          fieldOptions,
          supplies,
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
      supplies: sku.supplies.map(sup => ({
        ...sup,
        values: {
          ...sup.values,
          project: projectInfo.name,
          stage: projectInfo.stage,
          mb_id: sku.project,
        },
      })),
    }));

    setSkuData(baseData.map(normalizeSelectedSupplyKey));
    setLoading(false);
    setCurrentStep(2);
  };

  // Step 4: Validation Engine
  const runValidation = () => {
    const results: ValidationResult[] = [];
    const visibleForValidation = projectSkusForStep(skuData, currentStep);
    
    visibleForValidation.forEach(sku => {
      sku.supplies.forEach((sup) => {
        const prefix = `[${sku.project} · ${sup.label}] `;
        const vals = sup.values;

        // --- Rule 1: Color consistency (Color vs MBOM vs PBOM) ---
        const color = String(vals['color'] || '').trim();
        const mbom = String(vals['mbom'] || '').trim();
        const pbom = String(vals['pbom'] || '').trim();
        if (color) {
          const colorCheck = validateColorAgainstBom({ color, mbom, pbom });
          results.push({
            id: `RULE-COLOR-${sku.id}-${sup.id}`,
            title: colorCheck.ok ? '颜色一致性核验通过' : '颜色不一致',
            amReference: 'Rule-1',
            detail: colorCheck.ok
              ? `${prefix}颜色与 MBOM/PBOM 任一描述匹配。`
              : `${prefix}颜色(${color})与 MBOM/PBOM 均不匹配。`,
            level: colorCheck.ok ? 'pass' : 'error',
            fieldId: 'color',
          });
        }

        // --- Rule 2: Storage vs flash EMMC/flash DDR ---
        const storage = String(vals['storage'] || '').trim();
        const emmc = String(vals['emmc'] || '').trim();
        const ddr = String(vals['ddr'] || '').trim();
        if (storage) {
          const storageCheck = validateStorageAgainstComponents({ storage, emmc, ddr });
          results.push({
            id: `RULE-STORAGE-${sku.id}-${sup.id}`,
            title: storageCheck.ok ? '存储核验通过' : '存储配置冲突',
            amReference: 'Rule-2',
            detail: storageCheck.ok
              ? `${prefix}存储与 flash EMMC/flash DDR 匹配。`
              : `${prefix}存储(${storage})与${storageCheck.reasons.join('、')}冲突。`,
            level: storageCheck.ok ? 'pass' : 'error',
            fieldId: 'storage',
          });
        }

        // --- Rule 3: unit_id contains mb_id ---
        const unitId = String(vals['unit_id'] || '').trim();
        const mbId = String(vals['mb_id'] || '').trim();
        if (unitId && mbId) {
          const idCheck = validateUnitIdVsMbId({ unitId, mbId });
          results.push({
            id: `RULE-SUFFIX-${sku.id}-${sup.id}`,
            title: idCheck.ok ? '整机标识核验通过' : '整机标识冲突',
            amReference: 'Rule-3',
            detail: idCheck.ok
              ? `${prefix}整机标识(${unitId})包含主板标识(${mbId})。`
              : `${prefix}整机标识(${unitId})不包含主板标识(${mbId})。`,
            level: idCheck.ok ? 'pass' : 'error',
            fieldId: 'unit_id',
          });
        }

        // --- Rule R-EBOM-STORAGE-001: ebom_desc storage token vs storage field ---
        const ebomDesc = String(vals['ebom_desc'] || '').toLowerCase();
        const storageFld = String(vals['storage'] || '').toLowerCase();

        const ebomTokenMatch = ebomDesc.replace(/[gG]/g, '').match(/(\d+)\+(\d+)/);
        const ebomToken = ebomTokenMatch ? `${ebomTokenMatch[1]}+${ebomTokenMatch[2]}` : '';

        if (ebomDesc && storageFld && ebomToken) {
          const normalEbom    = normalizeStorage(ebomToken);
          const normalStorage = normalizeStorage(storageFld);
          if (normalEbom && normalStorage && normalEbom !== normalStorage) {
            results.push({
              id: `RULE-EBOM-STORAGE-${sku.id}-${sup.id}`,
              title: 'EBOM描述存储不匹配',
              amReference: 'R-EBOM-STORAGE-001',
              detail: `${prefix}EBOM描述存储(${ebomToken})与存储字段(${storageFld})不一致。`,
              level: 'error',
              fieldId: 'ebom_desc',
            });
          } else {
            results.push({
              id: `RULE-EBOM-STORAGE-${sku.id}-${sup.id}`,
              title: 'EBOM存储核验通过',
              amReference: 'R-EBOM-STORAGE-001',
              detail: `${prefix}EBOM描述存储与存储字段匹配。`,
              level: 'pass',
              fieldId: 'ebom_desc',
            });
          }
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
            const withInput = { ...sup.values, [fieldId]: value };
            const newValues = recomputeStep4Values(withInput);

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

  const handleUpdateSelectedSupply = (skuId: string, supplyKey: string) => {
    if (currentStep !== 3) return;
    setSkuData((prev) =>
      prev.map((sku) => (sku.id === skuId ? normalizeSelectedSupplyKey({ ...sku, selectedSupplyKey: supplyKey }) : sku))
    );
  };

  const handleAddSku = () => {
    const newSku: SKUData = {
      id: `sku_${Date.now()}`,
      stage: projectInfo.stage,
      orderNo: '',
      project: projectInfo.name,
      supplies: [{ id: 's1', supplyKey: '一供', label: '一供', values: {} }]
    };
    setSkuData(prev => [...prev, newSku]);
  };

  const handleAddSupply = (skuId: string) => {
    setSkuData(prev => prev.map(sku => {
      if (sku.id === skuId) {
        const newSup = { id: `s_${Date.now()}`, supplyKey: '', label: '新供应', values: {} };
        return { ...sku, supplies: [...sku.supplies, newSup] };
      }
      return sku;
    }));
  };

  const handleUpdateSupplyLabel = (skuId: string, supplyId: string, val: string) => {
    setSkuData(prev => prev.map(sku => {
      if (sku.id !== skuId) return sku;
      return {
        ...sku,
        supplies: sku.supplies.map(s => (s.id === supplyId ? { ...s, label: val } : s)),
      };
    }));
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as StepId);
  };

  const disableNextToPreview = 
    (currentStep === 4 && isExportDisabled) || 
    (currentStep === 2 && step2Conflicts.length > 0);
  const visibleSkuData = projectSkusForStep(skuData, currentStep);
  const skuSupplyKeys = Object.fromEntries(skuData.map(s => [s.id, listSupplyKeys(s)]));

  return (
    <div className="flex flex-col h-screen bg-[#f5f7f9] text-[#0B1F33] font-sans overflow-hidden">
      <header className="h-[60px] bg-white border-b border-[#DDE7F3] flex items-center justify-between px-6 shrink-0 z-[110]">
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
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-white rounded transition-all text-xs font-bold",
              currentStep > 1
                ? "bg-[#06B6D4] hover:bg-[#0891B2]"
                : "bg-[#2563EB] hover:bg-[#1d4ed8]"
            )}
          >
            <Plus size={16} />
            <span>新建试产阶段</span>
          </button>
          <div className="w-[1px] h-4 bg-slate-200 mx-1" />
           <button 
            onClick={() => setShowHistory(true)}
            className="group flex items-center gap-1.5 px-3 py-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EEF6FF] rounded transition-all text-xs font-medium"
          >
            <History size={16} className="group-hover:rotate-12 transition-transform" />
            <span>历史记录</span>
            {history.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#EEF6FF] text-[#2563EB] text-[9px] rounded-full font-black">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </header>
      
      <StepsIndicator
        currentStep={currentStep}
        collapsed={stepsCollapsed}
        onToggleCollapsed={() => setStepsCollapsed((prev) => !prev)}
      />

      <div className="flex flex-1 overflow-hidden relative min-w-0">
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
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
        />

        <main className="flex flex-col flex-1 min-w-0 min-h-0 overflow-y-auto p-4 md:p-6 pb-24 scroll-smooth transition-all duration-300 ease-out">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto space-y-6"
              >
                <div className="bg-white p-6 rounded-2xl shadow-xl shadow-[#DDE7F3]/50 border border-[#DDE7F3]">
                  <div className="flex items-center gap-3 mb-4 border-b border-[#DDE7F3] pb-4">
                    <div className="w-10 h-10 rounded-full bg-[#EEF6FF] flex items-center justify-center text-[#2563EB]">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-[#0B1F33]">项目基本信息</h2>
                      <p className="text-xs text-[#64748B]">设置项目的基本信息和阶段</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#64748B]">项目名称 <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        placeholder="例如: X6728"
                        className={cn(
                          "w-full h-12 px-4 rounded-xl border focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB] outline-none transition-all text-sm font-bold bg-[#F6F9FF]/30",
                          step1Errors.name ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500" : "border-[#DDE7F3]"
                        )}
                        value={projectInfo.name}
                        onChange={e => {
                          setProjectInfo(prev => ({ ...prev, name: e.target.value }));
                          if (step1Errors.name) setStep1Errors(prev => ({ ...prev, name: false }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#64748B]">模板选择 <span className="text-rose-500">*</span></label>
                      <select
                        className={cn(
                          "w-full h-12 px-4 rounded-xl border focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB] outline-none bg-[#F6F9FF]/30 transition-all text-sm font-bold appearance-none cursor-pointer",
                          step1Errors.customer ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500" : "border-[#DDE7F3]",
                          projectInfo.customer ? "text-[#0B1F33]" : "text-[#9CA3AF]"
                        )}
                        value={projectInfo.customer}
                        onChange={e => {
                          const customer = e.target.value as Template;
                          setProjectInfo(prev => ({ ...prev, customer, stage: '' }));
                          if (step1Errors.customer) setStep1Errors(prev => ({ ...prev, customer: false }));
                        }}
                      >
                        <option value="" className="text-[#9CA3AF]">请选择项目模板类型</option>
                        <option value="标准" className="text-[#0B1F33]">标准模板</option>
                        <option value="传音" className="text-[#0B1F33]">传音模板</option>
                        <option value="中兴" className="text-[#0B1F33]">中兴模板</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#64748B]">试产阶段 <span className="text-rose-500">*</span></label>
                      <select
                        className={cn(
                          "w-full h-12 px-4 rounded-xl border focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB] outline-none bg-[#F6F9FF]/30 transition-all text-sm font-bold appearance-none cursor-pointer",
                          step1Errors.stage ? "border-rose-500 focus:ring-rose-500/10 focus:border-rose-500" : "border-[#DDE7F3]",
                          projectInfo.stage ? "text-[#0B1F33]" : "text-[#9CA3AF]"
                        )}
                        value={projectInfo.stage}
                        disabled={!projectInfo.customer}
                        onChange={e => {
                          setProjectInfo(prev => ({ ...prev, stage: e.target.value as Stage }));
                          if (step1Errors.stage) setStep1Errors(prev => ({ ...prev, stage: false }));
                        }}
                      >
                        <option value="" className="text-[#9CA3AF]">请选择试产阶段</option>
                        {projectInfo.customer && TEMPLATE_STAGES[projectInfo.customer].map(s => (
                          <option key={s} value={s} className="text-[#0B1F33]">{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl shadow-[#DDE7F3]/50 border border-[#DDE7F3]">
                  <div className="flex items-center gap-3 mb-4 border-b border-[#DDE7F3] pb-4">
                    <div className="w-10 h-10 rounded-full bg-[#10B981] flex items-center justify-center text-[#10B981]">
                      <Upload size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-[#0B1F33]">数据源上传</h2>
                      <p className="text-xs text-[#64748B]">上传配置表、物料表等核心文件执行解析</p>
                    </div>
                  </div>

                  <div className="relative group">
                    <input 
                      type="file" 
                      multiple 
                      disabled={isUploadResolving}
                      className={cn("absolute inset-0 opacity-0 z-10", isUploadResolving ? "cursor-not-allowed" : "cursor-pointer")}
                      onChange={handleFileUpload}
                    />
                    <div className={cn(
                      "border border-dashed rounded-xl p-8 flex flex-col items-center justify-center group-hover:bg-[#F6F9FF] group-hover:border-[#2563EB] transition-all",
                      step1Errors.files ? "border-rose-500 bg-rose-50/30" : "border-[#DDE7F3]"
                    )}>
                      <div className="w-12 h-12 rounded-xl bg-[#F6F9FF] flex items-center justify-center text-[#64748B] group-hover:text-[#2563EB] group-hover:bg-[#EEF6FF] transition-all mb-3">
                        <Upload size={24} />
                      </div>
                      <p className="text-sm font-bold text-[#0B1F33] tracking-tight">点击或拖拽文件至此</p>
                      <p className="text-[11px] text-[#64748B] mt-1 font-medium">可上传物料表、样机收集表、配置表或关键物料选型模板</p>
                    </div>
                  </div>

                  {projectInfo.files.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-[#64748B]">已解析文件列表 ({projectInfo.files.length})</h4>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {projectInfo.files.map((file) => (
                           <motion.div 
                             layout
                             initial={{ opacity: 0, scale: 0.9 }}
                             animate={{ opacity: 1, scale: 1 }}
                             key={file.id} 
                             className="flex items-center justify-between p-2.5 bg-[#F6F9FF] rounded-lg border border-[#DDE7F3] group/file hover:bg-white hover:border-[#DDE7F3] hover:shadow-md transition-all"
                           >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-7 h-7 rounded bg-white border border-[#DDE7F3] flex items-center justify-center text-[#64748B] shadow-sm shrink-0">
                                <FileText size={14} />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[11px] font-bold text-[#0B1F33] truncate">{file.name}</span>
                                <span className="text-[9px] font-black text-[#2563EB]">{file.type}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleDeleteFile(file.id)}
                              className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[#DDE7F3] hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/file:opacity-100"
                            >
                              <X size={14} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!projectInfo.pcbaOptions || projectInfo.pcbaOptions.length === 0) ? (
                    <div className={cn(
                      "mt-6 border bg-[#EEF6FF]/30 rounded-xl p-4",
                      step1Errors.pcba ? "border-rose-500 bg-rose-50/30" : "border-[#DDE7F3]"
                    )}>
                      <h4 className="text-sm font-bold text-[#0B1F33] mb-3">请添加主板标识 <span className="text-rose-500">*</span></h4>
                      <p className="text-[11px] text-[#64748B] mb-4">未检测到配置表，请手动添加或上传相关文件</p>
                      
                      <div className="flex gap-2 mb-4">
                        <input 
                          type="text" 
                          className="flex-1 h-10 px-3 rounded-lg border border-[#DDE7F3] focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB] outline-none text-sm transition-all"
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
                          className="px-4 h-10 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-bold rounded-lg transition-all text-xs"
                        >
                          添加
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {projectInfo.checkedPcbaOptions?.map(pcba => (
                          <div key={pcba} className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-[#DDE7F3] rounded-lg shadow-sm">
                            <span className="text-xs font-bold text-[#0B1F33]">{pcba}</span>
                            <button 
                              type="button"
                              onClick={() => {
                                setProjectInfo(prev => ({
                                  ...prev,
                                  checkedPcbaOptions: prev.checkedPcbaOptions?.filter(c => c !== pcba)
                                }));
                              }}
                              className="w-4 h-4 flex items-center justify-center text-[#64748B] hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={cn(
                      "mt-6 border bg-[#EEF6FF]/30 rounded-xl p-4 flex flex-col h-full max-h-[400px]",
                      step1Errors.pcba ? "border-rose-500 bg-rose-50/30" : "border-[#DDE7F3]"
                    )}>
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <div>
                          <h4 className="text-sm font-bold text-[#0B1F33]">请选择主板标识 <span className="text-rose-500">*</span></h4>
                          <p className="text-[11px] text-[#64748B] mt-1">从配置表中提取到以下 PCBA 规格，将根据勾选进行生成</p>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#2563EB] px-3 py-1.5 bg-white border border-[#DDE7F3] rounded-lg shadow-sm text-xs font-bold transition-all hover:border-[#2563EB]">
                          <input 
                            type="checkbox"
                            className="rounded text-[#2563EB] w-3.5 h-3.5"
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
                                "flex items-center justify-center gap-2 bg-white px-3 py-2 cursor-pointer hover:bg-[#EEF6FF] transition-colors relative border border-[#DDE7F3] rounded-lg shadow-sm min-w-[60px]",
                                projectInfo.checkedPcbaOptions?.includes(opt.pcba) ? 'bg-[#EEF6FF]/50 border-[#2563EB]' : ''
                              )}
                            >
                              <input 
                                type="checkbox" 
                                className="w-3.5 h-3.5 text-[#2563EB] rounded shrink-0"
                                checked={projectInfo.checkedPcbaOptions?.includes(opt.pcba)}
                                onChange={(e) => {
                                  setProjectInfo(prev => {
                                    const c = new Set(prev.checkedPcbaOptions || []);
                                    if (e.target.checked) c.add(opt.pcba); else c.delete(opt.pcba);
                                    return { ...prev, checkedPcbaOptions: Array.from(c) };
                                  });
                                }}
                              />
                              <span className="text-[13px] font-bold text-[#0B1F33] truncate" title={opt.pcba}>{opt.pcba}</span>
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
                className="flex flex-col flex-1 min-h-0 gap-6"
              >
                <div className="flex justify-between items-end pb-4 border-b border-[#DDE7F3] shrink-0">
                  <div className="flex items-center gap-3">
                  </div>
                </div>

                <div className="flex-1 min-h-0 bg-white rounded shadow-sm border border-[#DDE7F3] overflow-hidden">
                  <TrialProductionTable
                    currentStep={currentStep}
                    skuData={visibleSkuData}
                    efuseConfigs={projectInfo.efuseConfigs}
                    onUpdateEfuse={(id, val) => setProjectInfo(prev => ({ ...prev, efuseConfigs: { ...prev.efuseConfigs, [id]: val } }))}
                    onUpdateValue={handleUpdateValue}
                    onUpdateSkuHeader={handleUpdateSkuHeader}
                    onUpdateSupplyLabel={handleUpdateSupplyLabel}
                    onAddSupply={handleAddSupplyAt}
                    onAddSku={handleAddSkuAt}
                    onDeleteSku={handleDeleteSku}
                    onInsertSkuAfter={handleInsertSkuAfter}
                    activeFields={activeFields}
                    onReorderFields={handleReorderFields}
                    onReorderSkus={handleReorderSkus}
                    onReorderSupplies={handleReorderSupplies}
                     onInsertRowAt={handleInsertFieldAt}
                     onUpdateFieldLabel={(id, label) => setActiveFields(flds => flds.map(f => f.id === id ? { ...f, label } : f))}
                     onDeleteRow={id => {
                        setActiveFields(prev => prev.filter(f => f.id !== id));
                        setIsExportDisabled(true);
                     }}
                     onStep5LayoutChange={setStep5Layout}
                     onUpdateSelectedSupply={handleUpdateSelectedSupply}
                     skuSupplyKeys={skuSupplyKeys}
                     selectedSkuId={selectedSkuId}
                     onSelectSku={handleSelectSku}
                     copiedSku={copiedSku}
                     onCopySelectedSku={handleCopySelectedSku}
                     onPasteIntoNewSku={handlePasteIntoNewSku}
                     step2Conflicts={step2Conflicts}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {loading && (
          <div className="fixed inset-0 bg-[#0B1F33]/60 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-12">
            <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-2xl space-y-6 text-center">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-4 border-[#DDE7F3] rounded-full" />
                <motion.div 
                  className="absolute inset-0 border-4 border-[#2563EB] rounded-full border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Play size={32} className="text-[#2563EB] animate-pulse ml-1" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-[#0B1F33]">
                  {loadingPhase === 'upload' ? '文件上传解析中...' : 'AI 正在深度解析...'}
                </h3>
                <p className="text-xs font-mono text-[#64748B] h-4">{loadingText}</p>
              </div>
            </div>
          </div>
        )}

        {/* Fixed Footer Actions */}
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#DDE7F3] flex items-center justify-end px-8 z-[105] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-4">
            {currentStep > 1 && (
              <>
                <button
                  onClick={goBack}
                  className="px-6 py-2 border border-[#DDE7F3] text-[#64748B] rounded font-bold text-[13px] hover:bg-[#F6F9FF] transition-all active:scale-95 flex items-center gap-2"
                >
                  上一步
                </button>
                <button
                  onClick={() => handleIntendSave(false)}
                  className="px-6 py-2 bg-[#F59E0B] text-white border border-[#F59E0B] rounded font-bold text-[13px] transition-all active:scale-95 flex items-center gap-2"
                >
                  暂存
                </button>
              </>
            )}

            {currentStep === 1 ? (
              <button
                disabled={isUploadResolving}
                onClick={startAutoCalc}
                className={cn(
                  "px-6 py-2 rounded font-bold text-[13px] text-white transition-all flex items-center gap-2",
                  isUploadResolving
                    ? "bg-[#DDE7F3] text-[#64748B] cursor-not-allowed"
                    : "bg-[#2563EB] hover:bg-[#1d4ed8]"
                )}
              >
                {isUploadResolving ? '解析中...' : '点此开始解析'}
                <Play size={16} fill="currentColor" />
              </button>
            ) : currentStep === 5 ? (
              <button 
                onClick={handleExport}
                className="px-6 py-2 rounded flex items-center gap-2 font-bold text-[13px] transition-all bg-[#2e7d32] text-white hover:bg-[#1b5e20] active:scale-95"
              >
                <Download size={16} />
                完成并导出
              </button>
            ) : (
              <div title={disableNextToPreview && currentStep === 2 ? '存在冲突，请先解决冲突' : undefined}>
                <button
                  disabled={disableNextToPreview}
                  onClick={() => {
                    if (disableNextToPreview) return;
                    setCurrentStep((currentStep + 1) as StepId);
                  }}
                  className={cn(
                    "px-6 py-2 rounded font-bold text-[13px] transition-all flex items-center gap-2",
                    disableNextToPreview
                      ? "bg-[#DDE7F3] text-[#64748B] cursor-not-allowed"
                      : "bg-[#06B6D4] text-white hover:bg-[#0891B2] active:scale-95"
                  )}
                >
                  下一步: {currentStep === 2 ? '要素补全' : currentStep === 3 ? '规则引擎核验' : '导出预览'}
                </button>
              </div>
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
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCreateNewPrompt(false)} className="absolute inset-0 bg-[#0B1F33]/40 backdrop-blur-sm" />
             <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
                <h3 className="text-lg font-black text-[#0B1F33]">新建试产配置</h3>
                <p className="text-sm text-[#64748B] font-medium">
                   当前页面包含未保存的内容，是否在新建前进行保存？
                </p>
                <div className="flex justify-end gap-3 pt-4 border-t border-[#DDE7F3]">
                   <button onClick={() => {
                     setCreateNewPrompt(false);
                     doResetForNew();
                   }} className="px-5 py-2.5 text-sm text-[#64748B] font-bold hover:bg-[#F6F9FF] rounded-xl transition-all">
                     不保存直接新建
                   </button>
                   <button onClick={() => {
                      setCreateNewPrompt(false);
                      handleIntendSave(false, () => {
                        doResetForNew();
                      });
                   }} className="px-5 py-2.5 text-sm text-white bg-[#2563EB] hover:bg-[#1d4ed8] font-bold rounded-xl shadow-lg shadow-[#2563EB]/20 transition-all">
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
