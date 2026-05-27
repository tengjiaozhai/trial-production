import React, { useRef, useState, useCallback } from 'react';
import { FIELD_GROUPS, FIELD_DEFS } from '@/src/constants';
import { SKUData, FieldDefinition, StepId, SplitOptionFieldId } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { Trash2, Plus, GripVertical, ChevronDown, X } from 'lucide-react';

function ProdLocDropdown({ value, onChange, disabled, hasConflict, fieldLabel }: any) {
  const options = ['宜宾', '南昌', '河源', '越南'];
  
  const isCustom = value === '__CUSTOM__' || (value && !options.includes(value));

  if (isCustom || disabled) {
    return (
      <div className="flex w-full h-full relative items-center">
        <input
          autoFocus={!disabled && value === '__CUSTOM__'}
          className={cn(
            "flex-1 min-w-0 px-3 focus:outline-none transition-all text-[13px] leading-none h-full bg-transparent text-center",
            (hasConflict && !disabled) ? "text-rose-600 placeholder:text-rose-400 placeholder:font-bold" : "text-slate-700"
          )}
          placeholder={value === '__CUSTOM__' ? "请输入..." : (hasConflict && !disabled ? `⚠️ ${fieldLabel}存在冲突` : "-")}
          value={value === '__CUSTOM__' ? '' : (value || '')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        {!disabled && (
          <button 
            type="button"
            onClick={() => {
              onChange('');
            }}
            className="absolute right-2 text-slate-300 hover:text-slate-500"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      className={cn(
        "flex-1 min-w-0 px-2 flex items-center justify-center bg-transparent focus:outline-none text-[13px] outline-none cursor-pointer appearance-none text-center h-full w-full",
        hasConflict && !disabled ? "text-rose-600 font-bold" : "text-slate-700"
      )}
      value={value || ''}
      onChange={(e) => {
        if (e.target.value === 'CUSTOM') {
          onChange('__CUSTOM__');
        } else {
          onChange(e.target.value);
        }
      }}
    >
      <option value="" disabled className="text-slate-400">- 试产地点 -</option>
      {options.map(o => <option key={o} value={o} className="text-slate-700">{o}</option>)}
      <option value="CUSTOM" className="text-blue-600 font-bold">自定义...</option>
    </select>
  );
}

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TrialProductionTableProps {
  currentStep: StepId;
  skuData: SKUData[];
  efuseConfigs?: Record<string, string>;
  onUpdateEfuse?: (fieldId: string, value: string) => void;
  onUpdateValue: (skuId: string, supplyId: string, fieldId: string, value: string) => void;
  onUpdateFieldLabel?: (fieldId: string, newLabel: string) => void;
  onDeleteRow?: (fieldId: string) => void;
  onUpdateSkuHeader?: (skuId: string, part: 'stage' | 'order' | 'project', val: string) => void;
  onUpdateSupplyLabel?: (skuId: string, supplyId: string, val: string) => void;
  onAddSupply?: (skuId: string, index?: number) => void;
  onDeleteSupply?: (skuId: string, supplyId: string) => void;
  onAddSku?: (index?: number) => void;
  onDeleteSku?: (skuId: string) => void;
  selectedRows?: string[];
  onSelectRow?: (fieldId: string) => void;
  activeFields: FieldDefinition[];
  onReorderFields?: (activeId: string, overId: string) => void;
  onReorderSkus?: (activeId: string, overId: string) => void;
  onReorderSupplies?: (skuId: string, activeId: string, overId: string) => void;
  onInsertRowAt?: (index: number) => void;
}

// Resize Handle Component
function ResizeHandle({ onResize, direction = 'horizontal' }: { onResize: (delta: number) => void, direction?: 'horizontal' | 'vertical' }) {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      onResize(currentPos - startPos);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div 
      onMouseDown={onMouseDown}
      className={cn(
        "absolute z-50 bg-transparent hover:bg-blue-400/50 transition-colors cursor-col-resize",
        direction === 'horizontal' ? "right-0 top-0 bottom-0 w-1.5 cursor-col-resize" : "bottom-0 left-0 right-0 h-1.5 cursor-row-resize"
      )}
    />
  );
}

// Sortable Table Header Cell (for Supplies/Columns)
function SortableHeader({ skuId, supply, onUpdateSupplyLabel, onDeleteSupply, onAddSupply, currentStep, supIdx, width, onResize }: any) {
  return (
    <th 
      style={{ width, minWidth: width }}
      className="border-b border-slate-200 border-r border-slate-200 p-3 text-left bg-[#f8fafc] relative group/th font-bold text-[13px] text-slate-700 hover:bg-slate-50 transition-colors"
    >
      <div className="flex items-center gap-1 group/sup h-full">
        {currentStep === 5 ? (
          <span className="w-full text-center px-1 font-bold text-slate-800 text-[13px]">{supply.label || '-'}</span>
        ) : (
          <input
             className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-400 rounded text-[13px] font-bold text-slate-800 placeholder:text-slate-400 px-1 py-0.5"
             value={supply.label}
             placeholder="方案名称"
             onChange={(e) => onUpdateSupplyLabel?.(skuId, supply.id, e.target.value)}
          />
        )}
        {currentStep === 4 && (
          <button onClick={() => onDeleteSupply?.(skuId, supply.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover/sup:opacity-100 transition-opacity absolute right-2"><Trash2 size={12} /></button>
        )}
      </div>
      {currentStep !== 5 && <ResizeHandle onResize={(delta) => onResize(supply.id, delta)} />}
      {/* Insert Column Button */}
      {currentStep !== 5 && currentStep === 4 && (
      <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-blue-500 opacity-0 group-hover/th:opacity-100 transition-opacity pointer-events-none">
         <button 
           type="button"
           onClick={() => onAddSupply?.(skuId, supIdx + 1)}
           className="pointer-events-auto absolute top-1/2 -translate-y-1/2 -right-2 w-5 h-5 bg-blue-500 rounded-full text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow z-50"
         >
           <Plus size={12} strokeWidth={3} />
         </button>
      </div>
      )}
    </th>
  );
}

// Separate SortableRow component for clarity
function SortableRow({ 
  field, 
  skuData, 
  currentStep, 
  onUpdateValue, 
  masterIdx,
  onInsertRowAt,
  colWidths,
  rowHeight,
  onRowResize,
  efuseConfigs,
  onUpdateEfuse,
  onUpdateSkuHeader
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    height: rowHeight
  };

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      id={`row-${field.id}`}
      className="hover:bg-blue-50/10 transition-colors group relative"
    >
      <td className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white p-2 text-center text-[10px] text-slate-400 font-mono w-[32px] min-w-[32px] relative group/handle">
        <div className="flex flex-col items-center justify-center gap-1 h-full">
          {currentStep !== 5 && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing opacity-0 group-hover/handle:opacity-100 transition-opacity p-0.5 text-slate-400">
              <GripVertical size={12} />
            </div>
          )}
          {(masterIdx + 1).toString().padStart(2, '0')}
        </div>
        {currentStep !== 5 && <ResizeHandle direction="vertical" onResize={(delta) => onRowResize(field.id, delta)} />}
      </td>
      <td className="sticky left-[32px] z-20 border-b border-slate-200 border-r-[2px] border-r-slate-300 bg-white p-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] align-top w-[120px] min-w-[120px]">
        <div className="flex flex-col items-center justify-center h-full gap-1.5">
          <span className="text-[13px] font-bold text-[#1e293b] text-center">{field.label}</span>
          {['ce_cert', 'customer_sample_req', 'hw_eng', 'hw_test', 'sw_eng', 'sw_test', 'struct_eng', 'reliability', 'reliability_eng', 'image_eng', 'npm', 'ux', 'parts'].includes(field.id) && (
            <select
              className="border border-slate-200 rounded bg-slate-50 text-[10px] font-bold text-slate-500 px-1 py-0.5 w-full outline-none hover:bg-slate-100 transition-colors text-center cursor-pointer disabled:cursor-not-allowed"
              value={efuseConfigs?.[field.id] || ''}
              onChange={(e) => onUpdateEfuse?.(field.id, e.target.value)}
              disabled={currentStep === 5}
            >
              <option value="" disabled>是否熔丝</option>
              <option value="no efuse">no efuse</option>
              <option value="efuse">efuse</option>
            </select>
          )}
        </div>
      </td>
      {skuData.map((sku: any) => {
        const shouldSpanSku = ['band', 'storage', 'project', 'stage', 'mb_id'].includes(field.id);
        
        if (shouldSpanSku) {
          const supply = sku.supplies[0];
          const hasConflict = supply.values[field.id] === '' && field.behavior !== 'calc';
          return (
            <td 
              key={sku.id} 
              colSpan={sku.supplies.length + (currentStep === 4 ? 1 : 0)}
              className={cn(
                "border-b border-r border-slate-200 p-3 align-top transition-colors relative",
                field.behavior === 'calc' ? "bg-[#f8fafc]" : "bg-white",
                hasConflict && "bg-rose-50/50"
              )}
            >
              <div className="flex flex-col gap-1.5 relative h-full">
                <div className={cn(
                  "rounded flex items-center transition-all overflow-hidden w-full",
                  currentStep !== 5 ? "border bg-white" : "border-none bg-transparent",
                  hasConflict && currentStep !== 5 ? "border-rose-400 ring-1 ring-inset ring-rose-400 shadow-sm shadow-rose-200 bg-rose-50/10" : currentStep !== 5 ? "border-slate-200" : "",
                  currentStep !== 5 && !hasConflict && "focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 hover:border-slate-300",
                  field.behavior === 'calc' && "bg-[#f8fafc] border-transparent"
                )}>
                  <input
                    style={{ height: rowHeight ? rowHeight - 20 : 34 }}
                    className={cn(
                      "flex-1 min-w-0 px-3 focus:outline-none transition-all text-[13px] leading-none text-center",
                      "bg-transparent text-slate-700",
                      field.behavior === 'calc' && "font-bold text-slate-500 cursor-default",
                      hasConflict && currentStep !== 5 && "text-rose-600 placeholder:text-rose-400 placeholder:font-bold"
                    )}
                    placeholder={hasConflict && currentStep !== 5 ? `⚠️ ${field.label}存在冲突` : "-"}
                    value={
                      supply.values[field.id] !== undefined ? supply.values[field.id] : ''
                    }
                    onChange={(e) => {
                      // Apply to all supplies in the SKU
                      sku.supplies.forEach((sup: any) => {
                         onUpdateValue(sku.id, sup.id, field.id, e.target.value);
                      });
                      if (field.id === 'project' && onUpdateSkuHeader) onUpdateSkuHeader(sku.id, 'project', e.target.value);
                      if (field.id === 'stage' && onUpdateSkuHeader) onUpdateSkuHeader(sku.id, 'stage', e.target.value);
                      if (field.id === 'order_no' && onUpdateSkuHeader) onUpdateSkuHeader(sku.id, 'order', e.target.value);
                    }}
                    readOnly={field.behavior === 'calc' || currentStep === 5}
                    disabled={currentStep === 5}
                  />
                </div>
              </div>
            </td>
          );
        }

        return (
        <React.Fragment key={sku.id}>
          {sku.supplies.map((supply: any) => {
            const hasConflict = supply.values[field.id] === '' && field.behavior !== 'calc' && field.id !== 'prod_loc';
            return (
            <td 
              key={supply.id} 
              style={{ width: colWidths[supply.id], minWidth: colWidths[supply.id] }}
              className={cn(
                "border-b border-r border-slate-200 p-3 align-top transition-colors",
                field.behavior === 'calc' ? "bg-[#f8fafc]" : "bg-white",
                hasConflict && "bg-rose-50/50"
              )}
            >
              <div className="flex flex-col gap-1.5 relative">
                <div className={cn(
                  "rounded flex items-center transition-all overflow-hidden",
                  currentStep !== 5 ? "border bg-white" : "border-none bg-transparent",
                  hasConflict && currentStep !== 5 ? "border-rose-400 ring-1 ring-inset ring-rose-400 shadow-sm shadow-rose-200 bg-rose-50/10" : currentStep !== 5 ? "border-slate-200" : "",
                  currentStep !== 5 && !hasConflict && "focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 hover:border-slate-300",
                  field.behavior === 'calc' && "bg-[#f8fafc] border-transparent"
                )}>
                  {field.id === 'prod_loc' ? (
                    <div style={{ height: rowHeight ? rowHeight - 20 : 34 }} className="flex-1 min-w-0">
                      <ProdLocDropdown
                        value={supply.values[field.id]}
                        onChange={(val: string) => onUpdateValue(sku.id, supply.id, field.id, val)}
                        disabled={currentStep === 5}
                        hasConflict={hasConflict && currentStep !== 5}
                        fieldLabel={field.label}
                      />
                    </div>
                  ) : (() => {
                    const options = sku.fieldOptions?.[field.id as SplitOptionFieldId];
                    return options && options.length > 0 ? (
                      <div
                        style={{ minHeight: rowHeight ? rowHeight - 20 : 34 }}
                        className={cn(
                          'grid gap-1.5 w-full p-1',
                          options.length === 1 && 'grid-cols-1',
                          options.length === 2 && 'grid-cols-2',
                          options.length >= 3 && 'grid-cols-3'
                        )}
                      >
                        {options.slice(0, 3).map((option: any) => (
                          <div
                            key={`${field.id}-${option.supply}-${option.text}`}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-700 text-center leading-snug"
                          >
                            {option.text}
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })() ?? (
                    <input
                      style={{ height: rowHeight ? rowHeight - 20 : 34 }}
                      className={cn(
                        "flex-1 min-w-0 px-3 focus:outline-none transition-all text-[13px] leading-none",
                        "bg-transparent text-slate-700",
                        field.behavior === 'calc' && "font-bold text-slate-500 cursor-default",
                        hasConflict && currentStep !== 5 && "text-rose-600 placeholder:text-rose-400 placeholder:font-bold"
                      )}
                      placeholder={hasConflict && currentStep !== 5 ? `⚠️ ${field.label}存在冲突` : "-"}
                      value={
                        supply.values[field.id] !== undefined ? supply.values[field.id] : ''
                      }
                      onChange={(e) => {
                        onUpdateValue(sku.id, supply.id, field.id, e.target.value);
                      }}
                      readOnly={field.behavior === 'calc' || currentStep === 5}
                      disabled={currentStep === 5}
                    />
                  )}
                </div>
                {hasConflict && currentStep !== 5 && field.id === 'lcd' && (
                  <div className="flex items-center gap-2 px-1 text-[11px] font-bold">
                    <span className="text-rose-500/90 whitespace-nowrap">快速:</span>
                    <button 
                       className="text-slate-500 hover:text-rose-600 transition-colors border-b border-dashed border-slate-300 px-1"
                       onClick={() => onUpdateValue(sku.id, supply.id, field.id, 'BOE')}
                    >
                       BOE
                    </button>
                    <button 
                       className="text-slate-500 hover:text-rose-600 transition-colors border-b border-dashed border-slate-300 px-1"
                       onClick={() => onUpdateValue(sku.id, supply.id, field.id, 'CSOT')}
                    >
                       CSOT
                    </button>
                  </div>
                )}
              </div>
            </td>
          )})}
          {currentStep === 4 && (
            <td className="bg-white border-b border-r border-slate-200 min-w-[40px] pointer-events-none"></td>
          )}
        </React.Fragment>
      )})}
      <td className="p-0 border-b border-gray-200 relative w-0">
        {currentStep !== 5 && (
        <div className="absolute left-[-1000px] right-0 -bottom-[1px] h-[2px] z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <button 
            type="button"
            onClick={() => onInsertRowAt?.(masterIdx + 1)}
            className="pointer-events-auto absolute left-1/2 -translate-x-1/2 -top-2 w-4 h-4 bg-blue-500 rounded-full text-white flex items-center justify-center hover:scale-125 active:scale-95 transition-all shadow-md"
            title="在此行后插入"
          >
            <Plus size={10} strokeWidth={4} />
          </button>
        </div>
        )}
      </td>
    </tr>
  );
}

export function TrialProductionTable({
  currentStep,
  skuData,
  efuseConfigs,
  onUpdateEfuse,
  onUpdateValue,
  onUpdateFieldLabel,
  onDeleteRow,
  onUpdateSkuHeader,
  onUpdateSupplyLabel,
  onAddSupply,
  onDeleteSupply,
  onAddSku,
  onDeleteSku,
  selectedRows = [],
  onSelectRow,
  activeFields,
  onReorderFields,
  onInsertRowAt
}: TrialProductionTableProps) {

  const topTableRef = useRef<HTMLDivElement>(null);
  const bottomTableRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getVisibleFields = () => {
    let fields = [...activeFields];

    if (currentStep === 2) {
      const step2Ids = [
        'project', 'stage', 'mb_id', 'band', 'storage', 
        'lcd', 'front_cam', 'main_cam', 'sub_cam', 'fingerprint', 'battery', 'speaker', 'receiver', 'mic', 'motor', 'spk_fpc', 'sidekey_fpc', 'ir_fpc', 'lens', 'housing', 'battery_cover', 'sim_tray', 'side_key', 'aux_material', 'cooling', 
        'cpu', 'emmc', 'ddr', 'pmu', 'tx', 'rf_transceiver', 'nfc', 'pcb', 'sub_board', 'reliability', 'field_test', 'fan_sample', 'ce_cert',
        'hw_eng', 'hw_test', 'sw_eng', 'sw_test', 'struct_eng', 'reliability_eng', 'pressure_test', 'image_eng', 'npm', 'ux', 'parts', 'pm'
      ];
      return fields.filter(f => step2Ids.includes(f.id));
    }
    if (currentStep === 3) {
      const step3Ids = [
        'project', 'stage', 'order_no', 'prod_order', 'board_adj_qty', 'backup_unit', 'prod_yield', 'test_yield',
        'software', 'online_time', 'assembly_time', 'prod_loc', 'color', 'unit_id', 'mb_id', 'cal_file',
        'pkg_process', 'copy_mold', 'underfill', 'thermal_gel_mb', 'usb_glue', 'solder_paste', 'thermal_gel_front', 'tp_hotmelt',
        'ebom', 'ebom_desc', 'sub_bom', 'sub_bom_desc', 'lda', 'mbom', 'pbom'
      ];
      return fields.filter(f => step3Ids.includes(f.id));
    }
    return fields;
  };

  const visibleFields = getVisibleFields();
  const basicInfoFields = visibleFields.filter(f => f.group === '基本信息');
  const otherFields = visibleFields.filter(f => f.group !== '基本信息');
  const otherGroups = Array.from(new Set(otherFields.map(f => f.group)));

  const handleDragEndRows = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderFields?.(active.id.toString(), over.id.toString());
    }
  };

  const handleColResize = useCallback((id: string, delta: number) => {
    setColWidths(prev => ({
      ...prev,
      [id]: Math.max(100, (prev[id] || 140) + delta)
    }));
  }, []);

  const handleRowResize = useCallback((id: string, delta: number) => {
    setRowHeights(prev => ({
      ...prev,
      [id]: Math.max(32, (prev[id] || 40) + delta)
    }));
  }, []);

  const handleScroll = (source: 'top' | 'bottom') => (e: React.UIEvent<HTMLDivElement>) => {
    if (source === 'top' && bottomTableRef.current) {
      bottomTableRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
    } else if (source === 'bottom' && topTableRef.current) {
      topTableRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
    }
  };

  const renderColGroup = () => (
    <colgroup>
      <col style={{ width: 32, minWidth: 32 }} />
      <col style={{ width: 120, minWidth: 120 }} />
      {skuData.map(sku => (
        <React.Fragment key={sku.id}>
          {sku.supplies.map(sup => (
             <col key={sup.id} style={{ width: colWidths[sup.id] || 140, minWidth: colWidths[sup.id] || 140 }} />
          ))}
          {currentStep === 4 && <col style={{ width: 40, minWidth: 40 }} />}
        </React.Fragment>
      ))}
      <col style={{ width: 0 }} />
    </colgroup>
  );

  return (
    <div className="relative border border-slate-200 rounded shadow-sm bg-white overflow-hidden flex flex-col h-[calc(100vh-280px)]">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEndRows}
      >
        <div 
          ref={topTableRef}
          onScroll={handleScroll('top')}
          className="overflow-x-auto overflow-y-hidden shrink-0 z-20 border-b-2 border-slate-300 shadow-sm"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <table className="text-sm border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
            {renderColGroup()}
            <thead className="bg-[#f1f5f9]">
              <tr>
                <th 
                  colSpan={3 + skuData.reduce((acc, sku) => acc + sku.supplies.length + (currentStep === 4 ? 1 : 0), 0)}
                  className="bg-[#f8fafc] border-b border-slate-200 px-3 py-3 text-[13px] font-bold text-slate-500 text-center uppercase tracking-wider relative"
                >
                  基本信息
                </th>
              </tr>
              {currentStep === 4 && (
                <tr className="bg-[#f8fafc]">
                  <th className="sticky left-0 z-[70] border-b border-r border-slate-200 bg-[#f8fafc]"></th>
                  <th className="sticky left-[32px] z-[70] border-b border-slate-200 border-r-[2px] border-r-slate-300 bg-[#f8fafc] px-3 py-4 text-center text-slate-700 text-[13px] font-bold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                    方案名称
                  </th>
                  {skuData.map((sku) => (
                    <React.Fragment key={sku.id}>
                      {sku.supplies.map((supply, supIdx) => (
                        <SortableHeader 
                          key={supply.id} 
                          skuId={sku.id} 
                          supply={supply} 
                          supIdx={supIdx}
                          currentStep={currentStep}
                          onUpdateSupplyLabel={onUpdateSupplyLabel}
                          onDeleteSupply={onDeleteSupply}
                          onAddSupply={onAddSupply}
                          width={colWidths[supply.id] || 140}
                          onResize={handleColResize}
                        />
                      ))}
                      <th className="bg-[#f8fafc] p-0 border-b border-slate-200 border-r border-slate-200 w-10">
                         <button onClick={() => onAddSupply?.(sku.id)} className="w-full h-full flex items-center justify-center text-slate-300 hover:text-blue-500 transition-colors bg-white hover:bg-slate-50"><Plus size={14} /></button>
                      </th>
                    </React.Fragment>
                  ))}
                  <th className="border-b border-slate-200 bg-[#f8fafc]"></th>
                </tr>
              )}
            </thead>
            {basicInfoFields.length > 0 && (
              <tbody>
                <SortableContext items={basicInfoFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  {basicInfoFields.map((field) => (
                    <SortableRow 
                      key={field.id}
                      field={field}
                      skuData={skuData}
                      currentStep={currentStep}
                      onUpdateValue={onUpdateValue}
                      masterIdx={activeFields.findIndex(f => f.id === field.id)}
                      onInsertRowAt={onInsertRowAt}
                      colWidths={colWidths}
                      rowHeight={rowHeights[field.id] || 40}
                      onRowResize={handleRowResize}
                      efuseConfigs={efuseConfigs}
                      onUpdateEfuse={onUpdateEfuse}
                      onUpdateSkuHeader={onUpdateSkuHeader}
                    />
                  ))}
                </SortableContext>
              </tbody>
            )}
          </table>
        </div>

        <div 
          ref={bottomTableRef}
          onScroll={handleScroll('bottom')}
          className="overflow-auto flex-1 z-0 scrollbar-thin scrollbar-thumb-slate-300 relative bg-white"
        >
          <table className="text-sm border-separate border-spacing-0" style={{ tableLayout: 'fixed' }}>
            {renderColGroup()}
            <tbody>
              <SortableContext 
                items={otherFields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {otherGroups.map((groupName) => {
                  const groupFields = otherFields.filter(f => f.group === groupName);
                  if (groupFields.length === 0) return null;

                  return (
                    <React.Fragment key={groupName}>
                      <tr className="bg-[#f8fafc] select-none">
                        <td 
                          colSpan={3 + skuData.reduce((acc, sku) => acc + sku.supplies.length + (currentStep === 4 ? 1 : 0), 0)}
                          className="border-y border-slate-200 bg-[#f8fafc] px-3 py-3 text-[13px] font-bold text-slate-500 text-center uppercase tracking-wider relative"
                        >
                          {groupName}
                        </td>
                      </tr>
                      {groupFields.map((field) => {
                        const masterIdx = activeFields.findIndex(f => f.id === field.id);
                        return (
                          <SortableRow 
                            key={field.id}
                            field={field}
                            skuData={skuData}
                            currentStep={currentStep}
                            onUpdateValue={onUpdateValue}
                            masterIdx={masterIdx}
                            onInsertRowAt={onInsertRowAt}
                            colWidths={colWidths}
                            rowHeight={rowHeights[field.id] || 40}
                            onRowResize={handleRowResize}
                            efuseConfigs={efuseConfigs}
                            onUpdateEfuse={onUpdateEfuse}
                            onUpdateSkuHeader={onUpdateSkuHeader}
                          />
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </SortableContext>
            </tbody>
          </table>
        </div>
      </DndContext>
    </div>
  );
}
