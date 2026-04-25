import React from 'react';
import { WorkStatus } from '../types';

interface StatusBadgeProps {
  status: WorkStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = {
    [WorkStatus.IDLE]: {
      style: 'bg-slate-100/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      label: 'Inativo',
      dot: 'bg-slate-400 dark:bg-slate-500'
    },
    [WorkStatus.WORKING]: {
      style: 'bg-indigo-50/80 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800/50',
      label: 'Trabalhando',
      dot: 'bg-indigo-500 animate-pulse'
    },
    [WorkStatus.ON_LUNCH]: {
      style: 'bg-amber-50/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800/50',
      label: 'Almoço',
      dot: 'bg-amber-500'
    },
    [WorkStatus.ON_COFFEE]: {
      style: 'bg-teal-50/80 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-800/50',
      label: 'Café',
      dot: 'bg-teal-500'
    },
    [WorkStatus.FINISHED]: {
      style: 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-700',
      label: 'Encerrado',
      dot: 'bg-slate-400'
    }
  };

  const current = config[status] || config[WorkStatus.IDLE];

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold transition-all duration-300 ${current.style} backdrop-blur-md shadow-sm`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`}></span>
      <span>{current.label}</span>
    </div>
  );
};

export default StatusBadge;