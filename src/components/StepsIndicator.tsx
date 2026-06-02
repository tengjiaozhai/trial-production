import React from 'react';
import { Check, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { StepId } from '@/src/types';

interface StepsIndicatorProps {
  currentStep: StepId;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const steps = [
  { id: 1, name: '填写必填项' },
  { id: 2, name: '自动获取' },
  { id: 3, name: '补充完善' },
  { id: 4, name: '计算与校验' },
  { id: 5, name: '导出预览' },
];

export function StepsIndicator({ currentStep, collapsed, onToggleCollapsed }: StepsIndicatorProps) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-between w-full h-7 px-6 bg-white shrink-0 border-b border-slate-100">
        <div
          data-testid="collapsed-current-step"
          className="flex items-center gap-2 text-[12px] font-bold text-slate-600"
        >
          <span className="w-2 h-2 rounded-full bg-[#00897b]" />
          <span>第 {currentStep} 步</span>
        </div>
        <button
          type="button"
          data-testid="steps-toggle"
          aria-label="展开步骤条"
          onClick={onToggleCollapsed}
          className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full py-6 bg-white shrink-0">
      <div className="flex items-center w-full max-w-5xl px-8">
        {steps.map((step, idx) => (
           <React.Fragment key={step.id}>
             <div className="flex flex-col items-center gap-2 w-24 shrink-0">
               <div
                 className={cn(
                   "flex items-center justify-center w-9 h-9 rounded-[10px] border-2 transition-all duration-300",
                   currentStep === step.id
                     ? "border-[#00897b] bg-[#00897b] text-white shadow-md shadow-[#00897b]/30"
                     : currentStep > step.id
                     ? "border-[#00897b] bg-white text-[#00897b]"
                     : "border-slate-200 bg-slate-50 text-slate-400"
                 )}
               >
                 {currentStep > step.id ? (
                   <Check size={18} strokeWidth={3} />
                 ) : (
                   <span className="text-[13px] font-black">{step.id}</span>
                 )}
               </div>
               <span
                 className={cn(
                   "text-[13px] font-bold tracking-tight text-center",
                   currentStep === step.id ? "text-slate-800" : "text-slate-500"
                 )}
               >
                 {step.name}
               </span>
             </div>
             {idx < steps.length - 1 && (
               <div className={cn(
                 "flex-1 min-w-[40px] h-[2px] -translate-y-4 rounded-full mx-4 transition-colors duration-300",
                 currentStep > step.id ? "bg-[#00897b]" : "bg-slate-200"
               )} />
             )}
           </React.Fragment>
        ))}
      </div>
      <button
        type="button"
        data-testid="steps-toggle"
        aria-label="折叠步骤条"
        onClick={onToggleCollapsed}
        className="absolute right-4 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
      >
        <ChevronUp size={14} />
      </button>
    </div>
  );
}
