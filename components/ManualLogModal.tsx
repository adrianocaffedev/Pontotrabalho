
import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Clock, PlusCircle, Edit3 } from 'lucide-react';
import { TimeLog, Break, AppSettings } from '../types';

interface ManualLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: TimeLog) => void;
  initialLog: TimeLog | null; // Adicionado para edição
  existingDates: string[]; // Para validação de duplicidade
  settings: AppSettings;
}

const ManualLogModal: React.FC<ManualLogModalProps> = ({ isOpen, onClose, onSave, initialLog, existingDates, settings }) => {
  // Correção de Data: Pega a data local considerando o offset do timezone, em vez de UTC
  const getLocalDate = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const [date, setDate] = useState(getLocalDate());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [lunchStartTime, setLunchStartTime] = useState('');
  const [lunchEndTime, setLunchEndTime] = useState('');
  const [coffeeStartTime, setCoffeeStartTime] = useState('');
  const [coffeeEndTime, setCoffeeEndTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Helper para extrair HH:mm de ISO string
  const formatTimeFromISO = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialLog) {
        // Preencher dados para edição
        setDate(initialLog.date);
        setStartTime(formatTimeFromISO(initialLog.startTime));
        setEndTime(formatTimeFromISO(initialLog.endTime));

        // Reset breaks
        setLunchStartTime('');
        setLunchEndTime('');
        setCoffeeStartTime('');
        setCoffeeEndTime('');

        // Find breaks
        const lunch = initialLog.breaks.find(b => b.type === 'LUNCH');
        if (lunch) {
          setLunchStartTime(formatTimeFromISO(lunch.startTime));
          setLunchEndTime(formatTimeFromISO(lunch.endTime));
        }

        const coffee = initialLog.breaks.find(b => b.type === 'COFFEE');
        if (coffee) {
          setCoffeeStartTime(formatTimeFromISO(coffee.startTime));
          setCoffeeEndTime(formatTimeFromISO(coffee.endTime));
        }

      } else {
        // Reset para novo registro
        setDate(getLocalDate());
        setStartTime('');
        setEndTime('');
        setLunchStartTime('');
        setLunchEndTime('');
        setCoffeeStartTime('');
        setCoffeeEndTime('');
      }
    }
  }, [isOpen, initialLog]);

  if (!isOpen) return null;

  // Generates a valid UUID v4
  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Polyfill for UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartTime(value);

    // Sugestão automática apenas se for NOVO registro
    if (value && !initialLog) {
        const [h, m] = value.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
            // Helper para formatar HH:mm
            const formatTime = (hours: number, minutes: number) => {
                const adjustedHours = (hours % 24).toString().padStart(2, '0');
                const adjustedMinutes = minutes.toString().padStart(2, '0');
                return `${adjustedHours}:${adjustedMinutes}`;
            };

            // Regra: Usar configurações dinâmicas
            const lunchStartH = h + 4;
            const lunchDurMin = settings.lunchDurationMinutes;
            const dailyH = settings.dailyWorkHours;

            setLunchStartTime(formatTime(lunchStartH, m));
            
            const lunchEndTotalMin = (lunchStartH * 60) + m + lunchDurMin;
            setLunchEndTime(formatTime(Math.floor(lunchEndTotalMin / 60), lunchEndTotalMin % 60));
            
            const endTotalMin = (h * 60) + m + (dailyH * 60) + lunchDurMin;
            setEndTime(formatTime(Math.floor(endTotalMin / 60), endTotalMin % 60));
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!date || !startTime || !endTime) {
      setError("Data, Entrada e Saída são obrigatórios.");
      return;
    }
    
    // Check for duplicate date
    const isDateTaken = existingDates.includes(date);
    const isEditingSameDate = initialLog && initialLog.date === date;
    
    // Se a data já existe e NÃO estamos editando o registro que já ocupa essa data
    if (isDateTaken && !isEditingSameDate) {
         setError("Já existe um registro para esta data. Por favor, edite o registro existente.");
         return;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    if (endDateTime <= startDateTime) {
        setError("A hora de saída deve ser posterior à hora de entrada.");
        return;
    }
    
    const breaks: Break[] = [];
    let totalDeductionMs = 0;

    // Validate and add lunch break
    if (lunchStartTime && lunchEndTime) {
        const lunchStartDateTime = new Date(`${date}T${lunchStartTime}`);
        const lunchEndDateTime = new Date(`${date}T${lunchEndTime}`);
        if (lunchEndDateTime <= lunchStartDateTime) {
            setError("O fim do almoço deve ser posterior ao início.");
            return;
        }
        if (lunchStartDateTime < startDateTime || lunchEndDateTime > endDateTime) {
            setError("O intervalo de almoço deve estar dentro da jornada de trabalho.");
            return;
        }
        // Preserve ID if editing and exists, else generate
        const existingLunch = initialLog?.breaks.find(b => b.type === 'LUNCH');
        breaks.push({
            id: existingLunch ? existingLunch.id : generateId(),
            startTime: lunchStartDateTime.toISOString(),
            endTime: lunchEndDateTime.toISOString(),
            type: 'LUNCH'
        });
        totalDeductionMs += (lunchEndDateTime.getTime() - lunchStartDateTime.getTime());
    }

    // Validate and add coffee break
    if (coffeeStartTime && coffeeEndTime) {
        const coffeeStartDateTime = new Date(`${date}T${coffeeStartTime}`);
        const coffeeEndDateTime = new Date(`${date}T${coffeeEndTime}`);
        if (coffeeEndDateTime <= coffeeStartDateTime) {
            setError("O fim do café deve ser posterior ao início.");
            return;
        }
        if (coffeeStartDateTime < startDateTime || coffeeEndDateTime > endDateTime) {
            setError("O intervalo de café deve estar dentro da jornada de trabalho.");
            return;
        }
        const existingCoffee = initialLog?.breaks.find(b => b.type === 'COFFEE');
        breaks.push({
            id: existingCoffee ? existingCoffee.id : generateId(),
            startTime: coffeeStartDateTime.toISOString(),
            endTime: coffeeEndDateTime.toISOString(),
            type: 'COFFEE'
        });
        // Coffee break duration is NOT deducted from total
    }

    const totalDurationMs = (endDateTime.getTime() - startDateTime.getTime()) - totalDeductionMs;

    const newLog: TimeLog = {
      id: initialLog ? initialLog.id : generateId(), // Mantém ID se edição
      date: startDateTime.toISOString().split('T')[0],
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      breaks,
      absences: initialLog ? initialLog.absences : [], // Mantém ausências na edição simples
      totalDurationMs: Math.max(0, totalDurationMs),
    };

    onSave(newLog);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-left">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 dark:border-slate-700 transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
             {initialLog ? <Edit3 className="text-indigo-500 dark:text-indigo-400" size={20} /> : <PlusCircle className="text-indigo-500 dark:text-indigo-400" size={20} />}
             {initialLog ? 'Editar Registro' : 'Adicionar Registro Manual'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Date Input */}
          <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-slate-400"/>
              Data do Registro
            </label>
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all p-2.5 dark:[color-scheme:dark]"
              required
            />
          </div>

          {/* Work Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Entrada</label>
                <input 
                    type="time" 
                    value={startTime} 
                    onChange={handleStartTimeChange} 
                    className="w-full bg-transparent outline-none font-mono font-bold text-slate-700 dark:text-slate-200 text-lg dark:[color-scheme:dark]" 
                    required 
                />
            </div>
            <div className="bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Saída</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-transparent outline-none font-mono font-bold text-slate-700 dark:text-slate-200 text-lg dark:[color-scheme:dark]" required />
            </div>
          </div>
          
          {/* Optional Breaks */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">Intervalos (Opcional)</h4>
             {/* Lunch Times */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50/50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <label className="block text-xs font-bold text-amber-600 dark:text-amber-400/80 mb-1">Início Almoço</label>
                    <input type="time" value={lunchStartTime} onChange={(e) => setLunchStartTime(e.target.value)} className="w-full bg-transparent outline-none font-mono font-bold text-amber-800 dark:text-amber-300 text-lg dark:[color-scheme:dark]" />
                </div>
                <div className="bg-amber-50/50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <label className="block text-xs font-bold text-amber-600 dark:text-amber-400/80 mb-1">Fim Almoço</label>
                    <input type="time" value={lunchEndTime} onChange={(e) => setLunchEndTime(e.target.value)} className="w-full bg-transparent outline-none font-mono font-bold text-amber-800 dark:text-amber-300 text-lg dark:[color-scheme:dark]" />
                </div>
            </div>
            {/* Coffee Times */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-teal-50/50 dark:bg-teal-900/20 p-3 rounded-xl border border-teal-100 dark:border-teal-900/30">
                    <label className="block text-xs font-bold text-teal-600 dark:text-teal-400/80 mb-1">Início Café</label>
                    <input type="time" value={coffeeStartTime} onChange={(e) => setCoffeeStartTime(e.target.value)} className="w-full bg-transparent outline-none font-mono font-bold text-teal-800 dark:text-teal-300 text-lg dark:[color-scheme:dark]" />
                </div>
                <div className="bg-teal-50/50 dark:bg-teal-900/20 p-3 rounded-xl border border-teal-100 dark:border-teal-900/30">
                    <label className="block text-xs font-bold text-teal-600 dark:text-teal-400/80 mb-1">Fim Café</label>
                    <input type="time" value={coffeeEndTime} onChange={(e) => setCoffeeEndTime(e.target.value)} className="w-full bg-transparent outline-none font-mono font-bold text-teal-800 dark:text-teal-300 text-lg dark:[color-scheme:dark]" />
                </div>
            </div>
          </div>
          
          {error && <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 p-3 rounded-lg text-center font-medium">{error}</p>}

          <div className="pt-5 flex justify-end gap-3 border-t border-gray-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors text-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
              Cancelar
            </button>
            <button type="submit" className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center gap-2 text-sm active:scale-95 shadow-md">
              <Save size={18} />
              {initialLog ? 'Salvar Alterações' : 'Salvar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default ManualLogModal;
