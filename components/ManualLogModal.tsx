
import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Clock, PlusCircle, Edit3 } from 'lucide-react';
import { TimeLog, Break, AppSettings } from '../types';

interface ManualLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (log: TimeLog) => void;
  initialLog: TimeLog | null; // Adicionado para edição
  existingLogs: TimeLog[]; // Para validação de duplicidade baseada em horas
  settings: AppSettings;
}

const ManualLogModal: React.FC<ManualLogModalProps> = ({ isOpen, onClose, onSave, initialLog, existingLogs, settings }) => {
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

  // Helper para formatar HH:mm
  const formatTime = (hours: number, minutes: number) => {
    const adjustedHours = (hours % 24).toString().padStart(2, '0');
    const adjustedMinutes = minutes.toString().padStart(2, '0');
    return `${adjustedHours}:${adjustedMinutes}`;
  };

  // Helper para adicionar minutos a uma string de tempo HH:mm
  const addMinutesToTime = (timeStr: string, minutesToAdd: number) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    
    const totalMinutes = h * 60 + m + minutesToAdd;
    return formatTime(Math.floor(totalMinutes / 60), totalMinutes % 60);
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartTime(value);

    // Sugestão automática abrangente apenas se for NOVO registro
    if (value && !initialLog) {
        const [h, m] = value.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
            // Regra: Usar configurações dinâmicas
            const coffeeStartH = h + 2; // Sugere café após 2 horas de trabalho
            const coffeeDurMin = settings.coffeeDurationMinutes || 15;
            
            const lunchStartH = h + 4; // Sugere almoço após 4 horas de trabalho
            const lunchDurMin = settings.lunchDurationMinutes || 60;
            const dailyH = settings.dailyWorkHours || 8;

            // Preenche Café
            const cStart = formatTime(coffeeStartH, m);
            setCoffeeStartTime(cStart);
            setCoffeeEndTime(addMinutesToTime(cStart, coffeeDurMin));

            // Preenche Almoço
            const lStart = formatTime(lunchStartH, m);
            setLunchStartTime(lStart);
            setLunchEndTime(addMinutesToTime(lStart, lunchDurMin));
            
            // Preenche Saída (Cálculo standard: Início + Jornada + Almoço)
            const endTotalMin = (h * 60) + m + (dailyH * 60) + lunchDurMin;
            setEndTime(formatTime(Math.floor(endTotalMin / 60), endTotalMin % 60));
        }
    }
  };

  const handleLunchStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLunchStartTime(value);
    if (value) {
      setLunchEndTime(addMinutesToTime(value, settings.lunchDurationMinutes));
    }
  };

  const handleCoffeeStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCoffeeStartTime(value);
    if (value) {
      setCoffeeEndTime(addMinutesToTime(value, settings.coffeeDurationMinutes));
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
    
    // Check for duplicate date/duration
    const dailyLimitMs = (settings.dailyWorkHours || 8) * 60 * 60 * 1000;
    
    // Calcula o total já registrado para este dia, excluindo o registro atual se estiver em edição
    const logsOnThisDate = existingLogs.filter(l => l.date === date && (!initialLog || l.id !== initialLog.id));
    const totalExistingMs = logsOnThisDate.reduce((sum, l) => sum + (l.totalDurationMs || 0), 0);
    
    // Se o que já existe (sem contar o que estou editando) já atinge ou passa o limite diário
    if (totalExistingMs >= dailyLimitMs) {
         setError(`Já existe um registro completo (jornada de ${settings.dailyWorkHours}h) para esta data.`);
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
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 dark:border-slate-700 transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
             {initialLog ? <Edit3 className="text-emerald-500 dark:text-emerald-400" size={20} /> : <PlusCircle className="text-emerald-500 dark:text-emerald-400" size={20} />}
             {initialLog ? 'Editar Registro' : 'Adicionar Registro Manual'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-all">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Date Input */}
          <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-slate-400"/>
              Data do Registro
            </label>
            <input 
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none transition-all p-2.5 dark:[color-scheme:dark]"
              required
            />
          </div>

          <div className="space-y-4">
              {/* PRIMARY ENTRY */}
              <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">01. Início da Jornada</label>
                  <div className="flex items-center gap-4">
                      <Clock size={24} className="text-emerald-500" />
                      <input 
                          type="time" 
                          value={startTime} 
                          onChange={handleStartTimeChange} 
                          className="w-full bg-transparent outline-none font-mono font-black text-slate-800 dark:text-white text-3xl dark:[color-scheme:dark]" 
                          required 
                      />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium italic">Preencha este campo para auto-sugestão do dia.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* COFFEE */}
                  <div className="space-y-2">
                      <label className="block text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest ml-1">02. Intervalo Café</label>
                      <div className="grid grid-cols-2 gap-2">
                          <div className="bg-teal-50/50 dark:bg-teal-900/20 p-2.5 rounded-lg border border-teal-100 dark:border-teal-900/30">
                              <label className="block text-[9px] font-bold text-teal-500 uppercase mb-1">Início</label>
                              <input type="time" value={coffeeStartTime} onChange={handleCoffeeStartTimeChange} className="w-full bg-transparent outline-none font-mono font-bold text-teal-800 dark:text-teal-300 text-sm dark:[color-scheme:dark]" />
                          </div>
                          <div className="bg-teal-50/50 dark:bg-teal-900/20 p-2.5 rounded-lg border border-teal-100 dark:border-teal-900/30">
                              <label className="block text-[9px] font-bold text-teal-500 uppercase mb-1">Fim</label>
                              <input type="time" value={coffeeEndTime} onChange={(e) => setCoffeeEndTime(e.target.value)} className="w-full bg-transparent outline-none font-mono font-bold text-teal-800 dark:text-teal-300 text-sm dark:[color-scheme:dark]" />
                          </div>
                      </div>
                  </div>

                  {/* LUNCH */}
                  <div className="space-y-2">
                      <label className="block text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest ml-1">03. Intervalo Almoço</label>
                      <div className="grid grid-cols-2 gap-2">
                          <div className="bg-amber-50/50 dark:bg-amber-900/20 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                              <label className="block text-[9px] font-bold text-amber-500 uppercase mb-1">Início</label>
                              <input type="time" value={lunchStartTime} onChange={handleLunchStartTimeChange} className="w-full bg-transparent outline-none font-mono font-bold text-amber-800 dark:text-amber-300 text-sm dark:[color-scheme:dark]" />
                          </div>
                          <div className="bg-amber-50/50 dark:bg-amber-900/20 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                              <label className="block text-[9px] font-bold text-amber-500 uppercase mb-1">Fim</label>
                              <input type="time" value={lunchEndTime} onChange={(e) => setLunchEndTime(e.target.value)} className="w-full bg-transparent outline-none font-mono font-bold text-amber-800 dark:text-amber-300 text-sm dark:[color-scheme:dark]" />
                          </div>
                      </div>
                  </div>
              </div>

              {/* FINAL EXIT */}
              <div className="bg-slate-800 dark:bg-slate-800 p-4 rounded-lg border border-slate-700 dark:border-slate-600 shadow-xl">
                  <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">04. Fim da Jornada (Saída)</label>
                  <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                        <Clock size={20} className="text-emerald-400" />
                      </div>
                      <input 
                          type="time" 
                          value={endTime} 
                          onChange={(e) => setEndTime(e.target.value)} 
                          className="w-full bg-transparent outline-none font-mono font-black text-white text-3xl dark:[color-scheme:dark]" 
                          required 
                      />
                  </div>
              </div>
          </div>
          
          {error && <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 p-3 rounded-lg text-center font-medium">{error}</p>}

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-5 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-bold transition-colors text-sm border border-slate-200 dark:border-slate-700">
              Cancelar
            </button>
            <button type="submit" className="flex-[2] px-8 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 text-sm active:scale-95 shadow-md">
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
