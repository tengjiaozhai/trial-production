import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FIELD_GROUPS, FIELD_DEFS } from '@/src/constants';
import { SKUData, FieldDefinition, StepId } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { Trash2, Plus, GripVertical, ChevronDown, X, Copy, ClipboardPaste } from 'lucide-react';
import { listSupplyKeys } from '../lib/supplyProjection';
import { buildStep5TableModel } from '../lib/step5TableModel';
import type { Step5Row } from '../lib/step5TableModel';
import { buildTableViewportMetrics, BASIC_INFO_BLOCK_HEIGHT_PX } from '../lib/tableViewport';
import type { CopiedSku } from '../lib/tableOperations';

function ProdLocDropdown({ value, onChange, disabled, fieldLabel }: any) {
  const options = ['宜宾', '南昌', '河源', '越南'];

  const isCustom = value === '__CUSTOM__' || (value && !options.includes(value));

  if (isCustom || disabled) {
    return (
      <div className="flex w-full h-full relative items-center">
        <input
          autoFocus={!disabled && value === '__CUSTOM__'}
          className="flex-1 min-w-0 px-3 focus:outline-none transition-all text-[13px] leading-none h-full bg-transparent text-slate-700 text-center"
          placeholder={value === '__CUSTOM__' ? "请输入..." : "-"}
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
      className="flex-1 min-w-0 px-2 flex items-center justify-center bg-transparent focus:outline-none text-[13px] outline-none cursor-pointer appearance-none text-center h-full w-full text-slate-700"
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
  onAddSku?: (index?: number) => void;
  onDeleteSku?: (skuId: string) => void;
  onInsertSkuAfter?: (afterSkuId: string) => void;
  selectedRows?: string[];
  onSelectRow?: (fieldId: string) => void;
  activeFields: FieldDefinition[];
  onReorderFields?: (activeId: string, overId: string) => void;
  onReorderSkus?: (activeId: string, overId: string) => void;
  onReorderSupplies?: (skuId: string, activeId: string, overId: string) => void;
  onInsertRowAt?: (afterFieldId: string) => void;
  onStep5LayoutChange?: (layout: { supplyWidths: Record<string, number>; rowHeights: Record<string, number> }) => void;
  onUpdateSelectedSupply?: (skuId: string, supplyKey: string) => void;
  skuSupplyKeys?: Record<string, string[]>;
  selectedSkuId?: string | null;
  onSelectSku?: (skuId: string) => void;
  copiedSku?: CopiedSku | null;
  onCopySelectedSku?: () => void;
  onPasteIntoNewSku?: () => void;
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
function SortableHeader({ skuId, supply, onUpdateSupplyLabel, onDeleteSku, onAddSupply, onInsertSkuAfter, currentStep, supIdx, width, onResize, isSelected, onSelectSku }: any) {
  const isFirstOfSku = supIdx === 0;
  return (
    <th
      data-testid={isFirstOfSku ? 'sku-header-block' : undefined}
      data-sku-id={isFirstOfSku ? skuId : undefined}
      data-selected={isFirstOfSku ? (isSelected ? 'true' : 'false') : undefined}
      style={{ width, minWidth: width }}
      className={cn(
        "border-b border-slate-200 border-r border-slate-200 p-2.5 text-center bg-gradient-to-b from-slate-50/80 to-slate-100/50 relative group/th font-bold text-[13px] text-slate-700 hover:from-slate-100/80 hover:to-slate-150/50 transition-all duration-200 hover:z-20",
        isFirstOfSku && isSelected && "bg-gradient-to-b from-blue-50/60 to-blue-50/10 shadow-[inset_0_-2px_0_0_#3b82f6] z-10"
      )}
    >
      <div className="flex items-center justify-center gap-1 group/sup h-full">
        {isFirstOfSku && currentStep !== 5 && onSelectSku && (
          <button
            type="button"
            data-testid="sku-select"
            onClick={() => onSelectSku(skuId)}
            className={cn(
              "shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all",
              isSelected
                ? "bg-blue-500 border-blue-500 text-white"
                : "bg-white border-slate-300 text-transparent hover:border-blue-400"
            )}
            title={isSelected ? "取消选中" : "选中此主板块"}
            aria-label={isSelected ? "取消选中主板块" : "选中主板块"}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5a1 1 0 011.4-1.4l3.9 3.9 6.7-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
          </button>
        )}
        {currentStep === 5 ? (
          <span className="w-full text-center px-1 font-bold text-slate-800 text-[13px]">{supply.label || '-'}</span>
        ) : (
          <input
             className="w-full bg-transparent border-none focus:ring-1 focus:ring-blue-400 rounded text-[13px] font-bold text-slate-800 placeholder:text-slate-400 px-1 py-0.5 text-center"
             value={supply.label}
             placeholder="方案名称"
             onChange={(e) => onUpdateSupplyLabel?.(skuId, supply.id, e.target.value)}
          />
        )}
        {currentStep >= 2 && currentStep <= 4 && (
          <button onClick={() => onDeleteSku?.(skuId)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover/sup:opacity-100 transition-opacity absolute right-2"><Trash2 size={12} /></button>
        )}
      </div>
      {currentStep !== 5 && <ResizeHandle onResize={(delta) => onResize(supply.id, delta)} />}
      {/* Insert Column Button */}
      {currentStep >= 2 && currentStep <= 4 && (
      <div className="absolute right-0 top-0 bottom-0 z-[60] w-[2px] bg-blue-500 opacity-0 group-hover/th:opacity-100 transition-opacity pointer-events-none">
         <button
           type="button"
           data-testid="column-insert-after"
           onClick={() => {
             if (currentStep === 2) {
               onAddSupply?.(skuId, supIdx + 1);
               return;
             }
             onInsertSkuAfter?.(skuId);
           }}
           className="pointer-events-auto absolute top-1/2 -translate-y-1/2 -right-2 z-[70] w-5 h-5 bg-blue-500 rounded-full text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow"
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
  onUpdateSkuHeader,
  onUpdateSelectedSupply,
  skuSupplyKeys,
  onDeleteRow
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
      <td className="sticky left-[32px] z-20 group-hover:z-30 border-b border-slate-200 border-r-[2px] border-r-slate-300 bg-white p-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] align-top w-[120px] min-w-[120px] relative">
        <div className="flex flex-col items-center justify-center h-full gap-1.5 w-full">
          <div className="flex items-center justify-between w-full px-1 group/rowlabel relative">
            <span className="text-[13px] font-bold text-[#1e293b] text-center flex-1">{field.label}</span>
            {currentStep >= 2 && currentStep <= 4 && onDeleteRow && (
              <button 
                onClick={() => onDeleteRow(field.id)} 
                className="text-slate-400 hover:text-red-500 opacity-0 group-hover/rowlabel:opacity-100 transition-opacity absolute right-0 bg-white"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
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
        {currentStep >= 2 && currentStep <= 4 && (
          <button
            type="button"
            data-testid="row-insert-after"
            onClick={() => onInsertRowAt?.(field.id)}
            className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-50 w-4 h-4 bg-blue-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-125 active:scale-95 transition-all shadow-md"
            title="在此行后插入"
          >
            <Plus size={10} strokeWidth={4} />
          </button>
        )}
      </td>
      {skuData.map((sku: any) => {
        const shouldSpanSku = ['band', 'storage', 'project', 'stage', 'mb_id'].includes(field.id);
        
        if (shouldSpanSku) {
          const supply = sku.supplies[0];
          return (
            <td
              key={sku.id}
              colSpan={sku.supplies.length}
              className={cn(
                "border-b border-r border-slate-200 p-2 align-top transition-colors relative",
                field.behavior === 'calc' ? "bg-[#f8fafc]" : "bg-white"
              )}
            >
              <div className="flex flex-col gap-1.5 relative h-full">
                <div className={cn(
                  "rounded-lg flex items-center transition-all duration-300 ease-out overflow-hidden w-full",
                  currentStep !== 5 ? "border bg-white" : "border-none bg-transparent",
                  currentStep !== 5 && "border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 hover:border-slate-300 hover:shadow-sm focus-within:shadow-md focus-within:shadow-blue-500/5",
                  field.behavior === 'calc' && "bg-slate-50/50 border-transparent text-slate-500"
                )}>
                  <input
                    style={{ height: rowHeight ? rowHeight - 20 : 34 }}
                    className={cn(
                      "flex-1 min-w-0 px-2 focus:outline-none transition-all text-[13px] leading-none text-center",
                      "bg-transparent text-slate-700",
                      field.behavior === 'calc' && "font-bold text-slate-500 cursor-default"
                    )}
                    placeholder="-"
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
          {field.id === '__supplier__' ? (
            <td
              key={sku.id}
              colSpan={sku.supplies.length}
              className="border-b border-r border-slate-200 p-2 align-top bg-white"
            >
              {currentStep === 3 ? (
                <select
                  className="w-full h-9 px-2 border border-slate-200 rounded bg-white text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 cursor-pointer"
                  value={sku.selectedSupplyKey || ''}
                  onChange={(e) => onUpdateSelectedSupply?.(sku.id, e.target.value)}
                >
                  {(skuSupplyKeys?.[sku.id] ?? []).map((k: string) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="w-full h-9 px-2 bg-transparent text-[13px] text-slate-700 text-center"
                  value={sku.supplies[0]?.label || sku.selectedSupplyKey || ''}
                  readOnly
                  disabled
                />
              )}
            </td>
          ) : (
          <React.Fragment>
          {sku.supplies.map((supply: any) => {
            return (
            <td
              key={supply.id}
              style={{ width: colWidths[supply.id], minWidth: colWidths[supply.id] }}
              className={cn(
                "border-b border-r border-slate-200 p-2 align-top transition-colors",
                field.behavior === 'calc' ? "bg-[#f8fafc]" : "bg-white"
              )}
            >
              <div className="flex flex-col gap-1.5 relative">
                <div className={cn(
                  "rounded-lg flex items-center transition-all duration-300 ease-out overflow-hidden",
                  currentStep !== 5 ? "border bg-white" : "border-none bg-transparent",
                  currentStep !== 5 && "border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 hover:border-slate-300 hover:shadow-sm focus-within:shadow-md focus-within:shadow-blue-500/5",
                  field.behavior === 'calc' && "bg-slate-50/50 border-transparent text-slate-500"
                )}>
                  {field.id === 'prod_loc' ? (
                    <div style={{ height: rowHeight ? rowHeight - 20 : 34 }} className="flex-1 min-w-0">
                      <ProdLocDropdown
                        value={supply.values[field.id]}
                        onChange={(val: string) => onUpdateValue(sku.id, supply.id, field.id, val)}
                        disabled={currentStep === 5}
                        fieldLabel={field.label}
                      />
                    </div>
                  ) : (
                    <>
                      <input
                        style={{ height: rowHeight ? rowHeight - 20 : 34 }}
                        className={cn(
                          "flex-1 min-w-0 px-2 focus:outline-none transition-all text-[13px] leading-none",
                          "bg-transparent text-slate-700",
                          field.behavior === 'calc' && "font-bold text-slate-500 cursor-default"
                        )}
                        placeholder="-"
                        value={
                          supply.values[field.id] !== undefined ? supply.values[field.id] : ''
                        }
                        onChange={(e) => {
                          onUpdateValue(sku.id, supply.id, field.id, e.target.value);
                        }}
                        readOnly={field.behavior === 'calc' || currentStep === 5}
                        disabled={currentStep === 5}
                      />
                    </>
                  )}
                </div>
              </div>
            </td>
          )})}
          </React.Fragment>
          )}
        </React.Fragment>
      )})}
      <td className="p-0 border-b border-gray-200 relative w-0"></td>
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
  onAddSku,
  onDeleteSku,
  onInsertSkuAfter,
  selectedRows = [],
  onSelectRow,
  activeFields,
  onReorderFields,
  onInsertRowAt,
  onStep5LayoutChange,
  onUpdateSelectedSupply,
  skuSupplyKeys,
  selectedSkuId = null,
  onSelectSku,
  copiedSku = null,
  onCopySelectedSku,
  onPasteIntoNewSku,
}: TrialProductionTableProps) {

  const topTableRef = useRef<HTMLDivElement>(null);
  const bottomTableRef = useRef<HTMLDivElement>(null);
  const step5TableRef = useRef<HTMLDivElement>(null);
  const canonicalFieldIds = new Set(FIELD_DEFS.map((field) => field.id));
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [horizontalScrollLeft, setHorizontalScrollLeft] = useState(0);
  const [horizontalScrollMax, setHorizontalScrollMax] = useState(0);
  const horizontalScrollLeftRef = useRef(0);
  const horizontalScrollMaxRef = useRef(0);
  const isSliderDraggingRef = useRef(false);
  const pendingSliderValueRef = useRef<number | null>(null);
  const sliderRafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentStep !== 5) return;
    onStep5LayoutChange?.({ supplyWidths: colWidths, rowHeights });
  }, [currentStep, colWidths, rowHeights, onStep5LayoutChange]);

  const viewport = buildTableViewportMetrics({ currentStep, skuData, colWidths });
  const tableStyle: React.CSSProperties = {
    tableLayout: 'fixed' as const,
    width: `${viewport.totalTableWidthPx}px`,
    minWidth: `${viewport.totalTableWidthPx}px`,
  };

  const getActiveHorizontalContainers = useCallback((): HTMLDivElement[] => {
    if (currentStep === 5) {
      return step5TableRef.current ? [step5TableRef.current] : [];
    }
    return [topTableRef.current, bottomTableRef.current].filter((n): n is HTMLDivElement => Boolean(n));
  }, [currentStep]);

  const writeHorizontalScroll = useCallback((nextLeft: number) => {
    const clamped = Math.max(0, Math.min(nextLeft, horizontalScrollMaxRef.current));
    horizontalScrollLeftRef.current = clamped;
    const containers = getActiveHorizontalContainers();
    containers.forEach((el) => {
      if (el.scrollLeft !== clamped) el.scrollLeft = clamped;
    });
    return clamped;
  }, [getActiveHorizontalContainers]);

  const syncHorizontalSliderState = useCallback(() => {
    const containers = getActiveHorizontalContainers();
    if (containers.length === 0) {
      horizontalScrollLeftRef.current = 0;
      horizontalScrollMaxRef.current = 0;
      setHorizontalScrollMax(0);
      if (!isSliderDraggingRef.current) setHorizontalScrollLeft(0);
      return;
    }
    const maxScroll = Math.max(...containers.map((el) => Math.max(0, el.scrollWidth - el.clientWidth)));
    const current = containers[0].scrollLeft;
    horizontalScrollMaxRef.current = maxScroll;
    horizontalScrollLeftRef.current = Math.min(current, maxScroll);
    setHorizontalScrollMax(maxScroll);
    if (!isSliderDraggingRef.current) {
      setHorizontalScrollLeft(Math.min(current, maxScroll));
    }
  }, [getActiveHorizontalContainers]);

  const flushPendingSliderScroll = useCallback(() => {
    if (pendingSliderValueRef.current === null) return;
    const clamped = writeHorizontalScroll(pendingSliderValueRef.current);
    pendingSliderValueRef.current = null;
    setHorizontalScrollLeft(clamped);
  }, [writeHorizontalScroll]);

  const applyHorizontalScroll = useCallback((nextLeft: number) => {
    isSliderDraggingRef.current = true;
    pendingSliderValueRef.current = nextLeft;
    if (sliderRafIdRef.current !== null) return;
    sliderRafIdRef.current = requestAnimationFrame(() => {
      sliderRafIdRef.current = null;
      if (pendingSliderValueRef.current === null) return;
      writeHorizontalScroll(pendingSliderValueRef.current);
    });
  }, [writeHorizontalScroll]);

  const endSliderDrag = useCallback(() => {
    isSliderDraggingRef.current = false;
    flushPendingSliderScroll();
  }, [flushPendingSliderScroll]);

  useEffect(() => {
    const rafId = requestAnimationFrame(syncHorizontalSliderState);
    return () => cancelAnimationFrame(rafId);
  }, [currentStep, skuData, colWidths, activeFields, syncHorizontalSliderState]);

  useEffect(() => {
    const handleResize = () => syncHorizontalSliderState();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentStep, syncHorizontalSliderState]);

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
      const step2Groups = new Set(
        FIELD_DEFS.filter((field) => step2Ids.includes(field.id)).map((field) => field.group),
      );
      return fields.filter(
        (field) => step2Ids.includes(field.id) || (!canonicalFieldIds.has(field.id) && step2Groups.has(field.group)),
      );
    }
    if (currentStep === 3) {
      const step3Ids = [
        'project', 'stage', 'order_no', 'prod_order', 'board_adj_qty', 'backup_unit', 'prod_yield', 'test_yield',
        'software', 'online_time', 'assembly_time', 'prod_loc', 'color', 'unit_id', 'mb_id', 'cal_file',
        'pkg_process', 'copy_mold', 'underfill', 'thermal_gel_mb', 'usb_glue', 'solder_paste', 'thermal_gel_front', 'tp_hotmelt',
        'ebom', 'ebom_desc', 'sub_bom', 'sub_bom_desc', 'lda', 'mbom', 'pbom'
      ];
      const step3Groups = new Set(
        FIELD_DEFS.filter((field) => step3Ids.includes(field.id)).map((field) => field.group),
      );
      return fields.filter(
        (field) => step3Ids.includes(field.id) || (!canonicalFieldIds.has(field.id) && step3Groups.has(field.group)),
      );
    }
    return fields;
  };

  const visibleFields = getVisibleFields();
  let basicInfoFields = visibleFields.filter(f => f.group === '基本信息');
  if (currentStep >= 3) {
    const supplierRow = { id: '__supplier__', label: '一供/二供', group: '基本信息', behavior: 'manual' as const };
    const orderIdx = basicInfoFields.findIndex(f => f.id === 'order_no');
    if (orderIdx >= 0) {
      basicInfoFields = [...basicInfoFields.slice(0, orderIdx + 1), supplierRow, ...basicInfoFields.slice(orderIdx + 1)];
    } else {
      basicInfoFields = [...basicInfoFields, supplierRow];
    }
  }
  const otherFields = visibleFields.filter(f => f.group !== '基本信息');
  const otherGroups = Array.from(new Set(otherFields.map(f => f.group)));

  const renderHorizontalSlider = () => {
    if (currentStep < 2) return null;
    return (
      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-1.5">
        <input
          type="range"
          min={0}
          max={Math.max(0, horizontalScrollMax)}
          step={8}
          value={Math.min(horizontalScrollLeft, Math.max(0, horizontalScrollMax))}
          onChange={(e) => applyHorizontalScroll(Number(e.target.value))}
          onPointerUp={endSliderDrag}
          onKeyUp={endSliderDrag}
          disabled={horizontalScrollMax <= 0}
          className="w-full accent-[#0ea5a4] disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
    );
  };

  if (currentStep === 5) {
    const step5Model = buildStep5TableModel({ activeFields, skuData });
    const totalValueCols = step5Model.columns.length;
    const step5TableWidthPx = 36 + 120 + step5Model.columns.reduce((sum, col) => sum + (colWidths[col.supplyId] ?? 160), 0);

    return (
      <div className="h-full border border-slate-200 rounded shadow-sm bg-white overflow-hidden flex flex-col">
        <div ref={step5TableRef} onScroll={syncHorizontalSliderState} className="overflow-auto flex-1">
          <table
            className="border-collapse text-[13px]"
            style={{ tableLayout: 'fixed', width: `${step5TableWidthPx}px`, minWidth: '100%' }}
          >
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 120 }} />
              {step5Model.columns.map((col) => (
                <col key={col.supplyId} style={{ width: colWidths[col.supplyId] ?? 160 }} />
              ))}
            </colgroup>
            <tbody>
              {step5Model.rows.map((row: Step5Row, rowIdx: number) => {
                if (row.kind === 'title') {
                  return (
                    <tr key={rowIdx}>
                      <td
                        colSpan={2 + totalValueCols}
                        className="bg-[#e8f5e9] font-bold text-slate-700 px-3 py-2 border border-slate-200 text-center"
                      >
                        {row.title}
                      </td>
                    </tr>
                  );
                }
                if (row.kind === 'group') {
                  return (
                    <tr key={rowIdx}>
                      <td
                        colSpan={2 + totalValueCols}
                        className="bg-[#f1f8e9] font-semibold text-slate-600 px-3 py-1.5 border border-slate-200"
                      >
                        {row.title}
                      </td>
                    </tr>
                  );
                }
                // field row
                return (
                  <tr key={rowIdx} style={{ height: rowHeights[row.fieldId] ?? 36 }}>
                    <td className="text-center text-slate-400 text-[11px] border border-slate-200 px-1">
                      {row.indexLabel}
                    </td>
                    <td className="px-3 text-slate-600 border border-slate-200 whitespace-nowrap">
                      {row.fieldLabel}
                    </td>
                    {row.cells.map((cell, ci) => (
                      <td
                        key={ci}
                        colSpan={cell.colSpan}
                        className="px-3 text-slate-700 border border-slate-200"
                      >
                        {cell.value}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderHorizontalSlider()}
      </div>
    );
  }

  const handleDragEndRows = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderFields?.(active.id.toString(), over.id.toString());
    }
  };

  const handleColResize = (id: string, delta: number) => {
    setColWidths(prev => ({
      ...prev,
      [id]: Math.max(100, (prev[id] || 140) + delta)
    }));
  };

  const handleRowResize = (id: string, delta: number) => {
    setRowHeights(prev => ({
      ...prev,
      [id]: Math.max(32, (prev[id] || 40) + delta)
    }));
  };

  const handleScroll = useCallback((source: 'top' | 'bottom') => (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (source === 'top' && bottomTableRef.current) {
      if (bottomTableRef.current.scrollLeft !== scrollLeft) {
        bottomTableRef.current.scrollLeft = scrollLeft;
      }
    } else if (source === 'bottom' && topTableRef.current) {
      if (topTableRef.current.scrollLeft !== scrollLeft) {
        topTableRef.current.scrollLeft = scrollLeft;
      }
    }
    horizontalScrollLeftRef.current = scrollLeft;
    if (!isSliderDraggingRef.current) {
      setHorizontalScrollLeft(Math.min(scrollLeft, Math.max(0, horizontalScrollMaxRef.current)));
    }
  }, []);

  const renderColGroup = () => (
    <colgroup>
      <col style={{ width: 32, minWidth: 32 }} />
      <col style={{ width: 120, minWidth: 120 }} />
      {skuData.map(sku => (
        <React.Fragment key={sku.id}>
          {sku.supplies.map(sup => (
             <col key={sup.id} style={{ width: colWidths[sup.id] || 140, minWidth: colWidths[sup.id] || 140 }} />
          ))}
        </React.Fragment>
      ))}
      <col style={{ width: 0 }} />
    </colgroup>
  );

  return (
    <div className="relative border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 bg-white/95 backdrop-blur-md overflow-hidden flex flex-col h-full min-h-0 min-w-0 transition-all duration-300">
      {currentStep >= 2 && currentStep <= 4 && (
        <div className="absolute top-3 right-3 z-[60] flex flex-col gap-2 items-end">
          {selectedSkuId && onCopySelectedSku && (
            <button
              type="button"
              data-testid="copy-selected-sku"
              onClick={onCopySelectedSku}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-blue-600 rounded-lg text-xs font-bold shadow-md hover:bg-blue-50 transition-all active:scale-95"
              title="复制选中的主板块到剪贴板（页面内）"
            >
              <Copy size={14} />
              复制选中主板块
            </button>
          )}
          {selectedSkuId && copiedSku && onPasteIntoNewSku && (
            <button
              type="button"
              data-testid="paste-into-new-sku"
              onClick={onPasteIntoNewSku}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-500 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95"
              title="在选中主板块之后插入新块并粘贴"
            >
              <ClipboardPaste size={14} />
              粘贴到新块
            </button>
          )}
        </div>
      )}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEndRows}
      >
        <div
          ref={topTableRef}
          onScroll={handleScroll('top')}
          style={{ height: BASIC_INFO_BLOCK_HEIGHT_PX }}
          className="shrink-0 z-20 shadow-sm min-w-0 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <table className="text-sm border-separate border-spacing-0" style={tableStyle}>
            {renderColGroup()}
            <thead className="bg-[#f1f5f9]">
            </thead>
            {basicInfoFields.length > 0 && (
              <tbody>
                <tr className="bg-slate-50/80 select-none">
                  <td
                    colSpan={viewport.basicInfoColSpan}
                    className="border-y border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] font-semibold text-slate-400 text-center tracking-[0.2em] uppercase relative"
                  >
                    基本信息
                  </td>
                </tr>
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
                      onUpdateSelectedSupply={onUpdateSelectedSupply}
                      skuSupplyKeys={skuSupplyKeys}
                      onDeleteRow={onDeleteRow}
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
          className="overflow-auto flex-1 min-h-0 z-0 scrollbar-thin scrollbar-thumb-slate-300 relative bg-white min-w-0"
        >
          <table className="text-sm border-separate border-spacing-0" style={tableStyle}>
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
                      <tr className="bg-slate-50/80 select-none">
                        <td
                          colSpan={viewport.bodyColSpan}
                          className="border-y border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] font-semibold text-slate-400 text-center tracking-[0.2em] uppercase relative"
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
                            onUpdateSelectedSupply={onUpdateSelectedSupply}
                            skuSupplyKeys={skuSupplyKeys}
                            onDeleteRow={onDeleteRow}
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
        {renderHorizontalSlider()}
      </DndContext>
    </div>
  );
}
