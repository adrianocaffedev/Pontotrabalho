
import { supabase } from './supabase';
import { TimeLog, AppSettings, AppUser } from '../types';

/* 
  NOTA IMPORTANTE DE BANCO DE DADOS:
  1. Para salvar feriados manuais: 
     alter table user_settings add column if not exists holidays text[];
     
  2. Para senha de ADMIN (sudo) no banco:
     create table if not exists app_config (id text primary key, value text not null);
     insert into app_config (id, value) values ('admin_password', '282904') on conflict (id) do nothing;
     
  3. Para tabela de FERIADOS DO SISTEMA:
     Rodar o script SQL de criação da tabela 'feriados'.
*/

// Utilitários de conversão (DB Snake Case <-> App Camel Case)

const mapSettingsFromDb = (dbSettings: any): AppSettings | null => {
  if (!dbSettings) return null;
  return {
    dailyWorkHours: Number(dbSettings.daily_work_hours) || 8,
    lunchDurationMinutes: Number(dbSettings.lunch_duration_minutes) || 60,
    notificationMinutes: Number(dbSettings.notification_minutes) || 10,
    hourlyRate: Number(dbSettings.hourly_rate) || 0,
    foodAllowance: Number(dbSettings.food_allowance) || 0,
    currency: dbSettings.currency || 'EUR',
    overtimePercentage: dbSettings.overtime_percentage !== null ? Number(dbSettings.overtime_percentage) : 25,
    overtimeDays: dbSettings.overtime_days || [0, 6],
    holidays: dbSettings.holidays || [], 
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
      type: a.type,
      reason: a.reason,
      startTime: a.start_time || undefined,
      endTime: a.end_time || undefined
    }))
  };
};

// --- Verificação de Senha Admin (Database) ---

export const verifyAdminPassword = async (password: string): Promise<{ verified: boolean, error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('id', 'admin_password')
      .maybeSingle();

    if (error) {
      console.error('Error verifying password:', error);
      return { verified: false, error: 'Erro de conexão com o banco ou permissão negada.' };
    }
    
    if (!data) {
       console.warn('Admin password not configured in database (table app_config missing or empty).');
       return { verified: false, error: 'Senha de admin não configurada no banco.' };
    }

    return { verified: data.value === password };
  } catch (err) {
    console.error('Unexpected error verifying password', err);
    return { verified: false, error: 'Erro inesperado ao verificar senha.' };
  }
};

// --- Gestão de Usuários do App (Manual/Kiosk) ---

export const getAppUsers = async (): Promise<AppUser[]> => {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching users:', JSON.stringify(error, null, 2));
    return [];
  }
  return data || [];
};

export const createAppUser = async (name: string): Promise<{ user: AppUser | null, error: string | null }> => {
  // 1. Criar o Usuário
  const { data: userData, error: userError } = await supabase
    .from('app_users')
    .insert({ name, active: true })
    .select()
    .single();

  if (userError) {
    const errorMsg = JSON.stringify(userError, null, 2);
    console.error('Error creating user:', errorMsg);
    return { user: null, error: errorMsg };
  }

  // 2. Criar Configurações Padrão Imediatamente
  // Isso garante que o usuário já nasça com configurações no banco.
  if (userData) {
      const defaultSettingsPayload = {
        user_id: userData.id,
        daily_work_hours: 8,
        lunch_duration_minutes: 60,
        notification_minutes: 10,
        hourly_rate: 0,
        food_allowance: 0,
        currency: 'EUR',
        overtime_percentage: 25,
        overtime_days: [0, 6],
        holidays: []
      };

      const { error: settingsError } = await supabase
        .from('user_settings')
        .insert(defaultSettingsPayload);
        
      if (settingsError) {
          console.error('Warning: Failed to init settings for new user:', settingsError);
          // Não bloqueamos o retorno do usuário, mas logamos o aviso
      }
  }

  return { user: userData, error: null };
};

export const deleteAppUser = async (id: string): Promise<{ success: boolean, error: string | null }> => {
  try {
    // 1. Buscar logs do usuário para limpar dependências
    const { data: logs, error: logsError } = await supabase
      .from('time_logs')
      .select('id')
      .eq('user_id', id);
    
    if (logsError) throw logsError;
    
    const logIds = logs?.map(l => l.id) || [];

    // 2. Apagar Breaks e Absences desses logs (Manual Cascade)
    if (logIds.length > 0) {
        await supabase.from('breaks').delete().in('time_log_id', logIds);
        await supabase.from('absences').delete().in('time_log_id', logIds);
        await supabase.from('time_logs').delete().in('id', logIds);
    }

    // 3. Apagar Configurações do Usuário
    await supabase.from('user_settings').delete().eq('user_id', id);

    // 4. Apagar o Usuário (Hard Delete)
    const { error: deleteUserError } = await supabase
      .from('app_users')
      .delete()
      .eq('id', id);

    if (deleteUserError) throw deleteUserError;

    return { success: true, error: null };

  } catch (error: any) {
    const errorMsg = error.message || JSON.stringify(error);
    console.error('Error hard deleting user:', errorMsg);
    return { success: false, error: errorMsg };
  }
};

// --- Feriados do Sistema ---
export const getSystemHolidays = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('feriados')
      .select('data');
    
    if (error) {
      // Se a tabela não existir ainda, não quebra o app, retorna vazio
      console.warn('System holidays fetch warning:', error.message);
      return [];
    }

    return data ? data.map((d: any) => d.data) : [];
  } catch (e) {
    return [];
  }
};

// --- Funções Principais de Dados ---

