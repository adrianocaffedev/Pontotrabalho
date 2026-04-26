import React, { useState } from 'react';
import { TimeLog, AppUser, AppSettings, Absence } from '../types';
import { Trash2, Utensils, Coffee, ArrowRight, Clock, CalendarOff, Download, Check, X, PlusCircle, Lock, Edit3, Calendar, FileText, ChevronDown, ChevronUp, CalendarRange, Filter, History, CalendarDays, MessageSquare } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTranslation, TranslationKey } from '../services/translations';

interface LogHistoryProps {
  logs: TimeLog[];
  standaloneAbsences: Absence[];
  user?: AppUser | null;
  settings: AppSettings;
  systemHolidays: string[];
  onDelete: (id: string) => void;
  onEdit: (log: TimeLog) => void;
  onAddManual: () => void;
  onOpenReports: () => void;
  currentLogId: string | null;
}

const ITEMS_PER_PAGE = 3;

const LogHistory: React.FC<LogHistoryProps> = ({ logs, standaloneAbsences, user, settings, systemHolidays, onDelete, onEdit, onAddManual, onOpenReports, currentLogId }) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const t = (key: TranslationKey) => getTranslation(settings.language || 'pt-PT', key);
  
  const calculateDurationStr = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const reversedLogs = [...logs].reverse();
  
  // Combine logs and standalone absences for a unified view
  const combinedHistory = [
    ...logs.map(l => ({ ...l, entryType: 'log' as const })),
    ...standaloneAbsences.map(a => ({ ...a, entryType: 'justification' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const visibleHistory = combinedHistory.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
         <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg tracking-tight">{t('label_timeline')}</h3>
         <div className="flex items-center gap-2">
            <button onClick={onAddManual} className="p-2.5 rounded-xl bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border border-white/40 dark:border-white/10 transition-all shadow-sm active:scale-90"><PlusCircle size={20}/></button>
            {logs.length > 0 && (
              <>
                <button onClick={onOpenReports} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 group"><CalendarDays size={18} className="group-hover:rotate-12 transition-transform" /><span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">{t('label_reports_portal')}</span></button>
                <button onClick={() => { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2)); const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", `ponto_backup_${new Date().toISOString().split('T')[0]}.json`); dl.click(); }} className="p-2.5 rounded-xl bg-white/40 dark:bg-white/5 text-slate-400 hover:text-indigo-500 border border-white/40 transition-all active:scale-90"><Download size={20}/></button>
              </>
            )}
         </div>
      </div>

      <div className="space-y-4">
        {visibleHistory.length === 0 ? (
          <div className="text-center py-24 bg-white/30 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 shadow-inner"><Clock size={32} className="text-slate-300 dark:text-slate-600" /></div>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">{t('label_no_logs')}</p>
          </div>
        ) : (
          visibleHistory.map((entry) => (
            entry.entryType === 'log' ? (
              <div key={entry.id} className={`group relative rounded-2xl p-5 sm:p-7 border transition-all duration-300 flex flex-col gap-5 backdrop-blur-md overflow-hidden ${entry.id === currentLogId ? 'bg-white/70 dark:bg-slate-800/70 border-indigo-200 dark:border-indigo-500/30 shadow-xl' : 'bg-white/40 dark:bg-slate-900/40 border-white/60 dark:border-white/5'}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className={`p-3.5 rounded-xl shadow-sm border transition-colors ${entry.id === currentLogId ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white/80 dark:bg-slate-800/80 text-indigo-500 dark:text-indigo-400 border-white dark:border-slate-700'}`}><Calendar size={22}/></div>
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{entry.date.split('-').reverse().join('/')}</p><p className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">{new Date(entry.startTime).toLocaleTimeString(settings.language === 'en' ? 'en-US' : 'pt-PT', {hour:'2-digit',minute:'2-digit'})} <ArrowRight size={14} className="opacity-30" />{entry.endTime ? new Date(entry.endTime).toLocaleTimeString(settings.language === 'en' ? 'en-US' : 'pt-PT', {hour:'2-digit',minute:'2-digit'}) : <span className="text-indigo-500 animate-pulse italic">{t('label_open')}</span>}</p></div>
                  </div>
                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex flex-col items-end"><span className="font-mono font-black text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800/60 px-4 py-2 rounded-xl text-base border border-white/60 dark:border-slate-700/50 shadow-sm">{calculateDurationStr(entry.totalDurationMs)}</span><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 mr-1">{t('label_total_time')}</p></div>
                    <div className="flex gap-2"><button onClick={() => onEdit(entry as any)} className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-white transition-all shadow-sm"><Edit3 size={18}/></button><button onClick={() => { if(confirm("Excluir este registro permanentemente?")) onDelete(entry.id); }} className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-white transition-all shadow-sm"><Trash2 size={18}/></button></div>
                  </div>
                </div>
                {entry.absences && entry.absences.length > 0 && (
                   <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      {entry.absences.map(a => (
                         <div key={a.id} className="flex flex-col gap-2 p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={12} className="text-rose-400" />
                                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">{t('settings_justifications')}: {a.type === 'ABSENCE' ? t('label_absence') : a.type === 'DELAY' ? t('label_delay') : a.type}</span>
                                </div>
                                {a.startTime && a.endTime && <span className="text-[10px] font-mono text-slate-400 italic">{a.startTime} - {a.endTime}</span>}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{a.reason}"</p>
                         </div>
                      ))}
                   </div>
                )}
              </div>
            ) : (
                <div key={entry.id} className="group relative rounded-2xl p-5 sm:p-7 border transition-all duration-300 flex flex-col gap-4 backdrop-blur-md overflow-hidden bg-rose-50/30 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-3.5 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/20"><CalendarOff size={22}/></div>
                            <div>
                                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">{entry.date.split('-').reverse().join('/')}</p>
                                <p className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                    {entry.type === 'ABSENCE' ? t('label_justified_absence') : t('label_justified_delay')}
                                </p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/30 font-bold text-[10px] uppercase tracking-widest ${entry.type === 'ABSENCE' ? 'text-rose-500' : 'text-amber-500'}`}>
                            {entry.type === 'ABSENCE' ? t('label_full_day') : t('label_late_entry')}
                        </div>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-xl border border-white dark:border-slate-700 italic">
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">"{entry.reason}"</p>
                    </div>
                    {entry.type === 'DELAY' && entry.startTime && entry.endTime && (
                         <div className="flex gap-6 px-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase"><Clock size={12}/> {t('label_expected')}: <span className="text-slate-700 dark:text-white">{entry.startTime}</span></div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase"><Clock size={12}/> {t('label_arrival')}: <span className="text-slate-700 dark:text-white">{entry.endTime}</span></div>
                         </div>
                    )}
                </div>
            )
          ))
        )}
      </div>

      {(logs.length + standaloneAbsences.length) > visibleCount && (<button onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} className="w-full py-4 rounded-2xl bg-white/40 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] border border-white/60 dark:border-white/10 hover:bg-white/60 transition-all active:scale-[0.98] shadow-sm">{t('btn_show_more')}</button>)}
    </div>
  );
};

export default LogHistory;