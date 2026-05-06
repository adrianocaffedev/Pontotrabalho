import React, { useState, useEffect } from 'react';

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-6 md:py-8 relative w-full overflow-hidden">
      <div className="flex flex-col items-center w-full">
        <div className="flex items-baseline justify-center relative flex-wrap sm:flex-nowrap px-4">
            {/* Responsividade Extrema: text-6xl no mobile, text-9rem no desktop */}
            <span className="text-6xl sm:text-8xl md:text-[9rem] font-bold text-slate-800 dark:text-white tracking-tighter tabular-nums leading-none transition-all duration-300">
                {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-2xl sm:text-3xl md:text-5xl font-light text-slate-400 dark:text-slate-600 tabular-nums ml-1 sm:ml-3 transition-colors duration-300 pb-1 sm:pb-2">
                {time.toLocaleTimeString('pt-BR', { second: '2-digit' })}
            </span>
        </div>
      </div>
      
      <div className="mt-2 md:mt-4">
        <div className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-lg flex items-center gap-2 uppercase tracking-wide">
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500"></span>
          {time.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>
    </div>
  );
};

export default Clock;