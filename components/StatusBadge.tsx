import React from 'react';
import { WorkStatus } from '../types';
import { Moon, Zap, Utensils, Coffee, CheckCircle2, LucideIcon } from 'lucide-react';

interface StatusBadgeProps {
  status: WorkStatus;
  label?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const config: Record<WorkStatus, { style: string; label: string; icon: LucideIcon; iconColor: string }> = {
    [WorkStatus.IDLE]: {
      style: 'bg-slate-100/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      label: label || 'Inativo',
      icon: Moon,
      iconColor: 'text-slate-400 dark:text-slate-500'
    },
    [WorkStatus.WORKING]: {
      style: 'bg-emerald-50/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/50',
      label: label || 'Trabalhando',
      icon: Zap,
      iconColor: 'text-emerald-500 animate-pulse'
    },
    [WorkStatus.ON_LUNCH]: {
      style: 'bg-amber-50/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800/50',
      label: label || 'Almoço',
      icon: Utensils,
      iconColor: 'text-amber-500'
    },
    [WorkStatus.ON_COFFEE]: {
      style: 'bg-teal-50/80 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-800/50',
      label: label || 'Café',
      icon: Coffee,
      iconColor: 'text-teal-500'
    },
    [WorkStatus.FINISHED]: {
      style: 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-700',
      label: label || 'Encerrado',
      icon: CheckCircle2,
      iconColor: 'text-slate-400'
    }
  };

  const current = config[status] || config[WorkStatus.IDLE];
  const Icon = current.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-bold transition-all duration-300 ${current.style} backdrop-blur-md shadow-sm`}>
      <Icon size={12} className={current.iconColor} />
      <span>{current.label}</span>
    </div>
  );
};

export default StatusBadge;