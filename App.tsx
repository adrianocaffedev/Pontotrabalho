
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WorkStatus, TimeLog, Break, AppSettings, Absence, AppUser } from './types';
import Clock from './components/Clock';
import StatusBadge from './components/StatusBadge';
import LogHistory from './components/LogHistory';
import SettingsModal from './components/SettingsModal';
import ReportsPortal from './components/ReportsPortal';
import AbsenceModal from './components/AbsenceModal';
import ManualLogModal from './components/ManualLogModal';
import { fetchRemoteData, saveRemoteSettings, upsertRemoteLog, deleteRemoteLog, getAppUsers, keepAlive } from './services/dataService';
import { Play, Coffee, StopCircle, Utensils, Settings as SettingsIcon, PlayCircle, DollarSign, Timer, CalendarClock, CalendarOff, Moon, Sun, Database, Users, Clock as ClockIcon, LogOut, Lock, ChevronRight, Loader2, User, Key, ArrowRight, Delete, Code2, Download, ClipboardList, TrendingUp } from 'lucide-react';

const STORAGE_KEY_THEME = 'ponto_ai_theme';
const STORAGE_KEY_ACTIVE_USER_ID = 'ponto_ai_active_user_id';

const DEFAULT_SETTINGS: AppSettings = {
    dailyWorkHours: 8,
    lunchDurationMinutes: 60,
    coffeeDurationMinutes: 15,
    notificationMinutes: 10,
    hourlyRate: 0,
    foodAllowance: 0,
    currency: 'EUR',
    overtimePercentage: 25,
    overtimeDays: [0, 6],
    holidays: [],
    socialSecurityRate: 11,
    irsRate: 0,
};

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const Signature = () => (
    <div className="flex justify-center mt-8 animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-500">
        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/50 group cursor-default">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold tracking-tighter text-sm">{"</>"}</span>
            <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">Por Adriano Caffé</span>
        </div>
    </div>
);

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
  const [now, setNow] = useState(new Date());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [systemHolidays, setSystemHolidays] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [isManualLogModalOpen, setIsManualLogModalOpen] = useState(false);
  const [standaloneAbsences, setStandaloneAbsences] = useState<Absence[]>([]);
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Login State
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [searchName, setSearchName] = useState('');
  const [selectedLoginUser, setSelectedLoginUser] = useState<AppUser | null>(null);
  const [pinBuffer, setPinBuffer] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
        return (savedTheme as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        setDeferredPrompt(null);
    }
  };

  const refreshUsersList = useCallback(async () => {
    const users = await getAppUsers();
    setUsersList(users);
  }, []);

  useEffect(() => {
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    const triggerHeartbeat = async () => { 
        if (navigator.onLine) {
            const alive = await keepAlive();
            setDbConnected(alive);
        } else {
            setDbConnected(false);
        }
    };
    const intervalId = setInterval(triggerHeartbeat, 10 * 60 * 1000);
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') triggerHeartbeat(); };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    triggerHeartbeat();
    return () => {
        clearInterval(intervalId);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const initApp = async () => {
        setIsLoadingData(true);
        const users = await getAppUsers();
        setUsersList(users);
        const savedUserId = localStorage.getItem(STORAGE_KEY_ACTIVE_USER_ID);
        if (savedUserId) {
            const foundUser = users.find(u => u.id === savedUserId);
            if (foundUser) setActiveUser(foundUser);
        }
        setIsLoadingData(false);
    };
    initApp();
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
        if (!activeUser) return;
        setIsLoadingData(true);
        const { logs: remoteLogs, settings: remoteSettings, systemHolidays: fetchedHolidays, standaloneAbsences: fetchedStandalone } = await fetchRemoteData(activeUser.id);
        setLogs(remoteLogs);
        setSettings(remoteSettings || DEFAULT_SETTINGS);
        setSystemHolidays(fetchedHolidays || []);
        setStandaloneAbsences(fetchedStandalone || []);
        
        const lastLog = remoteLogs.length > 0 ? remoteLogs[remoteLogs.length - 1] : null;
        if (lastLog && !lastLog.endTime) {
            setCurrentLogId(lastLog.id);
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
        setIsLoadingData(false);
    };
    loadUserData();
  }, [activeUser]);

  const handleLogout = () => {
      setActiveUser(null);
      localStorage.removeItem(STORAGE_KEY_ACTIVE_USER_ID);
      setSearchName('');
      setPinBuffer('');
      setSelectedLoginUser(null);
      setIsGlobalAdmin(false);
  };

  const handlePinInput = (val: string) => {
      if (pinBuffer.length >= 4) return;
      
      const user = selectedLoginUser || usersList.find(u => u.name.toLowerCase().trim() === searchName.toLowerCase().trim());
      
      if (!user) {
          alert("Por favor, selecione um usuário válido antes de digitar o PIN.");
          setPinBuffer('');
          return;
      }

      const newPin = pinBuffer + val;
      setPinBuffer(newPin);

      if (newPin.length === 4) {
          const storedPin = String(user.pin || '').trim();
          const enteredPin = String(newPin).trim();
          const isValid = storedPin ? enteredPin === storedPin : enteredPin === '0000';

          if (isValid) {
              setActiveUser(user);
              localStorage.setItem(STORAGE_KEY_ACTIVE_USER_ID, user.id);
          } else {
              setPinError(true);
              setTimeout(() => {
                  setPinBuffer('');
                  setPinError(false);
              }, 600);
          }
      }
  };

  const saveLogToRemote = async (log: TimeLog) => {
      if (activeUser) await upsertRemoteLog(log, activeUser.id);
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      if (activeUser) {
          const result = await saveRemoteSettings(newSettings, activeUser.id);
          if (!result.success) {
              console.error("Erro Supabase:", result.error);
              alert("ERRO AO SALVAR: O banco de dados recusou a alteração.\n\nMotivo: " + result.error + "\n\nSolução: Execute o arquivo 'fix_database.sql' no seu painel do Supabase para corrigir a estrutura das tabelas.");
          } else {
              alert("Configurações salvas com sucesso!");
          }
      }
  };

  const handleDeleteLog = async (id: string) => {
      const previousLogs = [...logs];
      setLogs(prev => prev.filter(log => log.id !== id));
      if (currentLogId === id) { setCurrentLogId(null); setStatus(WorkStatus.IDLE); }
      const result = await deleteRemoteLog(id);
      if (!result.success) setLogs(previousLogs);
  };

  const handleEditLog = (log: TimeLog) => {
    setEditingLog(log);
    setIsManualLogModalOpen(true);
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const getLocalDateString = (d: Date) => {
     const offset = d.getTimezoneOffset();
     const local = new Date(d.getTime() - (offset * 60 * 1000));
     return local.toISOString().split('T')[0];
  };

  const handleStartWork = () => {
    const todayStr = getLocalDateString(new Date());
    if (logs.some(l => l.date === todayStr)) {
        alert("Já existe um registro para hoje.");
        return;
    }
    const newLog: TimeLog = { id: generateId(), date: todayStr, startTime: new Date().toISOString(), breaks: [], absences: [], totalDurationMs: 0 };
    setLogs(prev => [...prev, newLog]);
    setCurrentLogId(newLog.id);
    setStatus(WorkStatus.WORKING);
    saveLogToRemote(newLog);
  };

  const handleStartBreak = (type: 'LUNCH' | 'COFFEE') => {
    if (!currentLogId) return;
    const newBreak: Break = { id: generateId(), startTime: new Date().toISOString(), type };
    setLogs(prev => prev.map(log => log.id === currentLogId ? { ...log, breaks: [...log.breaks, newBreak] } : log));
    setStatus(type === 'LUNCH' ? WorkStatus.ON_LUNCH : WorkStatus.ON_COFFEE);
    const updated = logs.find(l => l.id === currentLogId);
    if (updated) saveLogToRemote({ ...updated, breaks: [...updated.breaks, newBreak] });
  };

  const handleEndBreak = () => {
    if (!currentLogId) return;
    const nowIso = new Date().toISOString();
    setLogs(prev => prev.map(log => {
        if (log.id !== currentLogId) return log;
        const updatedBreaks = [...log.breaks];
        const last = updatedBreaks[updatedBreaks.length - 1];
        if (last && !last.endTime) updatedBreaks[updatedBreaks.length - 1] = { ...last, endTime: nowIso };
        const updatedLog = { ...log, breaks: updatedBreaks };
        saveLogToRemote(updatedLog);
        return updatedLog;
    }));
    setStatus(WorkStatus.WORKING);
  };

  const handleEndWork = () => {
    if (!currentLogId) return;
    const nowIso = new Date().toISOString();
    setLogs(prev => prev.map(log => {
      if (log.id === currentLogId) {
          const startTime = new Date(log.startTime).getTime();
          const endTime = new Date(nowIso).getTime();
          let duration = endTime - startTime;
          const updatedBreaks = log.breaks.map(b => !b.endTime ? { ...b, endTime: nowIso } : b);
          updatedBreaks.forEach(b => { if (b.type === 'LUNCH') duration -= (new Date(b.endTime!).getTime() - new Date(b.startTime).getTime()); });
          const updatedLog = { ...log, endTime: nowIso, breaks: updatedBreaks, totalDurationMs: Math.max(0, duration) }; 
          saveLogToRemote(updatedLog);
          return updatedLog;
      }
      return log;
    }));
    setStatus(WorkStatus.FINISHED);
    setCurrentLogId(null);
  };

  const handleSaveManualLog = (log: TimeLog) => {
    setLogs(prev => prev.some(l => l.id === log.id) ? prev.map(l => l.id === log.id ? log : l) : [...prev, log].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    saveLogToRemote(log);
    setEditingLog(null);
  };

  const handleSaveAbsence = async (absenceData: Omit<Absence, 'id'>) => {
    if (!activeUser) return;
    
    // Check if there's a log for this date. If yes, add to that log. If not, save as standalone.
    const logOnDate = logs.find(l => l.date === absenceData.date);
    
    if (logOnDate) {
        const newAbsence: Absence = { id: generateId(), ...absenceData };
        setLogs(prev => prev.map(log => {
            if (log.id === logOnDate.id) {
                const updated = { ...log, absences: [...(log.absences || []), newAbsence] };
                saveLogToRemote(updated);
                return updated;
            }
            return log;
        }));
    } else {
        const result = await import('./services/dataService').then(m => m.upsertStandaloneAbsence(absenceData, activeUser.id));
        if (result.success) {
            // Re-fetch data to update UI if needed
            const { standaloneAbsences: fetchedStandalone } = await fetchRemoteData(activeUser.id);
            setStandaloneAbsences(fetchedStandalone || []);
        } else {
            alert("Erro ao salvar justificativa: " + result.error);
        }
    }
  };

  const todayLog = logs.find(l => l.date === getLocalDateString(now));
  const workedMs = todayLog ? (() => {
      let total = (todayLog.endTime ? new Date(todayLog.endTime).getTime() : now.getTime()) - new Date(todayLog.startTime).getTime();
      todayLog.breaks.forEach(brk => { if (brk.type === 'LUNCH') total -= ((brk.endTime ? new Date(brk.endTime).getTime() : now.getTime()) - new Date(brk.startTime).getTime()); });
      return Math.max(0, total);
  })() : 0;

  const workedHours = Math.floor(workedMs / 3600000);
  const workedMinutes = Math.floor((workedMs % 3600000) / 60000);
  const workedSeconds = Math.floor((workedMs % 60000) / 1000);
  const currencySymbol = settings.currency === 'BRL' ? 'R$' : settings.currency === 'USD' ? '$' : '€';

  const filteredSuggestions = usersList.filter(u => u.name.toLowerCase().includes(searchName.toLowerCase())).slice(0, 4);

  if (!activeUser && !isLoadingData) {
      return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-500 ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
            <div className="max-w-lg w-full animate-in zoom-in-95 duration-500">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/20 rotate-3">
                        <ClockIcon size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-2">Ponto<span className="text-indigo-600">Inteligente</span></h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Controle de jornada seguro</p>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white dark:border-slate-800 shadow-2xl relative">
                    <div className="space-y-6">
                        {/* Campo de Nome com Sugestões */}
                        <div className="relative">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-2">
                                <User size={12}/> Nome do Usuário
                            </label>
                            <div className="relative group">
                                <input 
                                    ref={searchInputRef}
                                    type="text" 
                                    value={searchName}
                                    onChange={e => { setSearchName(e.target.value); setShowSuggestions(true); setSelectedLoginUser(null); }}
                                    onFocus={() => setShowSuggestions(true)}
                                    placeholder="Comece a digitar seu nome..."
                                    className="w-full p-4 pl-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-lg"
                                />
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
                                {showSuggestions && searchName && filteredSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        {filteredSuggestions.map(user => (
                                            <button 
                                                key={user.id} 
                                                onClick={() => { setSearchName(user.name); setSelectedLoginUser(user); setShowSuggestions(false); setPinBuffer(''); }}
                                                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-0 border-slate-100 dark:border-slate-700 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-bold text-[10px] uppercase">{user.name.substring(0,2)}</div>
                                                <div className="text-left flex-1">
                                                    <p className="font-bold text-slate-800 dark:text-white text-sm leading-tight">{user.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{user.company}</p>
                                                </div>
                                                <ArrowRight size={14} className="text-slate-300" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PIN Pad */}
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block flex items-center gap-2">
                                <Key size={12}/> PIN de Acesso {selectedLoginUser ? `para ${selectedLoginUser.name.split(' ')[0]}` : ''}
                            </label>
                            
                            <div className="flex justify-center gap-4 mb-6">
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${pinBuffer.length > i ? 'bg-indigo-500 border-indigo-500 scale-125 shadow-lg shadow-indigo-500/40' : 'border-slate-200 dark:border-slate-700'} ${pinError ? 'bg-rose-500 border-rose-500 animate-shake' : ''}`}></div>
                                ))}
                            </div>

                            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '←'].map(key => (
                                    <button 
                                        key={key} 
                                        onClick={() => {
                                            if (key === 'C') setPinBuffer('');
                                            else if (key === '←') setPinBuffer(p => p.slice(0, -1));
                                            else handlePinInput(key.toString());
                                        }}
                                        className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-xl hover:bg-indigo-600 hover:text-white active:scale-90 transition-all shadow-sm border border-slate-100/50 dark:border-slate-700/50"
                                    >
                                        {key === '←' ? <Delete size={20} className="mx-auto" /> : key}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t dark:border-slate-800 flex justify-center">
                        <button 
                            onClick={() => setIsSettingsOpen(true)} 
                            className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-indigo-500 hover:text-white transition-all shadow-sm active:scale-90"
                            title="Configurações Admin"
                        >
                            <SettingsIcon size={20} />
                        </button>
                    </div>
                </div>
                <Signature />
            </div>
            <SettingsModal isOpen={isSettingsOpen} onClose={() => { setIsSettingsOpen(false); refreshUsersList(); }} settings={settings} onSave={handleSaveSettings} currentUser={null} onSelectUser={setActiveUser} systemHolidays={systemHolidays} isAdmin={isGlobalAdmin} setIsAdmin={setIsGlobalAdmin} />
        </div>
      );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans selection:bg-indigo-500/20 ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/10 dark:bg-violet-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col min-h-screen">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 sm:mb-12 gap-6">
          <div className="flex items-center gap-3">
             <div className="bg-white dark:bg-slate-800 p-2 sm:p-3 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700">
                <ClockIcon size={24} className="text-indigo-600 dark:text-indigo-400" />
             </div>
             <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Ponto<span className="text-indigo-600">Inteligente</span></h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{activeUser?.company || 'Sistema de Ponto'}</p>
             </div>
          </div>

      <div className="flex items-center gap-3">
             {deferredPrompt && (
                <button 
                  onClick={handleInstallClick} 
                  className="flex items-center gap-2 px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 text-[10px] sm:text-xs font-bold uppercase tracking-wider active:scale-95 transition-all animate-bounce-subtle"
                  title="Instalar Aplicação"
                >
                   <Download size={16} /> <span>Instalar App</span>
                </button>
             )}
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/10 backdrop-blur-sm shadow-sm">
                <Database size={14} className={dbConnected ? "text-emerald-500" : "text-rose-500"} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {dbConnected ? 'Online' : 'Offline'}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${dbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
             </div>
             <button onClick={toggleTheme} className="p-2 sm:p-3 rounded-full bg-white/40 dark:bg-white/5 hover:bg-white/80 transition-all text-slate-600 dark:text-slate-400"><Sun size={18}/></button>
             <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 text-xs font-bold uppercase tracking-wider active:scale-95 transition-all">
                <LogOut size={16} /> <span className="hidden sm:inline">Sair</span>
             </button>
             <button onClick={() => setIsReportsOpen(true)} className="p-2 sm:p-3 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95 transition-all" title="Relatórios"><TrendingUp size={18}/></button>
             <button onClick={() => setIsSettingsOpen(true)} className="p-2 sm:p-3 rounded-full bg-slate-800 text-white dark:bg-white dark:text-slate-900 active:scale-95 transition-all shadow-lg" title="Configurações"><SettingsIcon size={18}/></button>
          </div>
        </header>

        {isLoadingData ? (
            <div className="flex-1 flex items-center justify-center min-h-[400px]"><Loader2 className="animate-spin text-indigo-500" size={40} /></div>
        ) : (
            <main className="flex-1 space-y-8 animate-in fade-in duration-700">
                <div className="flex flex-col items-center relative">
                    <div className="absolute top-0 right-0"><StatusBadge status={status} /></div>
                    <Clock />
                    <div className="mt-8 flex items-center gap-6">
                        {status === WorkStatus.IDLE || status === WorkStatus.FINISHED ? (
                            <div className="flex flex-col items-center gap-6">
                                <button onClick={handleStartWork} className="w-24 h-24 rounded-full bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all relative group">
                                    <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                    <Play size={32} className="ml-1 fill-current" />
                                </button>
                                <button 
                                    onClick={() => setIsAbsenceModalOpen(true)} 
                                    className="px-6 py-3 rounded-2xl bg-white/40 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-sm"
                                >
                                    <CalendarOff size={14} className="text-rose-500" /> Registrar Justificativa / Falta
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-4 items-center">
                                {status === WorkStatus.WORKING && (
                                    <>
                                        <button onClick={() => handleStartBreak('LUNCH')} className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 border-2 border-amber-200 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"><Utensils size={20}/></button>
                                        <button onClick={() => handleStartBreak('COFFEE')} className="w-14 h-14 rounded-full bg-teal-100 text-teal-600 border-2 border-teal-200 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"><Coffee size={20}/></button>
                                    </>
                                )}
                                {(status === WorkStatus.ON_LUNCH || status === WorkStatus.ON_COFFEE) && (
                                    <button onClick={handleEndBreak} className="w-20 h-20 rounded-full bg-emerald-500 text-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"><PlayCircle size={28}/></button>
                                )}
                                <button onClick={handleEndWork} className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 border-2 border-rose-200 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all"><StopCircle size={24}/></button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Timer} label="Trabalhado" value={`${String(workedHours).padStart(2, '0')}:${String(workedMinutes).padStart(2, '0')}:${String(workedSeconds).padStart(2, '0')}`} active={status !== WorkStatus.IDLE} colorClass="text-indigo-500" />
                    <StatCard icon={Users} label="Usuário" value={activeUser?.name.split(' ')[0]} subValue={activeUser?.company} colorClass="text-slate-500" />
                    <StatCard icon={DollarSign} label="Valor Hora" value={`${currencySymbol} ${settings.hourlyRate.toFixed(2)}`} colorClass="text-emerald-500" />
                    <StatCard icon={Utensils} label="V. Refeição" value={`${currencySymbol} ${settings.foodAllowance.toFixed(2)}`} colorClass="text-orange-500" />
                </div>
                
                <LogHistory 
                    logs={logs} 
                    user={activeUser} 
                    settings={settings} 
                    systemHolidays={systemHolidays} 
                    onDelete={handleDeleteLog} 
                    onEdit={handleEditLog} 
                    onAddManual={() => setIsManualLogModalOpen(true)} 
                    onOpenReports={() => setIsReportsOpen(true)}
                    currentLogId={currentLogId} 
                    standaloneAbsences={standaloneAbsences}
                />
            </main>
        )}
        
        <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-4">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Ponto Inteligente v1.2 | Logado como {activeUser?.name}
             </div>
             <Signature />
        </footer>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => { setIsSettingsOpen(false); refreshUsersList(); }} settings={settings} onSave={handleSaveSettings} currentUser={activeUser} onSelectUser={setActiveUser} systemHolidays={systemHolidays} isAdmin={isGlobalAdmin} setIsAdmin={setIsGlobalAdmin} />
      <ReportsPortal isOpen={isReportsOpen} onClose={() => setIsReportsOpen(false)} currentUser={activeUser} isAdmin={isGlobalAdmin} />
      <AbsenceModal isOpen={isAbsenceModalOpen} onClose={() => setIsAbsenceModalOpen(false)} onSave={handleSaveAbsence} />
      <ManualLogModal isOpen={isManualLogModalOpen} onClose={() => { setIsManualLogModalOpen(false); setEditingLog(null); }} onSave={handleSaveManualLog} initialLog={editingLog} existingDates={logs.map(l => l.date)} settings={settings} />
    </div>
  );
};

export default App;
