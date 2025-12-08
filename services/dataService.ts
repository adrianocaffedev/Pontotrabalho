
import { supabase } from './supabase';
import { TimeLog, AppSettings, AppUser } from '../types';

/* 
  NOTA IMPORTANTE DE BANCO DE DADOS:
  1. Para salvar feriados: 
     alter table user_settings add column if not exists holidays text[];
     
  2. Para senha de ADMIN (sudo) no banco:
     create table if not exists app_config (id text primary key, value text not null);
     insert into app_config (id, value) values ('admin_password', '282904') on conflict (id) do nothing;
     
     -- SE HOUVER ERRO DE PERMISSÃO/CONEXÃO NA VERIFICAÇÃO, EXECUTE (RLS):
     alter table app_config enable row level security;
     create policy "Allow public read access" on app_config for select using (true);
*/

// Utilitários de conversão (DB Snake Case <-> App Camel Case)

const mapSettingsFromDb = (dbSettings: any): AppSettings | null => {
  if (!dbSettings) return null;
  return {
    dailyWorkHours: Number(dbSettings.daily_work_hours),
    lunchDurationMinutes: dbSettings.lunch_duration_minutes,
    notificationMinutes: dbSettings.notification_minutes,
    hourlyRate: Number(dbSettings.hourly_rate),
    foodAllowance: Number(dbSettings.food_allowance),
    currency: dbSettings.currency,
    overtimePercentage: Number(dbSettings.overtime_percentage),
    overtimeDays: dbSettings.overtime_days || [],
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
        holidays: [] // Agora incluído para persistência completa
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


// --- Funções Principais de Dados ---

export const fetchRemoteData = async (userId: string) => {
  if (!userId) return { settings: null, logs: [] };

  try {
    // 1. Fetch Settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching settings:', JSON.stringify(settingsError, null, 2));
    }

    // 2. Fetch Logs
    const { data: logsData, error: logsError } = await supabase
      .from('time_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (logsError) throw logsError;

    // 3. Fetch Breaks (para todos os logs do usuário)
    const logIds = logsData?.map(l => l.id) || [];
    let allBreaks: any[] = [];
    let allAbsences: any[] = [];

    if (logIds.length > 0) {
      const { data: breaksData } = await supabase
        .from('breaks')
        .select('*')
        .in('time_log_id', logIds);
      allBreaks = breaksData || [];

      const { data: absencesData } = await supabase
        .from('absences')
        .select('*')
        .in('time_log_id', logIds);
      allAbsences = absencesData || [];
    }

    // 4. Montar Objetos
    const mappedLogs = logsData?.map(log => 
      mapLogFromDb(
        log, 
        allBreaks.filter(b => b.time_log_id === log.id),
        allAbsences.filter(a => a.time_log_id === log.id)
      )
    ) || [];

    return {
      settings: mapSettingsFromDb(settingsData),
      logs: mappedLogs
    };

  } catch (error) {
    console.error('Fetch remote data error:', JSON.stringify(error, null, 2));
    return { settings: null, logs: [] };
  }
};

export const saveRemoteSettings = async (settings: AppSettings, userId: string): Promise<{ success: boolean; error?: string }> => {
  if (!userId) return { success: false, error: 'Usuário não identificado' };

  const dbPayload = {
    user_id: userId,
    daily_work_hours: settings.dailyWorkHours,
    lunch_duration_minutes: settings.lunchDurationMinutes,
    notification_minutes: settings.notificationMinutes,
    hourly_rate: settings.hourlyRate,
    food_allowance: settings.foodAllowance,
    currency: settings.currency,
    overtime_percentage: settings.overtimePercentage,
    overtime_days: settings.overtimeDays || [],
    holidays: settings.holidays || [], 
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('user_settings')
    .upsert(dbPayload, { onConflict: 'user_id' });

  if (error) {
    const errorMsg = JSON.stringify(error, null, 2);
    console.error('Error saving settings:', errorMsg);
    return { success: false, error: errorMsg };
  }
  
  return { success: true };
};

export const upsertRemoteLog = async (log: TimeLog, userId: string) => {
  if (!userId) return;

  // 1. Upsert Log
  const { data: insertedLog, error: logError } = await supabase
    .from('time_logs')
    .upsert({
      id: log.id,
      user_id: userId,
      date: log.date,
      start_time: log.startTime,
      end_time: log.endTime,
      total_duration_ms: log.totalDurationMs
    })
    .select()
    .single();

  if (logError) {
    console.error('Error upserting log:', JSON.stringify(logError, null, 2));
    return;
  }

  const logId = insertedLog.id;

  // 2. Handle Breaks
  await supabase.from('breaks').delete().eq('time_log_id', logId);
  
  if (log.breaks.length > 0) {
    const breaksPayload = log.breaks.map(b => ({
      id: b.id,
      time_log_id: logId,
      start_time: b.startTime,
      end_time: b.endTime,
      type: b.type
    }));
    const { error: breaksError } = await supabase.from('breaks').insert(breaksPayload);
    if (breaksError) console.error('Error saving breaks', breaksError);
  }

  // 3. Handle Absences
  await supabase.from('absences').delete().eq('time_log_id', logId);

  if (log.absences && log.absences.length > 0) {
    const absencesPayload = log.absences.map(a => ({
      id: a.id,
      time_log_id: logId,
      type: a.type,
      reason: a.reason,
      start_time: a.startTime,
      end_time: a.endTime
    }));
    const { error: absencesError } = await supabase.from('absences').insert(absencesPayload);
    if (absencesError) console.error('Error saving absences', absencesError);
  }
};

export const deleteRemoteLog = async (logId: string): Promise<{ success: boolean, error?: string }> => {
    try {
        // Cascade delete manually just in case DB doesn't have it
        await supabase.from('breaks').delete().eq('time_log_id', logId);
        await supabase.from('absences').delete().eq('time_log_id', logId);
        
        const { error } = await supabase.from('time_logs').delete().eq('id', logId);
        if (error) throw error;
        
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message || 'Erro desconhecido' };
    }
};
