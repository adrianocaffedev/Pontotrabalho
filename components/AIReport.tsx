import React from 'react';
import { AnalysisResult } from '../types';
import { Sparkles, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';

interface AIReportProps {
  report: AnalysisResult | null;
  loading: boolean;
  onGenerate: () => void;
  hasData: boolean;
}

const AIReport: React.FC<AIReportProps> = ({ report, loading, onGenerate, hasData }) => {
  if (!hasData) return null;

  return (
    <div className="pb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
      {!report && !loading && (
        <div 
          onClick={onGenerate}
          className="group relative rounded-2xl p-1 overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.01] active:scale-[0.99]"
        >
          {/* Animated Gradient Border */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-30 group-hover:opacity-60 transition-opacity duration-500 animate-gradient-x"></div>
          
          <div className="relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-[22px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 border border-white/50 dark:border-white/5 shadow-lg shadow-indigo-500/5">
            <div className="flex items-center gap-5">
               <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-white dark:from-indigo-900/50 dark:to-slate-800 flex items-center justify-center shadow-inner text-indigo-500 dark:text-indigo-400">
                  <Sparkles size={24} className="animate-pulse" />
               </div>
               <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    Análise de Produtividade
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    Obtenha insights da IA sobre sua jornada hoje.
                  </p>
               </div>
            </div>
            
            <button
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 whitespace-nowrap text-sm flex items-center gap-2"
            >
              <Sparkles size={16} className="fill-current" />
              Gerar Relatório
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl p-10 border border-white/40 dark:border-white/5 shadow-lg flex flex-col items-center justify-center text-center animate-pulse">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-full"></div>
            <Sparkles className="text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" size={40} />
          </div>
          <p className="text-slate-700 dark:text-slate-200 font-bold text-lg">Processando...</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">A IA está analisando seus registros.</p>
        </div>
      )}

      {report && !loading && (
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl rounded-2xl border border-white/50 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden animate-in zoom-in-95 duration-500">
          <div className={`h-2 w-full ${report.mood === 'positive' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : report.mood === 'warning' ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`}></div>
          <div className="p-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
                <div className="flex items-center gap-4">
                     <div className={`p-3 rounded-2xl ${report.mood === 'positive' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : report.mood === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'}`}>
                        <Sparkles size={24} className="fill-current" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            Análise do Dia
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Gerado via Gemini AI</p>
                     </div>
                </div>
                
                {report.overtime && (
                    <span className="bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-4 py-2 rounded-xl uppercase tracking-widest flex items-center gap-2 border border-emerald-200/50 dark:border-emerald-500/20 shadow-sm self-start">
                        <TrendingUp size={14}/> Horas Extras
                    </span>
                )}
            </div>
            
            <div className="prose dark:prose-invert max-w-none">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-8 text-lg font-light">
                    {report.summary}
                </p>
            </div>

            <div className="grid gap-3">
                {report.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-4 bg-white/40 dark:bg-black/20 p-4 rounded-2xl border border-white/40 dark:border-white/5 hover:bg-white/60 dark:hover:bg-black/40 transition-colors">
                        {report.mood === 'warning' ? (
                            <div className="mt-0.5 text-amber-500 dark:text-amber-400 shrink-0">
                                <AlertCircle size={20} />
                            </div>
                        ) : (
                            <div className="mt-0.5 text-indigo-500 dark:text-indigo-400 shrink-0">
                                <CheckCircle size={20} />
                            </div>
                        )}
                        <span className="text-slate-600 dark:text-slate-300 font-medium text-sm leading-relaxed">{suggestion}</span>
                    </div>
                ))}
            </div>
            
            <div className="mt-8 flex justify-center">
                <button 
                    onClick={onGenerate} 
                    className="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold uppercase tracking-widest transition-colors py-3 px-6 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800"
                >
                    Atualizar Relatório
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReport;