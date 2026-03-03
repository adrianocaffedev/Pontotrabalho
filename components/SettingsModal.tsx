
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, BellRing, Briefcase, Coins, Utensils, Percent, Calendar, Plus, Trash2, Users, Check, UserPlus, Loader2, Settings as SettingsIcon, Lock, Unlock, ShieldAlert, AlertTriangle, Cloud, Edit2, History, Key, ShieldCheck, Globe, CalendarDays, Info } from 'lucide-react';
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
      <div className="bg-[#111827] dark:bg-[#0f172a] rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[92vh] overflow-hidden flex flex-col border border-white/10 relative transition-colors">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-8 py-6 shrink-0">
          <div className="flex items-center gap-3">
              <SettingsIcon size={18} className="text-indigo-400"/>
              <h3 className="text-base font-bold text-white tracking-tight">Configurações Globais</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 p-2 rounded-full hover:bg-white/5 transition-colors"><X size={24} /></button>
        </div>
        
        <div className="overflow-y-auto px-8 pb-8 flex-1 scrollbar-hide">
        
        {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="space-y-8 animate-in slide-in-from-left-4">
                
                {/* Configurações de Notificação e Ciclo */}
                <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CalendarDays size={12} className="text-indigo-400"/> Ciclo Mensal e Alertas
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Aviso de Fim (Minutos)</label>
                            <input type="number" value={formData.notificationMinutes} onChange={e => setFormData({...formData, notificationMinutes: Number(e.target.value)})} className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-lg" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Início do Mês (Dia)</label>
                            <input type="number" min="1" max="31" value={formData.periodStartDay || 1} onChange={e => setFormData({...formData, periodStartDay: Number(e.target.value)})} className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-lg" />
                        </div>
                    </div>
                    <div className="flex items-start gap-2 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-xl">
                        <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">O dia de início define como os registros são agrupados (ex: dia 8 até dia 7 do mês seguinte).</p>
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
                                <input type="number" step="0.01" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: Number(e.target.value)})} className="w-full p-4 pl-8 bg-slate-800/50 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Subsídio Almoço (Dia)</label>
                            <input type="number" step="0.01" value={formData.foodAllowance} onChange={e => setFormData({...formData, foodAllowance: Number(e.target.value)})} className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Extra (%) em dia útil</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                                <input type="number" value={formData.overtimePercentage} onChange={e => setFormData({...formData, overtimePercentage: Number(e.target.value)})} className="w-full p-4 pl-8 bg-slate-800/50 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Moeda</label>
                            <div className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-2xl font-bold text-white flex items-center justify-between cursor-default">
                                <span>Euro (€)</span>
                                <Globe size={16} className="text-slate-500" />
                            </div>
                            <input type="hidden" value="EUR" />
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
                <button type="submit" disabled={isSaving} className="w-full py-5 bg-[#5b56e6] hover:bg-[#4f49d6] text-white rounded-[1.8rem] font-bold shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 relative overflow-hidden group mt-4">
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {isSaving ? <Loader2 className="animate-spin" size={24}/> : <Save size={24}/>}
                    <span className="text-lg">Salvar Todas as Configurações</span>
                </button>
            </form>
        )}

        {activeTab === 'users' && (!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-10 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-white/5">
                    <ShieldCheck className="text-indigo-400" size={36} />
                </div>
                <h3 className="font-bold text-white mb-2 text-center text-lg">Área do Administrador</h3>
                <p className="text-sm text-slate-400 font-medium mb-8 text-center max-w-[260px]">Introduza o PIN de gestão para gerenciar a lista de colaboradores.</p>
                <form onSubmit={handleAdminLogin} className="w-full max-w-xs space-y-6">
                    <div className="relative">
                        <input 
                            type="password" 
                            value={adminPassword} 
                            onChange={e => setAdminPassword(e.target.value)} 
                            placeholder="PIN Administrativo" 
                            className="w-full p-5 pl-14 border border-slate-700 rounded-[1.5rem] bg-slate-800/50 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-center tracking-[0.5em] font-bold text-xl" 
                            autoFocus
                        />
                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
                    </div>
                    {authError && <p className="text-[10px] text-rose-500 font-bold text-center uppercase tracking-wider animate-shake">{authError}</p>}
                    <button type="submit" disabled={isVerifying} className="w-full bg-white text-[#111827] py-5 rounded-[1.5rem] font-bold active:scale-95 transition-all shadow-xl flex items-center justify-center text-lg">
                        {isVerifying ? <Loader2 className="animate-spin"/> : 'Desbloquear Acesso'}
                    </button>
                    {currentUser && (
                        <button type="button" onClick={() => setActiveTab('general')} className="w-full text-slate-500 text-[10px] font-bold uppercase tracking-widest pt-4 hover:text-slate-300">Voltar para Minhas Configurações</button>
                    )}
                </form>
            </div>
        ) : (
            <div className="space-y-8 animate-in slide-in-from-right-4">
                <div className="bg-slate-800/20 p-6 rounded-[2rem] border border-dashed border-slate-700">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2 text-white"><UserPlus size={18} className="text-indigo-400"/> Novo Funcionário</h4>
                    <div className="space-y-4">
                        <input placeholder="Nome Completo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="Cargo" value={newUser.company} onChange={e => setNewUser({...newUser, company: e.target.value})} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            <input placeholder="PIN" maxLength={4} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value})} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-center" />
                        </div>
                        <button onClick={handleCreateUser} disabled={creatingUser || !newUser.name} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg">
                            {creatingUser ? <Loader2 className="animate-spin" size={18}/> : <Plus size={18}/>} Criar Cadastro
                        </button>
                    </div>
                </div>

                <div className="space-y-4 pb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Lista de Colaboradores ({usersList.length})</h4>
                    <div className="space-y-3">
                        {usersList.map(user => (
                            <div key={user.id} className="p-5 bg-slate-800/40 border border-white/5 rounded-[1.5rem] shadow-sm transition-all hover:bg-slate-800/60">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm uppercase border border-indigo-500/20">
                                            {user.name.substring(0, 2)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{user.name}</p>
                                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user.company || 'Geral'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditClick(user)} className="p-3 text-slate-500 hover:text-white transition-all"><Edit2 size={18}/></button>
                                        <button onClick={async () => { if(confirm(`Excluir ${user.name}?`)) await deleteAppUser(user.id); fetchUsers(); }} className="p-3 text-slate-500 hover:text-rose-500 transition-all"><Trash2 size={18}/></button>
                                    </div>
                                </div>
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
