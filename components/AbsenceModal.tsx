import React, { useState, useEffect } from 'react';
import { X, Save, CalendarOff, Clock, FileText, Calendar } from 'lucide-react';
import { Absence } from '../types';

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (absence: Omit<Absence, 'id'>) => void;
  initialDate?: string;
}

const AbsenceModal: React.FC<AbsenceModalProps> = ({ isOpen, onClose, onSave, initialDate }) => {
  const [type, setType] = useState<'ABSENCE' | 'DELAY'>('ABSENCE');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!reason.trim()) return;
    if (type === 'DELAY' && (!startTime || !endTime)) return;

    onSave({
      date,
      type,
      reason,
      startTime: type === 'DELAY' ? startTime : undefined,
      endTime: type === 'DELAY' ? endTime : undefined,
    });
    
    // Reset form
    setReason('');
    setStartTime('');
    setEndTime('');
    setType('ABSENCE');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20 dark:border-slate-700 transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 transition-colors">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
             <div className="p-2 bg-rose-50 dark:bg-rose-900/30 rounded-full">
                <CalendarOff className="text-rose-500 dark:text-rose-400" size={18} />
             </div>
             Justificativa de Ocorrência
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Tipo de Ocorrência */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner transition-colors">
            <button
                type="button"
                onClick={() => setType('ABSENCE')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${type === 'ABSENCE' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                Falta
            </button>
            <button
                type="button"
                onClick={() => setType('DELAY')}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 ${type === 'DELAY' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                Atraso
            </button>
          </div>

          {/* Data da Ocorrência */}
          <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 transition-all">
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
          <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 focus-within:border-indigo-200 dark:focus-within:border-indigo-800 transition-all">
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

          {/* Horários (Apenas Atraso) */}
          {type === 'DELAY' && (
             <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={10}/> Horário Esperado</label>
                    <input 
                        type="time" 
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-transparent outline-none font-mono font-bold text-slate-700 dark:text-white text-lg dark:[color-scheme:dark]"
                        required
                    />
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Clock size={10}/> Horário Chegada</label>
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
              className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors text-xs uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2 text-xs uppercase tracking-widest active:scale-95 shadow-md shadow-indigo-500/20"
            >
              <Save size={16} />
              Salvar Justificativa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AbsenceModal;
