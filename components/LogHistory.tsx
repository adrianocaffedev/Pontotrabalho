
import React, { useState } from 'react';
import { TimeLog, AppUser, AppSettings } from '../types';
import { Trash2, Utensils, Coffee, ArrowRight, Clock, CalendarOff, Download, Check, X, PlusCircle, Lock, Edit3, Calendar, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LogHistoryProps {
  logs: TimeLog[];
  user?: AppUser | null;
  settings: AppSettings;
  systemHolidays: string[];
  onDelete: (id: string) => void;
  onEdit: (log: TimeLog) => void;
  onAddManual: () => void;
  currentLogId: string | null;
}

const ITEMS_PER_PAGE = 3;

const LogHistory: React.FC<LogHistoryProps> = ({ logs, user, settings, systemHolidays, onDelete, onEdit, onAddManual, currentLogId }) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  
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

  // Helper para calcular horas noturnas (Duplicado do App.tsx para isolamento)
  const calculateNightShiftMs = (log: TimeLog) => {
    if (!log.startTime) return 0;
    const start = new Date(log.startTime);
    const end = log.endTime ? new Date(log.endTime) : new Date();

    const getOverlap = (start1: number, end1: number, start2: number, end2: number) => {
        const maxStart = Math.max(start1, start2);
        const minEnd = Math.min(end1, end2);
        return Math.max(0, minEnd - maxStart);
    };

    let nightMs = 0;
    const sTime = start.getTime();
    const eTime = end.getTime();

    const windows = [];
    const currentScanner = new Date(start);
    currentScanner.setDate(currentScanner.getDate() - 1);
    const endScanner = new Date(end);
    endScanner.setDate(endScanner.getDate() + 1);

    while (currentScanner <= endScanner) {
        const wStart = new Date(currentScanner);
        wStart.setHours(22, 0, 0, 0);
        
        const wEnd = new Date(currentScanner);
        wEnd.setDate(wEnd.getDate() + 1);
        wEnd.setHours(7, 0, 0, 0);
        
        windows.push({ start: wStart.getTime(), end: wEnd.getTime() });
        currentScanner.setDate(currentScanner.getDate() + 1);
    }

    windows.forEach(win => {
        const intersection = getOverlap(sTime, eTime, win.start, win.end);
        
        if (intersection > 0) {
            let effectiveNightWork = intersection;
            const overlapStart = Math.max(sTime, win.start);
            const overlapEnd = Math.min(eTime, win.end);

            log.breaks.forEach(brk => {
                if (brk.type === 'LUNCH') {
                     const bStart = new Date(brk.startTime).getTime();
                     const bEnd = brk.endTime ? new Date(brk.endTime).getTime() : new Date().getTime();
                     const breakInNight = getOverlap(bStart, bEnd, overlapStart, overlapEnd);
                     effectiveNightWork -= breakInNight;
                }
            });

            nightMs += Math.max(0, effectiveNightWork);
        }
    });

    return nightMs;
  };

  const calculateDailyValue = (log: TimeLog) => {
      if (!settings.hourlyRate) return 0;

      const ms = log.totalDurationMs;
      const nightMs = calculateNightShiftMs(log);
      
      const totalHours = ms / (1000 * 60 * 60);
      const nightHoursDecimal = nightMs / (1000 * 60 * 60);
      const rate = settings.hourlyRate;
      
      const allHolidays = [...(settings.holidays || []), ...systemHolidays];
      const isHoliday = allHolidays.includes(log.date);
      
      const logDayOfWeek = new Date(log.date + 'T12:00:00').getDay();
      const isOvertimeDay = (settings.overtimeDays || []).includes(logDayOfWeek);
      
      let totalEarnings = 0;

      // REGRAS:
      // Fim de Semana/Feriado: 100% (Dobro)
      // Dia Útil: 1ª Hora Extra +25%, Restante +37.5%
      // Adicional Noturno: +25% ACUMULATIVO sobre todas as horas noturnas

      if (isHoliday || isOvertimeDay) {
          totalEarnings = totalHours * rate * 2;
      } else {
          const dailyLimit = settings.dailyWorkHours || 8;
          if (totalHours <= dailyLimit) {
              totalEarnings = totalHours * rate;
          } else {
              const normalEarnings = dailyLimit * rate;
              const extraHoursTotal = totalHours - dailyLimit;
              
              const firstExtraHour = Math.min(extraHoursTotal, 1);
              const remainingExtraHours = Math.max(0, extraHoursTotal - 1);
              
              const earningsFirstExtra = firstExtraHour * rate * 1.25;
              const earningsRemainingExtra = remainingExtraHours * rate * 1.375;
              
              totalEarnings = normalEarnings + earningsFirstExtra + earningsRemainingExtra;
          }
      }

      // Adicional Noturno (Acumulativo)
      // +25% da hora base para qualquer hora trabalhada entre 22h e 07h
      const nightBonus = nightHoursDecimal * rate * 0.25;
      
      const finalValue = totalEarnings + nightBonus;

      // Vale Refeição NÃO é somado aqui.

      return finalValue;
  };

  const handleExportPDF = () => {
    if (logs.length === 0) return;

    const doc = new jsPDF();
    const currency = settings.currency === 'BRL' ? 'R$' : settings.currency === 'USD' ? '$' : '€';
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text("Relatório de Ponto", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString('pt-BR');
    doc.text(`Data de Emissão: ${dateStr}`, 14, 28);
    
    if (user) {
        doc.text(`Funcionário: ${user.name}`, 14, 33);
    }

    // Data Processing for Table
    const sortedLogs = [...logs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    const allHolidays = [...(settings.holidays || []), ...systemHolidays];

    const tableRows = sortedLogs.map(log => {
        const dateObj = new Date(log.startTime);
        const dayDate = dateObj.toLocaleDateString('pt-BR');
        const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase();
        
        const startTime = new Date(log.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const endTime = log.endTime ? new Date(log.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---';
        
        // Duration
        const hours = Math.floor(log.totalDurationMs / (1000 * 60 * 60));
        const minutes = Math.floor((log.totalDurationMs % (1000 * 60 * 60)) / (1000 * 60));
        const duration = `${hours}h ${minutes}m`;

        // Breaks
        const breaks = log.breaks.map(b => {
            const bStart = new Date(b.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const bEnd = b.endTime ? new Date(b.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '?';
            const type = b.type === 'LUNCH' ? 'Alm' : 'Caf';
            return `${type}: ${bStart}-${bEnd}`;
        }).join('\n');
        
        // Contexto Financeiro para Explicação
        const isHoliday = allHolidays.includes(log.date);
        const logDayOfWeek = new Date(log.date + 'T12:00:00').getDay();
        const isOvertimeDay = (settings.overtimeDays || []).includes(logDayOfWeek);
        const nightMs = calculateNightShiftMs(log);
        const hasNightShift = nightMs > 0;
        const hasWork = log.totalDurationMs > 0;

        // Value Calculation
        const dailyValue = calculateDailyValue(log);
        const valueFormatted = `${currency} ${dailyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        // Notes / Absences / Financial Explanation
        const absenceNotes = log.absences.map(a => `[${a.type === 'FULL_DAY' ? 'FALTA' : 'PARCIAL'}] ${a.reason}`);
        
        const financialNotes = [];
        if (isHoliday) financialNotes.push("Feriado (100%)");
        else if (isOvertimeDay) financialNotes.push("Dia Extra (100%)");
        
        if (hasNightShift) financialNotes.push("Adic. Noturno");
        
        if (settings.foodAllowance > 0 && hasWork) {
            // Apenas informamos o VR, não somamos no valor da hora
            financialNotes.push(`VR: ${currency} ${settings.foodAllowance}`);
        }

        const allNotes = [...financialNotes, ...absenceNotes].join(', ');

        return [
            `${dayDate}\n${weekDay}`,
            startTime,
            endTime,
            breaks,
            duration,
            valueFormatted,
            allNotes
        ];
    });

    autoTable(doc, {
        head: [['Data', 'Entrada', 'Saída', 'Pausas', 'Total', 'Valor (Est.)', 'Obs']],
        body: tableRows,
        startY: 40,
        styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 22 },
            3: { cellWidth: 35 },
            5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
            6: { cellWidth: 'auto' }
        },
        alternateRowStyles: { fillColor: [245, 247, 255] }
    });

    doc.save(`relatorio_ponto_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const str = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const calculateDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Logic for "Show More"
  const reversedLogs = [...logs].reverse();
  const visibleLogs = reversedLogs.slice(0, visibleCount);
  const hasMore = reversedLogs.length > visibleCount;

  const handleShowMore = () => {
      setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  const handleShowLess = () => {
      setVisibleCount(ITEMS_PER_PAGE);
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
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-300 active:scale-95 border border-white/40 dark:border-white/10 backdrop-blur-sm group cursor-pointer shadow-sm"
                    title="Exportar PDF"
                >
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide hidden sm:inline group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">PDF</span>
                    <FileText size={16} strokeWidth={2} />
                </button>

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
          {visibleLogs.map((log, index) => {
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
                  {/* Time Section with Date */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                      {/* Date Badge */}
                      <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-indigo-500/80 dark:text-indigo-400/80" />
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              {formatDate(log.date)}
                          </span>
                      </div>

                      <div className="flex items-center gap-4 sm:gap-6 min-w-auto sm:min-w-[150px] justify-between sm:justify-start">
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

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-1">
                        {/* Botão Editar */}
                        <button
                            type="button"
                            disabled={isCurrentLog}
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit(log);
                            }}
                            className={`p-2 rounded-xl transition-all duration-300
                              ${isCurrentLog
                                ? 'hidden'
                                : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md active:scale-90'
                              }`
                            }
                            title="Editar registro"
                        >
                            <Edit3 size={18} />
                        </button>

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
                                className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
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
                              className={`relative z-30 p-2 rounded-xl transition-all duration-300
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
          
          {/* Pagination Controls */}
          {(hasMore || visibleCount > ITEMS_PER_PAGE) && (
             <div className="flex items-center justify-center gap-2 pt-2 animate-in fade-in">
                 {hasMore && (
                     <button
                        onClick={handleShowMore}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wide border border-white/40 dark:border-white/5 transition-all active:scale-95 shadow-sm"
                     >
                        <ChevronDown size={14} />
                        Carregar Mais Antigos
                     </button>
                 )}
                 {visibleCount > ITEMS_PER_PAGE && (
                     <button
                        onClick={handleShowLess}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wide border border-white/40 dark:border-white/5 transition-all active:scale-95"
                     >
                        <ChevronUp size={14} />
                        Mostrar Menos
                     </button>
                 )}
             </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LogHistory;
