
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
  startTime?: string;
  endTime?: string;
}

export interface TimeLog {
  id: string;
  date: string;
  startTime: string;
  breaks: Break[];
  absences: Absence[];
  endTime?: string;
  totalDurationMs: number;
}

export interface AppSettings {
  dailyWorkHours: number;
  lunchDurationMinutes: number;
  notificationMinutes: number;
  hourlyRate: number;
  foodAllowance: number;
  currency: string;
  overtimePercentage: number;
  overtimeDays: number[];
  holidays: string[];
  periodStartDay: number;
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
  pin?: string; // Novo campo para segurança da sessão
  created_at?: string;
}
