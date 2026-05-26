import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Clock, Calendar, Search, FileCheck, FileCode, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { HistoryEntry } from '../types';
import { cn } from '../lib/utils';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onLoad: (item: HistoryEntry) => void;
  onCopy: (item: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

export function HistoryModal({ isOpen, onClose, history, onLoad, onCopy, onDelete }: HistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredHistory = useMemo(() => {
    return history.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [history, searchTerm]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const currentData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredHistory, currentPage]);

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-xl shadow-2xl z-[101] overflow-hidden flex flex-col h-[85vh]"
          >
            <div className="flex items-center justify-between p-4 border-b bg-gray-50/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-2">
                <Clock className="text-blue-500" size={20} />
                <h2 className="text-lg font-bold">试产历史记录</h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b bg-white shrink-0">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="仅支持搜索项目名称..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-400 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {currentData.length === 0 ? (
                <div className="text-center py-20 text-gray-400 h-full flex flex-col items-center justify-center">
                  <div className="flex justify-center mb-4 text-gray-200">
                    <FileCode size={64} />
                  </div>
                  <p className="font-bold">{searchTerm ? '未找到相关项目记录' : '暂无试产记录'}</p>
                </div>
              ) : (
                currentData.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md hover:bg-blue-50/20 transition-all group flex items-center justify-between cursor-pointer"
                    onClick={() => onLoad(item)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-black text-[15px] text-gray-900 truncate">
                          {item.name}
                        </h3>
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] font-black rounded uppercase">
                          <Tag size={10} />
                          V{item.version || 1}
                        </span>
                        {item.isArchived ? (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">
                            <FileCheck size={10} />
                            已完成
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">
                            草稿
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[12px] text-gray-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[11px] uppercase font-black text-gray-600">
                          停留步骤 {item.currentStep}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-2">
                       {item.isArchived && (
                         <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopy(item);
                          }}
                          className="px-4 py-2 text-[13px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 shadow-sm rounded-lg transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 whitespace-nowrap"
                         >
                          复制为新项目
                         </button>
                       )}
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoad(item);
                        }}
                        className="px-4 py-2 text-[13px] font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 whitespace-nowrap"
                      >
                        加载此记录
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if(window.confirm('确定要删除这笔记录吗？')) {
                             onDelete(item.id);
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除记录"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                 <span className="text-[12px] text-gray-500 font-bold">
                   共 {filteredHistory.length} 条记录
                 </span>
                 {totalPages > 1 && (
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                       disabled={currentPage === 1}
                       className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                     >
                       <ChevronLeft size={16} />
                     </button>
                     <span className="text-[12px] font-bold text-gray-600">
                       {currentPage} / {totalPages}
                     </span>
                     <button
                       onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                       disabled={currentPage === totalPages}
                       className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                     >
                       <ChevronRight size={16} />
                     </button>
                   </div>
                 )}
              </div>
              
              <button 
                onClick={onClose}
                className="px-6 py-2 bg-white border border-gray-300 rounded text-[13px] font-bold shadow-sm hover:bg-gray-100 transition-all active:scale-95"
              >
                关闭界面
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
