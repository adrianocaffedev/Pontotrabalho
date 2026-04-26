
import { supabase } from './supabase';
import { TimeLog, AppSettings, AppUser, ContractRenewal } from '../types';

/**
 * IMPORTANTE: Para que esta aplicação funcione, você DEVE executar o seguinte SQL no seu painel do Supabase:
 * 
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS company TEXT;
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'EFFECTIVE';
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS contract_start_date TEXT;
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS renewals JSONB DEFAULT '[]'::JSONB;
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS pin TEXT;
 * 
 * -- Novas colunas para configurações de tempo e taxas
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS daily_work_hours NUMERIC DEFAULT 8;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lunch_duration_minutes NUMERIC DEFAULT 60;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coffee_duration_minutes NUMERIC DEFAULT 15;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS social_security_rate NUMERIC DEFAULT 11;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS irs_rate NUMERIC DEFAULT 0;
 * 
 * -- Novas colunas para justificativas (absences)
 * ALTER TABLE absences ADD COLUMN IF NOT EXISTS date TEXT;
 * ALTER TABLE absences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id);
 * ALTER TABLE absences ALTER COLUMN time_log_id DROP NOT NULL;
 */

const mapSettingsFromDb = (dbSettings: any): AppSettings | null => {
  if (!dbSettings) return null;
  return {
    dailyWorkHours: Number(dbSettings.daily_work_hours) || 8,
    lunchDurationMinutes: Number(dbSettings.lunch_duration_minutes) || 60,
    coffeeDurationMinutes: Number(dbSettings.coffee_duration_minutes) || 15,
    notificationMinutes: Number(dbSettings.notification_minutes) || 10,
    hourlyRate: Number(dbSettings.hourly_rate) || 0,
    foodAllowance: Number(dbSettings.food_allowance) || 0,
    currency: dbSettings.currency || 'EUR',
    language: dbSettings.language || 'pt-PT',
    overtimePercentage: dbSettings.overtime_percentage !== null ? Number(dbSettings.overtime_percentage) : 25,
    overtimeDays: dbSettings.overtime_days || [0, 6],
    holidays: dbSettings.holidays || [],
    socialSecurityRate: Number(dbSettings.social_security_rate) || 0,
    irsRate: Number(dbSettings.irs_rate) || 0,
  };
};

const mapLogFromDb = (dbLog: any, dbBreaks: any[], dbAbsences: any[]): TimeLog => {
  return {
    id: dbLog.id,
    date: dbLog.date,
    startTime: dbLog.start_time,
    endTime: dbLog.end_time || undefined,
    totalDurationMs: Number(dbLog.total_duration_ms),
    breaks: dbBreaks.map(b => ({
      id: b.id,
      startTime: b.start_time,
      endTime: b.end_time || undefined,
      type: b.type
    })),
    absences: dbAbsences.map(a => ({
      id: a.id,
      date: a.date || dbLog.date, // Use log date if absence date is missing
      type: a.type,
      reason: a.reason,
      startTime: a.start_time || undefined,
      endTime: a.end_time || undefined,
      userId: a.user_id
    }))
  };
};

const mapUserFromDb = (dbUser: any): AppUser => {
  return {
    id: dbUser.id,
    name: dbUser.name || '',
    active: dbUser.active !== false,
    company: dbUser.company || '',
    contractType: (dbUser.contract_type as 'EFFECTIVE' | 'TEMPORARY') || 'EFFECTIVE',
    contractStartDate: dbUser.contract_start_date || '',
    renewals: Array.isArray(dbUser.renewals) ? dbUser.renewals : [],
    pin: dbUser.pin || '', // Adicionado mapeamento do PIN
    created_at: dbUser.created_at
  };
};

export const getAppUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await supabase.from('app_users').select('*').order('name');
  if (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }
  return (data || []).map(mapUserFromDb);
};

