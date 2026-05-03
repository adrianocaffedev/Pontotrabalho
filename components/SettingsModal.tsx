
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, BellRing, Briefcase, Coins, Utensils, Percent, Calendar, Plus, Trash2, Users, Check, UserPlus, Loader2, Settings as SettingsIcon, Lock, Unlock, ShieldAlert, AlertTriangle, Cloud, Edit2, History, Key, ShieldCheck, Globe, CalendarDays, Info, MessageSquare, Files } from 'lucide-react';
import { AppSettings, AppUser, ContractRenewal } from '../types';
import { getAppUsers, createAppUser, deleteAppUser, verifyAdminPassword, updateAppUser, fetchAllJustifications } from '../services/dataService';
import { getTranslation, TranslationKey } from '../services/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => Promise<void>;
  currentUser: AppUser | null;
  onSelectUser: (user: AppUser | null) => void;
  systemHolidays?: string[];
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    settings, 
    onSave, 
    currentUser, 
    onSelectUser, 
    systemHolidays = [],
    isAdmin,
    setIsAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'general' | 'justifications'>(currentUser ? 'general' : 'users');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const t = (key: TranslationKey) => getTranslation(settings.language || 'pt-PT', key);
  const [isSaving, setIsSaving] = useState(false);
  
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  const [justifications, setJustifications] = useState<any[]>([]);
  const [loadingJustifications, setLoadingJustifications] = useState(false);
  
  const [newUser, setNewUser] = useState<Partial<AppUser>>({
    name: '',
    company: '',
    jobTitle: '',
    contractType: 'EFFECTIVE',
    contractStartDate: new Date().toISOString().split('T')[0],
    pin: '',
    isAdmin: false,
    renewals: []
  });

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<AppUser>>({});
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setFormData(settings);
        if (!currentUser) {
            setActiveTab('users');
        } else {
            setActiveTab('general');
            // If the logged in user is an admin, automatically grant admin view
            if (currentUser.isAdmin) {
                setIsAdmin(true);
            }
        }
        fetchUsers();
    }
  }, [isOpen, currentUser, settings, setIsAdmin]);

  useEffect(() => {
    if (activeTab === 'justifications' && isAdmin) {
        fetchJustifications();
    }
  }, [activeTab, isAdmin]);

  const fetchUsers = async () => {
      setLoadingUsers(true);
      const users = await getAppUsers();
      setUsersList(users);
      setLoadingUsers(false);
  };

  const fetchJustifications = async () => {
      setLoadingJustifications(true);
      const data = await fetchAllJustifications();
      setJustifications(data);
      setLoadingJustifications(false);
  };

  const handleCreateUser = async () => {
      if (!newUser.name?.trim()) return;
      setCreatingUser(true);
      const { user, error } = await createAppUser(newUser);
      setCreatingUser(false);
      if (error) {
          alert("Erro ao criar funcionário: " + error);
      } else {
          await fetchUsers(); 
          setNewUser({ name: '', company: '', jobTitle: '', contractType: 'EFFECTIVE', contractStartDate: new Date().toISOString().split('T')[0], pin: '', isAdmin: false, renewals: [] });
      }
  };

  const handleEditClick = (user: AppUser) => {
      setEditingUserId(user.id);
      setEditingUser({ ...user });
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUserId || !editingUser.name?.trim()) return;
      setIsUpdatingUser(true);
      const { success, error } = await updateAppUser(editingUserId, editingUser);
      if (success) {
          await fetchUsers();
          setEditingUserId(null);
      } else {
          alert("Erro ao salvar: " + error);
      }
      setIsUpdatingUser(false);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      await onSave(formData);
      setIsSaving(false);
      onClose();
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsVerifying(true);
      const { verified, error } = await verifyAdminPassword(adminPassword);
      if (verified) {
          setIsAdmin(true);
          setAdminPassword('');
          setAuthError(null);
          setActiveTab('users');
      } else {
          setAuthError(error || 'Senha incorreta.');
      }
      setIsVerifying(false);
  };

  const toggleDay = (day: number) => {
      const currentDays = formData.overtimeDays || [];
      const newDays = currentDays.includes(day)
          ? currentDays.filter(d => d !== day)
          : [...currentDays, day];
      setFormData({ ...formData, overtimeDays: newDays });
  };

  const daysOfWeek = [
      { id: 0, label: 'D' },
      { id: 1, label: 'S' },
      { id: 2, label: 'T' },
      { id: 3, label: 'Q' },
      { id: 4, label: 'Q' },
      { id: 5, label: 'S' },
      { id: 6, label: 'S' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in text-left">
      <div className="bg-[#111827] dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-hidden flex flex-col border border-white/10 relative transition-colors">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-8 py-6 shrink-0">
          <div className="flex items-center gap-3">
              <SettingsIcon size={18} className="text-indigo-400"/>
              <h3 className="text-base font-bold text-white tracking-tight">Configurações Globais</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 p-2 rounded-xl hover:bg-white/5 transition-colors"><X size={24} /></button>
        </div>
        
        {/* Tab Headers */}
        {isAdmin && (
            <div className="flex px-8 border-b border-white/5 bg-slate-900/50">
                <button onClick={() => setActiveTab('users')} className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'users' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    {t('settings_users')}
                </button>
                <button onClick={() => setActiveTab('general')} className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'general' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    {t('settings_general')}
                </button>
                <button onClick={() => setActiveTab('justifications')} className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'justifications' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    {t('settings_justifications')}
                </button>
            </div>
        )}

        <div className="overflow-y-auto px-8 pb-8 flex-1 scrollbar-hide">
        
        {activeTab === 'justifications' && isAdmin && (
            <div className="space-y-6 pt-6 animate-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Histórico de Ocorrências</h4>
                    <button onClick={fetchJustifications} className="text-indigo-400 hover:text-indigo-300 transition-all"><History size={16}/></button>
                </div>
                
                {loadingJustifications ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>
                ) : justifications.length === 0 ? (
                    <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                        <MessageSquare size={32} className="mx-auto text-slate-600 mb-3 opacity-20" />
                        <p className="text-xs text-slate-500 font-medium tracking-tight">Nenhuma justificativa registrada ainda.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {justifications.map(just => (
                            <div key={just.id} className="p-5 bg-slate-800/40 border border-white/5 rounded-xl shadow-sm">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[10px] ${just.type === 'ABSENCE' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {just.type === 'ABSENCE' ? 'F' : 'A'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-white">{just.app_users?.name || 'Desconhecido'}</p>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{new Date(just.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-widest ${just.type === 'ABSENCE' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                        {just.type === 'ABSENCE' ? 'Falta' : 'Atraso'}
                                    </span>
                                </div>
                                <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                                    <p className="text-xs text-slate-300 leading-relaxed italic">"{just.reason}"</p>
                                </div>
                                {just.type === 'DELAY' && just.start_time && just.end_time && (
                                    <div className="mt-3 flex gap-4">
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase">
                                            <Clock size={10} className="text-slate-600" /> Esperado: <span className="text-slate-300">{just.start_time}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase">
                                            <Clock size={10} className="text-slate-600" /> Chegada: <span className="text-slate-300">{just.end_time}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
        
        {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="space-y-8 animate-in slide-in-from-left-4">
                
                {/* Configurações de Horários de Turno e Lembretes */}
                <div className="space-y-4 p-5 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 shadow-sm shadow-indigo-500/5">
                    <h4 className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-[0.2em] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <BellRing size={12}/> {t('settings_shift_schedule')}
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] lowercase opacity-50">Notificações</span>
                           <button 
                            type="button" 
                            onClick={() => setFormData({...formData, enableNotifications: !formData.enableNotifications})}
                            className={`w-10 h-5 rounded-full relative transition-all duration-300 ${formData.enableNotifications ? 'bg-indigo-500' : 'bg-slate-700'}`}
                           >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 ${formData.enableNotifications ? 'left-5.5' : 'left-0.5'}`}></div>
                           </button>
                        </div>
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('settings_shift_start')}</label>
                            <input 
                                type="time"
                                value={formData.shiftStart || '08:00'}
                                onChange={e => setFormData({...formData, shiftStart: e.target.value})}
                                className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('settings_shift_end')}</label>
                            <input 
                                type="time"
                                value={formData.shiftEnd || '17:00'}
                                onChange={e => setFormData({...formData, shiftEnd: e.target.value})}
                                className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('settings_lunch_start')}</label>
                            <input 
                                type="time"
                                value={formData.lunchStart || '12:00'}
                                onChange={e => setFormData({...formData, lunchStart: e.target.value})}
                                className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('settings_reminder_buffer')}</label>
                            <div className="relative">
                                <input 
                                    type="number"
                                    value={formData.reminderBufferMinutes || 0}
                                    onChange={e => setFormData({...formData, reminderBufferMinutes: Number(e.target.value)})}
                                    className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/-2 text-[9px] font-black text-slate-600 uppercase">min</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configurações de Jornada e Intervalos */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={12} className="text-indigo-400"/> Horários e Jornada
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Jornada Diária (Horas)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.5"
                                    value={formData.dailyWorkHours || ''} 
                                    onChange={e => setFormData({...formData, dailyWorkHours: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                    placeholder="8"
                                    className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs uppercase">horas</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Almoço (Minutos)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={formData.lunchDurationMinutes || ''} 
                                        onChange={e => setFormData({...formData, lunchDurationMinutes: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                        placeholder="60"
                                        className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs uppercase">min</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Café (Minutos)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        value={formData.coffeeDurationMinutes || ''} 
                                        onChange={e => setFormData({...formData, coffeeDurationMinutes: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                        placeholder="15"
                                        className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs uppercase">min</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configurações de Notificação */}
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <BellRing size={12} className="text-indigo-400"/> Notificação (Saída e Almoço)
                    </label>
                    <div className="relative">
                        <input 
                            type="number" 
                            value={formData.notificationMinutes || ''} 
                            onChange={e => setFormData({...formData, notificationMinutes: e.target.value === '' ? 0 : Number(e.target.value)})} 
                            placeholder="0"
                            className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-lg" 
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs uppercase">minutos</span>
                    </div>
                    <div className="flex items-start gap-2 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-xl">
                        <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">Este tempo define o aviso prévio para o fim da jornada e para o retorno do intervalo de almoço.</p>
                    </div>
                </div>

                {/* Configurações Financeiras */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Coins size={12} className="text-emerald-400"/> Configurações Financeiras
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Valor Hora</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={formData.hourlyRate || ''} 
                                    onChange={e => setFormData({...formData, hourlyRate: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                    placeholder="0.00"
                                    className="w-full p-4 pl-8 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Subsídio Almoço (Dia)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={formData.foodAllowance || ''} 
                                onChange={e => setFormData({...formData, foodAllowance: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                placeholder="0.00"
                                className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Extra (%) em dia útil</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                <input 
                                    type="number" 
                                    value={formData.overtimePercentage || ''} 
                                    onChange={e => setFormData({...formData, overtimePercentage: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                    placeholder="0"
                                    className="w-full p-4 pl-8 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Moeda</label>
                            <select 
                                value={formData.currency} 
                                onChange={e => setFormData({...formData, currency: e.target.value as any})}
                                className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all cursor-pointer"
                            >
                                <option value="EUR">Euro (€)</option>
                                <option value="BRL">Real (R$)</option>
                                <option value="USD">Dólar ($)</option>
                            </select>
                        </div>
                    </div>

                    {/* Novo seletor de Idioma */}
                    <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                            <Globe size={12} className="text-indigo-400"/> Idioma da Interface
                        </label>
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, language: 'pt-BR'})}
                                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${formData.language === 'pt-BR' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                PT-BR
                            </button>
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, language: 'pt-PT'})}
                                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${formData.language === 'pt-PT' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                PT-PT
                            </button>
                            <button 
                                type="button"
                                onClick={() => setFormData({...formData, language: 'en'})}
                                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${formData.language === 'en' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                ENGLISH
                            </button>
                        </div>
                    </div>

                    {/* Taxas de Segurança Social e IRS */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                                <ShieldAlert size={12} className="text-amber-400"/> Seg. Social (%)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={formData.socialSecurityRate || ''} 
                                    onChange={e => setFormData({...formData, socialSecurityRate: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                    placeholder="0.0"
                                    className="w-full p-4 pl-8 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-amber-500/20" 
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                                <AlertTriangle size={12} className="text-rose-400"/> IRS (%)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={formData.irsRate || ''} 
                                    onChange={e => setFormData({...formData, irsRate: e.target.value === '' ? 0 : Number(e.target.value)})} 
                                    placeholder="0.0"
                                    className="w-full p-4 pl-8 bg-slate-800/50 border border-slate-700 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-rose-500/20" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dias de Folga */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CalendarDays size={12} className="text-orange-400"/> Dias com Valor Dobrado (100% Extra)
                    </h4>
                    <div className="flex justify-between gap-1 p-1 bg-slate-800/30 rounded-2xl border border-slate-700">
                        {daysOfWeek.map((day) => (
                            <button
                                key={day.id}
                                type="button"
                                onClick={() => toggleDay(day.id)}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                                    (formData.overtimeDays || []).includes(day.id)
                                        ? 'bg-orange-600 text-white shadow-lg'
                                        : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-500 italic text-center leading-relaxed">Clique nos dias que são considerados folga remunerada a 100%.</p>
                </div>

                {/* Botão Salvar Estilo Mockup */}
                <button type="submit" disabled={isSaving} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 relative overflow-hidden group mt-6 cursor-pointer">
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                    <span className="text-base">{t('settings_save_btn')}</span>
                </button>
            </form>
        )}

        {activeTab === 'users' && (!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-10 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-white/5">
                    <ShieldCheck className="text-indigo-400" size={36} />
                </div>
                <h3 className="font-bold text-white mb-2 text-center text-lg">Área do Administrador</h3>
                <p className="text-sm text-slate-400 font-medium mb-8 text-center max-w-[260px]">Acesso restrito para administradores do sistema.</p>
                <form onSubmit={handleAdminLogin} className="w-full max-w-xs space-y-6">
                    <div className="relative">
                        <input 
                            type="password" 
                            value={adminPassword} 
                            onChange={e => setAdminPassword(e.target.value)} 
                            placeholder="PIN Administrativo" 
                            className="w-full p-5 pl-14 border border-slate-700 rounded-xl bg-slate-800/50 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-center tracking-[0.5em] font-bold text-xl" 
                            autoFocus
                        />
                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
                    </div>
                    {authError && <p className="text-[10px] text-rose-500 font-bold text-center uppercase tracking-wider animate-shake">{authError}</p>}
                    <button type="submit" disabled={isVerifying} className="w-full bg-white text-slate-950 py-4 rounded-xl font-bold active:scale-95 transition-all shadow-lg flex items-center justify-center text-base hover:bg-slate-100 cursor-pointer">
                        {isVerifying ? <Loader2 className="animate-spin" size={20}/> : 'Desbloquear Acesso'}
                    </button>
                    {currentUser && (
                        <button type="button" onClick={() => setActiveTab('general')} className="w-full text-slate-500 text-[10px] font-bold uppercase tracking-widest pt-4 hover:text-slate-300">Voltar para Minhas Configurações</button>
                    )}
                </form>
            </div>
        ) : (
            <div className="space-y-8 animate-in slide-in-from-right-4">
                <div className="bg-slate-800/20 p-6 rounded-2xl border border-dashed border-slate-700">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-white"><UserPlus size={18} className="text-indigo-400"/> Novo Funcionário</h4>
                    <div className="space-y-4">
                        <input placeholder="Nome Completo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        <input placeholder="Empresa" value={newUser.company} onChange={e => setNewUser({...newUser, company: e.target.value})} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Cargo" value={newUser.jobTitle} onChange={e => setNewUser({...newUser, jobTitle: e.target.value})} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            <input placeholder="PIN" maxLength={4} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value})} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-center" />
                        </div>
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                             <button 
                                onClick={() => setNewUser({...newUser, isAdmin: false})}
                                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${!newUser.isAdmin ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                             >
                                Padrão
                             </button>
                             <button 
                                onClick={() => setNewUser({...newUser, isAdmin: true})}
                                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${newUser.isAdmin ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500'}`}
                             >
                                Administrador (Super Usuário)
                             </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Regime Contratual</label>
                            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                                <button 
                                    onClick={() => setNewUser({...newUser, contractType: 'EFFECTIVE'})}
                                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${newUser.contractType === 'EFFECTIVE' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500'}`}
                                >
                                    Efetivo
                                </button>
                                <button 
                                    onClick={() => setNewUser({...newUser, contractType: 'TEMPORARY'})}
                                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${newUser.contractType === 'TEMPORARY' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500'}`}
                                >
                                    Temporário (PT)
                                </button>
                            </div>
                        </div>
                        <button onClick={handleCreateUser} disabled={creatingUser || !newUser.name} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg">
                            {creatingUser ? <Loader2 className="animate-spin" size={18}/> : <Plus size={18}/>} Criar Cadastro
                        </button>
                    </div>
                </div>

                <div className="space-y-4 pb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Lista de Colaboradores ({usersList.length})</h4>
                    <div className="space-y-3">
                        {usersList.map(user => (
                            <div key={user.id} className="p-5 bg-slate-800/40 border border-white/5 rounded-xl shadow-sm transition-all hover:bg-slate-800/60">
                                {editingUserId === user.id ? (
                                    <form onSubmit={handleSaveEditUser} className="space-y-4">
                                        <input 
                                            value={editingUser.name || ''} 
                                            onChange={e => setEditingUser({...editingUser, name: e.target.value})} 
                                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                                        />
                                        <input 
                                            placeholder="Empresa"
                                            value={editingUser.company || ''} 
                                            onChange={e => setEditingUser({...editingUser, company: e.target.value})} 
                                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input 
                                                placeholder="Cargo"
                                                value={editingUser.jobTitle || ''} 
                                                onChange={e => setEditingUser({...editingUser, jobTitle: e.target.value})} 
                                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                                            />
                                            <input 
                                                placeholder="PIN"
                                                maxLength={4}
                                                value={editingUser.pin || ''} 
                                                onChange={e => setEditingUser({...editingUser, pin: e.target.value})} 
                                                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono text-center"
                                            />
                                        </div>
                                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                                            <button 
                                                type="button"
                                                onClick={() => setEditingUser({...editingUser, isAdmin: false})}
                                                className={`flex-1 py-1.5 text-[8px] font-bold uppercase tracking-widest rounded-lg transition-all ${!editingUser.isAdmin ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                                            >
                                                Comum
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setEditingUser({...editingUser, isAdmin: true})}
                                                className={`flex-1 py-1.5 text-[8px] font-bold uppercase tracking-widest rounded-lg transition-all ${editingUser.isAdmin ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}
                                            >
                                                Admin (Super)
                                            </button>
                                        </div>
                                        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700">
                                            <button 
                                                type="button"
                                                onClick={() => setEditingUser({...editingUser, contractType: 'EFFECTIVE'})}
                                                className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${editingUser.contractType === 'EFFECTIVE' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}
                                            >
                                                Efetivo
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setEditingUser({...editingUser, contractType: 'TEMPORARY'})}
                                                className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${editingUser.contractType === 'TEMPORARY' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}
                                            >
                                                Temporário
                                            </button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="submit" disabled={isUpdatingUser} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                                {isUpdatingUser ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>} Salvar
                                            </button>
                                            <button type="button" onClick={() => setEditingUserId(null)} className="px-4 bg-slate-700 text-white py-2.5 rounded-xl font-bold text-xs">
                                                <X size={14}/>
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm uppercase border border-indigo-500/20">
                                                {user.name.substring(0, 2)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-white">{user.name}</p>
                                                    {user.contractType === 'TEMPORARY' && (
                                                        <span className="text-[7px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-lg font-black uppercase tracking-tighter">TEMP</span>
                                                    )}
                                                    {user.isAdmin && (
                                                        <span className="text-[7px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-lg font-black uppercase tracking-tighter border border-amber-500/20">ADMIN</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{user.company || 'Geral'}</p>
                                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user.jobTitle || 'Colaborador'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEditClick(user)} className="p-3 text-slate-500 hover:text-white transition-all"><Edit2 size={18}/></button>
                                            <button onClick={async () => { if(confirm(`Excluir ${user.name}?`)) await deleteAppUser(user.id); fetchUsers(); }} className="p-3 text-slate-500 hover:text-rose-500 transition-all"><Trash2 size={18}/></button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
