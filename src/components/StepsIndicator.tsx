import React from 'react';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { StepId } from '@/src/types';

interface StepsIndicatorProps {
  currentStep: StepId;
}

const steps = [
  { id: 1, name: '填写必填项' },
  { id: 2, name: '自动获取' },
  { id: 3, name: '补充完善' },
  { id: 4, name: '计算与校验' },
  { id: 5, name: '导出预览' },
];

export function StepsIndicator({ currentStep }: StepsIndicatorProps) {
  return (
    <div className="flex items-center justify-center w-full py-6 bg-white shrink-0">
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
    </div>
  );
}
