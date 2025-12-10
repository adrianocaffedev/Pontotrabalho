
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WorkStatus, TimeLog, AnalysisResult, Break, AppSettings, Absence, AppUser } from './types';
import Clock from './components/Clock';
import StatusBadge from './components/StatusBadge';
import LogHistory from './components/LogHistory';
import AIReport from './components/AIReport';
import SettingsModal from './components/SettingsModal';
import AbsenceModal from './components/AbsenceModal';
import ManualLogModal from './components/ManualLogModal';
import { analyzeTimesheet } from './services/geminiService';
import { fetchRemoteData, saveRemoteSettings, upsertRemoteLog, deleteRemoteLog, getAppUsers } from './services/dataService';
import { Play, Coffee, StopCircle, Utensils, BellRing, Settings as SettingsIcon, PlayCircle, TrendingUp, DollarSign, Timer, CalendarClock, CalendarOff, ArrowRight, Moon, Sun, Edit3, Cloud, Database, Users, Clock as ClockIcon } from 'lucide-react';

const STORAGE_KEY_THEME = 'ponto_ai_theme';
const STORAGE_KEY_ACTIVE_USER_ID = 'ponto_ai_active_user_id';

const DEFAULT_SETTINGS: AppSettings = {
    dailyWorkHours: 8,
    lunchDurationMinutes: 60,
    notificationMinutes: 10,
    hourlyRate: 0,
    foodAllowance: 0,
    currency: 'EUR',
    overtimePercentage: 25,
    overtimeDays: [0, 6],
    holidays: [],
};

