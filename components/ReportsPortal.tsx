
import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Users, Clock, ArrowRight, Download, Filter, TrendingUp, DollarSign, Calculator, Briefcase, FileText, ChevronRight, ChevronLeft, Search, Loader2, CalendarOff, CalendarRange, Files, ShieldAlert, Utensils, Package, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { AppSettings, AppUser, TimeLog, Absence } from '../types';
import { supabase } from '../services/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getTranslation, TranslationKey } from '../services/translations';
import { getHolidayByDate, getHolidayColorClasses } from '../services/holidayService';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    PieChart, 
    Pie, 
    Cell,
    LineChart,
    Line,
    AreaChart,
    Area
} from 'recharts';

interface ReportsPortalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: AppUser | null;
    isAdmin: boolean;
    systemHolidays: string[];
}

const ReportsPortal: React.FC<ReportsPortalProps> = ({ isOpen, onClose, currentUser, isAdmin, systemHolidays }) => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [absences, setAbsences] = useState<any[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [settingsMap, setSettingsMap] = useState<Record<string, AppSettings>>({});
    const [activeTab, setActiveTab] = useState<'ponto' | 'producao'>('ponto');
    
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
                active: u.active,
                contractType: u.contract_type // Adicionado para identificar regime temporário
            })));
        }
    };

    /**
     * Calcula dias úteis (Segunda a Sexta) em um determinado mês/ano
     */
    const getBusinessDaysInMonth = (dateStr: string) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = date.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        let businessDays = 0;
        for (let i = 1; i <= lastDay; i++) {
            const d = new Date(year, month, i);
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                businessDays++;
            }
        }
        return businessDays;
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
                        language: settsData.language || 'pt-PT',
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
        const userSettings = settingsMap[selectedUserId] || { dailyWorkHours: 8, hourlyRate: 0, foodAllowance: 0, overtimePercentage: 25, socialSecurityRate: 11, irsRate: 0, language: 'pt-PT', currency: 'EUR', overtimeDays: [0, 6] };
        const user = users.find(u => u.id === selectedUserId);
        if (!userSettings && !user) return null;

        // Rounding helper to ensure consistency
        const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

        let totalDurationMs = 0;
        let totalBasePay = 0;
        let totalExtraMs = 0;
        let totalExtraPay = 0;
        let daysWorkedCount = logs.length;
        let lunchAllowanceTotalResult = 0;

        logs.forEach(log => {
            const logDurationMs = Number(log.total_duration_ms) || 0;
            totalDurationMs += logDurationMs;
            
            const logDate = new Date(log.date + 'T12:00:00'); // Force midday to avoid TZ issues
            const dayOfWeek = logDate.getDay();
            const holidayInfo = getHolidayByDate(log.date);
            const isHoliday = [...(userSettings.holidays || []), ...systemHolidays].includes(log.date) || !!holidayInfo;
            const isOvertimeDay = (userSettings.overtimeDays || []).includes(dayOfWeek);
            
            const hours = logDurationMs / 3600000;
            const expectedMs = (userSettings.dailyWorkHours || 8) * 3600000;

            // 1. Base Pay Calculation
            if (isHoliday || isOvertimeDay) {
                // Days like Sundays or Holidays usually pay 100% extra in many PT contracts (effectively x2)
                // Or follow a specific overtime rule. Here we treat them as fully extra or special.
                const dayPay = hours * (userSettings.hourlyRate * 2);
                totalBasePay += dayPay;
            } else {
                totalBasePay += hours * userSettings.hourlyRate;
                
                // 2. Daily Overtime (Only on regular days, as special days are already x2)
                if (logDurationMs > expectedMs) {
                    const extraMs = logDurationMs - expectedMs;
                    totalExtraMs += extraMs;
                    const extraHours = extraMs / 3600000;
                    // Overtime pay is the EXTRA percentage on top of the already paid base
                    totalExtraPay += extraHours * (userSettings.hourlyRate * (userSettings.overtimePercentage / 100));
                }
            }
            
            // 3. Lunch Allowance
            if (logDurationMs > 0) {
                lunchAllowanceTotalResult += (userSettings.foodAllowance || 0);
            }
        });

        const totalHours = totalDurationMs / 3600000;
        const totalExtraHours = totalExtraMs / 3600000;
        
        const isTemporary = user?.contractType === 'TEMPORARY';
        let duodecimoFerias = 0;
        let duodecimoNatal = 0;
        
        const basePay = round(totalBasePay);
        const extraPay = round(totalExtraPay);
        
        if (isTemporary) {
            // Regra de Duodécimos: 1/12 do salário base + extras por cada subsídio
            duodecimoFerias = round(basePay / 12);
            duodecimoNatal = round(basePay / 12);
        }

        const totalDuodecimosBruto = round(duodecimoFerias + duodecimoNatal);
        const baseTributavel = round(basePay + extraPay + totalDuodecimosBruto);
        
        const ssDiscount = round(baseTributavel * (userSettings.socialSecurityRate / 100));
        const irsDiscount = round(baseTributavel * (userSettings.irsRate / 100));
        
        const lunchAllowanceTotal = round(lunchAllowanceTotalResult);
        const bruteTotal = round(baseTributavel); 
        const netTotal = round(baseTributavel - ssDiscount - irsDiscount); 
        const employerCost = round(baseTributavel * 1.2375 + lunchAllowanceTotal); 

        return {
            totalHours,
            totalExtraHours,
            daysWorked: daysWorkedCount,
            businessDays: getBusinessDaysInMonth(startDate),
            basePay,
            extraPay,
            duodecimoFerias,
            duodecimoNatal,
            totalDuodecimosBruto,
            baseTributavel,
            bruteTotal,
            netTotal,
            ssDiscount,
            irsDiscount,
            lunchAllowanceTotal,
            employerCost,
            isTemporary
        };
    }, [logs, settingsMap, selectedUserId, users, startDate, systemHolidays]);

    const productionStats = useMemo(() => {
        if (logs.length === 0) return null;

        const dailyData: any[] = [];
        const boxDistribution: Record<string, number> = {};
        const infeedDistribution: Record<string, number> = {};
        let totalPicking = 0;

        logs.forEach(log => {
            const picking = log.production_picking || 0;
            totalPicking += picking;

            dailyData.push({
                date: log.date.split('-').reverse().slice(0, 2).join('/'),
                picking: picking,
                fullDate: log.date
            });

            if (log.production_box) {
                boxDistribution[log.production_box] = (boxDistribution[log.production_box] || 0) + picking;
            }

            if (log.production_infeed) {
                infeedDistribution[log.production_infeed] = (infeedDistribution[log.production_infeed] || 0) + picking;
            }
        });

        const boxData = Object.entries(boxDistribution).map(([name, value]) => ({ name, value }));
        const infeedData = Object.entries(infeedDistribution).map(([name, value]) => ({ name, value }));

        return {
            dailyData,
            boxData,
            infeedData,
            totalPicking,
            avgPicking: totalPicking / logs.length
        };
    }, [logs]);

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
        if (!reportStats || logs.length === 0) { 
            const lang = settingsMap[selectedUserId]?.language || 'pt-PT';
            alert(getTranslation(lang, 'error_no_data')); 
            return; 
        }
        
        const doc = new jsPDF('p', 'mm', 'a4');
        const user = users.find(u => u.id === selectedUserId);
        const settings = settingsMap[selectedUserId];
        const lang = settings?.language || 'pt-PT';
        const t = (key: TranslationKey) => getTranslation(lang, key);
        
        const currencySymbol = settings?.currency === 'BRL' ? 'R$' : settings?.currency === 'USD' ? '$' : '€';
        const cur = currencySymbol;

        doc.setFontSize(20);
        doc.setTextColor(16, 185, 129);
        doc.text(`Ponto Inteligente - ${t('report_title')}`, 14, 20);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Colaborador: ${user?.name || 'N/D'} | Empresa: ${user?.company || 'N/D'}`, 14, 28);
        doc.text(`${t('report_period')}: ${startDate.split('-').reverse().join('/')} até ${endDate.split('-').reverse().join('/')}`, 14, 33);
        
        const logData = logs.map(l => {
            const durationMs = Number(l.total_duration_ms) || 0;
            const duration = formatDuration(durationMs / 3600000);
            const lunch = l.breaks?.find((b:any) => b.type === 'LUNCH');
            const lunchStr = lunch ? `${new Date(lunch.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${lunch.end_time ? new Date(lunch.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '...'}` : '---';
            
            const holidayInfo = getHolidayByDate(l.date);
            const isHolidayDay = [...(settings?.holidays || []), ...systemHolidays].includes(l.date) || !!holidayInfo;
            const dateStr = l.date.split('-').reverse().join('/');
            
            return [
                `${dateStr}${isHolidayDay ? ` (${holidayInfo?.name || 'F'})` : ''}`,
                new Date(l.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                lunchStr,
                l.end_time ? new Date(l.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Aberto',
                duration
            ];
        });

        autoTable(doc, {
            head: [['Data', 'Entrada', 'Intervalo Almoço', 'Saída', 'Total']],
            body: logData,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] },
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 25 },
                2: { cellWidth: 40 },
                3: { cellWidth: 25 },
                4: { cellWidth: 30, halign: 'right' }
            }
        });

        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 50;
        
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text("Resumo de Processamento:", 14, finalY);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Vencimento Base (${formatDuration(reportStats.totalHours)}):`, 14, finalY + 7);
        doc.text(`${cur} ${reportStats.basePay.toFixed(2)}`, 100, finalY + 7, { align: 'right' });
        
        if (reportStats.extraPay && reportStats.extraPay > 0) {
            doc.text(`Horas Extras (${formatDuration(reportStats.totalExtraHours)}):`, 14, finalY + 12);
            doc.text(`${cur} ${reportStats.extraPay.toFixed(2)}`, 100, finalY + 12, { align: 'right' });
        }

        let currentY = finalY + (reportStats.extraPay > 0 ? 17 : 12);

        if (reportStats.isTemporary) {
            doc.text("Duodécimo Subsídio de Férias:", 14, currentY);
            doc.text(`${cur} ${reportStats.duodecimoFerias.toFixed(2)}`, 100, currentY, { align: 'right' });
            
            doc.text("Duodécimo Subsídio de Natal:", 14, currentY + 5);
            doc.text(`${cur} ${reportStats.duodecimoNatal.toFixed(2)}`, 100, currentY + 5, { align: 'right' });
            
            currentY += 10;
        }

        doc.text(`Subsídio de Almoço (${reportStats.daysWorked} dias):`, 14, currentY);
        doc.text(`${cur} ${reportStats.lunchAllowanceTotal.toFixed(2)}`, 100, currentY, { align: 'right' });

        doc.setFontSize(9);
        doc.setTextColor(16, 185, 129);
        doc.text("Total Bruto:", 14, currentY + 7);
        doc.text(`${cur} ${reportStats.bruteTotal.toFixed(2)}`, 100, currentY + 7, { align: 'right' });

        doc.setFontSize(8);
        doc.setTextColor(225, 29, 72);
        doc.text(`Segurança Social (${settings?.socialSecurityRate || 11}%):`, 14, currentY + 14);
        doc.text(`(-) ${cur} ${reportStats.ssDiscount.toFixed(2)}`, 100, currentY + 14, { align: 'right' });
        
        doc.text(`Retenção IRS (${settings?.irsRate || 0}%):`, 14, currentY + 19);
        doc.text(`(-) ${cur} ${reportStats.irsDiscount.toFixed(2)}`, 100, currentY + 19, { align: 'right' });

        doc.setFontSize(12);
        doc.setTextColor(16, 185, 129);
        doc.text("LÍQUIDO A RECEBER:", 14, currentY + 28);
        doc.text(`${cur} ${reportStats.netTotal.toFixed(2)}`, 100, currentY + 28, { align: 'right' });

        doc.save(`Relatorio_${user?.name.replace(/\s+/g, '_') || 'Funcionario'}_${startDate}.pdf`);
    };

    const formatDuration = (hoursDecimal: number | undefined) => {
        if (!hoursDecimal && hoursDecimal !== 0) return '--h --m';
        const totalMinutes = Math.round(hoursDecimal * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    };

    if (!isOpen) return null;

    const userSettings = settingsMap[selectedUserId];
    const lang = userSettings?.language || 'pt-PT';
    const t = (key: TranslationKey) => getTranslation(lang, key);
    const currency = userSettings?.currency === 'BRL' ? 'R$' : userSettings?.currency === 'USD' ? '$' : '€';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-[#0f172a] w-full h-full sm:h-[90vh] sm:max-w-5xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden border border-white/10">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <TrendingUp size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Portal de Relatórios</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Análise de Desempenho e Financeiro</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 transition-all">
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
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none transition-all"
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
                                    className="bg-slate-800 border border-slate-700 text-white rounded-lg py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all w-full [color-scheme:dark]"
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
                                    className="bg-slate-800 border border-slate-700 text-white rounded-lg py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all w-full [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        <div className="pt-5">
                            <button 
                                onClick={fetchData}
                                disabled={loading || !selectedUserId}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:grayscale"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                                {/* <span className="hidden lg:inline">Atualizar</span> */}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] whitespace-nowrap mr-2">Filtros Rápidos:</span>
                        <button onClick={() => setPresetPeriod('today')} className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">Hoje</button>
                        <button onClick={() => setPresetPeriod('thisWeek')} className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">Esta Semana</button>
                        <button onClick={() => setPresetPeriod('thisMonth')} className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">Mês Atual</button>
                        <button onClick={() => setPresetPeriod('lastMonth')} className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-emerald-500 text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">Mês Passado</button>
                    </div>
                </div>
                <div className="px-6 py-3 bg-slate-900 border-b border-white/5 flex items-center gap-1">
                    <button 
                        onClick={() => setActiveTab('ponto')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'ponto' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                    >
                        <Clock size={14} /> Registro de Ponto
                    </button>
                    <button 
                        onClick={() => setActiveTab('producao')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'producao' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                    >
                        <Package size={14} /> Produção Diária
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">{getTranslation(settingsMap[selectedUserId]?.language || 'pt-PT', 'label_processing')}</p>
                        </div>
                    ) : !selectedUserId ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 rounded-lg border border-dashed border-slate-800">
                             <Users size={48} className="text-slate-700 mb-4" />
                             <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{getTranslation('pt-PT', 'label_no_user_selected')}</p>
                        </div>
                    ) : activeTab === 'ponto' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* Stats Summary Bento Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 p-6 rounded-lg border border-emerald-500/10">
                                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                        <Clock size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('label_total_hours')}</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{formatDuration(reportStats?.totalHours)}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">{t('report_period')}</p>
                                </div>

                                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 p-6 rounded-lg border border-emerald-500/10">
                                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                                        <TrendingUp size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('label_gross_remuneration')}</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{currency} {(reportStats?.bruteTotal ?? 0).toLocaleString(lang === 'en' ? 'en-US' : 'pt-PT', {minimumFractionDigits: 2})}</p>
                                    <p className="text-[10px] text-slate-500 mt-1 font-medium italic">Salário + Extras + Duodécimos</p>
                                </div>

                                <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 p-6 rounded-lg border border-amber-500/10">
                                    <div className="flex items-center gap-2 text-amber-500 mb-2">
                                        <Utensils size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Alimentação (Cartão)</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{currency} {(reportStats?.lunchAllowanceTotal ?? 0).toLocaleString(lang === 'en' ? 'en-US' : 'pt-PT', {minimumFractionDigits: 2})}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Benefício Isento (Pago em Cartão)</p>
                                </div>

                                <div className="bg-gradient-to-br from-rose-500/20 to-rose-600/5 p-6 rounded-lg border border-rose-500/10">
                                    <div className="flex items-center gap-2 text-rose-400 mb-2">
                                        <Calculator size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('label_total_discounts')}</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{currency} {((reportStats?.ssDiscount ?? 0) + (reportStats?.irsDiscount ?? 0)).toLocaleString(lang === 'en' ? 'en-US' : 'pt-PT', {minimumFractionDigits: 2})}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Seg. Social + IRS</p>
                                </div>

                                <div className="bg-emerald-600 p-6 rounded-lg border border-emerald-400/20 shadow-xl shadow-emerald-600/20">
                                    <div className="flex items-center gap-2 text-emerald-100 mb-2">
                                        <DollarSign size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('label_net_value')}</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{currency} {(reportStats?.netTotal ?? 0).toLocaleString(lang === 'en' ? 'en-US' : 'pt-PT', {minimumFractionDigits: 2})}</p>
                                    <p className="text-[10px] text-emerald-200 mt-1">Líquido a receber em conta</p>
                                </div>
                            </div>

                        {/* Monthly Receipt Section */}
                        <div className="bg-slate-900 border border-white/5 rounded-lg p-8 shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Files size={120} />
                                </div>
                                
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                                        <div>
                                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                                    <Calculator className="text-emerald-400" size={20} />
                                                </div>
                                                {t('label_salary_receipt')}
                                            </h3>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">
                                                Simulação de Processamento {reportStats?.isTemporary ? 'Temporário' : 'Efetivo'} • Portugal
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[9px] font-bold uppercase tracking-wider mb-2">
                                                <Calendar size={10} /> {reportStats?.daysWorked} Dias Trabalhados
                                            </div>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Período: {startDate} - {endDate}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                                        {/* Remunerações */}
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                    <TrendingUp size={12} /> 01. Rendimentos Brutos
                                                </h4>
                                                
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center group">
                                                        <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Vencimento Base</span>
                                                        <span className="font-bold text-white tabular-nums">{currency} {reportStats?.basePay.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                    </div>
                                                    
                                                    {reportStats && reportStats.extraPay > 0 && (
                                                        <div className="flex justify-between items-center group">
                                                            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Horas Suplementares</span>
                                                            <span className="font-bold text-white tabular-nums">{currency} {reportStats.extraPay.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                        </div>
                                                    )}

                                                    {reportStats?.isTemporary && (
                                                        <>
                                                            <div className="flex justify-between items-center group">
                                                                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Duodécimo Subs. Férias (1/12)</span>
                                                                <span className="font-bold text-white tabular-nums">{currency} {reportStats.duodecimoFerias.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center group">
                                                                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Duodécimo Subs. Natal (1/12)</span>
                                                                <span className="font-bold text-white tabular-nums">{currency} {reportStats.duodecimoNatal.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                            </div>
                                                        </>
                                                    )}

                                                    <div className="flex justify-between items-center group pt-2 px-3 py-2 bg-slate-800/20 rounded-lg border border-white/5">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors flex items-center gap-2">
                                                                <Utensils size={12} className="text-amber-500" /> Subsídio de Alimentação
                                                            </span>
                                                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">(Pago em Cartão Especial • Isento)</span>
                                                        </div>
                                                        <span className="font-bold text-amber-500 tabular-nums">{currency} {reportStats?.lunchAllowanceTotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                    </div>

                                                    <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Bruto de Rendimentos</span>
                                                        <span className="text-xl font-black text-white tabular-nums">{currency} {reportStats?.bruteTotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Descontos e Líquido */}
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                    <ShieldAlert size={12} /> 02. Retenções e Encargos
                                                </h4>
                                                
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center group">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Segurança Social</span>
                                                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">(Quota Trabalhador {settingsMap[selectedUserId]?.socialSecurityRate}%)</span>
                                                        </div>
                                                        <span className="font-bold text-rose-400 tabular-nums">(-) {currency} {reportStats?.ssDiscount.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center group">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Retenção na Fonte (IRS)</span>
                                                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter">(Taxa Mensal {settingsMap[selectedUserId]?.irsRate}%)</span>
                                                        </div>
                                                        <span className="font-bold text-rose-400 tabular-nums">(-) {currency} {reportStats?.irsDiscount.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                    </div>

                                                    <div className="pt-8 border-t border-white/5">
                                                        <div className="bg-emerald-600/10 rounded-xl p-6 border border-emerald-500/20 relative overflow-hidden group">
                                                            <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 group-hover:scale-110 transition-transform">
                                                                <DollarSign size={80} />
                                                            </div>
                                                            <div className="relative z-10">
                                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1 block">Valor Líquido Final</span>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-4xl font-black text-white tabular-nums tracking-tighter">
                                                                        {currency} {reportStats?.netTotal.toLocaleString('pt-PT', {minimumFractionDigits: 2})}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[9px] text-emerald-300/40 font-bold uppercase tracking-widest mt-2">Valor disponível para transferência</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isAdmin && (
                                                        <div className="mt-6 pt-6 border-t border-white/5 opacity-40 hover:opacity-100 transition-opacity">
                                                            <div className="flex justify-between items-center px-4 py-3 bg-slate-800/30 rounded-xl border border-white/5">
                                                                <div className="flex items-center gap-2">
                                                                    <Briefcase size={14} className="text-slate-500" />
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Custo para Empresa</span>
                                                                </div>
                                                                <span className="text-xs font-black text-slate-400">{currency} {reportStats?.employerCost.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Details Table */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <FileText size={14} className="text-slate-500" /> Detalhamento Diário
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-slate-800 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-700">{logs.length} Dias Registrados</span>
                                    </div>
                                </div>

                                <div className="bg-slate-900 shadow-2xl rounded-lg border border-white/5 overflow-hidden">
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
                                                    const holidayInfo = getHolidayByDate(log.date);
                                                    const isHoliday = [...(userSettings?.holidays || []), ...systemHolidays].includes(log.date) || !!holidayInfo;
                                                    const holidayColors = holidayInfo ? getHolidayColorClasses(holidayInfo.type) : getHolidayColorClasses('FACULTATIVE');
                                                    
                                                    return (
                                                        <tr key={log.id} className={`hover:bg-white/[0.02] transition-colors group ${isHoliday ? holidayColors.bg : ''}`}>
                                                                    <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-bold text-white">{log.date.split('-').reverse().slice(0, 2).join('/')}</span>
                                                                        {isHoliday && (
                                                                            <span className={`px-1.5 py-0.5 rounded ${holidayColors.badge} text-[8px] font-black uppercase tracking-tighter border`}>
                                                                                {holidayInfo ? holidayInfo.name : 'Feriado'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-500 font-medium uppercase">{new Date(log.date + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'short'})}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm font-bold">
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
                                                                <span className="inline-flex items-center px-4 py-1.5 rounded-lg bg-slate-800 text-white font-mono text-xs font-black border border-white/5">
                                                                    {formatDuration(duration)}
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
                                            <div key={abs.id} className="p-5 bg-rose-500/5 rounded-xl border border-rose-500/10 flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                                                    <CalendarOff size={18} className="text-rose-400" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{new Date(abs.date).toLocaleDateString('pt-BR')}</span>
                                                        <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-[8px] font-extrabold text-rose-400 uppercase tracking-widest">{abs.type === 'ABSENCE' ? 'Falta' : 'Atraso'}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-300 font-medium leading-relaxed italic">"{abs.reason}"</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                            {/* Production Stats Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/5 p-6 rounded-lg border border-amber-500/10">
                                    <div className="flex items-center gap-2 text-amber-400 mb-2">
                                        <Package size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Total Produzido</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{productionStats?.totalPicking.toLocaleString() || 0}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Peças no período</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/5 p-6 rounded-lg border border-blue-500/10">
                                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                                        <TrendingUp size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Média Diária</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{(productionStats?.avgPicking || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Peças / dia</p>
                                </div>
                                <div className="bg-gradient-to-br from-teal-500/20 to-teal-600/5 p-6 rounded-lg border border-teal-500/10">
                                    <div className="flex items-center gap-2 text-teal-400 mb-2">
                                        <Calendar size={16} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Dias Ativos</span>
                                    </div>
                                    <p className="text-3xl font-black text-white">{logs.filter(l => l.production_picking).length}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Com registro de produção</p>
                                </div>
                            </div>

                            {/* Main Productivity Chart */}
                            <div className="bg-slate-900 border border-white/5 rounded-lg p-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                    <BarChart3 size={14} className="text-amber-500" /> Produtividade Diária (Peças)
                                </h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={productionStats?.dailyData}>
                                            <defs>
                                                <linearGradient id="colorPicking" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                                            <XAxis 
                                                dataKey="date" 
                                                stroke="#475569" 
                                                fontSize={10} 
                                                tickLine={false} 
                                                axisLine={false} 
                                            />
                                            <YAxis 
                                                stroke="#475569" 
                                                fontSize={10} 
                                                tickLine={false} 
                                                axisLine={false}
                                                tickFormatter={(value) => value.toLocaleString()}
                                            />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: '#0f172a', 
                                                    border: '1px solid #1e293b',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold'
                                                }}
                                                itemStyle={{ color: '#fbbf24' }}
                                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="picking" 
                                                name="Produção"
                                                stroke="#f59e0b" 
                                                strokeWidth={3}
                                                fillOpacity={1} 
                                                fill="url(#colorPicking)" 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Distribution Charts */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-900 border border-white/5 rounded-lg p-6">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <PieChartIcon size={14} className="text-blue-500" /> Distribuição por Caixa (BOX)
                                    </h3>
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={productionStats?.boxData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {(productionStats?.boxData || []).map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={[
                                                            '#3b82f6', '#f97316', '#64748b', '#22c55e', '#eab308'
                                                        ][index % 5]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                                />
                                                <Legend 
                                                    verticalAlign="bottom" 
                                                    height={36}
                                                    formatter={(value) => <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{value}</span>}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-slate-900 border border-white/5 rounded-lg p-6">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <PieChartIcon size={14} className="text-purple-500" /> Distribuição por Infeed
                                    </h3>
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={productionStats?.infeedData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {(productionStats?.infeedData || []).map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#8b5cf6' : '#ec4899'} />
                                                    ))}
                                                </Pie>
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                                />
                                                <Legend 
                                                    verticalAlign="bottom" 
                                                    height={36}
                                                    formatter={(value) => <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Infeed {value}</span>}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-6 bg-slate-900 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 italic max-w-xs">
                        <Calculator size={14} className="text-emerald-400 shrink-0" /> Valores baseados nas taxas atuais de SS ({settingsMap[selectedUserId]?.socialSecurityRate || 11}%) e IRS ({settingsMap[selectedUserId]?.irsRate || 0}%)
                    </p>
                    <button 
                        onClick={handleExportPDF}
                        disabled={loading || logs.length === 0}
                        className="w-full sm:w-auto px-8 py-4 bg-white text-slate-950 rounded-lg font-bold text-sm shadow-xl hover:bg-slate-100 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
                    >
                        <Download size={18} /> Exportar Relatório PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportsPortal;
