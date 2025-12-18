
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, BellRing, Briefcase, Coins, Utensils, Percent, Calendar, Plus, Trash2, Users, Check, UserPlus, Loader2, Settings as SettingsIcon, Lock, Unlock, ShieldAlert, AlertTriangle, Cloud, Edit2 } from 'lucide-react';
import { AppSettings, AppUser } from '../types';
import { getAppUsers, createAppUser, deleteAppUser, verifyAdminPassword, updateAppUser } from '../services/dataService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => Promise<void>;
  // User Management Props
  currentUser: AppUser | null;
  onSelectUser: (user: AppUser | null) => void;
  // System Data
  systemHolidays?: string[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, currentUser, onSelectUser, systemHolidays = [] }) => {
  const [activeTab, setActiveTab] = useState<'selection' | 'users' | 'general'>('selection');

  const [formData, setFormData] = useState<AppSettings>(settings);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // User Management State
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  // User Editing State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Admin / Security State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    setFormData(settings);
    if (isOpen) {
        fetchUsers();
        // Default to selection tab
        setActiveTab('selection');
        setIsSaving(false);
        setConfirmDeleteId(null);
        setEditingUserId(null);
        // Reset Admin Access on Open
        setIsAdmin(false);
        setAdminPassword('');
        setAuthError(null);
        setIsVerifying(false);
    }
  }, [settings, isOpen]);

  const fetchUsers = async () => {
      setLoadingUsers(true);
      const users = await getAppUsers();
      setUsersList(users);
      setLoadingUsers(false);
  };

  const handleCreateUser = async () => {
      if (!newUserName.trim()) return;
      setCreatingUser(true);
      
      const { user, error } = await createAppUser(newUserName.trim());
      
      setCreatingUser(false);

      if (error) {
          alert("Erro ao criar usuário: " + error);
          return;
      }

      if (user) {
          setUsersList([...usersList, user]);
          setNewUserName('');
          // Se não tiver ninguém selecionado, seleciona o novo
          if (!currentUser) onSelectUser(user);
      }
  };

  const handleEditClick = (user: AppUser, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setEditingUserId(user.id);
      setEditingUserName(user.name);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUserId || !editingUserName.trim()) return;

      setIsUpdatingUser(true);
      const { success, error } = await updateAppUser(editingUserId, editingUserName.trim());
      setIsUpdatingUser(false);

      if (success) {
          setUsersList(prev => prev.map(u => u.id === editingUserId ? { ...u, name: editingUserName.trim() } : u));
          
          // Se for o usuário ativo, atualiza o estado global
          if (currentUser?.id === editingUserId) {
              onSelectUser({ ...currentUser, name: editingUserName.trim() });
          }
          
          setEditingUserId(null);
          setEditingUserName('');
      } else {
          alert("Erro ao atualizar usuário: " + error);
      }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setConfirmDeleteId(id);
      setEditingUserId(null); // Fecha edição se estiver aberta
  };

  const handleConfirmDelete = async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      setDeletingUserId(id);
      const { success, error } = await deleteAppUser(id);
      setDeletingUserId(null);

      if (success) {
          setUsersList(prev => prev.filter(u => u.id !== id));
          setConfirmDeleteId(null);
          if (currentUser?.id === id) {
              onSelectUser(null);
          }
      } else {
          alert("Erro ao remover usuário: " + error);
      }
  };
  
  const handleCancelDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setConfirmDeleteId(null);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsVerifying(true);
      setAuthError(null);

      const { verified, error } = await verifyAdminPassword(adminPassword);
      
      setIsVerifying(false);

      if (verified) {
          setIsAdmin(true);
          setAdminPassword('');
      } else {
          if (error) {
              setAuthError(error); 
          } else {
              setAuthError('Senha incorreta.'); 
          }
      }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
    onClose();
  };

  const handleMoneyChange = (valueStr: string, field: 'hourlyRate' | 'foodAllowance') => {
    const value = valueStr.replace(/\D/g, "");
    const numberValue = Number(value) / 100;
    setFormData({ ...formData, [field]: numberValue });
  };

  const formatDisplayValue = (val: number) => {
    return val.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
  };

  const getCurrencySymbol = (curr: string) => {
    switch(curr) {
        case 'EUR': return '€';
        case 'BRL': return 'R$';
        case 'USD': return '$';
        default: return '€';
    }
  }

  const currencySymbol = getCurrencySymbol(formData.currency || 'EUR');
  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const toggleOvertimeDay = (dayIndex: number) => {
    const currentDays = formData.overtimeDays || [];
    const newDays = currentDays.includes(dayIndex)
      ? currentDays.filter(d => d !== dayIndex)
      : [...currentDays, dayIndex];
    setFormData({ ...formData, overtimeDays: newDays.sort() });
  };

  const addHoliday = () => {
    if (!newHolidayDate) return;
    const currentHolidays = formData.holidays || [];
    if (!currentHolidays.includes(newHolidayDate)) {
        const updated = [...currentHolidays, newHolidayDate].sort();
        setFormData({ ...formData, holidays: updated });
    }
    setNewHolidayDate('');
  };

  const removeHoliday = (dateToRemove: string) => {
    const currentHolidays = formData.holidays || [];
    setFormData({ ...formData, holidays: currentHolidays.filter(d => d !== dateToRemove) });
  };

  const renderLockScreen = () => (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner relative overflow-hidden">
             <div className="absolute inset-0 bg-indigo-500/10 animate-pulse rounded-full"></div>
             <ShieldAlert size={40} className="text-slate-400 dark:text-slate-500 relative z-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Acesso Restrito</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 text-center max-w-xs">
              Esta área é reservada para administradores do sistema.
          </p>
          
          <form onSubmit={handleAdminLogin} className="w-full max-w-xs space-y-4">
              <div className="relative group">
                  <div className={`absolute inset-0 bg-indigo-500/20 rounded-xl blur transition-opacity duration-500 ${authError ? 'opacity-100 bg-rose-500/20' : 'opacity-0 group-focus-within:opacity-100'}`}></div>
                  <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden focus-within:border-indigo-500 dark:focus-within:border-indigo-500 transition-colors">
                      <div className="pl-4 text-slate-400">
                          <Lock size={18} />
                      </div>
                      <input 
                          type="password" 
                          placeholder="Senha de administrador"
                          value={adminPassword}
                          onChange={(e) => {
                              setAdminPassword(e.target.value);
                              setAuthError(null);
                          }}
                          className="w-full px-4 py-3 bg-transparent outline-none text-slate-700 dark:text-white placeholder-slate-400 font-medium"
                          autoFocus
                          disabled={isVerifying}
                      />
                  </div>
              </div>
              
              {authError && (
                  <div className={`p-3 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 animate-shake
                    ${authError.includes('Senha') 
                        ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/10' 
                        : 'text-amber-600 bg-amber-50 dark:bg-amber-900/10'
                    }`}>
                      {authError.includes('Senha') ? null : <AlertTriangle size={14}/>}
                      {authError}
                  </div>
              )}

              <button 
                  type="submit"
                  disabled={isVerifying}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-bold hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                  {isVerifying ? <Loader2 size={18} className="animate-spin" /> : <Unlock size={18} />}
                  {isVerifying ? 'Verificando...' : 'Desbloquear'}
              </button>
          </form>
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col border border-white/20 dark:border-slate-700 transition-colors relative">
        
        {/* Header com Abas */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 shrink-0">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide w-full mr-2">
              <button 
                onClick={() => setActiveTab('selection')}
                className={`text-sm font-bold pb-1 relative transition-colors whitespace-nowrap ${activeTab === 'selection' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
              >
                  Quem é você?
                  {activeTab === 'selection' && <div className="absolute -bottom-5 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full"></div>}
              </button>

              <button 
                onClick={() => setActiveTab('users')}
                className={`text-sm font-bold pb-1 relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'users' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
              >
                  Usuários
                  {!isAdmin && activeTab !== 'users' && <Lock size={12} className="opacity-50" />}
                  {activeTab === 'users' && <div className="absolute -bottom-5 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full"></div>}
              </button>
              
              <button 
                onClick={() => setActiveTab('general')}
                className={`text-sm font-bold pb-1 relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'general' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`}
              >
                  Sistema
                  {activeTab === 'general' && <div className="absolute -bottom-5 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full"></div>}
              </button>
          </div>
          <button onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full transition-all shrink-0">
            <X size={20} />
          </button>
        </div>
        
        <div className="overflow-y-auto p-4 sm:p-6 scrollbar-hide flex-1">
        
        {/* TAB SELEÇÃO */}
        {activeTab === 'selection' && (
            <div className="space-y-6 animate-in slide-in-from-left-4">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Users size={16} className="text-indigo-500" /> Selecione seu Usuário
                        </h4>
                    </div>
                    
                    {loadingUsers ? (
                        <div className="text-center py-8 text-slate-400 animate-pulse">Carregando equipe...</div>
                    ) : usersList.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center gap-2">
                            <UserPlus size={32} className="opacity-50" />
                            <p>Nenhum usuário cadastrado.</p>
                            <button onClick={() => setActiveTab('users')} className="text-indigo-500 font-bold text-sm underline">
                                Cadastrar novo usuário
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {usersList.map(user => (
                                <button 
                                    key={user.id}
                                    onClick={() => { onSelectUser(user); onClose(); }}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group
                                        ${currentUser?.id === user.id 
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/20 shadow-sm' 
                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-slate-600 hover:shadow-md hover:-translate-y-0.5'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold uppercase shadow-sm transition-transform group-hover:scale-110
                                            ${currentUser?.id === user.id 
                                                ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white' 
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                            }`}>
                                            {user.name.substring(0, 2)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`font-semibold text-base ${currentUser?.id === user.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {user.name}
                                            </span>
                                            {currentUser?.id === user.id && (
                                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Selecionado</span>
                                            )}
                                        </div>
                                    </div>
                                    {currentUser?.id === user.id && (
                                            <div className="p-2 text-indigo-500 bg-white dark:bg-slate-800 rounded-full shadow-sm">
                                                <Check size={16} strokeWidth={3} />
                                            </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* TAB GERAL */}
        {activeTab === 'general' && (
            !currentUser ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-500 dark:text-slate-400 text-center animate-in zoom-in-95">
                    <UserPlus size={48} className="mb-4 opacity-30" />
                    <p className="font-medium">Nenhum usuário selecionado.</p>
                    <p className="text-sm mt-2 max-w-[200px]">Por favor, selecione um usuário na aba "Quem é você?" para editar suas configurações.</p>
                </div>
            ) : (
            <form id="settings-form" onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-right-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30 md:col-span-2">
                        <div className="flex justify-between items-start mb-2">
                            <label className="block text-sm font-semibold text-emerald-900 dark:text-emerald-400 flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-300">
                                <Coins size={16} />
                            </div>
                            Valor da Hora
                            </label>
                            <select 
                                value={formData.currency || 'EUR'}
                                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                                className="bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900 text-xs font-bold text-emerald-800 dark:text-emerald-300 rounded-lg px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                <option value="EUR">EUR (€)</option>
                                <option value="BRL">BRL (R$)</option>
                                <option value="USD">USD ($)</option>
                            </select>
                        </div>
                        <div className="relative group">
                            <span className="absolute left-3 top-2.5 text-emerald-600 dark:text-emerald-400 font-medium group-focus-within:text-emerald-700 z-10">
                                {currencySymbol}
                            </span>
                            <input
                            type="text"
                            inputMode="numeric"
                            value={formData.hourlyRate === 0 ? '' : formatDisplayValue(formData.hourlyRate)}
                            onChange={(e) => handleMoneyChange(e.target.value, 'hourlyRate')}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100 font-medium rounded-xl focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 focus:border-emerald-500 outline-none transition-all placeholder-emerald-300"
                            placeholder="0,00"
                            />
                        </div>
                    </div>

                    <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100/50 dark:border-orange-900/30 md:col-span-2">
                        <label className="block text-sm font-semibold text-orange-900 dark:text-orange-400 mb-2 flex items-center gap-2">
                            <div className="p-1.5 bg-orange-100 dark:bg-orange-900/50 rounded-lg text-orange-600 dark:text-orange-300">
                                <Utensils size={16} />
                            </div>
                            Vale Refeição (Diário)
                        </label>
                        <div className="relative group">
                            <span className="absolute left-3 top-2.5 text-orange-600 dark:text-orange-400 font-medium group-focus-within:text-orange-700 z-10">
                                {currencySymbol}
                            </span>
                            <input
                            type="text"
                            inputMode="numeric"
                            value={formData.foodAllowance === 0 ? '' : formatDisplayValue(formData.foodAllowance || 0)}
                            onChange={(e) => handleMoneyChange(e.target.value, 'foodAllowance')}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/50 text-orange-900 dark:text-orange-100 font-medium rounded-xl focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/20 focus:border-orange-500 outline-none transition-all placeholder-orange-300"
                            placeholder="0,00"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                    <label className="block text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-300">
                        <Briefcase size={16} />
                    </div>
                    Jornada Diária (Horas)
                    </label>
                    <input
                    type="number"
                    min="1"
                    max="24"
                    step="0.5"
                    value={formData.dailyWorkHours || ''}
                    onChange={(e) => setFormData({...formData, dailyWorkHours: Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-100 font-medium rounded-xl focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/20 focus:border-indigo-500 outline-none transition-all"
                    />
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30 space-y-4">
                    <label className="block text-sm font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-300">
                        <Percent size={16} />
                    </div>
                    Configuração de Horas Extras
                    </label>
                    
                    <div>
                        <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">Bônus (%)</label>
                        <input
                        type="number"
                        min="0"
                        max="500"
                        value={formData.overtimePercentage || ''}
                        onChange={(e) => setFormData({...formData, overtimePercentage: Number(e.target.value)})}
                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100 font-medium rounded-xl focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5"><Calendar size={12} /> Dias 100% Extras</label>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 bg-emerald-100/50 dark:bg-emerald-900/20 p-2 rounded-xl">
                        {daysOfWeek.map((day, index) => (
                            <button
                            key={index}
                            type="button"
                            onClick={() => toggleOvertimeDay(index)}
                            className={`py-2 text-xs font-bold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500
                                ${(formData.overtimeDays || []).includes(index)
                                ? 'bg-emerald-500 text-white shadow'
                                : 'bg-white/50 dark:bg-slate-800/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50'
                                }
                            `}
                            >
                            {day}
                            </button>
                        ))}
                        </div>
                    </div>

                    {systemHolidays && systemHolidays.length > 0 && (
                        <div>
                             <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                                 <Cloud size={12} /> Feriados Nacionais (Automáticos)
                             </label>
                             <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1 scrollbar-hide bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700/50">
                                   {systemHolidays.map(date => (
                                       <div key={date} className="flex items-center gap-1 bg-white dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm opacity-80 cursor-default" title="Feriado do Sistema (Automático)">
                                           <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                               {new Date(date).toLocaleDateString('pt-BR')}
                                           </span>
                                       </div>
                                   ))}
                             </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                            <Calendar size={12} /> Feriados Manuais
                        </label>
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="date" 
                                value={newHolidayDate}
                                onChange={(e) => setNewHolidayDate(e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs font-bold text-emerald-900 dark:text-emerald-100 outline-none focus:border-emerald-500 dark:[color-scheme:dark]"
                            />
                            <button 
                                type="button"
                                onClick={addHoliday}
                                className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1 scrollbar-hide">
                            {formData.holidays && formData.holidays.length > 0 ? (
                                formData.holidays.map((date) => (
                                    <div key={date} className="flex items-center gap-1 bg-white dark:bg-emerald-900/30 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-sm">
                                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200">
                                            {new Date(date).toLocaleDateString('pt-BR')}
                                        </span>
                                        <button
                                            type="button" 
                                            onClick={() => removeHoliday(date)}
                                            className="text-emerald-400 hover:text-rose-500 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-[10px] text-emerald-500/60 italic px-1">Nenhum feriado manual cadastrado.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100/50 dark:border-amber-900/30">
                        <label className="block text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-300">
                            <Clock size={16} />
                        </div>
                        Almoço (min)
                        </label>
                        <input
                        type="number"
                        min="15"
                        max="180"
                        value={formData.lunchDurationMinutes || ''}
                        onChange={(e) => setFormData({...formData, lunchDurationMinutes: Number(e.target.value)})}
                        className="w-full pl-4 pr-8 py-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-100 font-medium rounded-xl focus:ring-4 focus:ring-amber-100 dark:focus:ring-amber-900/20 focus:border-amber-500 outline-none transition-all"
                        />
                    </div>
                    <div className="bg-rose-50/50 dark:bg-rose-900/10 p-4 rounded-2xl border border-rose-100/50 dark:border-rose-900/30">
                        <label className="block text-sm font-semibold text-rose-900 dark:text-rose-300 mb-2 flex items-center gap-2">
                        <div className="p-1.5 bg-rose-100 dark:bg-rose-900/50 rounded-lg text-rose-600 dark:text-rose-300">
                            <BellRing size={16} />
                        </div>
                        Aviso (min)
                        </label>
                        <input
                        type="number"
                        min="1"
                        max={formData.lunchDurationMinutes > 1 ? formData.lunchDurationMinutes - 1 : 1}
                        value={formData.notificationMinutes || ''}
                        onChange={(e) => setFormData({...formData, notificationMinutes: Number(e.target.value)})}
                        className="w-full pl-4 pr-8 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-100 font-medium rounded-xl focus:ring-4 focus:ring-rose-100 dark:focus:ring-rose-900/20 focus:border-rose-500 outline-none transition-all"
                        />
                    </div>
                </div>
            </form>
            )
        )}

        {/* TAB USUÁRIOS */}
        {activeTab === 'users' && (
            !isAdmin ? renderLockScreen() : (
            <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <UserPlus size={16} className="text-indigo-500" /> Cadastrar Usuário
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                            type="text" 
                            placeholder="Nome do funcionário"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 dark:text-white"
                            disabled={creatingUser}
                        />
                        <button 
                            onClick={handleCreateUser}
                            disabled={creatingUser || !newUserName.trim()}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {creatingUser ? <Loader2 size={16} className="animate-spin"/> : 'Adicionar'}
                        </button>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <SettingsIcon size={16} className="text-indigo-500" /> Gerenciar Equipe
                    </h4>
                    
                    {loadingUsers ? (
                        <div className="text-center py-4 text-slate-400">Carregando...</div>
                    ) : usersList.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            Nenhum usuário cadastrado.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {usersList.map(user => (
                                <div 
                                    key={user.id}
                                    className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-slate-600 transition-all"
                                >
                                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-bold uppercase shrink-0">
                                            {user.name.substring(0, 2)}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            {editingUserId === user.id ? (
                                                <form onSubmit={handleSaveEditUser} className="flex items-center gap-2">
                                                    <input 
                                                        type="text"
                                                        value={editingUserName}
                                                        onChange={(e) => setEditingUserName(e.target.value)}
                                                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 rounded outline-none text-sm dark:text-white"
                                                        autoFocus
                                                    />
                                                    <button type="submit" disabled={isUpdatingUser} className="text-emerald-500 hover:text-emerald-600 shrink-0">
                                                        {isUpdatingUser ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
                                                    </button>
                                                    <button type="button" onClick={() => setEditingUserId(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                                                        <X size={18} strokeWidth={3} />
                                                    </button>
                                                </form>
                                            ) : (
                                                <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 break-words line-clamp-1">
                                                    {user.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                    {editingUserId !== user.id && confirmDeleteId !== user.id && (
                                        <button 
                                            onClick={(e) => handleEditClick(user, e)}
                                            className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors cursor-pointer"
                                            title="Editar nome"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}

                                    {confirmDeleteId === user.id ? (
                                        <>
                                            <button 
                                                onClick={(e) => handleConfirmDelete(user.id, e)}
                                                disabled={deletingUserId === user.id}
                                                className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors shadow-sm"
                                                title="Confirmar exclusão"
                                            >
                                                {deletingUserId === user.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                            </button>
                                            <button 
                                                onClick={handleCancelDelete}
                                                disabled={deletingUserId === user.id}
                                                className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                                title="Cancelar"
                                            >
                                                <X size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        editingUserId !== user.id && (
                                            <button 
                                                type="button"
                                                onClick={(e) => handleDeleteClick(user.id, e)}
                                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors cursor-pointer"
                                                title="Remover usuário"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )
                                    )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            )
        )}

        </div>

        {((activeTab === 'general' && !!currentUser) || (activeTab === 'users' && isAdmin)) && (
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex justify-end gap-3 animate-in slide-in-from-bottom-2">
                <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 sm:px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors text-xs sm:text-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                Cancelar
                </button>
                {activeTab === 'general' && (
                    <button
                    form="settings-form"
                    type="submit"
                    disabled={isSaving}
                    className="px-6 sm:px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center gap-2 text-xs sm:text-sm active:scale-95 shadow-md disabled:opacity-70 disabled:active:scale-100"
                    >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
