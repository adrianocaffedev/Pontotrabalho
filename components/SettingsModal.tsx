
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, BellRing, Briefcase, Coins, Utensils, Percent, Calendar, Plus, Trash2, Users, Check, UserPlus, Loader2, Settings as SettingsIcon, Lock, Unlock, ShieldAlert, AlertTriangle, Cloud, Edit2, History, Key, ShieldCheck, Globe, CalendarDays, Heart, Copy, Smartphone, ExternalLink } from 'lucide-react';
import { AppSettings, AppUser, ContractRenewal } from '../types';
import { getAppUsers, createAppUser, deleteAppUser, verifyAdminPassword, updateAppUser } from '../services/dataService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => Promise<void>;
  currentUser: AppUser | null;
  onSelectUser: (user: AppUser | null) => void;
  systemHolidays?: string[];
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, currentUser, onSelectUser, systemHolidays = [] }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'general'>(currentUser ? 'general' : 'users');
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  
  // Donation State
  const [donationAmount, setDonationAmount] = useState<string>('5');
  const [copied, setCopied] = useState(false);
  const mbWayNumber = "+351968975732";

  const [newUser, setNewUser] = useState<Partial<AppUser>>({
    name: '',
    company: '',
    contractType: 'EFFECTIVE',
    contractStartDate: new Date().toISOString().split('T')[0],
    pin: '',
    renewals: []
  });

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<AppUser>>({});
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setFormData(settings);
        if (!currentUser) {
            setActiveTab('users');
            setIsAdmin(false);
        } else {
            setActiveTab('general');
        }
        fetchUsers();
    }
  }, [isOpen, currentUser, settings]);

  const fetchUsers = async () => {
      setLoadingUsers(true);
      const users = await getAppUsers();
      setUsersList(users);
      setLoadingUsers(false);
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
          setNewUser({ name: '', company: '', contractType: 'EFFECTIVE', contractStartDate: new Date().toISOString().split('T')[0], pin: '', renewals: [] });
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

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(mbWayNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-white/10 relative transition-colors">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex gap-4">
              {isAdmin && currentUser ? (
                  <>
                      <button onClick={() => setActiveTab('general')} className={`text-sm font-bold pb-1 border-b-2 transition-all ${activeTab === 'general' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Configurações</button>
                      <button onClick={() => setActiveTab('users')} className={`text-sm font-bold pb-1 border-b-2 transition-all ${activeTab === 'users' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Gerenciar Equipe</button>
                  </>
              ) : (
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    {activeTab === 'general' ? (
                        <><SettingsIcon size={16} className="text-indigo-500"/> Configurações Globais</>
                    ) : (
                        <><Users size={16} className="text-indigo-500"/> Área Restrita</>
                    )}
                  </h3>
              )}
          </div>
          <button onClick={onClose} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"><X size={20} /></button>
        </div>
        
        <div className="overflow-y-auto p-6 flex-1 scrollbar-hide">
        
        {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="space-y-8 animate-in slide-in-from-left-4 pb-4">
                {/* Seção 1: Jornada de Trabalho */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={12} className="text-indigo-500"/> Regras de Jornada
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Carga Diária (Horas)</label>
                            <input type="number" step="0.5" value={formData.dailyWorkHours} onChange={e => setFormData({...formData, dailyWorkHours: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Duração Almoço (Min)</label>
                            <input type="number" value={formData.lunchDurationMinutes} onChange={e => setFormData({...formData, lunchDurationMinutes: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><BellRing size={10}/> Notificação antes de sair (Minutos)</label>
                        <input type="number" value={formData.notificationMinutes} onChange={e => setFormData({...formData, notificationMinutes: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                </div>

                {/* Seção 2: Financeiro */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Coins size={12} className="text-emerald-500"/> Configurações Financeiras
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Valor Hora</label>
                            <div className="relative">
                                <input type="number" step="0.01" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: Number(e.target.value)})} className="w-full p-2.5 pl-8 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Subsídio Almoço (Dia)</label>
                            <input type="number" step="0.01" value={formData.foodAllowance} onChange={e => setFormData({...formData, foodAllowance: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Percent size={10}/> Extra (%) em Dia Útil</label>
                            <input type="number" value={formData.overtimePercentage} onChange={e => setFormData({...formData, overtimePercentage: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Globe size={10}/> Moeda</label>
                            <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20">
                                <option value="EUR">Euro (€)</option>
                                <option value="BRL">Real (R$)</option>
                                <option value="USD">Dólar ($)</option>
                                <option value="GBP">Libra (£)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Seção 3: Dias de Descanso (Sáb/Dom etc) */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CalendarDays size={12} className="text-orange-500"/> Dias com Valor Dobrado (100% Extra)
                    </h4>
                    <div className="flex justify-between gap-1 p-1 bg-slate-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
                        {daysOfWeek.map((day) => (
                            <button
                                key={day.id}
                                type="button"
                                onClick={() => toggleDay(day.id)}
                                className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${
                                    (formData.overtimeDays || []).includes(day.id)
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                                }`}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 italic text-center">Clique nos dias que são considerados folga remunerada a 100%.</p>
                </div>

                <button type="submit" disabled={isSaving} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-6">
                    {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Todas as Configurações
                </button>

                {/* Secção de Doação MBWay */}
                <div className="mt-8 pt-8 border-t dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-800/30 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Heart size={16} className="text-rose-500 fill-rose-500 animate-pulse" />
                            <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-widest">Apoie o Projeto (MBWay)</h4>
                        </div>
                        
                        <div className="w-full space-y-4">
                            <div className="flex items-center gap-2 justify-center">
                                {[2, 5, 10].map(val => (
                                    <button 
                                        key={val}
                                        type="button"
                                        onClick={() => setDonationAmount(val.toString())}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${donationAmount === val.toString() ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border dark:border-slate-700'}`}
                                    >
                                        {val}€
                                    </button>
                                ))}
                                <div className="relative flex-1 max-w-[100px]">
                                    <input 
                                        type="number" 
                                        value={donationAmount} 
                                        onChange={e => setDonationAmount(e.target.value)}
                                        className="w-full p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-xs font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-center"
                                        placeholder="Outro"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">€</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-4 py-2">
                                <div className="p-3 bg-white rounded-2xl shadow-inner border-4 border-indigo-50 dark:border-slate-800 relative group">
                                    <img 
                                        // Alterado para um formato que a app MBWay reconhece melhor ao ser lido pelo scanner interno
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${mbWayNumber}`} 
                                        alt="QR Code MBWay" 
                                        className="w-32 h-32 opacity-90 hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/40 pointer-events-none rounded-xl">
                                        <Smartphone className="text-indigo-600" size={24} />
                                    </div>
                                </div>
                                <div className="flex flex-col items-center w-full">
                                    <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm w-full justify-center">
                                        <Smartphone size={16} className="text-indigo-500" />
                                        <span className="text-sm font-mono font-bold dark:text-white">{mbWayNumber}</span>
                                        <button 
                                            type="button"
                                            onClick={handleCopyNumber}
                                            className={`p-1.5 rounded-lg transition-all ${copied ? 'bg-emerald-500 text-white' : 'hover:bg-indigo-100 dark:hover:bg-slate-700 text-slate-400'}`}
                                        >
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    
                                    <div className="mt-4 w-full space-y-2">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center px-4 leading-relaxed">
                                            Importante: Abra a App MBWay e use o botão <span className="text-indigo-500">"Ler QR Code"</span> para transferir {donationAmount}€.
                                        </p>
                                        
                                        <a 
                                            href={`tel:${mbWayNumber}`}
                                            className="flex items-center justify-center gap-2 w-full py-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
                                        >
                                            <ExternalLink size={12} /> Abrir Contacto / Telefonar
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {!isAdmin && (
                    <div className="pt-6 border-t dark:border-slate-800 mt-6">
                        <button 
                            type="button"
                            onClick={() => { setActiveTab('users'); setIsAdmin(false); }}
                            className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-500 hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                        >
                            <Lock size={14} /> Acesso à Gestão de Equipe
                        </button>
                    </div>
                )}
            </form>
        )}

        {activeTab === 'users' && (!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-10 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-slate-100 dark:border-slate-700">
                    <ShieldCheck className="text-indigo-500" size={32} />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white mb-2 text-center">Gestão de Colaboradores</h3>
                <p className="text-xs text-slate-400 font-medium mb-8 text-center max-w-[240px]">Para gerenciar a lista de funcionários, você precisa ser administrador.</p>
                <form onSubmit={handleAdminLogin} className="w-full max-w-xs space-y-4">
                    <div className="relative">
                        <input 
                            type="password" 
                            value={adminPassword} 
                            onChange={e => setAdminPassword(e.target.value)} 
                            placeholder="PIN Administrativo" 
                            className="w-full p-4 pl-12 border dark:border-slate-700 rounded-2xl dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-center tracking-[0.5em] font-bold" 
                            autoFocus
                        />
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    </div>
                    {authError && <p className="text-[10px] text-rose-500 font-bold text-center uppercase tracking-wider animate-shake">{authError}</p>}
                    <button type="submit" disabled={isVerifying} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-xl flex items-center justify-center">
                        {isVerifying ? <Loader2 className="animate-spin"/> : 'Desbloquear Acesso'}
                    </button>
                    {currentUser && (
                        <button type="button" onClick={() => setActiveTab('general')} className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-widest pt-2 hover:text-slate-600 dark:hover:text-slate-200">Voltar para Minha Jornada</button>
                    )}
                </form>
            </div>
        ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-dashed dark:border-slate-700">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2 dark:text-white"><UserPlus size={16} className="text-indigo-500"/> Cadastrar Funcionário</h4>
                    <div className="space-y-3">
                        <input placeholder="Nome Completo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        <div className="grid grid-cols-2 gap-2">
                            <input placeholder="Empresa / Cargo" value={newUser.company} onChange={e => setNewUser({...newUser, company: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            <input placeholder="PIN (4 dígitos)" maxLength={4} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value})} className="w-full p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm font-mono dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                        <button onClick={handleCreateUser} disabled={creatingUser || !newUser.name} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md">
                            {creatingUser ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>} Adicionar à Lista
                        </button>
                    </div>
                </div>

                <div className="space-y-3 pb-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">Equipe Cadastrada ({usersList.length})</h4>
                    <div className="space-y-2">
                        {usersList.map(user => (
                            <div key={user.id} className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-800 rounded-2xl shadow-sm transition-all hover:border-slate-200 dark:hover:border-slate-700">
                                {editingUserId === user.id ? (
                                    <form onSubmit={handleSaveEditUser} className="space-y-3 animate-in fade-in">
                                        <input value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl dark:text-white font-bold outline-none border border-indigo-500/30" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input value={editingUser.company || ''} onChange={e => setEditingUser({...editingUser, company: e.target.value})} placeholder="Empresa" className="w-full p-2.5 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-xs outline-none" />
                                            <input value={editingUser.pin || ''} onChange={e => setEditingUser({...editingUser, pin: e.target.value})} placeholder="PIN" className="w-full p-2.5 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-xs font-mono outline-none" />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button type="button" onClick={() => setEditingUserId(null)} className="text-xs font-bold text-slate-400 p-2 hover:text-slate-600">Cancelar</button>
                                            <button type="submit" disabled={isUpdatingUser} className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm">
                                                {isUpdatingUser ? <Loader2 className="animate-spin" size={14}/> : <Check size={14}/>} Salvar Alterações
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs uppercase border border-indigo-100 dark:border-indigo-800/30">
                                                {user.name.substring(0, 2)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-white text-sm">{user.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                                    <span className="text-indigo-500">{user.company || 'Sem Empresa'}</span> • PIN: {user.pin ? 'Ativo' : '0000'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEditClick(user)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all" title="Editar"><Edit2 size={16}/></button>
                                            <button onClick={async () => { if(confirm(`Excluir ${user.name}?`)) await deleteAppUser(user.id); fetchUsers(); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all" title="Excluir"><Trash2 size={16}/></button>
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
