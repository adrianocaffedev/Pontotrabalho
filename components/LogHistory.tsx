import React, { useState } from 'react';
import { TimeLog, AppUser, AppSettings } from '../types';
import { Trash2, Utensils, Coffee, ArrowRight, Clock, CalendarOff, Download, Check, X, PlusCircle, Lock, Edit3, Calendar, FileText, ChevronDown, ChevronUp, CalendarRange, Filter, History } from 'lucide-react';
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
  
  // Estados para o filtro de relatório
  const [reportStart, setReportStart] = useState(() => {
    const d = new Date();
    d.setDate(1); // Primeiro dia do mês atual
    return d.toISOString().split('T')[0];
  });
  const [reportEnd, setReportEnd] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const setPresetPeriod = (type: 'thisMonth' | 'lastMonth' | 'last7') => {
    const today = new Date();
    if (type === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setReportStart(start.toISOString().split('T')[0]);
      setReportEnd(today.toISOString().split('T')[0]);
    } else if (type === 'lastMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setReportStart(start.toISOString().split('T')[0]);
      setReportEnd(end.toISOString().split('T')[0]);
    } else if (type === 'last7') {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      setReportStart(start.toISOString().split('T')[0]);
      setReportEnd(today.toISOString().split('T')[0]);
    }
  };
  
  const handleDownloadBackup = () => {
    if (logs.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const fileName = `ponto_backup_${new Date().toISOString().split('T')[0]}.json`;
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
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

  const calculateDailyValue = (log: TimeLog) => {
      if (!settings.hourlyRate) return 0;
      const ms = log.totalDurationMs;
      const rate = settings.hourlyRate;
      const totalHours = ms / 3600000;
      const isHoliday = [...(settings.holidays || []), ...systemHolidays].includes(log.date);
      const isOvertimeDay = (settings.overtimeDays || []).includes(new Date(log.date + 'T12:00:00').getDay());
      let total = 0;
      if (isHoliday || isOvertimeDay) total = totalHours * rate * 2;
      else {
          const limit = settings.dailyWorkHours || 8;
          if (totalHours <= limit) total = totalHours * rate;
          else total = (limit * rate) + (Math.min(totalHours - limit, 1) * rate * 1.25) + (Math.max(0, totalHours - limit - 1) * rate * 1.375);
      }
      return total + (calculateNightShiftMs(log) / 3600000 * rate * 0.25);
  };

  const handleExportPDF = () => {
    const filteredLogs = logs.filter(l => l.date >= reportStart && l.date <= reportEnd);
    if (filteredLogs.length === 0) { alert("Nenhum registro encontrado no período."); return; }
    const doc = new jsPDF('l', 'mm', 'a4');
    const currency = settings.currency === 'BRL' ? 'R$' : settings.currency === 'USD' ? '$' : '€';
    doc.setFontSize(18); doc.text("Relatório de Ponto", 14, 20);
    doc.setFontSize(10); doc.text(`Período: ${reportStart.split('-').reverse().join('/')} a ${reportEnd.split('-').reverse().join('/')}`, 14, 28);
    if (user) doc.text(`Funcionário: ${user.name}`, 14, 34);
    
    let totalWorked = 0, totalVal = 0;
    const rows = filteredLogs.sort((a,b) => a.date.localeCompare(b.date)).map(l => {
        totalWorked += l.totalDurationMs;
        const val = calculateDailyValue(l);
        totalVal += val;
        return [
            l.date.split('-').reverse().join('/'),
            new Date(l.startTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
            l.endTime ? new Date(l.endTime).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '---',
            calculateDurationStr(l.totalDurationMs),
            `${currency} ${val.toLocaleString('pt-BR', {minimumFractionDigits:2})}`
        ];
    });

    autoTable(doc, {
        head: [['Data', 'Entrada', 'Saída', 'Total Dia', 'Valor (Est.)']],
        body: rows,
        foot: [['TOTAIS', '', '', calculateDurationStr(totalWorked), `${currency} ${totalVal.toLocaleString('pt-BR', {minimumFractionDigits:2})}`]],
        startY: 40,
        headStyles: { fillColor: [79, 70, 229] }
    });
    doc.save(`ponto_${user?.name.replace(/\s+/g, '_')}_${reportStart}.pdf`);
    setIsReportModalOpen(false);
  };

  const reversedLogs = [...logs].reverse();
  const visibleLogs = reversedLogs.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
         <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg tracking-tight">Linha do Tempo</h3>
         <div className="flex items-center gap-2">
            <button onClick={onAddManual} className="p-2 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/60 text-slate-600 dark:text-slate-400 border border-white/40 transition-all shadow-sm"><PlusCircle size={18}/></button>
            {logs.length > 0 && (
              <>
                <button onClick={() => setIsReportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-md active:scale-95"><FileText size={16}/><span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Relatório</span></button>
                <button onClick={handleDownloadBackup} className="p-2 rounded-full bg-white/40 dark:bg-white/5 text-slate-400 hover:text-indigo-500 border border-white/40 transition-all shadow-sm"><Download size={18}/></button>
              </>
            )}
         </div>
      </div>

      <div className="space-y-4">
        {visibleLogs.length === 0 ? (
          <div className="text-center py-20 bg-white/30 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <Clock size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-slate-500 font-medium">Sem registros</p>
          </div>
        ) : (
          visibleLogs.map((log) => (
            <div key={log.id} className={`group relative rounded-3xl p-4 sm:p-6 border transition-all duration-300 flex flex-col gap-4 backdrop-blur-md ${log.id === currentLogId ? 'bg-white/60 dark:bg-slate-800/60 border-indigo-200 dark:border-indigo-500/30 shadow-lg' : 'bg-white/40 dark:bg-slate-900/40 border-white/50 dark:border-white/5'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-600"><Calendar size={20}/></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.date.split('-').reverse().join('/')}</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white">{new Date(log.startTime).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})} - {log.endTime ? new Date(log.endTime).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : '...'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl text-sm border border-white/50">{calculateDurationStr(log.totalDurationMs)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(log)} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"><Edit3 size={18}/></button>
                    <button onClick={() => { if(confirm("Excluir registro?")) onDelete(log.id); }} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {logs.length > visibleCount && (
        <button onClick={() => setVisibleCount(v => v + ITEMS_PER_PAGE)} className="w-full py-3 rounded-2xl bg-white/20 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest border border-white/20 hover:bg-white/30 transition-all">Ver mais registros</button>
      )}

      {/* Modal de Exportação do Relatório Refinado */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 dark:border-slate-800 animate-in zoom-in-95">
             <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-rose-500 rounded-xl shadow-lg shadow-rose-500/20 text-white">
                      <FileText size={20} />
                   </div>
                   <h3 className="font-bold text-slate-800 dark:text-slate-100">Relatório Periódico</h3>
                </div>
                <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-all">
                  <X size={20} />
                </button>
             </div>
             
             <div className="p-6 space-y-6">
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => setPresetPeriod('last7')} className="py-2 px-1 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all">7 Dias</button>
                    <button onClick={() => setPresetPeriod('thisMonth')} className="py-2 px-1 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all">Este Mês</button>
                    <button onClick={() => setPresetPeriod('lastMonth')} className="py-2 px-1 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all">Mês Pass.</button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block flex items-center gap-2"><CalendarRange size={12}/> Início do Período</label>
                    <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 dark:[color-scheme:dark] transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block flex items-center gap-2"><CalendarRange size={12}/> Término do Período</label>
                    <input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/20 dark:[color-scheme:dark] transition-all" />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                   <button onClick={handleExportPDF} className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold transition-all shadow-xl shadow-rose-500/20 active:scale-95 flex items-center justify-center gap-3">
                     <Download size={20} /> Gerar PDF Detalhado
                   </button>
                   <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">O documento incluirá horas extras e valores estimados</p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogHistory;