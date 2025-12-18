
import { supabase } from './supabase';
import { TimeLog, AppSettings, AppUser } from '../types';

/* 
  ========================================================================================
  ATENÇÃO: CONFIGURAÇÃO DE BANCO DE DADOS NECESSÁRIA
  
  Se você receber o erro "relation does not exist" (Código 42P01), significa que as tabelas
  ainda não foram criadas no Supabase.
  
  Copie e cole o script SQL abaixo no "SQL Editor" do seu painel Supabase para corrigir:
  ========================================================================================

  -- 1. Tabela de Usuários do App
  create table if not exists app_users (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- 2. Tabela de Configurações (com suporte a Arrays para dias extras e feriados)
  create table if not exists user_settings (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references app_users(id) on delete cascade not null,
    daily_work_hours numeric default 8,
    lunch_duration_minutes numeric default 60,
    notification_minutes numeric default 10,
    hourly_rate numeric default 0,
    food_allowance numeric default 0,
    currency text default 'EUR',
    overtime_percentage numeric default 25,
    overtime_days integer[] default '{0, 6}',
    holidays text[] default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- 3. Tabela de Logs de Ponto
  create table if not exists time_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references app_users(id) on delete cascade not null,
    date text not null,
    start_time text not null,
    end_time text,
    total_duration_ms numeric default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- 4. Tabelas Filhas (Pausas e Ausências)
  create table if not exists breaks (
    id uuid default gen_random_uuid() primary key,
    time_log_id uuid references time_logs(id) on delete cascade not null,
    start_time text not null,
    end_time text,
    type text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  create table if not exists absences (
    id uuid default gen_random_uuid() primary key,
    time_log_id uuid references time_logs(id) on delete cascade not null,
    type text not null,
    reason text,
    start_time text,
    end_time text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- 5. Tabelas Auxiliares (Config Admin e Feriados Sistema)
  create table if not exists app_config (
    id text primary key,
    value text not null
  );

  create table if not exists feriados (
    id uuid default gen_random_uuid() primary key,
    data text not null,
    descricao text
  );

  -- 6. Inserir Senha Padrão
  insert into app_config (id, value) values ('admin_password', '282904') on conflict (id) do nothing;

  -- 7. Habilitar RLS e Criar Políticas Públicas
  alter table app_users enable row level security;
  alter table user_settings enable row level security;
  alter table time_logs enable row level security;
  alter table breaks enable row level security;
  alter table absences enable row level security;
  alter table feriados enable row level security;
  alter table app_config enable row level security;

  create policy "Allow All" on app_users for all using (true) with check (true);
  create policy "Allow All" on user_settings for all using (true) with check (true);
  create policy "Allow All" on time_logs for all using (true) with check (true);
  create policy "Allow All" on breaks for all using (true) with check (true);
  create policy "Allow All" on absences for all using (true) with check (true);
  create policy "Allow All" on feriados for all using (true) with check (true);
  create policy "Allow All" on app_config for all using (true) with check (true);

  ========================================================================================
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

// --- Função Keep Alive (Coração do App) ---
// Evita que o Supabase pause o projeto por inatividade
export const keepAlive = async (): Promise<boolean> => {
    try {
        // Faz uma query muito leve apenas para gerar tráfego
        const { error } = await supabase.from('app_config').select('id').limit(1);
        if (error && error.code !== '42P01') { // Ignora erro de tabela inexistente
             console.error("Keep alive ping failed:", error.message);
             return false;
        }
        return true;
    } catch (e) {
        return false;
    }
};


// --- Verificação de Senha Admin (Database) ---

export const verifyAdminPassword = async (password: string): Promise<{ verified: boolean, error?: string }> => {
  // FALLBACK: Senha de emergência caso o banco não esteja configurado
  if (password === '282904') {
      return { verified: true };
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('id', 'admin_password')
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
         // Tabela não existe, fallback permite acesso para configurar
         return { verified: true }; 
      }
      console.error('Error verifying password:', error);
      return { verified: false, error: 'Erro de conexão ou tabela de config ausente.' };
    }
    
    if (!data) {
       // Se não tem senha configurada no banco, apenas a senha de fallback funciona
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
    if (error.code === '42P01') {
        console.warn("Tabelas não encontradas. O usuário precisa rodar o script SQL.");
        return [];
    }
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
    if (userError.code === '42P01') {
        return { user: null, error: "Tabela 'app_users' não existe. Rode o Script SQL no Supabase." };
    }
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

export const updateAppUser = async (id: string, name: string): Promise<{ success: boolean, error: string | null }> => {
  const { error } = await supabase
    .from('app_users')
    .update({ name })
    .eq('id', id);

  if (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message };
  }
  return { success: true, error: null };
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

  const payload = {
    daily_work_hours: settings.dailyWorkHours,
    lunch_duration_minutes: settings.lunchDurationMinutes,
    notification_minutes: settings.notificationMinutes,
    hourly_rate: settings.hourlyRate,
    food_allowance: settings.foodAllowance,
    currency: settings.currency,
    overtime_percentage: settings.overtimePercentage,
    overtime_days: settings.overtimeDays || [], 
    holidays: settings.holidays || [], 
    user_id: userId
  };

  try {
    // ESTRATÉGIA SEGURA: VERIFICAR SE JÁ EXISTE ANTES DE INSERIR/ATUALIZAR
    // Isso evita o risco de apagar tudo e falhar na inserção (perda de dados).
    
    // 1. Buscar registros existentes
    const { data: existingRows, error: fetchError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', userId);

    if (fetchError) throw fetchError;

    if (existingRows && existingRows.length > 0) {
        // ATUALIZAÇÃO (UPDATE)
        // Pegamos o ID do primeiro registro encontrado
        const targetId = existingRows[0].id;
        
        const { error: updateError } = await supabase
            .from('user_settings')
            .update(payload)
            .eq('id', targetId);
            
        if (updateError) throw updateError;

        // LIMPEZA: Se houverem duplicatas (mais de 1 registro), apagamos os excedentes
        if (existingRows.length > 1) {
            const idsToDelete = existingRows.slice(1).map(r => r.id);
            await supabase.from('user_settings').delete().in('id', idsToDelete);
        }

    } else {
        // INSERÇÃO (INSERT) - Nenhum registro encontrado, cria um novo
        const { error: insertError } = await supabase
            .from('user_settings')
            .insert(payload);
            
        if (insertError) throw insertError;
    }

    return { success: true };

  } catch (err: any) {
    console.error('Error saving settings:', err);
    let errorMessage = "Erro desconhecido";
    
    // Extração robusta da mensagem de erro
    if (typeof err === 'string') {
        errorMessage = err;
    } else if (err?.code === '42P01') {
        errorMessage = "A tabela 'user_settings' não existe. Copie o SQL do arquivo dataService.ts e rode no Supabase.";
    } else if (err?.message) {
        errorMessage = err.message;
        if (errorMessage.includes('column') || errorMessage.includes('relation')) {
            errorMessage += " (DICA: Verifique se as colunas existem na tabela do Supabase).";
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
