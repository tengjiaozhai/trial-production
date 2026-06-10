import React from 'react';
import { CheckCircle2, Check, Circle, AlertCircle, Info, ArrowLeft, ShieldCheck, RotateCw } from 'lucide-react';
import { StepId, ProjectInfo, SKUData, ValidationResult } from '@/src/types';
import { AM_RULE_DEFS } from '@/src/constants';
import { cn } from '@/src/lib/utils';
import type { Step2CellConflict, Step2CellConflictCandidate } from '../lib/step2CellConflicts';

interface SidebarProps {
  currentStep: StepId;
  projectInfo: ProjectInfo;
  skuData: SKUData[];
  validationResults: ValidationResult[];
  onBackToEdit?: () => void;
  onGoBack: () => void;
  isFlowComplete: boolean;
  setIsFlowComplete: (val: boolean) => void;
  onRunValidation: () => void;
  step2Conflicts?: Step2CellConflict[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onFocusCell?: (skuId: string, supplyId: string | undefined, fieldId: string) => void;
  onResolveStep2Conflict?: (conflict: Step2CellConflict, candidate: string) => void;
}

const STEP2_CANDIDATE_SOURCE_LABELS: Record<Step2CellConflictCandidate['source'], string> = {
  key_material: '关键物料',
  managed_material: '管控物料',
};

export function Sidebar({
  currentStep,
  projectInfo,
  skuData,
  validationResults,
  onBackToEdit,
  onGoBack,
  isFlowComplete,
  setIsFlowComplete,
  onRunValidation,
  step2Conflicts = [],
  collapsed = false,
  onToggleCollapsed,
  onFocusCell,
  onResolveStep2Conflict,
}: SidebarProps) {
  
  const focusStep2CellConflict = (conflict: Step2CellConflict) => {
    if (onFocusCell) {
      onFocusCell(conflict.skuId, conflict.supplyId, conflict.fieldId);
    }
  };
  const focusStep4Validation = (result: ValidationResult) => {
    const fieldId = result.targetFieldId ?? result.fieldId;
    if (!fieldId || !result.skuId) return;
    if (onFocusCell) {
      onFocusCell(result.skuId, result.supplyId, fieldId);
    }
  };
  const hasDataSources = projectInfo.files.length > 0;

  const checklist = [
    { label: '项目名称', done: !!projectInfo.name },
    { label: '主板标识', done: !!projectInfo.checkedPcbaOptions && projectInfo.checkedPcbaOptions.length > 0 },
    { label: '选择模版', done: !!projectInfo.customer },
    { label: '试产阶段', done: !!projectInfo.stage },
    { label: '上传数据源', done: hasDataSources },
  ];

  return (
    <aside
      className={cn(
        "relative h-full bg-[linear-gradient(180deg,rgba(236,245,255,0.96)_0%,rgba(248,251,255,0.9)_38%,rgba(242,250,248,0.94)_100%)] backdrop-blur-xl border-r border-[#DDE7F3]/80 flex flex-col shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] z-10 transition-all duration-300 ease-out",
        collapsed ? "w-12" : "w-80",
      )}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/92 backdrop-blur-xl border border-[#DDE7F3] flex items-center justify-center text-[#64748B] hover:text-[#0B1F33] hover:border-[#0B1F33] transition-colors z-20"
      >
        <ArrowLeft size={12} className={cn("transition-transform duration-300", collapsed && "rotate-180")} />
      </button>

      <div className={cn("flex-1 flex flex-col overflow-hidden transition-opacity duration-200", collapsed && "opacity-0 pointer-events-none")}>
      <div className="flex-1 overflow-y-auto pt-6 px-4 space-y-8 scrollbar-thin">
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-[#0B1F33] flex items-center gap-2 mb-4">
                <CheckCircle2 size={18} className="text-[#0B1F33]" /> 准备就绪核对
              </h3>
              <ul className="space-y-3">
                {checklist.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[13px] font-bold p-2 hover:bg-[#F6F9FF] rounded transition-all">
                    {item.done ? (
                      <div className="w-5 h-5 rounded border-2 border-[#06B6D4] text-[#06B6D4] flex items-center justify-center">
                        <Check size={14} strokeWidth={4} />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded border-2 border-slate-300" />
                    )}
                    <span className={cn(item.done ? "text-[#0B1F33]" : "text-[#64748B]")}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            {step2Conflicts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-rose-600 flex items-center gap-2">
                  <AlertCircle size={18} className="text-rose-600" /> 冲突待确认 ({step2Conflicts.length})
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 select-none">
                  {step2Conflicts.map((c, i) => (
                    <div 
                      key={i} 
                      onClick={() => focusStep2CellConflict(c)}
                      className="p-3 bg-rose-50/50 rounded border border-rose-200 hover:border-rose-400 hover:shadow-sm transition-all cursor-pointer space-y-1 group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] font-black text-rose-700">{c.fieldLabel}存在冲突</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            focusStep2CellConflict(c);
                          }}
                          className="text-[11px] font-bold text-rose-500/80 group-hover:text-rose-600 hover:text-rose-700 transition-colors"
                        >
                          点击定位
                        </button>
                      </div>
                      <p className="text-[12px] text-rose-600/80 font-medium leading-relaxed">
                        PCBA: {c.pcba} | 供应商: {c.supplyLabel}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full border border-rose-200 bg-white text-[11px] font-black text-rose-500">
                          {c.candidates.length} 个候选值
                        </span>
                        <span className="text-[11px] font-bold text-rose-500/80">
                          点击候选值直接写回当前单元格
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {c.candidates.map((candidate, index) => (
                          <div
                            key={`${candidate.source}-${candidate.writeValue}-${candidate.materialName}-${index}`}
                            className="flex min-w-[132px] flex-1 flex-col gap-1 rounded-md border border-rose-200 bg-white/80 px-2 py-1.5"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[10px] font-black",
                                  candidate.source === 'managed_material'
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-sky-100 text-sky-700"
                                )}
                              >
                                {STEP2_CANDIDATE_SOURCE_LABELS[candidate.source]}
                              </span>
                              {candidate.supplyTag && (
                                <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-500">
                                  {candidate.supplyTag}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onResolveStep2Conflict?.(c, candidate.writeValue);
                              }}
                              className="rounded-md bg-rose-100 px-2 py-1 text-left text-[11px] font-bold text-rose-700 border border-rose-200 hover:bg-rose-200 hover:border-rose-300 transition-colors"
                            >
                              {candidate.label}
                            </button>
                            {(candidate.vendor || candidate.materialName) && (
                              <p className="text-[11px] font-medium leading-snug text-rose-600/70">
                                {[candidate.vendor, candidate.materialName].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="p-4 rounded border border-amber-200 bg-amber-50/50 space-y-2">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle size={18} />
                <span className="text-[13px] font-black">处理冲突说明</span>
              </div>
              <p className="text-[12px] text-amber-700/80 leading-relaxed font-medium">
                当自动获取或计算结果与历史数据存在冲突时，系统会将该异常单元格标红。此时须要人工确认方可进入下一步。
              </p>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-[#0f2e4a] flex items-center gap-2">
              <AlertCircle size={18} className="text-[#0f2e4a]" /> 待完善要素
            </h3>
               <p className="text-[13px] text-[#64748B] font-medium leading-relaxed italic opacity-80">系统检测到以下关键要素配置不全，请在右侧表格中进行手动补充：</p>
            
            <div className="space-y-3">
              {[
                { title: '基础业务信息', items: ['订单号', '生产顺序', '试产地点'] },
                { title: '关键交付属性', items: ['软件版本', '上线时间', '颜色/整机标识'] },
                { title: '工艺辅料与BOM', items: ['锡膏', '导热凝胶', 'EBOM/小板BOM（料号+描述）', 'MBOM/PBOM'] }
              ].map((group, i) => (
                <div key={i} className="bg-white p-4 rounded border border-[#DDE7F3] space-y-3 hover:border-[#06B6D4] transition-all">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-[#06B6D4] rounded-full" />
                    <span className="text-[13px] font-black text-[#0B1F33]">{group.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map(it => (
                      <span key={it} className="px-3 py-1 bg-[#F6F9FF] text-[12px] font-bold text-[#64748B] border border-[#DDE7F3] rounded transition-all">
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded border border-[#06B6D4]/30 shadow-sm space-y-4">
              <h3 className="text-[13px] font-black text-[#0B1F33] flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#0B1F33]" /> 核验控制器
              </h3>
              <button 
                onClick={onRunValidation}
                className="w-full py-3 bg-white border border-[#06B6D4] text-[#06B6D4] text-[13px] font-bold rounded hover:bg-[#06B6D4] hover:text-white transition-all flex items-center justify-center gap-2 group"
              >
                <RotateCw size={16} className="group-active:rotate-180 transition-transform duration-500" />
                重新执行
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-[13px] font-black text-[#0B1F33]">校验结果</h3>
              <div className="space-y-3 select-none">
                {[...validationResults]
                  .sort((a, b) => {
                    const order = { error: 0, warn: 1, pass: 2, skip: 3 };
                    return (order[a.level] ?? 4) - (order[b.level] ?? 4);
                  })
                  .map((result, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      if (result.level === 'error' || result.level === 'warn') {
                        focusStep4Validation(result);
                      }
                    }}
                    className={cn(
                    "p-4 rounded border-l-4 space-y-1 transition-all cursor-pointer hover:shadow-sm",
                    result.level === 'error' ? "bg-rose-50 border-rose-500" :
                    result.level === 'warn' ? "bg-amber-50 border-amber-500" :
                    result.level === 'skip' ? "bg-[#F6F9FF] border-slate-300" :
                    "bg-[#EEF6FF]/50 border-[#06B6D4]"
                  )}>
                    <div className="flex justify-between items-start">
                       <span className="font-bold text-[#64748B] text-[11px] font-mono tracking-tighter">#{result.amReference || 'REF'}</span>
                       <div className="flex items-center gap-2">
                          {result.fieldId && result.skuId && result.supplyId && result.level !== 'pass' && <span className="text-[10px] font-bold text-[#2563EB] underline">点击定位</span>}
                         <span className={cn(
                          "font-bold text-[11px] px-1.5 py-0.5 rounded",
                          result.level === 'error' ? "bg-rose-100 text-rose-700" :
                          result.level === 'warn' ? "bg-amber-100 text-amber-700" :
                           "bg-[#06B6D4]/20 text-[#06B6D4]"
                        )}>{result.level === 'error' ? '错误' : result.level === 'warn' ? '警告' : '通过'}</span>
                       </div>
                    </div>
                    <div>
                      <p className="font-bold text-[#0B1F33] text-[13px]">{result.title}</p>
                      <p className="text-[#64748B] text-[12px] font-medium leading-relaxed mt-1">{result.detail}</p>
                    </div>
                  </div>
                ))}
                {validationResults.length === 0 && (
                  <div className="text-[13px] font-bold text-[#64748B] text-center py-10 border border-dashed border-[#DDE7F3] rounded bg-[#F6F9FF]">
                    正在等待初始化核验...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-[#0B1F33] flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[#0B1F33]" /> 预览模式
            </h3>
            <p className="text-[13px] text-[#64748B] font-medium leading-relaxed">
              试产表构建完成，处于最终确认阶段。您可以进行整体预览，确认各列数据无误。
            </p>
          </div>
        )}

      </div>
      </div>

      {collapsed && (
        <div className="absolute inset-0 flex items-center justify-center text-[#64748B] pointer-events-none">
          <AlertCircle size={16} />
        </div>
      )}
    </aside>

  );
}
