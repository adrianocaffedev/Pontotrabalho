
import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Users, Clock, ArrowRight, Download, Filter, TrendingUp, DollarSign, Calculator, Briefcase, FileText, ChevronRight, ChevronLeft, Search, Loader2, CalendarOff, CalendarRange } from 'lucide-react';
import { AppSettings, AppUser, TimeLog, Absence } from '../types';
import { supabase } from '../services/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsPortalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: AppUser | null;
    isAdmin: boolean;
}

const ReportsPortal: React.FC<ReportsPortalProps> = ({ isOpen, onClose, currentUser, isAdmin }) => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [absences, setAbsences] = useState<any[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [settingsMap, setSettingsMap] = useState<Record<string, AppSettings>>({});
    
    // Filtros
    const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || '');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // Início do mês atual
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
    });

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            if (currentUser && !isAdmin) {
                setSelectedUserId(currentUser.id);
            }
        }
    }, [isOpen, isAdmin, currentUser]);

    useEffect(() => {
        if (isOpen && selectedUserId) {
            fetchData();
        }
    }, [isOpen, selectedUserId, startDate, endDate]);

    const fetchUsers = async () => {
        const { data } = await supabase.from('app_users').select('*').order('name');
        if (data) {
            setUsers(data.map((u: any) => ({
                id: u.id,
                name: u.name,
                company: u.company,
                pin: u.pin,
                active: u.active
            })));
        }
    };

    const fetchData = async () => {
        if (!selectedUserId) return;
        setLoading(true);
        try {
            // Fetch logs for period
            const { data: logsData } = await supabase
                .from('time_logs')
                .select(`*, breaks (*)`)
                .eq('user_id', selectedUserId)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: true });

            // Fetch absences for period
            const { data: absencesData } = await supabase
                .from('absences')
                .select('*')
                .eq('user_id', selectedUserId)
                .gte('date', startDate)
                .lte('date', endDate);

            // Fetch user specific settings
            const { data: settsData } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', selectedUserId)
                .single();

            setLogs(logsData || []);
            setAbsences(absencesData || []);
            
            if (settsData) {
                setSettingsMap({
                    [selectedUserId]: {
                        dailyWorkHours: Number(settsData.daily_work_hours),
                        lunchDurationMinutes: Number(settsData.lunch_duration_minutes),
                        coffeeDurationMinutes: Number(settsData.coffee_duration_minutes) || 15,
                        notificationMinutes: Number(settsData.notification_minutes),
                        hourlyRate: Number(settsData.hourly_rate),
                        foodAllowance: Number(settsData.food_allowance),
                        currency: settsData.currency,
                        overtimePercentage: Number(settsData.overtime_percentage),
                        overtimeDays: settsData.overtime_days || [],
                        socialSecurityRate: Number(settsData.social_security_rate),
                        irsRate: Number(settsData.irs_rate),
                        holidays: settsData.holidays || []
                    }
                });
            }
        } catch (error) {
            console.error("Erro ao buscar dados do relatório:", error);
        } finally {
            setLoading(false);
        }
    };

    const reportStats = useMemo(() => {
        const userSettings = settingsMap[selectedUserId];
        if (!userSettings) return null;

        let totalDurationMs = 0;
        let totalExtraMs = 0;
        let daysWorked = logs.length;
        let lunchAllowanceTotal = 0;

        logs.forEach(log => {
            totalDurationMs += Number(log.total_duration_ms);
            
            // Cálculo de horas extras (simplificado para o relatório)
            const expectedMs = userSettings.dailyWorkHours * 3600000;
            if (log.total_duration_ms > expectedMs) {
                totalExtraMs += (log.total_duration_ms - expectedMs);
            }
            
            // Subsídio de almoço (se trabalhou no dia)
            if (log.total_duration_ms > 0) {
                lunchAllowanceTotal += userSettings.foodAllowance;
            }
        });

        const totalHours = totalDurationMs / 3600000;
        const totalExtraHours = totalExtraMs / 3600000;
        
        const basePay = totalHours * userSettings.hourlyRate;
        const extraPay = totalExtraHours * (userSettings.hourlyRate * (userSettings.overtimePercentage / 100));
        const bruteTotal = basePay + extraPay + lunchAllowanceTotal;
        
        const ssDiscount = (basePay + extraPay) * (userSettings.socialSecurityRate / 100);
        const irsDiscount = (basePay + extraPay) * (userSettings.irsRate / 100);
        const netTotal = bruteTotal - ssDiscount - irsDiscount;

        return {
            totalHours,
            totalExtraHours,
            daysWorked,
            bruteTotal,
            netTotal,
            ssDiscount,
            irsDiscount,
            lunchAllowanceTotal
        };
    }, [logs, settingsMap, selectedUserId]);

    const setPresetPeriod = (type: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth') => {
        const today = new Date();
        const start = new Date();
        const end = new Date();

        switch (type) {
            case 'today':
                setStartDate(today.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
                break;
            case 'thisWeek':
                const day = today.getDay();
                start.setDate(today.getDate() - day);
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
                break;
            case 'thisMonth':
                start.setDate(1);
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
                break;
            case 'lastMonth':
                start.setMonth(today.getMonth() - 1);
                start.setDate(1);
                end.setDate(0);
                setStartDate(start.toISOString().split('T')[0]);
                setEndDate(end.toISOString().split('T')[0]);
                break;
        }
    };

    const handleExportPDF = () => {
        if (logs.length === 0) { alert("Nenhum registro para exportar."); return; }
        
        const doc = new jsPDF('p', 'mm', 'a4');
        const user = users.find(u => u.id === selectedUserId);
        const settings = settingsMap[selectedUserId];
        const cur = settings?.currency === 'BRL' ? 'R$' : '€';

        doc.setFontSize(20);
        doc.setTextColor(79, 70, 229);
        doc.text("Ponto Inteligente - Relatório de Atividades", 14, 20);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Colaborador: ${user?.name || 'N/D'} | Empresa: ${user?.company || 'N/D'}`, 14, 28);
        doc.text(`Período: ${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`, 14, 33);
        
        const rows = logs.map(l => {
            const duration = (Number(l.total_duration_ms) / 3600000).toFixed(1) + 'h';
            const lunch = l.breaks?.find((b:any) => b.type === 'LUNCH');
            const lunchStr = lunch ? `${new Date(lunch.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${lunch.end_time ? new Date(lunch.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}` : '---';
            
            return [
                l.date.split('-').reverse().join('/'),
                new Date(l.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                lunchStr,
                l.end_time ? new Date(l.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Aberto',
                duration
            ];
        });

        autoTable(doc, {
            head: [['Data', 'Entrada', 'Intervalo Almoço', 'Saída', 'Total']],
            body: rows,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            styles: { fontSize: 8 }
        });

        const finalY = (doc as any).lastAutoTable.cursor.y + 10;
        doc.text(`Total de Horas: ${reportStats?.totalHours.toFixed(1)}h`, 14, finalY);
        doc.text(`Expectativa de Recebimento Líquido: ${cur} ${reportStats?.netTotal.toFixed(2)}`, 14, finalY + 5);

        doc.save(`Relatorio_${user?.name.replace(/\s+/g, '_')}_${startDate}.pdf`);
    };

    if (!isOpen) return null;

    const currency = settingsMap[selectedUserId]?.currency === 'BRL' ? 'R$' : 'EUR';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-[#0f172a] w-full max-w-5xl h-full sm:h-[90vh] sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <TrendingUp size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Portal de Relatórios</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Análise de Desempenho e Financeiro</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Filters Row */}
                <div className="px-6 py-5 bg-slate-900/30 border-b border-white/5 space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                        {isAdmin && (
                            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Colaborador</label>
                                <div className="relative">
                                    <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select 
                                        value={selectedUserId} 
                                        onChange={(e) => setSelectedUserId(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                                    >
                                        <option value="">Selecione...</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5 min-w-[150px]">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Data Início</label>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-white rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all w-full [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5 min-w-[150px]">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Data Fim</label>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 text-white rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all w-full [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        <div className="pt-5">
                            <button 
                                onClick={fetchData}
                                disabled={loading || !selectedUserId}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:grayscale"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                                {/* <span className="hidden lg:inline">Atualizar</span> */}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] whitespace-nowrap mr-2">Filtros Rápidos:</span>
                        <button onClick={() => setPresetPeriod('today')} className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-indigo-500 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">Hoje</button>
                        <button onClick={() => setPresetPeriod('thisWeek')} className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-indigo-500 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">Esta Semana</button>
                        <button onClick={() => setPresetPeriod('thisMonth')} className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-indigo-500 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">Mês Atual</button>
                        <button onClick={() => setPresetPeriod('lastMonth')} className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-indigo-500 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">Mês Passado</button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Processando dados...</p>
                        </div>
                    ) : !selectedUserId ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 rounded-[2rem] border border-dashed border-slate-800">
                             <Users size={48} className="text-slate-700 mb-4" />
                             <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhum funcionário selecionado</p>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* Stats Summary Bento Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/5 p-6 rounded-3xl border border-indigo-500/10">
                                    <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                        <Clock size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Horas Totais</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{reportStats?.totalHours.toFixed(1)}h</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Estimado para o período</p>
                                </div>

                                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 p-6 rounded-3xl border border-emerald-500/10">
                                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                        <TrendingUp size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Remuneração Base</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{currency} {(reportStats?.bruteTotal ?? 0).toFixed(2)}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Bruto sem descontos</p>
                                </div>

                                <div className="bg-gradient-to-br from-rose-500/20 to-rose-600/5 p-6 rounded-3xl border border-rose-500/10">
                                    <div className="flex items-center gap-2 text-rose-400 mb-2">
                                        <Calculator size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Descontos</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{currency} {((reportStats?.ssDiscount ?? 0) + (reportStats?.irsDiscount ?? 0)).toFixed(2)}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Seg. Social + IRS</p>
                                </div>

                                <div className="bg-indigo-600 p-6 rounded-3xl border border-indigo-400/20 shadow-xl shadow-indigo-600/20">
                                    <div className="flex items-center gap-2 text-indigo-100 mb-2">
                                        <DollarSign size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Recebimento Líquido</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{currency} {(reportStats?.netTotal ?? 0).toFixed(2)}</p>
                                    <p className="text-[10px] text-indigo-200 mt-1">Valor final a receber</p>
                                </div>
                            </div>

                            {/* Details Table */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <FileText size={14} className="text-slate-500" /> Detalhamento Diário
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold text-slate-400 border border-slate-700">{logs.length} Dias Registrados</span>
                                    </div>
                                </div>

                                <div className="bg-slate-900 shadow-2xl rounded-[2.5rem] border border-white/5 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/5">
                                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entrada</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Almoço</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saída</th>
                                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Total Real</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {logs.map((log: any) => {
                                                    const lunchBreak = log.breaks?.find((b: any) => b.type === 'LUNCH');
                                                    const duration = Number(log.total_duration_ms) / 3600000;
                                                    
                                                    return (
                                                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-white">{new Date(log.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}</span>
                                                                    <span className="text-[10px] text-slate-500 font-medium uppercase">{new Date(log.date).toLocaleDateString('pt-BR', {weekday:'short'})}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2 text-indigo-400 font-mono text-sm font-bold">
                                                                    <Clock size={12} className="opacity-40" />
                                                                    {new Date(log.start_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                {lunchBreak ? (
                                                                    <div className="flex items-center gap-1.5 text-orange-400 font-mono text-xs font-bold">
                                                                        {new Date(lunchBreak.start_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                                                                        <span className="opacity-30">→</span>
                                                                        {lunchBreak.end_time ? new Date(lunchBreak.end_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Nenhum</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2 text-teal-400 font-mono text-sm font-bold">
                                                                    <Clock size={12} className="opacity-40" />
                                                                    {log.end_time ? new Date(log.end_time).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : 'Em aberto'}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-800 text-white font-mono text-xs font-black border border-white/5">
                                                                    {duration.toFixed(1)}h
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {logs.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-10 text-center text-slate-500 font-bold text-[10px] uppercase tracking-widest italic">Nenhum registro encontrado no período</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                             {/* Absences Section */}
                             {absences.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-rose-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <CalendarOff size={14} className="text-rose-500" /> Justificativas e Ocorrências
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {absences.map(abs => (
                                            <div key={abs.id} className="p-5 bg-rose-500/5 rounded-[1.8rem] border border-rose-500/10 flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
                                                    <CalendarOff size={18} className="text-rose-400" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{new Date(abs.date).toLocaleDateString('pt-BR')}</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-[8px] font-extrabold text-rose-400 uppercase tracking-widest">{abs.type === 'ABSENCE' ? 'Falta' : 'Atraso'}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 font-medium leading-relaxed italic">"{abs.reason}"</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-6 bg-slate-900 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 italic">
                        <Calculator size={14} className="text-indigo-400" /> Valores baseados nas taxas atuais de SS ({settingsMap[selectedUserId]?.socialSecurityRate}%) e IRS ({settingsMap[selectedUserId]?.irsRate}%)
                    </p>
                    <button 
                        onClick={handleExportPDF}
                        disabled={loading || logs.length === 0}
                        className="w-full sm:w-auto px-8 py-3 bg-white text-slate-950 rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <Download size={18} /> Exportar Relatório PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportsPortal;