// Generates a valid UUID v4
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Polyfill for UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Reusable Glass Stat Card
const StatCard = ({ icon: Icon, label, value, subValue, active, colorClass, delay }: any) => (
    <div 
        className={`relative overflow-hidden p-4 sm:p-6 rounded-3xl border backdrop-blur-xl transition-all duration-500 group animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards
        ${active 
            ? 'bg-white/80 dark:bg-slate-800/60 border-indigo-200 dark:border-indigo-500/30 shadow-lg shadow-indigo-500/10' 
            : 'bg-white/30 dark:bg-slate-900/30 border-white/40 dark:border-white/5 hover:bg-white/50 dark:hover:bg-slate-800/40 hover:border-white/60 dark:hover:border-slate-700 hover:-translate-y-1 hover:shadow-lg'}
        `}
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="absolute top-[-10px] right-[-10px] p-4 opacity-5 group-hover:opacity-10 transition-opacity transform rotate-12 scale-150">
            <Icon size={64} className={colorClass} />
        </div>
        <div className="relative z-10">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1 sm:mb-2 flex items-center gap-2 opacity-80">
                <Icon size={12} className="sm:w-3.5 sm:h-3.5" /> {label}
            </p>
            <div className="flex flex-col gap-0.5">
                <span className={`text-2xl sm:text-3xl font-bold tracking-tighter ${active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                    {value}
                </span>
                {subValue && (
                    <span className={`text-[10px] sm:text-xs font-bold tracking-wide ${colorClass}`}>
                        {subValue}
                    </span>
                )}
            </div>
        </div>
        {active && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-60"></div>
        )}
    </div>
);

const App: React.FC = () => {
  const [activeUser, setActiveUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<WorkStatus>(WorkStatus.IDLE);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const [now, setNow] = useState(new Date());
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [systemHolidays, setSystemHolidays] = useState<string[]>([]); // Feriados globais do banco

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  
  // Manual Log & Edit State
  const [isManualLogModalOpen, setIsManualLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);

  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Network status
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
        return (savedTheme as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });
  
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Monitor Network Status
  useEffect(() => {
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // --- Initial User Load ---
  useEffect(() => {
    const initApp = async () => {
        setIsLoadingData(true);
        try {
            const users = await getAppUsers();
            const savedUserId = localStorage.getItem(STORAGE_KEY_ACTIVE_USER_ID);
            
            if (savedUserId) {
                const foundUser = users.find(u => u.id === savedUserId);
                if (foundUser) {
                    setActiveUser(foundUser);
                } else {
                     // ID salvo invalido, abre settings
                     setIsSettingsOpen(true);
                }
            } else {
                // Sem usuario selecionado, abre settings
                setIsSettingsOpen(true);
            }
        } catch (e) {
            console.error("Failed to init app", e);
        } finally {
            setIsLoadingData(false);
        }
    };
    initApp();
  }, []);


  // --- Data Loading based on Active User ---
  useEffect(() => {
    const loadData = async () => {
        setIsLoadingData(true);
        if (activeUser) {
            // Load from Supabase using app user id
            const { logs: remoteLogs, settings: remoteSettings, systemHolidays: fetchedHolidays } = await fetchRemoteData(activeUser.id);
            setLogs(remoteLogs);
            if (remoteSettings) setSettings(remoteSettings);
            else setSettings(DEFAULT_SETTINGS); 
            
            if (fetchedHolidays) setSystemHolidays(fetchedHolidays);
            
            // Determinar status baseado no último log
            const lastLog = remoteLogs.length > 0 ? remoteLogs[remoteLogs.length - 1] : null;
            if (lastLog && !lastLog.endTime) {
                setCurrentLogId(lastLog.id);
                // Check if in break
                const lastBreak = lastLog.breaks.length > 0 ? lastLog.breaks[lastLog.breaks.length - 1] : null;
                if (lastBreak && !lastBreak.endTime) {
                    setStatus(lastBreak.type === 'LUNCH' ? WorkStatus.ON_LUNCH : WorkStatus.ON_COFFEE);
                } else {
                    setStatus(WorkStatus.WORKING);
                }
            } else {
                setStatus(WorkStatus.IDLE);
                setCurrentLogId(null);
            }

        } else {
            // No user active - "Kiosk" mode implies we depend on DB.
            setLogs([]);
            setStatus(WorkStatus.IDLE);
            setCurrentLogId(null);
        }
        setIsLoadingData(false);
    };

    loadData();
  }, [activeUser]);

  // Handle User Selection from Settings
  const handleSelectUser = (user: AppUser | null) => {
      setActiveUser(user);
      if (user) {
          localStorage.setItem(STORAGE_KEY_ACTIVE_USER_ID, user.id);
      } else {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_USER_ID);
      }
  };


  // --- Helper to Save Remote ---
  const saveLogToRemote = async (log: TimeLog) => {
      if (activeUser) {
          await upsertRemoteLog(log, activeUser.id);
      }
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      if (activeUser) {
          const result = await saveRemoteSettings(newSettings, activeUser.id);
          if (!result.success) {
              alert("Atenção: Houve um erro ao salvar as configurações no banco de dados.\n" + (result.error || 'Verifique sua conexão.'));
          }
      }
  };

  const handleDeleteLog = async (id: string) => {
      // Confirmation handled by UI component (LogHistory)
      
      // Store previous state for rollback
      const previousLogs = [...logs];
      const previousStatus = status;
      const previousCurrentId = currentLogId;

      // Optimistic Update
      setLogs(prev => prev.filter(log => log.id !== id));
      if (currentLogId === id) {
          setCurrentLogId(null);
          setStatus(WorkStatus.IDLE);
      }
      
      const result = await deleteRemoteLog(id);
      if (!result.success) {
          alert("Não foi possível excluir o registro. O servidor retornou um erro.");
          // Rollback
          setLogs(previousLogs);
          setStatus(previousStatus);
          setCurrentLogId(previousCurrentId);
      }
  };

  // --- Existing Logic ---

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
        setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
    } else {
        root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const playAlarmSound = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const audioNow = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioNow);
        osc.frequency.exponentialRampToValueAtTime(440, audioNow + 0.2);
        gain.gain.setValueAtTime(0.1, audioNow);
        gain.gain.exponentialRampToValueAtTime(0.001, audioNow + 0.5);
        osc.start(audioNow);
        osc.stop(audioNow + 0.5);
    } catch (e) {
        console.error("Audio playback failed", e);
    }
  };

  useEffect(() => {
    const checkAlarm = () => {
        if (status === WorkStatus.ON_LUNCH && currentLogId && !alarmTriggered) {
            const currentLog = logs.find(l => l.id === currentLogId);
            if (currentLog) {
                const currentBreak = currentLog.breaks[currentLog.breaks.length - 1];
                if (currentBreak && currentBreak.type === 'LUNCH' && !currentBreak.endTime) {
                    const startTime = new Date(currentBreak.startTime).getTime();
                    const nowMs = new Date().getTime();
                    const elapsedMinutes = (nowMs - startTime) / 1000 / 60;
                    const triggerMinute = settings.lunchDurationMinutes - settings.notificationMinutes;
                    if (triggerMinute > 0 && elapsedMinutes >= triggerMinute) {
                        playAlarmSound();
                        if (Notification.permission === 'granted') {
                            new Notification("PontoInteligente: Fim do Almoço", {
                                body: `Faltam ${settings.notificationMinutes} minutos para acabar seu intervalo.`,
                                icon: "https://cdn-icons-png.flaticon.com/512/2928/2928750.png"
                            });
                        }
                        setAlarmTriggered(true);
                    }
                }
            }
        }
    };
    alarmIntervalRef.current = setInterval(checkAlarm, 5000);
    return () => { if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current); };
  }, [status, currentLogId, logs, alarmTriggered, settings]);
  
  // --- Calculations for Stat Cards & Helpers ---
  // Using Local Date for "Today" comparison to match UI Clock and User Day
  const getLocalDateString = (d: Date) => {
     const offset = d.getTimezoneOffset();
     const local = new Date(d.getTime() - (offset * 60 * 1000));
     return local.toISOString().split('T')[0];
  };

  const handleStartWork = () => {
    // Verificar duplicidade: se já existe um log para hoje
    const todayStr = getLocalDateString(new Date());
    const hasLogToday = logs.some(l => l.date === todayStr);

    if (hasLogToday) {
        alert("Já existe um registro de ponto para hoje. Para adicionar mais horas, edite o registro existente ou exclua-o.");
        return;
    }

    if (Notification.permission !== 'granted') Notification.requestPermission();
    
    const newLog: TimeLog = {
      id: generateId(),
      date: todayStr,
      startTime: new Date().toISOString(),
      breaks: [],
      absences: [],
      totalDurationMs: 0
    };
    
    setLogs(prev => [...prev, newLog]);
    setCurrentLogId(newLog.id);
    setStatus(WorkStatus.WORKING);
    setAiAnalysis(null);
    saveLogToRemote(newLog);
  };

  const handleStartBreak = (type: 'LUNCH' | 'COFFEE') => {
    if (!currentLogId) return;
    const nowIso = new Date().toISOString();
    const newBreak: Break = {
        id: generateId(),
        startTime: nowIso,
        type: type
    };

    let updatedLog: TimeLog | null = null;
    setLogs(prev => prev.map(log => {
      if (log.id === currentLogId) {
          updatedLog = { ...log, breaks: [...log.breaks, newBreak] };
          return updatedLog;
      }
      return log;
    }));
    
    if (type === 'LUNCH') setAlarmTriggered(false);
    setStatus(type === 'LUNCH' ? WorkStatus.ON_LUNCH : WorkStatus.ON_COFFEE);
    if (updatedLog) saveLogToRemote(updatedLog);
  };

  const handleEndBreak = () => {
    if (!currentLogId) return;
    const nowIso = new Date().toISOString();
    
    let updatedLog: TimeLog | null = null;
    setLogs(prev => prev.map(log => {
        if (log.id !== currentLogId) return log;
        const updatedBreaks = [...log.breaks];
        const lastBreakIndex = updatedBreaks.length - 1;
        if (lastBreakIndex >= 0 && !updatedBreaks[lastBreakIndex].endTime) {
            updatedBreaks[lastBreakIndex] = {
                ...updatedBreaks[lastBreakIndex],
                endTime: nowIso
            };
        }
        updatedLog = { ...log, breaks: updatedBreaks };
        return updatedLog;
    }));
    
    setStatus(WorkStatus.WORKING);
    if (updatedLog) saveLogToRemote(updatedLog);
  };

  const handleEndWork = () => {
    if (!currentLogId) return;
    const nowIso = new Date().toISOString();
    
    let updatedLog: TimeLog | null = null;
    setLogs(prev => prev.map(log => {
      if (log.id === currentLogId) {
          // Calculate actual worked duration (Time elapsed - Lunch duration)
          const startTime = new Date(log.startTime).getTime();
          const endTime = new Date(nowIso).getTime();
          let duration = endTime - startTime;
          
          // Deduct lunch breaks
          // We also need to handle if a break was open (no endTime).
          const updatedBreaks = log.breaks.map(b => {
             if (!b.endTime) return { ...b, endTime: nowIso };
             return b;
          });
          
          updatedBreaks.forEach(b => {
              if (b.type === 'LUNCH') {
                   const bStart = new Date(b.startTime).getTime();
                   const bEnd = new Date(b.endTime!).getTime(); // endTime is guaranteed by map above
                   duration -= (bEnd - bStart);
              }
          });
          
          updatedLog = { 
              ...log, 
              endTime: nowIso, 
              breaks: updatedBreaks,
              totalDurationMs: Math.max(0, duration) 
          }; 
          return updatedLog;
      }
      return log;
    }));
    
    setStatus(WorkStatus.FINISHED);
    setCurrentLogId(null);
    setAlarmTriggered(false);
    if (updatedLog) saveLogToRemote(updatedLog);
  };

  // Create or Update Log
  const handleSaveManualLog = (log: TimeLog) => {
    // Check if updating an existing log
    const exists = logs.some(l => l.id === log.id);

    if (exists) {
        // Update
        setLogs(prev => prev.map(l => l.id === log.id ? log : l));
    } else {
        // Create (and sort)
        setLogs(prev => [...prev, log].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    }
    
    saveLogToRemote(log);
    
    // Cleanup state
    setEditingLog(null);
  };

  const handleEditLog = (log: TimeLog) => {
    setEditingLog(log);
    setIsManualLogModalOpen(true);
  };

  const handleCloseManualModal = () => {
    setIsManualLogModalOpen(false);
    setEditingLog(null);
  };

  const handleSaveAbsence = (absenceData: Omit<Absence, 'id'>) => {
    if (!currentLogId) return;
    
    const newAbsence: Absence = {
        id: generateId(),
        ...absenceData
    };
    
    let updatedLog: TimeLog | null = null;
    setLogs(prev => prev.map(log => {
        if (log.id === currentLogId) {
            updatedLog = { ...log, absences: [...(log.absences || []), newAbsence] };
            return updatedLog;
        }
        return log;
    }));
    
    if (updatedLog) saveLogToRemote(updatedLog);
  };

  const handleGenerateAIReport = async () => {
    // Filter logs for today
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.date === today);
    
    if (todayLogs.length === 0) return;

    setIsAnalyzing(true);
    // Combine settings holidays with system holidays for AI analysis
    const combinedSettings = {
        ...settings,
        holidays: [...(settings.holidays || []), ...systemHolidays]
    };
    const result = await analyzeTimesheet(todayLogs, combinedSettings);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const todayStr = getLocalDateString(now);
  const todayLogs = logs.filter(l => l.date === todayStr);
  const todayLog = logs.find(l => l.date === todayStr); // Simple assumption: 1 log per day mainly
  
  // Calculate total worked time today (excluding open breaks)
  const calculateWorkedTime = () => {
    if (!todayLog) return 0;
    
    // Se o log já está finalizado, usa o total dele (se calculado corretamente)
    // Mas para tempo real, precisamos recalcular
    let total = 0;
    const start = new Date(todayLog.startTime).getTime();
    const end = todayLog.endTime ? new Date(todayLog.endTime).getTime() : now.getTime();
    
    total = end - start;
    
    // Deduct LUNCH breaks
    todayLog.breaks.forEach(brk => {
        if (brk.type === 'LUNCH') {
            const bStart = new Date(brk.startTime).getTime();
            const bEnd = brk.endTime ? new Date(brk.endTime).getTime() : now.getTime();
            total -= (bEnd - bStart);
        }
    });

    return Math.max(0, total);
  };

  // --- NIGHT SHIFT LOGIC (22:00 - 07:00) ---
  const calculateNightShiftMs = (log: TimeLog) => {
    // If no start time, no work
    if (!log.startTime) return 0;

    const start = new Date(log.startTime);
    // If running, calculate until now
    const end = log.endTime ? new Date(log.endTime) : new Date();

    // Helper: Calculate intersection of two time ranges
    const getOverlap = (start1: number, end1: number, start2: number, end2: number) => {
        const maxStart = Math.max(start1, start2);
        const minEnd = Math.min(end1, end2);
        return Math.max(0, minEnd - maxStart);
    };

    let nightMs = 0;
    
    // Night shift definition in Portugal: 22:00 to 07:00 (Next Day)
    // We check windows relative to the log's date
    const sTime = start.getTime();
    const eTime = end.getTime();

    // Construct potential night windows:
    // 1. Previous Day 22:00 -> Today 07:00 (In case shift started very early or ran overnight)
    // 2. Today 22:00 -> Tomorrow 07:00
    // 3. Tomorrow 22:00 -> After Tomorrow 07:00 (If shift is super long)
    
    const windows = [];
    const currentScanner = new Date(start);
    currentScanner.setDate(currentScanner.getDate() - 1); // Start check from yesterday
    const endScanner = new Date(end);
    endScanner.setDate(endScanner.getDate() + 1);

    while (currentScanner <= endScanner) {
        // Window Start: 22:00 of CurrentScanner Day
        const wStart = new Date(currentScanner);
        wStart.setHours(22, 0, 0, 0);
        
        // Window End: 07:00 of Next Day
        const wEnd = new Date(currentScanner);
        wEnd.setDate(wEnd.getDate() + 1);
        wEnd.setHours(7, 0, 0, 0);
        
        windows.push({ start: wStart.getTime(), end: wEnd.getTime() });
        currentScanner.setDate(currentScanner.getDate() + 1);
    }

    // Calculate overlap
    windows.forEach(win => {
        const intersection = getOverlap(sTime, eTime, win.start, win.end);
        
        if (intersection > 0) {
            let effectiveNightWork = intersection;

            // Subtract BREAKS that occurred during this specific night window overlap
            // Intersection of (Break) AND (Log overlap with Night Window)
            const overlapStart = Math.max(sTime, win.start);
            const overlapEnd = Math.min(eTime, win.end);

            log.breaks.forEach(brk => {
                if (brk.type === 'LUNCH') { // Usually only Lunch deducts, Coffee is paid work
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
  
  const workedMs = calculateWorkedTime();
  const workedHours = Math.floor(workedMs / (1000 * 60 * 60));
  const workedMinutes = Math.floor((workedMs % (1000 * 60 * 60)) / (1000 * 60));
  const workedSeconds = Math.floor((workedMs % (1000 * 60)) / 1000);
  
  // Calculate Night Shift for Today
  const todayNightMs = todayLog ? calculateNightShiftMs(todayLog) : 0;
  const nightHours = Math.floor(todayNightMs / (1000 * 60 * 60));
  const nightMinutes = Math.floor((todayNightMs % (1000 * 60 * 60)) / (1000 * 60));
  const nightSeconds = Math.floor((todayNightMs % (1000 * 60)) / 1000);

  const calculateDailyEarnings = (ms: number, nightMs: number, dateStr: string) => {
      if (!settings.hourlyRate) return 0;

      const totalHours = ms / (1000 * 60 * 60);
      const nightHoursDecimal = nightMs / (1000 * 60 * 60);
      const rate = settings.hourlyRate;
      
      // 1. Verificar se é Feriado (Comparação exata da string de data)
      const allHolidays = [...(settings.holidays || []), ...systemHolidays];
      const isHoliday = allHolidays.includes(dateStr);
      
      // 2. Verificar se é Dia Especial (Fim de semana/Configurado)
      const logDayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
      const isOvertimeDay = (settings.overtimeDays || []).includes(logDayOfWeek);
      
      let totalEarnings = 0;

      // --- REGRA DE OURO (Portugal) ---
      // 1. Horas Normais vs Extras
      // 2. Adicional Noturno é pago À PARTE sobre todas as horas noturnas (+25%) e acumula.

      if (isHoliday || isOvertimeDay) {
          // Fim de Semana / Feriado: 100% sobre TUDO
          // Valor dobra
          totalEarnings = totalHours * rate * 2;
      } else {
          // Dia Útil Normal
          const dailyLimit = settings.dailyWorkHours || 8;
          
          if (totalHours <= dailyLimit) {
              // Dentro do limite
              totalEarnings = totalHours * rate;
          } else {
              // Hora Suplementar (Escalonada)
              // 1ª Hora Extra: +25%
              // Horas Seguintes: +37.5%
              
              const normalEarnings = dailyLimit * rate;
              const extraHoursTotal = totalHours - dailyLimit;
              
              const firstExtraHour = Math.min(extraHoursTotal, 1);
              const remainingExtraHours = Math.max(0, extraHoursTotal - 1);
              
              // Cálculo
              const earningsFirstExtra = firstExtraHour * rate * 1.25; // 1ª Hora (+25%)
              const earningsRemainingExtra = remainingExtraHours * rate * 1.375; // Resto (+37.5%)
              
              totalEarnings = normalEarnings + earningsFirstExtra + earningsRemainingExtra;
          }
      }

      // Adicional Noturno (Acumulativo)
      // Das 22h às 07h, ganha-se +25% sobre a hora base, INDEPENDENTE de ser hora extra ou não.
      // Se for hora extra, já calculamos o valor da extra acima. Agora somamos o "plus" noturno.
      const nightBonus = nightHoursDecimal * rate * 0.25;
      
      return totalEarnings + nightBonus;
  };

  const estimatedEarnings = calculateDailyEarnings(workedMs, todayNightMs, todayStr);

  const currencySymbol = settings.currency === 'BRL' ? 'R$' : settings.currency === 'USD' ? '$' : '€';
  
  const isTodayHoliday = [...(settings.holidays || []), ...systemHolidays].includes(todayStr);

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans selection:bg-indigo-500/20 ${theme === 'dark' ? 'dark' : ''}`}>
      
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Orbs */}
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/10 dark:bg-violet-600/10 rounded-full blur-[120px]" style={{ animationDelay: '-5s' }}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-8 sm:mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-3 sm:gap-4 group cursor-default">
             <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative bg-white dark:bg-slate-800 p-2 sm:p-3 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 group-hover:scale-105 transition-transform duration-300">
                    <ClockIcon size={24} className="text-indigo-600 dark:text-indigo-400 sm:w-7 sm:h-7" />
                </div>
             </div>
             <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tight">
                  Ponto<span className="text-indigo-600 dark:text-indigo-400">Inteligente</span>
                </h1>
                <p className="text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                   Controle de Jornada AI
                </p>
             </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
             <button 
                onClick={toggleTheme}
                className="p-2 sm:p-3 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 backdrop-blur-md transition-all duration-300 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm hover:shadow-md border border-white/20 dark:border-white/5 group active:scale-95"
                title="Alternar Tema"
             >
                {theme === 'dark' ? <Sun size={18} className="group-hover:rotate-90 transition-transform duration-500 sm:w-5 sm:h-5"/> : <Moon size={18} className="group-hover:-rotate-12 transition-transform duration-500 sm:w-5 sm:h-5"/>}
             </button>
             
             {/* Settings Button */}
             <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`p-2 sm:p-3 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 backdrop-blur-md transition-all duration-300 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm hover:shadow-md border border-white/20 dark:border-white/5 active:scale-95 group relative ${(!activeUser) ? 'ring-2 ring-indigo-500 animate-pulse' : ''}`}
                title="Configurações"
             >
                <SettingsIcon size={18} className="group-hover:rotate-45 transition-transform duration-500 sm:w-5 sm:h-5" />
                {!activeUser && <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>}
             </button>

             {/* User Profile/Select Button (Using Settings Modal) */}
             <button
                onClick={() => setIsSettingsOpen(true)} // Reuses settings modal
                className="pl-2 pr-3 sm:pl-3 sm:pr-4 py-1.5 rounded-full bg-white/40 dark:bg-slate-800/40 hover:bg-white/60 dark:hover:bg-slate-800/60 backdrop-blur-md transition-all duration-300 border border-white/20 dark:border-white/5 shadow-sm flex items-center gap-2 sm:gap-3 active:scale-95 group"
             >
                 <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-inner text-white text-[10px] sm:text-xs font-bold uppercase group-hover:scale-110 transition-transform">
                     {activeUser ? activeUser.name.substring(0, 2) : <Users size={12}/>}
                 </div>
                 <div className="flex flex-col items-start hidden xs:flex">
                     <span className="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 leading-none">
                        {activeUser ? activeUser.name.split(' ')[0] : 'Selecionar'}
                     </span>
                     <span className="text-[8px] sm:text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-none mt-0.5">
                        {activeUser ? 'Usuário' : 'Entrar'}
                     </span>
                 </div>
             </button>
          </div>
        </header>

        {isLoadingData ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] animate-pulse">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin relative z-10"></div>
                </div>
                <p className="mt-8 text-slate-400 font-medium tracking-wide text-sm uppercase">Carregando Sistema...</p>
             </div>
        ) : !activeUser ? (
             <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-800 shadow-xl animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner animate-bounce-slow">
                     <Users size={40} className="text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Bem-vindo ao Ponto Inteligente</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8 leading-relaxed">
                    Para começar a registrar seu ponto, por favor selecione seu perfil de usuário nas configurações.
                </p>
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/25 transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-2"
                >
                    <SettingsIcon size={18} />
                    Selecionar Usuário
                </button>
             </div>
        ) : (
            <main className="flex-1 space-y-8">
            {/* Clock & Main Actions */}
            <div className="flex flex-col items-center relative">
                <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20">
                    <StatusBadge status={status} />
                </div>
                
                <Clock />
                
                {/* Main Action Controller */}
                <div className="mt-6 sm:mt-8 flex items-center gap-4 sm:gap-6 relative z-10">
                {status === WorkStatus.IDLE || status === WorkStatus.FINISHED ? (
                    <button
                    onClick={handleStartWork}
                    className="group relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-xl shadow-indigo-500/30 transition-all duration-300 hover:scale-110 active:scale-95"
                    >
                    <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    <Play size={24} className="ml-1 fill-current sm:w-8 sm:h-8" />
                    <span className="absolute -bottom-8 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">INICIAR</span>
                    </button>
                ) : (
                    <>
                    {/* Pause Controls */}
                    {(status === WorkStatus.WORKING) && (
                        <div className="flex gap-3 sm:gap-4 animate-in zoom-in-50 duration-300">
                            <button
                            onClick={() => handleStartBreak('LUNCH')}
                            className="group relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border-2 border-amber-200 dark:border-amber-700/50 shadow-lg hover:shadow-amber-500/20 transition-all duration-300 hover:scale-105 active:scale-95"
                            title="Almoço"
                            >
                                <Utensils size={18} className="sm:w-5 sm:h-5" />
                                <span className="absolute -bottom-8 text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">ALMOÇO</span>
                            </button>
                            <button
                            onClick={() => handleStartBreak('COFFEE')}
                            className="group relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 border-2 border-teal-200 dark:border-teal-700/50 shadow-lg hover:shadow-teal-500/20 transition-all duration-300 hover:scale-105 active:scale-95"
                            title="Café"
                            >
                                <Coffee size={18} className="sm:w-5 sm:h-5" />
                                <span className="absolute -bottom-8 text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">CAFÉ</span>
                            </button>
                        </div>
                    )}

                    {/* Resume Control */}
                    {(status === WorkStatus.ON_LUNCH || status === WorkStatus.ON_COFFEE) && (
                        <button
                        onClick={handleEndBreak}
                        className="group relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-110 active:scale-95 animate-in zoom-in-50"
                        >
                        <PlayCircle size={28} className="sm:w-8 sm:h-8" />
                        <span className="absolute -bottom-8 text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">RETORNAR</span>
                        </button>
                    )}

                    {/* Stop Control */}
                    <button
                        onClick={handleEndWork}
                        className="group relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 border-2 border-rose-200 dark:border-rose-700/50 shadow-lg hover:shadow-rose-500/20 transition-all duration-300 hover:scale-105 active:scale-95"
                        title="Encerrar Dia"
                    >
                        <StopCircle size={20} className="sm:w-6 sm:h-6" />
                        <span className="absolute -bottom-8 text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">ENCERRAR</span>
                    </button>
                    
                    {/* Add Absence Button (Only when working) */}
                    {status === WorkStatus.WORKING && (
                         <button
                            onClick={() => setIsAbsenceModalOpen(true)}
                            className="absolute -right-16 sm:-right-20 top-1/2 -translate-y-1/2 p-2 sm:p-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors opacity-50 hover:opacity-100"
                            title="Registrar Ausência/Justificativa"
                         >
                            <CalendarOff size={18} className="sm:w-5 sm:h-5" />
                         </button>
                    )}

                    </>
                )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <StatCard 
                    icon={Timer}
                    label="Total"
                    value={`${String(workedHours).padStart(2, '0')}:${String(workedMinutes).padStart(2, '0')}:${String(workedSeconds).padStart(2, '0')}`}
                    active={status !== WorkStatus.IDLE && status !== WorkStatus.FINISHED}
                    colorClass="text-indigo-500"
                    delay={0}
                />
                
                <StatCard 
                    icon={Moon}
                    label="Noturno"
                    value={`${String(nightHours).padStart(2, '0')}:${String(nightMinutes).padStart(2, '0')}:${String(nightSeconds).padStart(2, '0')}`}
                    active={todayNightMs > 0}
                    colorClass="text-violet-500"
                    delay={100}
                />

                <StatCard 
                    icon={DollarSign}
                    label={isTodayHoliday ? "Estimado (100%)" : "Estimado"}
                    value={`${currencySymbol} ${estimatedEarnings.toFixed(2)}`}
                    colorClass="text-emerald-500"
                    delay={200}
                />

                <StatCard 
                    icon={Utensils}
                    label="Refeição"
                    value={`${currencySymbol} ${settings.foodAllowance.toFixed(2)}`}
                    subValue={settings.foodAllowance > 0 ? "Creditado" : "Não config."}
                    colorClass="text-orange-500"
                    delay={300}
                />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Timeline */}
                <div className="lg:col-span-2">
                    <LogHistory 
                        logs={logs}
                        user={activeUser}
                        settings={settings}
                        systemHolidays={systemHolidays}
                        onDelete={handleDeleteLog}
                        onEdit={handleEditLog}
                        onAddManual={() => setIsManualLogModalOpen(true)}
                        currentLogId={currentLogId}
                    />
                </div>
                
                {/* Reports & AI */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden group hidden lg:block">
                        <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-10 -translate-y-10 group-hover:rotate-12 transition-transform duration-700">
                             <CalendarClock size={120} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-1 opacity-90">Registros Hoje</h3>
                            <div className="text-4xl font-bold tracking-tighter mb-4">{todayLogs.length}</div>
                            <p className="text-xs font-medium opacity-70 leading-relaxed max-w-[200px]">
                                Mantenha seus registros consistentes para melhor análise da IA.
                            </p>
                        </div>
                    </div>
                    
                    <AIReport 
                        report={aiAnalysis} 
                        loading={isAnalyzing} 
                        onGenerate={handleGenerateAIReport}
                        hasData={todayLogs.length > 0}
                    />
                </div>
            </div>
            </main>
        )}
        
        {/* Footer Info */}
        <footer className="mt-auto pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest animate-in fade-in duration-1000">
             <div className="flex items-center gap-2">
                 <span>&lt;/&gt; ADRIANO CAFFÉ</span>
                 <span className="hidden sm:inline">|</span>
                 {/* Database Indicator */}
                 <button 
                    onClick={() => { if (!isOnline) setIsSettingsOpen(true); }} // Maybe allow triggering sync retry?
                    className={`flex items-center gap-1.5 transition-colors duration-300 ${isOnline ? 'text-emerald-500 hover:text-emerald-400' : 'text-slate-500 hover:text-slate-400'}`}
                    title={isOnline ? "Conectado à Nuvem (Supabase)" : "Modo Offline (Sem internet)"}
                 >
                     <Database size={12} className="sm:w-3.5 sm:h-3.5" />
                     <span className="sr-only">{isOnline ? 'Online' : 'Offline'}</span>
                     {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>}
                 </button>
             </div>
             <div>
                PontoInteligente v1.2
             </div>
        </footer>

      </div>

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onSave={handleSaveSettings}
        currentUser={activeUser}
        onSelectUser={handleSelectUser}
        systemHolidays={systemHolidays}
      />

      <AbsenceModal
        isOpen={isAbsenceModalOpen}
        onClose={() => setIsAbsenceModalOpen(false)}
        onSave={handleSaveAbsence}
      />
      
      <ManualLogModal
        isOpen={isManualLogModalOpen}
        onClose={handleCloseManualModal}
        onSave={handleSaveManualLog}
        initialLog={editingLog}
        existingDates={logs.map(l => l.date)}
      />

    </div>
  );
};

export default App;
