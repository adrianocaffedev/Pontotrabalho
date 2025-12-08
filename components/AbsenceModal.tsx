import React, { useState } from 'react';
import { X, Save, CalendarOff, Clock, FileText } from 'lucide-react';
import { Absence } from '../types';

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (absence: Omit<Absence, 'id'>) => void;
}

const AbsenceModal: React.FC<AbsenceModalProps> = ({ isOpen, onClose, onSave }) => {
  const [type, setType] = useState<'FULL_DAY' | 'PARTIAL'>('FULL_DAY');
  const [reason, setReason] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!reason.trim()) return;
    if (type === 'PARTIAL' && (!startTime || !endTime)) return;

    onSave({
      type,
      reason,
      startTime: type === 'PARTIAL' ? startTime : undefined,
      endTime: type === 'PARTIAL' ? endTime : undefined,
    });
    
    // Reset form
    setReason('');
    setStartTime('');
    setEndTime('');
    setType('FULL_DAY');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20 dark:border-slate-700 transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-colors">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
             <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-full">
                <CalendarOff className="text-rose-500 dark:text-rose-400" size={18} />
             </div>
             Registrar Ausência
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Tipo de Ausência */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner transition-colors">
            <button
                type="button"
                onClick={() => setType('FULL_DAY')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${type === 'FULL_DAY' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                Dia Todo
            </button>
            <button
                type="button"
                onClick={() => setType('PARTIAL')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${type === 'PARTIAL' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                Parcial
            </button>
          </div>

          {/* Motivo */}
          <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 focus-within:border-indigo-200 dark:focus-within:border-indigo-800 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <FileText size={16} className="text-slate-400"/>
              Motivo / Justificativa
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Consulta médica, Problemas pessoais..."
              className="w-full bg-transparent outline-none text-slate-700 dark:text-slate-200 resize-none h-20 placeholder-slate-300 dark:placeholder-slate-600 leading-relaxed"
              required
            />
          </div>

          {/* Horários (Apenas Parcial) */}
          {type === 'PARTIAL' && (
             <div className="grid grid-cols-2 gap-4 animate-fade-in">
                <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Clock size={10}/> Início</label>
                    <input 
                        type="time" 
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-transparent outline-none font-mono font-bold text-slate-700 dark:text-slate-200 text-lg dark:[color-scheme:dark]"
                        required
                    />
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-colors">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Clock size={10}/> Fim</label>
                    <input 
                        type="time" 
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-transparent outline-none font-mono font-bold text-slate-700 dark:text-slate-200 text-lg dark:[color-scheme:dark]"
                        required
                    />
                </div>
             </div>
          )}

          <div className="pt-6 flex justify-end gap-3 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors text-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-slate-800 dark:bg-indigo-600 text-white rounded-xl font-bold hover:bg-slate-900 dark:hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2 text-sm active:scale-95 shadow-md"
            >
              <Save size={18} />
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AbsenceModal;