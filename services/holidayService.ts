
export interface Holiday {
  date: string;
  name: string;
  type: 'MANDATORY' | 'FACULTATIVE' | 'REGIONAL' | 'MUNICIPAL' | 'SCHOOL';
  note?: string;
}

export const PORTUGAL_HOLIDAYS_2026: Holiday[] = [
  // Feriados Nacionais Obrigatórios
  { date: '2026-01-01', name: 'Ano Novo', type: 'MANDATORY' },
  { date: '2026-04-03', name: 'Sexta-feira Santa', type: 'MANDATORY' },
  { date: '2026-04-05', name: 'Domingo de Páscoa', type: 'MANDATORY' },
  { date: '2026-04-25', name: 'Dia da Liberdade', type: 'MANDATORY', note: 'Cai ao sábado' },
  { date: '2026-05-01', name: 'Dia do Trabalhador', type: 'MANDATORY' },
  { date: '2026-06-04', name: 'Corpo de Deus', type: 'MANDATORY' },
  { date: '2026-06-10', name: 'Dia de Portugal', type: 'MANDATORY' },
  { date: '2026-08-15', name: 'Assunção de Nossa Senhora', type: 'MANDATORY', note: 'Cai ao sábado' },
  { date: '2026-10-05', name: 'Implantação da República', type: 'MANDATORY' },
  { date: '2026-11-01', name: 'Dia de Todos-os-Santos', type: 'MANDATORY', note: 'Cai ao domingo' },
  { date: '2026-12-01', name: 'Restauração da Independência', type: 'MANDATORY' },
  { date: '2026-12-08', name: 'Imaculada Conceição', type: 'MANDATORY' },
  { date: '2026-12-25', name: 'Natal', type: 'MANDATORY' },

  // Feriado Facultativo
  { date: '2026-02-17', name: 'Carnaval', type: 'FACULTATIVE' },

  // Feriados Regionais
  { date: '2026-05-14', name: 'Quinta-feira da Ascensão (Dia da Espiga)', type: 'MUNICIPAL', note: 'Feriado Municipal em vários concelhos' },
  { date: '2026-05-25', name: 'Dia dos Açores', type: 'REGIONAL' },
  { date: '2026-07-01', name: 'Dia da Madeira', type: 'REGIONAL' },
  { date: '2026-12-26', name: 'Primeira Oitava (Madeira)', type: 'REGIONAL', note: 'Cai ao sábado' },

  // Feriados Municipais Principais
  { date: '2026-05-14', name: 'Quinta-feira da Ascensão (Dia da Espiga)', type: 'MUNICIPAL', note: 'Feriado Municipal em vários concelhos' },
  { date: '2026-06-13', name: 'Santo António (Lisboa)', type: 'MUNICIPAL', note: 'Cai ao sábado' },
  { date: '2026-06-24', name: 'São João (Porto/Braga)', type: 'MUNICIPAL' },
  { date: '2026-06-29', name: 'São Pedro (Sintra/Évora)', type: 'MUNICIPAL' },
  { date: '2026-07-04', name: 'Santa Isabel (Coimbra)', type: 'MUNICIPAL', note: 'Cai ao sábado' },
  { date: '2026-08-20', name: 'N. Sra. da Agonia (Viana do Castelo)', type: 'MUNICIPAL' },
  { date: '2026-09-21', name: 'São Mateus (Viseu)', type: 'MUNICIPAL' },
  { date: '2026-11-25', name: 'Santa Catarina (Aveiro)', type: 'MUNICIPAL' },

  // Calendário Escolar - Interrupções
  // Natal (Início de 2026 conforme contexto: até 4 Jan)
  { date: '2026-01-01', name: 'Férias de Natal', type: 'SCHOOL' },
  { date: '2026-01-02', name: 'Férias de Natal', type: 'SCHOOL' },
  { date: '2026-01-03', name: 'Férias de Natal', type: 'SCHOOL' },
  { date: '2026-01-04', name: 'Férias de Natal', type: 'SCHOOL' },
  
  // Carnaval (16 a 18 Fev)
  { date: '2026-02-16', name: 'Interrupção Carnaval', type: 'SCHOOL' },
  { date: '2026-02-17', name: 'Feriado de Carnaval', type: 'SCHOOL' },
  { date: '2026-02-18', name: 'Interrupção Carnaval', type: 'SCHOOL' },

  // Páscoa (30 Mar a 10 Abr)
  { date: '2026-03-30', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-03-31', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-04-01', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-04-02', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-04-03', name: 'Sexta-feira Santa', type: 'SCHOOL' },
  { date: '2026-04-04', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-04-05', name: 'Páscoa', type: 'SCHOOL' },
  { date: '2026-04-06', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-04-07', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-04-08', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-04-09', name: 'Férias da Páscoa', type: 'SCHOOL' },
  { date: '2026-04-10', name: 'Férias da Páscoa', type: 'SCHOOL' },
];

export const getHolidayByDate = (date: string): Holiday | undefined => {
  // Ordenar por prioridade se houver sobreposição (MANDATORY > FACULTATIVE > REGIONAL > MUNICIPAL > SCHOOL)
  const holidays = PORTUGAL_HOLIDAYS_2026.filter(h => h.date === date);
  if (holidays.length === 0) return undefined;
  
  const priority = {
    MANDATORY: 1,
    FACULTATIVE: 2,
    REGIONAL: 3,
    MUNICIPAL: 4,
    SCHOOL: 5
  };

  return holidays.sort((a, b) => priority[a.type] - priority[b.type])[0];
};

export const getHolidayColorClasses = (type: Holiday['type']) => {
  switch (type) {
    case 'MANDATORY':
      return {
        bg: 'bg-rose-50/40 dark:bg-rose-950/20',
        border: 'border-rose-200/60 dark:border-rose-500/30',
        shadow: 'shadow-rose-500/5',
        dot: 'bg-rose-500',
        badge: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
        iconBg: 'bg-rose-500',
        text: 'text-rose-600 dark:text-rose-400'
      };
    case 'FACULTATIVE':
      return {
        bg: 'bg-amber-50/40 dark:bg-amber-900/10',
        border: 'border-amber-200/60 dark:border-amber-500/20',
        shadow: 'shadow-amber-500/5',
        dot: 'bg-amber-500',
        badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
        iconBg: 'bg-amber-500',
        text: 'text-amber-600 dark:text-amber-400'
      };
    case 'REGIONAL':
      return {
        bg: 'bg-blue-50/40 dark:bg-blue-900/10',
        border: 'border-blue-200/60 dark:border-blue-500/20',
        shadow: 'shadow-blue-500/5',
        dot: 'bg-blue-500',
        badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
        iconBg: 'bg-blue-500',
        text: 'text-blue-600 dark:text-blue-400'
      };
    case 'MUNICIPAL':
      return {
        bg: 'bg-purple-50/40 dark:bg-purple-900/10',
        border: 'border-purple-200/60 dark:border-purple-500/20',
        shadow: 'shadow-purple-500/5',
        dot: 'bg-purple-500',
        badge: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
        iconBg: 'bg-purple-500',
        text: 'text-purple-600 dark:text-purple-400'
      };
    case 'SCHOOL':
      return {
        bg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
        border: 'border-emerald-200/60 dark:border-emerald-500/30',
        shadow: 'shadow-emerald-500/5',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
        iconBg: 'bg-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400'
      };
    default:
      return {
        bg: 'bg-slate-50/40 dark:bg-slate-900/10',
        border: 'border-slate-200/60 dark:border-slate-500/20',
        shadow: 'shadow-slate-500/5',
        dot: 'bg-slate-500',
        badge: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/30',
        iconBg: 'bg-slate-500',
        text: 'text-slate-600 dark:text-slate-400'
      };
  }
};
