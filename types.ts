
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
  date: string; // Added date to allow standalone absences
  type: 'FULL_DAY' | 'PARTIAL' | 'DELAY' | 'ABSENCE'; 
  reason: string;
  startTime?: string;
  endTime?: string;
  userId?: string; // To track owner for manager view
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
  coffeeDurationMinutes: number;
  notificationMinutes: number;
  hourlyRate: number;
  foodAllowance: number;
  currency: 'EUR' | 'BRL' | 'USD';
  language: 'pt-BR' | 'pt-PT' | 'en';
  overtimePercentage: number;
  overtimeDays: number[];
  holidays: string[];
  socialSecurityRate: number;
  irsRate: number;
  // Novas configurações de horário e notificações
  shiftStart?: string; // Ex: "08:00"
  shiftEnd?: string;   // Ex: "17:00"
  lunchStart?: string; // Ex: "12:00"
  enableNotifications?: boolean;
  reminderBufferMinutes?: number;
}

export interface ContractRenewal {
  id: string;
  date: string;
}

export interface UserDocument {
  id: string;
  user_id: string;
  name: string;
  file_path: string;
  file_type: string;
  category: 'CONTRACT' | 'JUSTIFICATION' | 'ID' | 'OTHER';
  created_at: string;
}
export interface AppUser {
  id: string;
  name: string;
  active: boolean;
  company?: string;
  jobTitle?: string;
  contractType?: 'EFFECTIVE' | 'TEMPORARY';
  contractStartDate?: string;
  renewals?: ContractRenewal[];
  pin?: string; // Novo campo para segurança da sessão
  isAdmin?: boolean; // Novo campo para identificar super usuários
  created_at?: string;
}
