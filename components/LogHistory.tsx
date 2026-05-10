import React, { useState, useMemo, useCallback } from 'react';
import { TimeLog, AppUser, AppSettings, Absence } from '../types';
import { Trash2, ArrowRight, Clock, CalendarOff, Download, PlusCircle, Edit3, Calendar, CalendarDays, MessageSquare } from 'lucide-react';
import { getTranslation, TranslationKey } from '../services/translations';
import { getHolidayByDate, getHolidayColorClasses } from '../services/holidayService';

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
  todayDate?: string;
}

const ITEMS_PER_PAGE = 3;

const LogHistory: React.FC<LogHistoryProps> = ({ logs, standaloneAbsences, user, settings, systemHolidays, onDelete, onEdit, onAddManual, onOpenReports, currentLogId, todayDate }) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [showConfigId, setShowConfigId] = useState<string | null>(null);

  const t = useCallback((key: TranslationKey) => getTranslation(settings.language || 'pt-PT', key), [settings.language]);
  
  // Combine logs and standalone absences for a unified view with pre-calculated values
  const combinedHistory = useMemo(() => [
    ...logs.map(l => {
      const holidayInfo = getHolidayByDate(l.date);
      const isHoliday = [...(settings.holidays || []), ...systemHolidays].includes(l.date) || !!holidayInfo;
      const holidayColors = holidayInfo ? getHolidayColorClasses(holidayInfo.type) : getHolidayColorClasses('FACULTATIVE');
      
      const ms = l.totalDurationMs;
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      
      return { 
        ...l, 
        entryType: 'log' as const,
        isHoliday,
        holidayInfo,
        holidayColors,
        durationStr: `${hours}h ${minutes}m`
      };
    }),
    ...standaloneAbsences.map(a => ({ ...a, entryType: 'justification' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [logs, standaloneAbsences, settings.holidays, systemHolidays]);

  const visibleHistory = useMemo(() => combinedHistory.slice(0, visibleCount), [combinedHistory, visibleCount]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
         <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg tracking-tight">{t('label_timeline')}</h3>
         <div className="flex items-center gap-2">
            <button onClick={onAddManual} className="p-2.5 rounded-lg bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border border-white/40 dark:border-white/10 transition-all shadow-sm active:scale-90"><PlusCircle size={20}/></button>
            {logs.length > 0 && (
              <>
                <button onClick={onOpenReports} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 group"><CalendarDays size={18} className="group-hover:rotate-12 transition-transform" /><span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">{t('label_reports_portal')}</span></button>
                <button onClick={() => { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2)); const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", `ponto_backup_${new Date().toISOString().split('T')[0]}.json`); dl.click(); }} className="p-2.5 rounded-lg bg-white/40 dark:bg-white/5 text-slate-400 hover:text-emerald-500 border border-white/40 transition-all active:scale-90"><Download size={20}/></button>
              </>
            )}
         </div>
      </div>

      <div className="space-y-4">
        {visibleHistory.length === 0 ? (
          <div className="text-center py-24 bg-white/30 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-xl flex items-center justify-center mb-4 shadow-inner"><Clock size={32} className="text-slate-300 dark:text-slate-600" /></div>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">{t('label_no_logs')}</p>
          </div>
        ) : (
          visibleHistory.map((entry) => {
            const isLog = entry.entryType === 'log';
            const logEntry = isLog ? (entry as any) : null;
            const isHoliday = isLog && logEntry.isHoliday;
            const holidayInfo = isLog ? logEntry.holidayInfo : undefined;
            const holidayColors = isLog ? logEntry.holidayColors : undefined;
            
            const isToday = entry.date === todayDate;

            return isLog ? (
              <div 
                key={entry.id} 
                className={`group relative rounded-xl p-5 sm:p-7 border transition-all duration-300 flex flex-col gap-5 backdrop-blur-md overflow-hidden 
                  ${isToday
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-300/50 dark:border-emerald-500/40 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20' 
                    : entry.id === currentLogId 
                      ? 'bg-white/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30 shadow-xl shadow-emerald-500/5' 
                      : isHoliday 
                        ? `${holidayColors?.bg} ${holidayColors?.border} ${holidayColors?.shadow}`
                        : 'bg-white/40 dark:bg-slate-900/40 border-white/60 dark:border-white/5 shadow-sm'}`}
              >
                {/* Visual indicator for today */}
                {isToday && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 animate-pulse"></div>
                )}

                {/* Holiday Decorative Element */}
                {isHoliday && (
                  <div className={`absolute -right-4 -top-4 w-24 h-24 ${holidayColors?.dot} opacity-10 blur-2xl rounded-full pointer-events-none`}></div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className={`p-3.5 rounded-lg shadow-sm border transition-colors 
                      ${isToday
                        ? 'bg-emerald-600 text-white border-emerald-500 ring-4 ring-emerald-500/10'
                        : entry.id === currentLogId 
                          ? 'bg-emerald-500 text-white border-emerald-400' 
                          : isHoliday
                            ? `${holidayColors?.iconBg} text-white border-white/20 shadow-md`
                            : 'bg-white/80 dark:bg-slate-800/50 text-emerald-500 dark:text-emerald-400 border-white dark:border-white/10'}`}
                    >
                      {isHoliday ? <CalendarDays size={22}/> : <Calendar size={22}/>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? 'text-emerald-600 dark:text-emerald-400' : isHoliday ? holidayColors?.text : 'text-slate-400'}`}>
                          {entry.date.split('-').reverse().join('/')}
                        </p>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[8px] font-black tracking-tighter uppercase border border-emerald-200 dark:border-emerald-500/30">
                            {t('label_today')}
                          </span>
                        )}
                        {isHoliday && (
                          <span className={`px-1.5 py-0.5 rounded-md ${holidayColors?.badge} text-[8px] font-black tracking-tighter uppercase border`}>
                            {holidayInfo ? holidayInfo.name : t('label_holiday')}
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                        {new Date((entry as TimeLog).startTime).toLocaleTimeString(settings.language === 'en' ? 'en-US' : 'pt-PT', {hour:'2-digit',minute:'2-digit'})} 
                        <ArrowRight size={14} className="opacity-30" />
                        {(entry as TimeLog).endTime 
                          ? new Date((entry as TimeLog).endTime!).toLocaleTimeString(settings.language === 'en' ? 'en-US' : 'pt-PT', {hour:'2-digit',minute:'2-digit'}) 
                          : <span className="text-emerald-500 animate-pulse italic">{t('label_open')}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex flex-col items-end">
                      <span className={`font-mono font-black px-4 py-2 rounded-lg text-base border shadow-sm 
                         ${isToday
                          ? 'text-emerald-700 dark:text-emerald-300 bg-white/80 dark:bg-emerald-900/40 border-emerald-200/50 dark:border-emerald-700/50'
                          : isHoliday 
                            ? `${holidayColors?.text} bg-white/60 dark:bg-slate-800/60 ${holidayColors?.border}` 
                            : 'text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800/60 border-white/60 dark:border-slate-700/50'}`}
                      >
                        {logEntry.durationStr}
                      </span>
                      <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 mr-1 ${isToday ? 'text-emerald-500' : isHoliday ? holidayColors?.text : 'text-slate-400'}`}>
                        {t('label_total_time')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowConfigId(showConfigId === entry.id ? null : entry.id)} 
                        className={`p-3 rounded-lg transition-all shadow-sm ${showConfigId === entry.id ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}
                        title={t('btn_view_config')}
                      >
                        <Clock size={18} />
                      </button>
                      <button onClick={() => onEdit(entry as any)} className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-white transition-all shadow-sm">
                        <Edit3 size={18}/>
                      </button>
                      <button onClick={() => { if(confirm("Excluir este registro permanentemente?")) onDelete(entry.id); }} className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white transition-all shadow-sm">
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline config display */}
                {showConfigId === entry.id && (
                  <div className="pt-6 border-t border-emerald-100 dark:border-emerald-900/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">{t('label_goal')}</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{settings.dailyWorkHours}h {t('label_worked')}</p>
                      </div>
                      <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-1">{t('label_shift')}</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{settings.shiftStart} — {settings.shiftEnd}</p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-emerald-50/30 dark:bg-emerald-900/10">
                            <th className="px-4 py-2 text-[8px] font-black uppercase tracking-wider text-emerald-600/70">{t('settings_general')}</th>
                            <th className="px-4 py-2 text-[8px] font-black uppercase tracking-wider text-emerald-600/70 text-right">{t('label_recorded')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-100/50 dark:divide-emerald-900/30">
                          {/* Entrada */}
                          <tr>
                            <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{t('label_entry')}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                              {new Date((entry as TimeLog).startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                          
                          {/* Todas as Pausas (Almoço e Café) */}
                          {(entry as TimeLog).breaks.map((brk: any) => (
                            <React.Fragment key={brk.id}>
                              <tr>
                                <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                  {brk.type === 'LUNCH' ? t('status_lunch') : t('status_coffee')} (↑)
                                </td>
                                <td className="px-4 py-2.5 font-mono font-bold text-amber-600 dark:text-amber-400 text-right">
                                  {new Date(brk.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                              <tr>
                                <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter pl-6">
                                  {t('label_return')}
                                </td>
                                <td className="px-4 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right border-l-0">
                                  {brk.endTime 
                                    ? new Date(brk.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : '--:--'}
                                </td>
                              </tr>
                            </React.Fragment>
                          ))}

                          {/* Saída */}
                          <tr>
                            <td className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{t('label_exit')}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                              {(entry as TimeLog).endTime 
                                ? new Date((entry as TimeLog).endTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : <span className="animate-pulse italic opacity-50">{t('label_open')}</span>}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(entry as TimeLog).absences && (entry as TimeLog).absences.length > 0 && (
                   <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 relative z-10">
                      {(entry as TimeLog).absences.map((a: any) => (
                         <div key={a.id} className="flex flex-col gap-2 p-3 bg-rose-500/5 rounded-lg border border-rose-500/10">
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
                <div key={entry.id} className="group relative rounded-xl p-5 sm:p-7 border transition-all duration-300 flex flex-col gap-4 backdrop-blur-md overflow-hidden bg-rose-50/30 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="p-3.5 rounded-lg bg-rose-500 text-white shadow-lg shadow-rose-500/20"><CalendarOff size={22}/></div>
                            <div>
                                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">{entry.date.split('-').reverse().join('/')}</p>
                                <p className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                    {(entry as Absence).type === 'ABSENCE' ? t('label_justified_absence') : t('label_justified_delay')}
                                </p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/30 font-bold text-[10px] uppercase tracking-widest ${(entry as Absence).type === 'ABSENCE' ? 'text-rose-500' : 'text-amber-500'}`}>
                            {(entry as Absence).type === 'ABSENCE' ? t('label_full_day') : t('label_late_entry')}
                        </div>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg border border-white dark:border-slate-700 italic">
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">"{(entry as Absence).reason}"</p>
                    </div>
                    {(entry as Absence).type === 'DELAY' && (entry as Absence).startTime && (entry as Absence).endTime && (
                         <div className="flex gap-6 px-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase"><Clock size={12}/> {t('label_expected')}: <span className="text-slate-700 dark:text-white">{(entry as Absence).startTime}</span></div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase"><Clock size={12}/> {t('label_arrival')}: <span className="text-slate-700 dark:text-white">{(entry as Absence).endTime}</span></div>
                         </div>
                    )}
                </div>
            );
          })
        )}
      </div>

      {(logs.length + standaloneAbsences.length) > visibleCount && (<button onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} className="w-full py-4 rounded-xl bg-white/40 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] border border-white/60 dark:border-white/10 hover:bg-white/60 transition-all active:scale-[0.98] shadow-sm">{t('btn_show_more')}</button>)}
    </div>
  );
};

export default LogHistory;