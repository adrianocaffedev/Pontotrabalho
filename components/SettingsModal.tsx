
import React, { useState, useEffect } from 'react';
import { X, Save, Clock, BellRing, Briefcase, Coins, Utensils, Percent, Calendar, Plus, Trash2, Users, Check, UserPlus, Loader2, Settings as SettingsIcon, Lock, Unlock, ShieldAlert, AlertTriangle, Cloud, Edit2, History } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'selection' | 'users' | 'general'>('selection');
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
        fetchUsers();
        setActiveTab('selection');
        setIsAdmin(false);
        setEditingUserId(null);
    }
  }, [isOpen]);

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
          setNewUser({ name: '', company: '', contractType: 'EFFECTIVE', contractStartDate: new Date().toISOString().split('T')[0], renewals: [] });
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
          const updatedUsers = await getAppUsers();
          setUsersList(updatedUsers);
          
          if (currentUser?.id === editingUserId) {
              const matched = updatedUsers.find(u => u.id === editingUserId);
              if (matched) onSelectUser(matched);
          }
          
          setEditingUserId(null);
          setIsUpdatingUser(false);
      } else {
          setIsUpdatingUser(false);
          // Alerta mais específico para o erro de colunas
          if (error?.includes("ERRO DE SCHEMA")) {
              alert(error);
          } else {
              alert("Erro ao salvar alterações:\n\n" + error);
          }
      }
  };

  const addRenewal = () => {
      if (!newRenewalDate) return;
      const newRenewal: ContractRenewal = { id: Math.random().toString(36).substr(2, 9), date: newRenewalDate };
      setEditingUser(prev => ({
          ...prev,
          renewals: [...(prev.renewals || []), newRenewal].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }));
      setNewRenewalDate('');
  };

  const removeRenewal = (id: string) => {
      setEditingUser(prev => ({
          ...prev,
          renewals: (prev.renewals || []).filter(r => r.id !== id)
      }));
  };

  const handleConfirmDelete = async (id: string) => {
      setDeletingUserId(id);
      const { success, error } = await deleteAppUser(id);
      setDeletingUserId(null);
      if (success) {
          await fetchUsers();
          setConfirmDeleteId(null);
          if (currentUser?.id === id) onSelectUser(null);
      } else {
          alert("Erro ao remover: " + error);
      }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsVerifying(true);
      const { verified, error } = await verifyAdminPassword(adminPassword);
      if (verified) {
          setIsAdmin(true);
          setAdminPassword('');
          setIsVerifying(false);
      } else {
          setAuthError(error || 'Senha incorreta.');
          setIsVerifying(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-white/10 relative transition-colors">
        
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex gap-4">
              <button onClick={() => setActiveTab('selection')} className={`text-sm font-bold pb-1 transition-colors ${activeTab === 'selection' ? 'text-indigo-600' : 'text-slate-500'}`}>Quem é você?</button>
              <button onClick={() => setActiveTab('users')} className={`text-sm font-bold pb-1 transition-colors ${activeTab === 'users' ? 'text-indigo-600' : 'text-slate-500'}`}>Usuários</button>
              <button onClick={() => setActiveTab('general')} className={`text-sm font-bold pb-1 transition-colors ${activeTab === 'general' ? 'text-indigo-600' : 'text-slate-500'}`}>Sistema</button>
          </div>
          <button onClick={onClose} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><X size={20} /></button>
        </div>
        
        <div className="overflow-y-auto p-6 flex-1 scrollbar-hide">
        
        {activeTab === 'selection' && (
            <div className="space-y-4 animate-in slide-in-from-left-4">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Users size={16} /> Selecione seu Perfil</h4>
                <div className="space-y-2">
                    {loadingUsers ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-indigo-500"/></div> : 
                    usersList.map(user => (
                        <button key={user.id} onClick={() => { onSelectUser(user); onClose(); }} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${currentUser?.id === user.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold uppercase">{user.name.substring(0, 2)}</div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm dark:text-white">{user.name}</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold">{user.company || 'Empresa não def.'}</span>
                                </div>
                            </div>
                            {currentUser?.id === user.id && <Check size={16} className="text-indigo-500" />}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'users' && (!isAdmin ? (
            <div className="flex flex-col items-center justify-center py-10">
                <Lock className="text-slate-400 mb-4" />
                <h3 className="font-bold mb-4 dark:text-white">Acesso Restrito</h3>
                <form onSubmit={handleAdminLogin} className="w-full max-w-xs space-y-3">
                    <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Senha admin" className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-indigo-500" />
                    {authError && <p className="text-xs text-rose-500 font-bold text-center">{authError}</p>}
                    <button type="submit" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-bold active:scale-95 transition-all">
                        {isVerifying ? <Loader2 className="animate-spin mx-auto"/> : 'Entrar'}
                    </button>
                </form>
            </div>
        ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-dashed dark:border-slate-700">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2 dark:text-white"><UserPlus size={16} /> Novo Funcionário</h4>
                    <div className="space-y-3">
                        <input placeholder="Nome completo" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2 border rounded-xl text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-indigo-500" />
                        <input placeholder="Empresa" value={newUser.company} onChange={e => setNewUser({...newUser, company: e.target.value})} className="w-full p-2 border rounded-xl text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-indigo-500" />
                        <div className="flex gap-2">
                            <select value={newUser.contractType} onChange={e => setNewUser({...newUser, contractType: e.target.value as any})} className="flex-1 p-2 border rounded-xl text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-indigo-500">
                                <option value="EFFECTIVE">Efetivo</option>
                                <option value="TEMPORARY">Temporário</option>
                            </select>
                            <input type="date" value={newUser.contractStartDate} onChange={e => setNewUser({...newUser, contractStartDate: e.target.value})} className="flex-1 p-2 border rounded-xl text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none focus:border-indigo-500" />
                        </div>
                        <button onClick={handleCreateUser} disabled={creatingUser || !newUser.name} className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                            {creatingUser ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>} Adicionar
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2 dark:text-white"><SettingsIcon size={16} /> Equipe Cadastrada</h4>
                    <div className="space-y-2">
                        {usersList.map(user => (
                            <div key={user.id} className="p-3 border rounded-xl bg-white dark:bg-slate-800 dark:border-slate-800">
                                {editingUserId === user.id ? (
                                    <form onSubmit={handleSaveEditUser} className="space-y-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label>
                                            <input value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm dark:bg-slate-900 dark:text-white outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Empresa</label>
                                                <input value={editingUser.company || ''} onChange={e => setEditingUser({...editingUser, company: e.target.value})} className="w-full p-2 border rounded-lg text-sm dark:bg-slate-900 dark:text-white outline-none focus:border-indigo-500" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                                                <select value={editingUser.contractType || 'EFFECTIVE'} onChange={e => setEditingUser({...editingUser, contractType: e.target.value as any})} className="w-full p-2 border rounded-lg text-sm dark:bg-slate-900 dark:text-white outline-none focus:border-indigo-500">
                                                    <option value="EFFECTIVE">Efetivo</option>
                                                    <option value="TEMPORARY">Temporário</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-dashed dark:border-slate-700">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-2"><History size={12}/> Renovações</label>
                                            <div className="flex gap-2 mb-2">
                                                <input type="date" value={newRenewalDate} onChange={e => setNewRenewalDate(e.target.value)} className="flex-1 p-1 border rounded-lg text-xs dark:bg-slate-800 dark:text-white outline-none focus:border-indigo-500" />
                                                <button type="button" onClick={addRenewal} className="px-3 bg-indigo-500 text-white rounded-lg active:scale-95 transition-all"><Plus size={14}/></button>
                                            </div>
                                            <div className="space-y-1">
                                                {(editingUser.renewals || []).map(r => (
                                                    <div key={r.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border text-xs dark:border-slate-700 dark:text-white">
                                                        <span>{new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                                        <button type="button" onClick={() => removeRenewal(r.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={12}/></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <button type="button" onClick={() => setEditingUserId(null)} className="text-xs font-bold text-slate-500 p-2 hover:text-slate-700">Cancelar</button>
                                            <button type="submit" disabled={isUpdatingUser} className="px-5 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 active:scale-95 transition-all hover:bg-emerald-600 disabled:opacity-50">
                                                {isUpdatingUser ? <Loader2 className="animate-spin" size={14}/> : <Check size={14}/>} Salvar
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold uppercase dark:text-white">{user.name.substring(0, 2)}</div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm dark:text-white">{user.name}</span>
                                                <span className="text-[9px] text-indigo-500 font-bold uppercase">{user.company} • {user.contractType === 'EFFECTIVE' ? 'Efetivo' : 'Temporário'}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
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