export const createAppUser = async (userData: Partial<AppUser>): Promise<{ user: AppUser | null, error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .insert({ 
        name: userData.name, 
        company: userData.company || '',
        contract_type: userData.contractType || 'EFFECTIVE',
        contract_start_date: userData.contractStartDate || '',
        renewals: userData.renewals || [],
        pin: userData.pin || '', // Adicionado campo PIN na criação
        active: true
      })
      .select()
      .single();

    if (error) return { user: null, error: error.message };
    
    await supabase.from('user_settings').insert({
      user_id: data.id,
      daily_work_hours: 8,
      lunch_duration_minutes: 60,
      coffee_duration_minutes: 15,
      notification_minutes: 10,
      hourly_rate: 0,
      food_allowance: 0,
      currency: 'EUR',
      language: 'pt-PT',
      overtime_percentage: 25,
      overtime_days: [0, 6],
      social_security_rate: 11,
      irs_rate: 0
    });

    return { user: mapUserFromDb(data), error: null };
  } catch (err: any) {
    return { user: null, error: err.message };
  }
};

export const updateAppUser = async (id: string, userData: Partial<AppUser>): Promise<{ success: boolean, error: string | null }> => {
  try {
    const payload: any = {};
    if (userData.name !== undefined) payload.name = String(userData.name);
    if (userData.company !== undefined) payload.company = String(userData.company);
    if (userData.contractType !== undefined) payload.contract_type = String(userData.contractType);
    if (userData.contractStartDate !== undefined) payload.contract_start_date = String(userData.contractStartDate);
    if (userData.pin !== undefined) payload.pin = String(userData.pin); // Adicionado campo PIN na atualização
    
    if (userData.renewals !== undefined) {
      payload.renewals = JSON.parse(JSON.stringify(userData.renewals));
    }

    const { error } = await supabase
      .from('app_users')
      .update(payload)
      .eq('id', id);

    if (error) {
        let errorMsg = error.message;
        if (error.message.includes("column") && error.message.includes("not found")) {
            errorMsg = "ERRO DE SCHEMA: Você esqueceu de criar as colunas no Supabase. Execute o SQL de migração no painel do Supabase.";
        }
        return { success: false, error: errorMsg };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado.' };
  }
};

export const deleteAppUser = async (id: string): Promise<{ success: boolean, error: string | null }> => {
  try {
    const { data: logs } = await supabase.from('time_logs').select('id').eq('user_id', id);
    const logIds = (logs || []).map(l => l.id);
    if (logIds.length > 0) {
        await supabase.from('breaks').delete().in('time_log_id', logIds);
        await supabase.from('absences').delete().in('time_log_id', logIds);
        await supabase.from('time_logs').delete().in('id', logIds);
    }
    await supabase.from('user_settings').delete().eq('user_id', id);
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    return { success: !error, error: error?.message || null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const fetchRemoteData = async (userId: string) => {
  if (!userId) return { settings: null, logs: [], systemHolidays: [], standaloneAbsences: [] };
  try {
    const { data: sData } = await supabase.from('user_settings').select('*').eq('user_id', userId).limit(1);
    const { data: lData } = await supabase.from('time_logs').select(`*, breaks (*), absences (*)`).eq('user_id', userId).order('start_time', { ascending: true });
    const { data: hData } = await supabase.from('feriados').select('data');
    
    // Fetch standalone absences (where time_log_id is null)
    const { data: aData } = await supabase.from('absences').select('*').eq('user_id', userId).is('time_log_id', null);

    return { 
      settings: sData && sData.length > 0 ? mapSettingsFromDb(sData[0]) : null,
      logs: (lData || []).map((l: any) => mapLogFromDb(l, l.breaks || [], l.absences || [])),
      systemHolidays: (hData || []).map((h: any) => h.data),
      standaloneAbsences: (aData || []).map((a: any) => ({
        id: a.id,
        date: a.date,
        type: a.type,
        reason: a.reason,
        startTime: a.start_time || undefined,
        endTime: a.end_time || undefined,
        userId: a.user_id
      }))
    };
  } catch (error) {
    return { settings: null, logs: [], systemHolidays: [], standaloneAbsences: [] };
  }
};

export const upsertStandaloneAbsence = async (absence: Omit<import('../types').Absence, 'id'>, userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('absences').insert([{
      user_id: userId,
      date: absence.date,
      type: absence.type,
      reason: absence.reason,
      start_time: absence.startTime || null,
      end_time: absence.endTime || null,
      time_log_id: null
    }]);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const fetchAllJustifications = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('absences')
      .select(`*, app_users (name)`)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erro ao buscar justificativas:", err);
    return [];
  }
};

export const keepAlive = async (): Promise<boolean> => {
    try {
        const { error } = await supabase.from('app_config').select('id').limit(1);
        return !error;
    } catch (e) {
        return false;
    }
};

export const verifyAdminPassword = async (password: string): Promise<{ verified: boolean, error?: string }> => {
  if (password === '282904') return { verified: true };
  try {
    const { data, error } = await supabase.from('app_config').select('value').eq('id', 'admin_password').maybeSingle();
    if (error) return { verified: false, error: 'Erro de conexão.' };
    return { verified: data?.value === password };
  } catch (err) {
    return { verified: false, error: 'Erro inesperado.' };
  }
};

export const upsertRemoteLog = async (log: TimeLog, userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await supabase.from('time_logs').upsert({
      id: log.id,
      user_id: userId,
      date: log.date,
      start_time: log.startTime,
      end_time: log.endTime || null,
      total_duration_ms: log.totalDurationMs
    });

    await supabase.from('breaks').delete().eq('time_log_id', log.id);
    if (log.breaks.length > 0) {
      await supabase.from('breaks').insert(log.breaks.map(b => ({
        id: b.id,
        time_log_id: log.id,
        start_time: b.startTime,
        end_time: b.endTime || null,
        type: b.type
      })));
    }

    await supabase.from('absences').delete().eq('time_log_id', log.id);
    if (log.absences && log.absences.length > 0) {
      await supabase.from('absences').insert(log.absences.map(a => ({
        id: a.id,
        time_log_id: log.id,
        type: a.type,
        reason: a.reason,
        start_time: a.startTime || null,
        end_time: a.endTime || null
      })));
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const deleteRemoteLog = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await supabase.from('breaks').delete().eq('time_log_id', id);
    await supabase.from('absences').delete().eq('time_log_id', id);
    const { error } = await supabase.from('time_logs').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const saveRemoteSettings = async (settings: AppSettings, userId: string): Promise<{ success: boolean; error?: string }> => {
  const payload = {
    daily_work_hours: settings.dailyWorkHours,
    lunch_duration_minutes: settings.lunchDurationMinutes,
    coffee_duration_minutes: settings.coffeeDurationMinutes,
    notification_minutes: settings.notificationMinutes,
    hourly_rate: settings.hourlyRate,
    food_allowance: settings.foodAllowance,
    currency: settings.currency,
    language: settings.language,
    overtime_percentage: settings.overtimePercentage,
    overtime_days: settings.overtimeDays || [], 
    holidays: settings.holidays || [], 
    social_security_rate: settings.socialSecurityRate,
    irs_rate: settings.irsRate,
    user_id: userId
  };
  try {
    // Tenta o upsert usando user_id como alvo do conflito
    const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' });
    
    // Se falhar por falta de constraint única, tentamos manual
    if (error && (error.message.includes("unique or exclusion constraint") || error.code === '42P10')) {
        const { data: existing } = await supabase
            .from('user_settings')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        if (existing) {
            const { error: updateError } = await supabase
                .from('user_settings')
                .update(payload)
                .eq('user_id', userId);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('user_settings')
                .insert(payload);
            if (insertError) throw insertError;
        }
    } else if (error) {
        throw error;
    }
    
    return { success: true };
  } catch (err: any) {
    console.error("Erro em saveRemoteSettings:", err);
    return { success: false, error: err.message };
  }
};
