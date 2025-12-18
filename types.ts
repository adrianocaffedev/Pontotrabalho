
export enum WorkStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  ON_LUNCH = 'ON_LUNCH',
  ON_COFFEE = 'ON_COFFEE',
  FINISHED = 'FINISHED'
}

export interface Break {
  id: string;
  startTime: string;
  endTime?: string;
  type: 'LUNCH' | 'COFFEE';
}

export interface Absence {
  id: string;
  type: 'FULL_DAY' | 'PARTIAL';
  reason: string;
  startTime?: string; // Obrigatório se PARTIAL
  endTime?: string;   // Obrigatório se PARTIAL
}

export interface TimeLog {
  id: string;
  date: string; // ISO String YYYY-MM-DD
  startTime: string; // ISO timestamp
  breaks: Break[]; // Supports multiple breaks (Coffee + Lunch in same day)
  absences: Absence[]; // Lista de ausências justificadas
  endTime?: string; // ISO timestamp
  totalDurationMs: number; // milliseconds
}

export interface AppSettings {
  dailyWorkHours: number; // Horas de trabalho diário (ex: 8)
  lunchDurationMinutes: number; // Tempo de almoço em minutos (ex: 60)
  notificationMinutes: number; // Minutos antes de acabar para avisar (ex: 10)
  hourlyRate: number; // Valor da hora
  foodAllowance: number; // Vale Refeição Diário
  currency: string; // Moeda (BRL, EUR, USD)
  overtimePercentage: number; // Percentual de bônus para horas extras
  overtimeDays: number[]; // Dias da semana considerados 100% extra (0=Dom, 1=Seg...)
  holidays: string[]; // Lista de datas (YYYY-MM-DD) que são feriados (100% extra)
}

export interface AnalysisResult {
  summary: string;
  overtime: boolean;
  mood: 'positive' | 'neutral' | 'warning';
  suggestions: string[];
}

export interface ContractRenewal {
  id: string;
  date: string;
}

export interface AppUser {
  id: string;
  name: string;
  active: boolean;
  company?: string;
  contractType?: 'EFFECTIVE' | 'TEMPORARY';
  contractStartDate?: string;
  renewals?: ContractRenewal[];
  created_at?: string;
}
