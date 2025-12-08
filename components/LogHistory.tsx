
import React, { useState } from 'react';
import { TimeLog } from '../types';
import { Trash2, Utensils, Coffee, ArrowRight, Clock, CalendarOff, Download, Check, X, PlusCircle, Lock } from 'lucide-react';

interface LogHistoryProps {
  logs: TimeLog[];
  onDelete: (id: string) => void;
  onAddManual: () => void;
  currentLogId: string | null;
}

const LogHistory: React.FC<LogHistoryProps> = ({ logs, onDelete, onAddManual, currentLogId }) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const handleDownloadBackup = () => {
    if (logs.length === 0) return;
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `ponto_backup_${dateStr}.json`;
    
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2 mb-2">
         <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg sm:text-xl tracking-tight">Linha do Tempo</h3>
         
         <div className="flex items-center gap-2">
            <button
                onClick={onAddManual}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 active:scale-95 border border-white/40 dark:border-white/10 backdrop-blur-sm group cursor-pointer shadow-sm"
                title="Adicionar registro manual"
            >
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide hidden sm:inline group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Adicionar</span>
                <PlusCircle size={16} strokeWidth={2.5} />
            </button>
            
            {logs.length > 0 && (
              <>
                <button
                    onClick={handleDownloadBackup}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 active:scale-95 border border-white/40 dark:border-white/10 backdrop-blur-sm group cursor-pointer shadow-sm"
                    title="Baixar backup (.json)"
                >
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide hidden sm:inline group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Backup</span>
                    <Download size={16} strokeWidth={2} />
                </button>
              </>
            )}
         </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-20 opacity-60 flex flex-col items-center justify-center bg-white/30 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 backdrop-blur-sm">
          <div className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 shadow-sm border border-white dark:border-slate-700 transition-colors">
              <Clock size={24} className="text-slate-400 dark:text-slate-500" />
          </div>
          <p className="font-medium text-slate-500 dark:text-slate-400">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.slice().reverse().map((log, index) => {
            const isCurrentLog = log.id === currentLogId;

            return (
            <div 
                key={log.id} 
                className={`group relative rounded-3xl p-4 sm:p-6 border transition-all duration-500 flex flex-col gap-4 overflow-hidden animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards
                    ${isCurrentLog 
                        ? 'bg-white/60 dark:bg-slate-800/60 border-indigo-200 dark:border-indigo-500/30 shadow-lg shadow-indigo-500/10 backdrop-blur-xl' 
                        : 'bg-white/40 dark:bg-slate-900/40 border-white/50 dark:border-white/5 hover:bg-white/60 dark:hover:bg-slate-800/40 hover:border-white/80 dark:hover:border-slate-700 hover:shadow-lg hover:-translate-y-1 backdrop-blur-md'
                    }`}
                style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Active Indicator Strip */}
              {isCurrentLog && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-400 to-violet-500"></div>
              )}
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 relative z-10 pl-2">
                  {/* Time Section */}
                  <div className="flex items-center gap-4 sm:gap-6 min-w-auto sm:min-w-[150px] w-full sm:w-auto justify-between sm:justify-start">
                      <div>
                          <div className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tighter leading-none transition-colors">
                              {formatTime(log.startTime)}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1 sm:mt-1.5">Entrada</div>
                      </div>
                      <div className="h-8 sm:h-10 w-[1px] bg-slate-200 dark:bg-slate-700/50"></div>
                      <div>
                          <div className={`text-2xl sm:text-3xl font-bold tracking-tighter leading-none ${log.endTime ? 'text-slate-800 dark:text-slate-100' : 'text-indigo-500 dark:text-indigo-400 animate-pulse'}`}>
                              {log.endTime ? formatTime(log.endTime) : '...'}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1 sm:mt-1.5">Saída</div>
                      </div>
                  </div>

                  {/* Breaks Section */}
                  <div className="flex-1 flex flex-wrap gap-2 w-full sm:w-auto">
                      {log.breaks && log.breaks.length > 0 ? (
                          log.breaks.map((brk, idx) => (
                              <div key={idx} className={`flex items-center gap-2 text-xs font-semibold py-1.5 px-3 rounded-xl border shadow-sm transition-colors backdrop-blur-sm
                              ${brk.type === 'COFFEE' 
                                  ? 'bg-teal-50/40 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 border-teal-100/50 dark:border-teal-800/30' 
                                  : 'bg-amber-50/40 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100/50 dark:border-amber-800/30'}`}>
                                  {brk.type === 'COFFEE' ? <Coffee size={12} strokeWidth={2.5}/> : <Utensils size={12} strokeWidth={2.5}/>}
                                  <span>
                                      {formatTime(brk.startTime)} <ArrowRight size={10} className="inline opacity-40"/> {formatTime(brk.endTime)}
                                  </span>
                              </div>
                          ))
                      ) : (
                          <div className="px-3 py-1.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/50 w-full sm:w-auto text-center sm:text-left">
                             <span className="text-slate-400 dark:text-slate-600 text-xs font-medium">Sem pausas</span>
                          </div>
                      )}
                  </div>

                  {/* Duration & Actions */}
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end sm:border-l border-slate-100 dark:border-slate-700/50 sm:pl-6 pt-2 sm:pt-0 relative z-20">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 px-4 py-2 rounded-xl text-sm border border-white/60 dark:border-slate-600/30 shadow-sm">
                          {calculateDuration(log.totalDurationMs)}
                      </span>

                      {/* Lógica de Exclusão Inline */}
                      {deleteId === log.id && !isCurrentLog ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200 absolute right-0 sm:relative bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-xl border border-rose-100 dark:border-rose-900/50 z-50">
                           <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(log.id);
                                  setDeleteId(null);
                              }}
                              className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 active:scale-95 transition-all shadow-sm"
                              title="Confirmar exclusão"
                           >
                              <Check size={16} strokeWidth={3} />
                           </button>
                           <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteId(null);
                              }}
                              className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
                              title="Cancelar"
                           >
                              <X size={16} strokeWidth={3} />
                           </button>
                        </div>
                      ) : (
                        <button 
                            type="button"
                            disabled={isCurrentLog}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isCurrentLog) {
                                  setDeleteId(log.id);
                                }
                            }}
                            className={`relative z-30 p-2.5 rounded-xl transition-all duration-300
                              ${isCurrentLog 
                                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50'
                                : 'text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md active:scale-90'
                              }`
                            }
                        >
                            {isCurrentLog ? <Lock size={18} /> : <Trash2 size={18} />}
                        </button>
                      )}
                  </div>
              </div>

              {/* Absences Section */}
              {log.absences && log.absences.length > 0 && (
                  <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/30 flex flex-col gap-2 relative z-10 transition-colors pl-2">
                      {log.absences.map((abs, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-rose-50/40 dark:bg-rose-900/10 p-2.5 rounded-xl border border-rose-100/60 dark:border-rose-900/30 text-sm text-rose-800 dark:text-rose-300 backdrop-blur-sm">
                               <div className="p-1.5 bg-rose-100/50 dark:bg-rose-900/50 rounded-lg shrink-0">
                                  <CalendarOff size={14} className="text-rose-600 dark:text-rose-400" />
                               </div>
                               <div className="flex flex-col">
                                  <span className="font-bold text-[10px] uppercase tracking-wide text-rose-600/70 dark:text-rose-400/70">
                                      {abs.type === 'FULL_DAY' ? 'Ausência (Dia Todo)' : `Ausência (${abs.startTime} - ${abs.endTime})`}
                                  </span>
                                  <span className="font-medium leading-tight">{abs.reason}</span>
                               </div>
                          </div>
                      ))}
                  </div>
              )}

            </div>
          )})}
        </div>
      )}
    </div>
  );
};

export default LogHistory;