export const fetchRemoteData = async (userId: string) => {
  if (!userId) return { settings: null, logs: [], systemHolidays: [] };

  try {
    // 1. Fetch Settings
    // Importante: .limit(1) para pegar um único registro.
    const { data: settingsData, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

    let settings: AppSettings | null = null;
    if (settingsData && settingsData.length > 0) {
        settings = mapSettingsFromDb(settingsData[0]);
    } else if (settingsError) {
        console.warn("Error fetching settings:", settingsError);
    }

    // 2. Fetch Logs
    const { data: logsData, error: logsError } = await supabase
        .from('time_logs')
        .select(`*, breaks (*), absences (*)`)
        .eq('user_id', userId)
        .order('start_time', { ascending: true });

    if (logsError) {
        console.error("Error fetching logs:", logsError);
    }

    const logs = logsData ? logsData.map((l: any) => mapLogFromDb(l, l.breaks || [], l.absences || [])) : [];

    // 3. Fetch System Holidays
    const systemHolidays = await getSystemHolidays();

    return { settings, logs, systemHolidays };
  } catch (error) {
      console.error("Critical error fetching remote data:", error);
      return { settings: null, logs: [], systemHolidays: [] };
  }
};

export const saveRemoteSettings = async (settings: AppSettings, userId: string): Promise<{ success: boolean; error?: string }> => {
  if (!userId) return { success: false, error: 'User ID missing' };

  // SAFETY: Ensure arrays are initialized to avoid DB errors or nulls
  const payload = {
    daily_work_hours: settings.dailyWorkHours,
    lunch_duration_minutes: settings.lunchDurationMinutes,
    notification_minutes: settings.notificationMinutes,
    hourly_rate: settings.hourlyRate,
    food_allowance: settings.foodAllowance,
    currency: settings.currency,
    overtime_percentage: settings.overtimePercentage,
    overtime_days: settings.overtimeDays || [], // Proteção contra undefined
    holidays: settings.holidays || [], // Proteção contra undefined
    user_id: userId
  };

  try {
    // ESTRATÉGIA NUCLEAR (DELETE THEN INSERT):
    // 1. Apagar TODAS as configurações existentes para este usuário.
    // Isso remove duplicatas, lixo e conflitos antigos de uma vez por todas.
    
    const { error: deleteError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId);
        
    if (deleteError) {
        console.warn('Warning deleting old settings:', deleteError);
        // Não lançamos erro aqui, pois se não tinha nada para deletar, tudo bem.
        // Se falhou por outro motivo, o Insert abaixo vai acusar ou duplicar, mas o objetivo é limpar.
    }
    
    // 2. Inserir o novo registro limpo.
    const { error: insertError } = await supabase
        .from('user_settings')
        .insert(payload);
        
    if (insertError) throw insertError;

    return { success: true };

  } catch (err: any) {
    console.error('Error saving settings:', err);
    let errorMessage = "Erro desconhecido";
    
    // Extração robusta da mensagem de erro
    if (typeof err === 'string') {
        errorMessage = err;
    } else if (err?.message) {
        errorMessage = err.message;
        // Dica amigável se for problema de coluna faltando no Supabase
        if (errorMessage.includes('column') || errorMessage.includes('relation')) {
            errorMessage += " (DICA TÉCNICA: Verifique se as colunas 'holidays' e 'overtime_days' existem na tabela 'user_settings' do Supabase).";
        }
    } else {
        errorMessage = JSON.stringify(err);
    }
    
    return { success: false, error: errorMessage };
  }
};

export const upsertRemoteLog = async (log: TimeLog, userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const logPayload = {
            id: log.id,
            user_id: userId,
            date: log.date,
            start_time: log.startTime,
            end_time: log.endTime,
            total_duration_ms: log.totalDurationMs
        };

        const { error: logError } = await supabase
            .from('time_logs')
            .upsert(logPayload);
        
        if (logError) throw logError;

        // Clean sync strategy for children:
        // 1. Upsert the TimeLog.
        // 2. Delete existing breaks/absences for this log (to handle removals).
        // 3. Insert current breaks/absences.
        
        // Step 2: Delete children
        await supabase.from('breaks').delete().eq('time_log_id', log.id);
        await supabase.from('absences').delete().eq('time_log_id', log.id);

        // Step 3: Insert children
        if (log.breaks.length > 0) {
            const breaksPayload = log.breaks.map(b => ({
                id: b.id,
                time_log_id: log.id,
                start_time: b.startTime,
                end_time: b.endTime,
                type: b.type
            }));
            const { error: breakError } = await supabase.from('breaks').insert(breaksPayload);
            if (breakError) console.error('Error saving breaks', breakError);
        }

        if (log.absences && log.absences.length > 0) {
            const absencesPayload = log.absences.map(a => ({
                id: a.id,
                time_log_id: log.id,
                type: a.type,
                reason: a.reason,
                start_time: a.startTime,
                end_time: a.endTime
            }));
            const { error: absError } = await supabase.from('absences').insert(absencesPayload);
            if (absError) console.error('Error saving absences', absError);
        }

        return { success: true };

    } catch (err: any) {
        console.error('Error upserting log:', err);
        return { success: false, error: err.message };
    }
};

export const deleteRemoteLog = async (logId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        // Cascade delete usually handled by DB, but doing manual just in case
        await supabase.from('breaks').delete().eq('time_log_id', logId);
        await supabase.from('absences').delete().eq('time_log_id', logId);
        
        const { error } = await supabase
            .from('time_logs')
            .delete()
            .eq('id', logId);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
};
