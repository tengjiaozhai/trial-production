import React from 'react';
import { CheckCircle2, Check, Circle, AlertCircle, Info, ArrowLeft, ShieldCheck, RotateCw } from 'lucide-react';
import { StepId, ProjectInfo, SKUData, ValidationResult } from '@/src/types';
import { AM_RULE_DEFS } from '@/src/constants';
import { cn } from '@/src/lib/utils';

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
  step2Conflicts?: { fieldId: string; fieldLabel: string; supplyLabel: string }[];
}

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
  step2Conflicts = []
}: SidebarProps) {
  
  const scrollToField = (id: string) => {
    const el = document.getElementById(`row-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-rose-50');
      setTimeout(() => el.classList.remove('bg-rose-50'), 2000);
    }
  };
  const hasDataSources = projectInfo.files.length > 0;

  const checklist = [
    { label: '项目名称', done: !!projectInfo.name },
    { label: '主板标识', done: !!projectInfo.checkedPcbaOptions && projectInfo.checkedPcbaOptions.length > 0 },
    { label: '选择客户', done: !!projectInfo.customer },
    { label: '试产阶段', done: !!projectInfo.stage },
    { label: '上传数据源', done: hasDataSources },
  ];

  return (
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm z-10">
      <div className="flex-1 overflow-y-auto pt-6 px-4 space-y-8 scrollbar-thin">
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-black text-[#0f2e4a] flex items-center gap-2 mb-4">
                <CheckCircle2 size={18} className="text-[#0f2e4a]" /> 准备就绪核对
              </h3>
              <ul className="space-y-3">
                {checklist.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-[13px] font-bold p-2 hover:bg-slate-50 rounded transition-all">
                    {item.done ? (
                      <div className="w-5 h-5 rounded border-2 border-[#00897b] text-[#00897b] flex items-center justify-center">
                        <Check size={14} strokeWidth={4} />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded border-2 border-slate-300" />
                    )}
                    <span className={cn(item.done ? "text-slate-800" : "text-slate-400")}>{item.label}</span>
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
                      onClick={() => scrollToField(c.fieldId)}
                      className="p-3 bg-rose-50/50 rounded border border-rose-200 hover:border-rose-400 hover:shadow-sm transition-all cursor-pointer space-y-1 group"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] font-black text-rose-700">{c.fieldLabel}存在冲突</span>
                        <span className="text-[11px] font-bold text-rose-500/80 group-hover:text-rose-600">点击定位</span>
                      </div>
                      <p className="text-[12px] text-rose-600/80 font-medium">配置项：<span className="font-bold text-rose-700">{c.supplyLabel}</span> 缺少值</p>
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
            <p className="text-[13px] text-slate-500 font-medium leading-relaxed italic opacity-80">系统检测到以下关键要素配置不全，请在右侧表格中进行手动补充：</p>
            
            <div className="space-y-3">
              {[
                { title: '基础业务信息', items: ['订单号', '生产顺序', '试产地点'] },
                { title: '关键交付属性', items: ['软件版本', '上线时间', '颜色/整机标识'] },
                { title: '工艺辅料与BOM', items: ['锡膏', '导热凝胶', 'EBOM/小板BOM（料号+描述）', 'MBOM/PBOM'] }
              ].map((group, i) => (
                <div key={i} className="bg-white p-4 rounded border border-slate-200 space-y-3 hover:border-[#00897b] transition-all">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-[#00897b] rounded-full" />
                    <span className="text-[13px] font-black text-slate-800">{group.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map(it => (
                      <span key={it} className="px-3 py-1 bg-slate-50 text-[12px] font-bold text-slate-500 border border-slate-100 rounded transition-all">
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
            <div className="bg-white p-5 rounded border border-[#00897b]/30 shadow-sm space-y-4">
              <h3 className="text-[13px] font-black text-[#0f2e4a] flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#0f2e4a]" /> 核验控制器
              </h3>
              <button 
                onClick={onRunValidation}
                className="w-full py-3 bg-white border border-[#00897b] text-[#00897b] text-[13px] font-bold rounded hover:bg-[#00897b] hover:text-white transition-all flex items-center justify-center gap-2 group"
              >
                <RotateCw size={16} className="group-active:rotate-180 transition-transform duration-500" />
                重新执行
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-[13px] font-black text-slate-800">校验结果</h3>
              <div className="space-y-3 select-none">
                {[...validationResults]
                  .sort((a, b) => {
                    const order = { error: 0, warn: 1, pass: 2, skip: 3 };
                    return (order[a.level] ?? 4) - (order[b.level] ?? 4);
                  })
                  .map((result, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => result.fieldId && scrollToField(result.fieldId)}
                    className={cn(
                    "p-4 rounded border-l-4 space-y-1 transition-all cursor-pointer hover:shadow-sm",
                    result.level === 'error' ? "bg-rose-50 border-rose-500" :
                    result.level === 'warn' ? "bg-amber-50 border-amber-500" :
                    result.level === 'skip' ? "bg-slate-50 border-slate-300" :
                    "bg-[#e0f2f1]/50 border-[#00897b]"
                  )}>
                    <div className="flex justify-between items-start">
                       <span className="font-bold text-slate-400 text-[11px] font-mono tracking-tighter">#{result.amReference || 'REF'}</span>
                       <div className="flex items-center gap-2">
                         {result.fieldId && result.level !== 'pass' && <span className="text-[10px] font-bold text-blue-500 underline">定位</span>}
                         <span className={cn(
                          "font-bold text-[11px] px-1.5 py-0.5 rounded",
                          result.level === 'error' ? "bg-rose-100 text-rose-700" :
                          result.level === 'warn' ? "bg-amber-100 text-amber-700" :
                          "bg-[#4db6ac]/20 text-[#00897b]"
                        )}>{result.level === 'error' ? '错误' : result.level === 'warn' ? '警告' : '通过'}</span>
                       </div>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-[13px]">{result.title}</p>
                      <p className="text-slate-600 text-[12px] font-medium leading-relaxed mt-1">{result.detail}</p>
                    </div>
                  </div>
                ))}
                {validationResults.length === 0 && (
                  <div className="text-[13px] font-bold text-slate-400 text-center py-10 border border-dashed border-slate-200 rounded bg-slate-50">
                    正在等待初始化核验...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h3 className="text-sm font-black text-[#0f2e4a] flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[#0f2e4a]" /> 预览模式
            </h3>
            <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
              试产表构建完成，处于最终确认阶段。您可以进行整体预览，确认各列数据无误。
            </p>
          </div>
        )}

      </div>
    </div>

  );
}
