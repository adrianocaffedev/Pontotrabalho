
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, BellRing, Briefcase, Coins, Utensils, Percent, Calendar, Plus, Trash2, Users, Check, UserPlus, Loader2, Settings as SettingsIcon, Lock, Unlock, ShieldAlert, AlertTriangle, Cloud, Edit2, History, Key } from 'lucide-react';
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
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
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
  const [newRenewalDate, setNewRenewalDate] = useState('');

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
        if (!currentUser) {
            setActiveTab('users');
            setIsAdmin(false);
        } else {
            setActiveTab('general');
            setFormData(settings);
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
      setNewRenewalDate('');
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
      } else {
          setAuthError(error || 'Senha incorreta.');
      }
      setIsVerifying(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-white/10 relative transition-colors">
        
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex gap-4">
              <button onClick={() => setActiveTab('general')} className={`text-sm font-bold pb-1 border-b-2 transition-all ${activeTab === 'general' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Configurações</button>
              <button onClick={() => setActiveTab('users')} className={`text-sm font-bold pb-1 border-b-2 transition-all ${activeTab === 'users' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Gerenciar Equipe</button>
          </div>
          <button onClick={onClose} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><X size={20} /></button>
        </div>
        
        <div className="overflow-y-auto p-6 flex-1 scrollbar-hide">
        
        {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneral} className="space-y-6 animate-in slide-in-from-left-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> Carga Horária</label>
                        <input type="number" value={formData.dailyWorkHours} onChange={e => setFormData({...formData, dailyWorkHours: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Coins size={12}/> Valor Hora</label>
                        <input type="number" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Utensils size={12}/> Vale Refeição (Diário)</label>
                    <input type="number" value={formData.foodAllowance} onChange={e => setFormData({...formData, foodAllowance: Number(e.target.value)})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-bold dark:text-white" />
                </div>
                <button type="submit" disabled={isSaving} className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Salvar Alterações
                </button>
            </form>
        )}

        {activeTab === 'users' && (!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4"><Lock className="text-slate-400" /></div>
                <h3 className="font-bold text-slate-800 dark:text-white mb-6">Área Restrita (Administrador)</h3>
                <form onSubmit={handleAdminLogin} className="w-full max-w-xs space-y-4">
                    <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Senha Administrativa" className="w-full p-3.5 border dark:border-slate-700 rounded-2xl dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    {authError && <p className="text-xs text-rose-500 font-bold text-center">{authError}</p>}
                    <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 rounded-2xl font-bold active:scale-95 transition-all">
                        {isVerifying ? <Loader2 className="animate-spin mx-auto"/> : 'Desbloquear'}
                    </button>
                </form>
            </div>
        ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-dashed dark:border-slate-700">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2 dark:text-white"><UserPlus size={16} /> Novo Usuário</h4>
                    <div className="space-y-3">
                        <input placeholder="Nome" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                        <div className="grid grid-cols-2 gap-2">
                            <input placeholder="Empresa" value={newUser.company} onChange={e => setNewUser({...newUser, company: e.target.value})} className="w-full p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm dark:text-white" />
                            <input placeholder="PIN (4 dígitos)" maxLength={4} value={newUser.pin} onChange={e => setNewUser({...newUser, pin: e.target.value})} className="w-full p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm font-mono dark:text-white" />
                        </div>
                        <button onClick={handleCreateUser} disabled={creatingUser || !newUser.name} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                            {creatingUser ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>} Adicionar Funcionário
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">Colaboradores Cadastrados</h4>
                    <div className="space-y-2">
                        {usersList.map(user => (
                            <div key={user.id} className="p-4 bg-white dark:bg-slate-800 border dark:border-slate-800 rounded-2xl shadow-sm">
                                {editingUserId === user.id ? (
                                    <form onSubmit={handleSaveEditUser} className="space-y-3">
                                        <input value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl dark:text-white font-bold" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input value={editingUser.company || ''} onChange={e => setEditingUser({...editingUser, company: e.target.value})} placeholder="Empresa" className="w-full p-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-xs" />
                                            <input value={editingUser.pin || ''} onChange={e => setEditingUser({...editingUser, pin: e.target.value})} placeholder="PIN" className="w-full p-2 rounded-lg border dark:bg-slate-900 dark:border-slate-700 dark:text-white text-xs font-mono" />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button type="button" onClick={() => setEditingUserId(null)} className="text-xs font-bold text-slate-400 p-2">Cancelar</button>
                                            <button type="submit" disabled={isUpdatingUser} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all">
                                                {isUpdatingUser ? <Loader2 className="animate-spin" size={14}/> : <Check size={14}/>} Salvar
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-sm dark:text-white uppercase">{user.name.substring(0, 2)}</div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-white">{user.name}</p>
                                                <p className="text-[10px] font-bold text-indigo-500 uppercase">{user.company || 'Empresa'} • PIN: {user.pin ? '****' : 'Não def.'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEditClick(user)} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"><Edit2 size={16}/></button>
                                            <button onClick={() => setConfirmDeleteId(user.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
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
