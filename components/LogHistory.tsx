import React, { useState } from 'react';
import { TimeLog, AppUser, AppSettings } from '../types';
import { Trash2, Utensils, Coffee, ArrowRight, Clock, CalendarOff, Download, Check, X, PlusCircle, Lock, Edit3, Calendar, FileText, ChevronDown, ChevronUp, CalendarRange, Filter, History, CalendarDays } from 'lucide-react';
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
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  const [reportStart, setReportStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [reportEnd, setReportEnd] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const setPresetPeriod = (type: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'last7') => {
    const today = new Date();
    const start = new Date();
    const end = new Date();

    switch (type) {
      case 'today':
        setReportStart(today.toISOString().split('T')[0]);
        setReportEnd(today.toISOString().split('T')[0]);
        break;
      case 'thisWeek':
        const day = today.getDay();
        start.setDate(today.getDate() - day);
        setReportStart(start.toISOString().split('T')[0]);
        setReportEnd(today.toISOString().split('T')[0]);
        break;
      case 'thisMonth':
        start.setDate(1);
        setReportStart(start.toISOString().split('T')[0]);
        setReportEnd(today.toISOString().split('T')[0]);
        break;
      case 'lastMonth':
        start.setMonth(today.getMonth() - 1);
        start.setDate(1);
        end.setDate(0);
        setReportStart(start.toISOString().split('T')[0]);
        setReportEnd(end.toISOString().split('T')[0]);
        break;
      case 'last7':
        start.setDate(today.getDate() - 7);
        setReportStart(start.toISOString().split('T')[0]);
        setReportEnd(today.toISOString().split('T')[0]);
        break;
    }
  };
  
  const calculateDurationStr = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const calculateNightShiftMs = (log: TimeLog) => {
    if (!log.startTime) return 0;
    const start = new Date(log.startTime);
    const end = log.endTime ? new Date(log.endTime) : new Date();
    const getOverlap = (s1: number, e1: number, s2: number, e2: number) => Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
    let nightMs = 0;
    const sTime = start.getTime();
    const eTime = end.getTime();
    const currentScanner = new Date(start);
    currentScanner.setDate(currentScanner.getDate() - 1);
    for (let i = 0; i < 3; i++) {
        const wStart = new Date(currentScanner); wStart.setHours(22, 0, 0, 0);
        const wEnd = new Date(currentScanner); wEnd.setDate(wEnd.getDate() + 1); wEnd.setHours(7, 0, 0, 0);
        const intersection = getOverlap(sTime, eTime, wStart.getTime(), wEnd.getTime());
        if (intersection > 0) {
            let effective = intersection;
            log.breaks.forEach(b => { if(b.type === 'LUNCH') effective -= getOverlap(new Date(b.startTime).getTime(), b.endTime ? new Date(b.endTime).getTime() : Date.now(), Math.max(sTime, wStart.getTime()), Math.min(eTime, wEnd.getTime())); });
            nightMs += Math.max(0, effective);
        }
        currentScanner.setDate(currentScanner.getDate() + 1);
    }
    return nightMs;
  };

  const getPeriodForDate = (dateStr: string, startDay: number) => {
    const d = new Date(dateStr + 'T12:00:00');
    let year = d.getFullYear();
    let month = d.getMonth();
    const day = d.getDate();

    if (day < startDay) {
      month--;
      if (month < 0) {
        month = 11;
        year--;
      }
    }

    const startDate = new Date(year, month, startDay);
    const endDate = new Date(year, month + 1, startDay - 1);

    const formatDate = (date: Date) => {
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    };

    return `${formatDate(startDate)} a ${formatDate(endDate)}`;
  };


  const handleExportPDF = () => {
    const filteredLogs = logs.filter(l => l.date >= reportStart && l.date <= reportEnd);
    if (filteredLogs.length === 0) { alert("Nenhum registro encontrado no período."); return; }
    
    const doc = new jsPDF('l', 'mm', 'a4');
    const currency = settings.currency === 'BRL' ? 'R$' : settings.currency === 'USD' ? '$' : '€';
    
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text("Ponto Inteligente - Extrato de Jornada", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Período: ${reportStart.split('-').reverse().join('/')} até ${reportEnd.split('-').reverse().join('/')}`, 14, 28);
    if (user) doc.text(`Colaborador: ${user.name} | Empresa: ${user.company || 'N/A'}`, 14, 34);
    
    let totalWorkedMs = 0, totalVal = 0, totalExtraMs = 0, totalExtraVal = 0;
    const rate = settings.hourlyRate || 0;
    const dailyLimitHours = settings.dailyWorkHours || 8;

    const rows = filteredLogs.sort((a,b) => a.date.localeCompare(b.date)).map(l => {
        const workedMs = l.totalDurationMs;
        const totalHours = workedMs / 3600000;
        const isHoliday = [...(settings.holidays || []), ...systemHolidays].includes(l.date);
        const isOvertimeDay = (settings.overtimeDays || []).includes(new Date(l.date + 'T12:00:00').getDay());
        
        let dailyTotalVal = 0;
        let dailyExtraMs = 0;
        let dailyExtraVal = 0;

        // Se for feriado ou folga configurada, todas as horas são extras a 100%
        if (isHoliday || isOvertimeDay) {
            dailyExtraMs = workedMs;
            dailyExtraVal = totalHours * rate * 2;
            dailyTotalVal = dailyExtraVal;
        } else {
            // Horas extras: realizadas antes ou depois da jornada de 8h
            const extraHours = Math.max(0, totalHours - dailyLimitHours);
            dailyExtraMs = extraHours * 3600000;
            
            const normalVal = Math.min(totalHours, dailyLimitHours) * rate;
            const overtime1 = Math.min(extraHours, 1) * rate * 1.25;
            const overtimeRemaining = Math.max(0, extraHours - 1) * rate * 1.375;
            
            dailyExtraVal = overtime1 + overtimeRemaining;
            dailyTotalVal = normalVal + dailyExtraVal;
        }

        // Adicional noturno é somado ao ganho extra
        const nightMs = calculateNightShiftMs(l);
        const nightBonus = (nightMs / 3600000) * rate * 0.25;
        dailyTotalVal += nightBonus;
        dailyExtraVal += nightBonus; 

        totalWorkedMs += workedMs;
        totalVal += dailyTotalVal;
        totalExtraMs += dailyExtraMs;
        totalExtraVal += dailyExtraVal;

        return [
            l.date.split('-').reverse().join('/'),
            new Date(l.startTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
            l.endTime ? new Date(l.endTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '---',
            calculateDurationStr(workedMs),
            calculateDurationStr(dailyExtraMs),
            `${currency} ${dailyExtraVal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
            `${currency} ${dailyTotalVal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`
        ];
    });

    autoTable(doc, {
        head: [['Data', 'Entrada', 'Saída', 'Total Dia', 'Horas Extras', 'Ganhos Extras', 'Total Geral']],
        body: rows,
        foot: [[
            'RESUMO TOTAIS', 
            '', 
            '', 
            calculateDurationStr(totalWorkedMs), 
            calculateDurationStr(totalExtraMs), 
            `${currency} ${totalExtraVal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, 
            `${currency} ${totalVal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`
        ]],
        startY: 42,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          5: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] }, // Azul para destaque de extras
          6: { halign: 'right', fontStyle: 'bold' }
        }
    });

    doc.save(`relatorio_horas_extras_${user?.name.replace(/\s+/g, '_')}_${reportStart}.pdf`);
    setIsReportModalOpen(false);
  };

  const reversedLogs = [...logs].reverse();
  const visibleLogs = reversedLogs.slice(0, visibleCount);

  // Group visible logs by period
  const groupedLogs: { [period: string]: TimeLog[] } = {};
  visibleLogs.forEach(log => {
    const period = getPeriodForDate(log.date, settings.periodStartDay || 1);
    if (!groupedLogs[period]) groupedLogs[period] = [];
    groupedLogs[period].push(log);
  });

  const periods = Object.keys(groupedLogs);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const currentPeriodStr = getPeriodForDate(todayStr, settings.periodStartDay || 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
         <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg tracking-tight">Linha do Tempo</h3>
         <div className="flex items-center gap-2">
            <button onClick={onAddManual} className="p-2.5 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border border-white/40 dark:border-white/10 transition-all shadow-sm active:scale-90"><PlusCircle size={20}/></button>
            {logs.length > 0 && (
              <>
                <button onClick={() => setIsReportModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 group"><CalendarDays size={18} className="group-hover:rotate-12 transition-transform" /><span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Gerar Relatório</span></button>
                <button onClick={() => { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2)); const dl = document.createElement('a'); dl.setAttribute("href", dataStr); dl.setAttribute("download", `ponto_backup_${new Date().toISOString().split('T')[0]}.json`); dl.click(); }} className="p-2.5 rounded-full bg-white/40 dark:bg-white/5 text-slate-400 hover:text-indigo-500 border border-white/40 transition-all active:scale-90"><Download size={20}/></button>
              </>
            )}
         </div>
      </div>

      <div className="space-y-8">
        {visibleLogs.length === 0 ? (
          <div className="text-center py-24 bg-white/30 dark:bg-slate-900/30 rounded-[2.5rem] border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 shadow-inner"><Clock size={32} className="text-slate-300 dark:text-slate-600" /></div>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sem registros de jornada</p>
          </div>
        ) : (
          periods.map((period, index) => (
            <div key={period} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                  {period === currentPeriodStr ? 'Período Atual' : 'Período Arquivado'} ({period})
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
              </div>
              <div className="space-y-4">
                {groupedLogs[period].map((log) => (
                  <div key={log.id} className={`group relative rounded-[2.5rem] p-5 sm:p-7 border transition-all duration-300 flex flex-col gap-5 backdrop-blur-md overflow-hidden ${log.id === currentLogId ? 'bg-white/70 dark:bg-slate-800/70 border-indigo-200 dark:border-indigo-500/30 shadow-xl' : 'bg-white/40 dark:bg-slate-900/40 border-white/60 dark:border-white/5'}`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <div className={`p-3.5 rounded-2xl shadow-sm border transition-colors ${log.id === currentLogId ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white/80 dark:bg-slate-800/80 text-indigo-500 dark:text-indigo-400 border-white dark:border-slate-700'}`}><Calendar size={22}/></div>
                        <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{log.date.split('-').reverse().join('/')}</p><p className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">{new Date(log.startTime).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} <ArrowRight size={14} className="opacity-30" />{log.endTime ? new Date(log.endTime).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : <span className="text-indigo-500 animate-pulse italic">Em Aberto</span>}</p></div>
                      </div>
                      <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="flex flex-col items-end"><span className="font-mono font-black text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800/60 px-4 py-2 rounded-2xl text-base border border-white/60 dark:border-slate-700/50 shadow-sm">{calculateDurationStr(log.totalDurationMs)}</span><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 mr-1">Tempo Total</p></div>
                        <div className="flex gap-2"><button onClick={() => onEdit(log)} className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-white transition-all shadow-sm"><Edit3 size={18}/></button><button onClick={() => { if(confirm("Excluir este registro permanentemente?")) onDelete(log.id); }} className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-white transition-all shadow-sm"><Trash2 size={18}/></button></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {logs.length > visibleCount && (<button onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} className="w-full py-4 rounded-[1.8rem] bg-white/40 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] border border-white/60 dark:border-white/10 hover:bg-white/60 transition-all active:scale-[0.98] shadow-sm">Ver Histórico Anterior</button>)}

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 dark:border-slate-800 animate-in zoom-in-95 duration-300">
             <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white"><FileText size={20} /></div><div><h3 className="font-bold text-slate-800 dark:text-slate-100">Relatório de Extras</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Selecione o período</p></div></div>
                <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-2.5 rounded-full transition-all"><X size={20} /></button>
             </div>
             <div className="p-8 space-y-8">
                <div className="space-y-3">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">Atalhos Rápidos</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setPresetPeriod('today')} className="py-2.5 px-2 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Hoje</button>
                        <button onClick={() => setPresetPeriod('thisWeek')} className="py-2.5 px-2 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Esta Semana</button>
                        <button onClick={() => setPresetPeriod('thisMonth')} className="py-2.5 px-2 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Mês Atual</button>
                        <button onClick={() => setPresetPeriod('lastMonth')} className="py-2.5 px-2 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">Mês Passado</button>
                    </div>
                </div>
                <div className="space-y-5">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2 px-1"><CalendarRange size={12} className="text-indigo-500" /> Data Inicial</label><input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 dark:[color-scheme:dark] transition-all" /></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2 px-1"><CalendarRange size={12} className="text-indigo-500" /> Data Final</label><input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 dark:[color-scheme:dark] transition-all" /></div>
                </div>
                <div className="pt-2">
                   <button onClick={handleExportPDF} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.8rem] font-bold text-base transition-all shadow-xl shadow-indigo-500/30 active:scale-95 flex items-center justify-center gap-3"><Download size={22} /> Exportar em PDF</button>
                   <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/10"><p className="text-[9px] text-center text-indigo-600/80 dark:text-indigo-400/80 font-bold uppercase tracking-widest leading-relaxed">O relatório foca nas Horas Extras realizadas fora da jornada de {settings.dailyWorkHours}h e nos ganhos financeiros correspondentes.</p></div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogHistory;