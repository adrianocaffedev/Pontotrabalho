import React, { useState, useEffect, useMemo } from 'react';
import { TimeLog, AppSettings } from '../types';
import { X, Package, Hash, Archive, Save, Loader2 } from 'lucide-react';
import { getTranslation, TranslationKey } from '../services/translations';

interface ProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productionData: { date: string; box: string; infeed: string; picking: number }) => Promise<void>;
  logs: TimeLog[];
  settings: AppSettings;
}

const DEFAULT_BOX_OPTIONS = ['Azul', 'Laranja', 'Cinzento', 'Verde', 'Amarelo'];

const ProductionModal: React.FC<ProductionModalProps> = ({ isOpen, onClose, onSave, logs, settings }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [box, setBox] = useState<string>('');
  const [infeed, setInfeed] = useState<string>('');
  const [picking, setPicking] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const t = (key: TranslationKey) => getTranslation(settings.language || 'pt-PT', key);

  // Get unique box values for the "dropdown" (datalist) and merge with defaults
  const existingBoxes = useMemo(() => {
    const fromLogs = logs.map(l => l.productionBox).filter(Boolean) as string[];
    return Array.from(new Set([...DEFAULT_BOX_OPTIONS, ...fromLogs]));
  }, [logs]);

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
      
      const existingLog = logs.find(l => l.date === today);
      if (existingLog) {
        setBox(existingLog.productionBox || '');
        setInfeed(existingLog.productionInfeed || '');
        setPicking(existingLog.productionPicking || 0);
      } else {
        setBox('');
        setInfeed('');
        setPicking(0);
      }
    }
  }, [isOpen, logs]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    const existingLog = logs.find(l => l.date === date);
    if (existingLog) {
      setBox(existingLog.productionBox || '');
      setInfeed(existingLog.productionInfeed || '');
      setPicking(existingLog.productionPicking || 0);
    } else {
      setBox('');
      setInfeed('');
      setPicking(0);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        date: selectedDate,
        box,
        infeed,
        picking
      });
      onClose();
    } catch (error) {
      console.error("Error saving production:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 rounded-lg text-white shadow-lg shadow-emerald-500/20">
              <Package size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">{t('label_production')}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('label_today')}: {selectedDate.split('-').reverse().join('/')}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Archive size={14} className="text-emerald-500" /> {t('label_box')}
            </label>
            <div className="relative">
              <input 
                list="box-options"
                type="text"
                value={box}
                onChange={(e) => setBox(e.target.value)}
                placeholder={t('label_box')}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-lg font-bold dark:text-white outline-none focus:border-emerald-500 transition-all text-xl"
              />
              <datalist id="box-options">
                {existingBoxes.map((b: string) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Hash size={14} className="text-teal-500" /> {t('label_infeed')}
            </label>
            <select 
              value={infeed}
              onChange={(e) => setInfeed(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-lg font-bold dark:text-white outline-none focus:border-teal-500 transition-all text-xl appearance-none"
            >
              <option value="">Selecione...</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Loader2 size={14} className="text-amber-500" /> {t('label_picking_quantity')}
            </label>
            <input 
              type="number"
              value={picking || ''}
              onChange={(e) => setPicking(Number(e.target.value))}
              placeholder="0"
              className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-lg font-bold dark:text-white outline-none focus:border-amber-500 transition-all text-xl"
            />
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {t('btn_save_production')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductionModal;
