import React, { useState, useEffect } from 'react';
import { X, Save, CalendarOff, Clock, FileText, Calendar, History, Trash2, Edit3, PlusCircle } from 'lucide-react';
import { Absence } from '../types';
import { updateStandaloneAbsence, deleteStandaloneAbsence } from '../services/dataService';

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (absence: Omit<Absence, 'id'>) => void;
  initialDate?: string;
  userId?: string;
  existingAbsences?: Absence[];
  onRefresh?: () => void;
}

const AbsenceModal: React.FC<AbsenceModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialDate,
  userId,
  existingAbsences = [],
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [type, setType] = useState<Absence['type']>('ABSENCE');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setActiveTab('NEW');
    }
  }, [isOpen]);

  const resetForm = () => {
    setReason('');
    setStartTime('');
    setEndTime('');
    setType('ABSENCE');
    setEditingId(null);
    setDate(initialDate || new Date().toISOString().split('T')[0]);
  };

  const handleEdit = (absence: Absence) => {
    setEditingId(absence.id);
    setType(absence.type);
    setDate(absence.date);
    setReason(absence.reason);
    setStartTime(absence.startTime || '');
    setEndTime(absence.endTime || '');
    setActiveTab('NEW');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta justificativa?')) return;
    
    try {
      const result = await deleteStandaloneAbsence(id);
      if (result.success) {
        if (onRefresh) onRefresh();
      } else {
        alert("Erro ao excluir: " + result.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) return;
    if (type === 'DELAY' && (!startTime || !endTime)) return;

    setIsSaving(true);
    try {
      if (editingId) {
        const result = await updateStandaloneAbsence(editingId, {
          date,
          type,
          reason,
          startTime: (type === 'DELAY' || type === 'PARTIAL') ? startTime : undefined,
          endTime: (type === 'DELAY' || type === 'PARTIAL') ? endTime : undefined,
        });
        if (result.success && onRefresh) onRefresh();
      } else {
        onSave({
          date,
          type: type as any,
          reason,
          startTime: (type === 'DELAY' || type === 'PARTIAL') ? startTime : undefined,
          endTime: (type === 'DELAY' || type === 'PARTIAL') ? endTime : undefined,
        });
      }
      
      resetForm();
      if (editingId) setActiveTab('HISTORY');
      if (!editingId) onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 dark:border-slate-700 transition-colors flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-colors">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
             <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
                <CalendarOff className="text-rose-500 dark:text-rose-400" size={18} />
             </div>
             Justificativa de Ocorrência
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-4 gap-4 border-b border-gray-50 dark:border-slate-800/50">
          <button 
            onClick={() => { setActiveTab('NEW'); setEditingId(null); resetForm(); }}
            className={`pb-3 px-2 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'NEW' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className="flex items-center gap-2">
              <PlusCircle size={14} /> {editingId ? 'Editar Justificativa' : 'Nova Justificativa'}
            </div>
            {activeTab === 'NEW' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-3 px-2 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === 'HISTORY' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className="flex items-center gap-2">
              <History size={14} /> Histórico ({existingAbsences.length})
            </div>
            {activeTab === 'HISTORY' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-t-full"></div>}
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-6">
          {activeTab === 'NEW' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Tipo de Ocorrência */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg shadow-inner transition-colors">
                {(['ABSENCE', 'DELAY', 'PARTIAL', 'FULL_DAY'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all duration-200 ${type === t ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    {t === 'ABSENCE' ? 'Falta' : t === 'DELAY' ? 'Atraso' : t === 'PARTIAL' ? 'Parcial' : 'Integral'}
                  </button>
                ))}
              </div>

              {/* Data da Ocorrência */}
              <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700 transition-all">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Calendar size={12}/> Data da Ocorrência
                </label>
                <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-transparent outline-none font-bold text-slate-700 dark:text-white text-lg dark:[color-scheme:dark]"
                    required
                />
              </div>

              {/* Justificativa */}
              <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700 focus-within:border-emerald-200 dark:focus-within:border-emerald-800 transition-all">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <FileText size={12} className="text-slate-400"/>
                  Justificativa / Observação
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Consulta médica, problemas de transporte, etc..."
                  className="w-full bg-transparent outline-none text-slate-700 dark:text-white resize-none h-20 placeholder-slate-300 dark:placeholder-slate-600 leading-relaxed text-sm"
                  required
                />
              </div>

              {/* Horários */}
              {(type === 'DELAY' || type === 'PARTIAL') && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={10}/> Início/Esperado</label>
                        <input 
                            type="time" 
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full bg-transparent outline-none font-mono font-bold text-slate-700 dark:text-white text-lg dark:[color-scheme:dark]"
                            required
                        />
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={10}/> Fim/Chegada</label>
                        <input 
                            type="time" 
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full bg-transparent outline-none font-mono font-bold text-slate-700 dark:text-white text-lg dark:[color-scheme:dark]"
                            required
                        />
                    </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-bold transition-colors text-xs uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 hover:shadow-lg transition-all flex items-center gap-2 text-xs uppercase tracking-widest active:scale-95 shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  {editingId ? 'Atualizar Justificativa' : 'Salvar Justificativa'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {existingAbsences.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="text-slate-300" size={32} />
                  </div>
                  <p className="text-slate-400 font-bold text-sm">Nenhum histórico encontrado</p>
                </div>
              ) : (
                existingAbsences.slice().sort((a, b) => b.date.localeCompare(a.date)).map((abs) => (
                  <div key={abs.id} className="group p-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-lg border border-slate-100/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-white dark:bg-slate-700 shadow-sm ${
                          abs.type === 'ABSENCE' ? 'text-rose-500' : 
                          abs.type === 'FULL_DAY' ? 'text-rose-500' :
                          'text-amber-500'
                        }`}>
                          {abs.type === 'ABSENCE' || abs.type === 'FULL_DAY' ? <CalendarOff size={16} /> : <Clock size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-white">
                            {new Date(abs.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {abs.type === 'ABSENCE' ? 'Falta' : abs.type === 'DELAY' ? 'Atraso' : abs.type === 'PARTIAL' ? 'Parcial' : 'Dia Integral'}
                            {abs.startTime && ` • ${abs.startTime} - ${abs.endTime}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(abs)}
                          className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(abs.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                      "{abs.reason}"
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default AbsenceModal;
