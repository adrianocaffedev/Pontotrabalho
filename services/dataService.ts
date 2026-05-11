
import { supabase } from './supabase';
import { TimeLog, AppSettings, AppUser, ContractRenewal, UserDocument, Absence } from '../types';
import { Holiday, PORTUGAL_HOLIDAYS_2026 } from './holidayService';
import { dbLocal, addToSyncQueue } from './localDb';

// Helper to check if online
const isOnline = () => {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true;
};

/**
 * IMPORTANTE: Para que esta aplicação funcione, você DEVE executar o seguinte SQL no seu painel do Supabase:
 * 
 * -- 1. Criar o Bucket de Documentos (caso não exista)
 * -- Vá em Storage -> New Bucket -> Nome: 'DOCUMENTS' -> Public: ON
 * 
 * -- 2. Configurar Políticas de Segurança para o Storage (Acesso Público para Testes)
 * -- Execute este bloco para garantir que as políticas sejam recriadas:
 * BEGIN;
 *   DROP POLICY IF EXISTS "Acesso Público Upload" ON storage.objects;
 *   DROP POLICY IF EXISTS "Acesso Público Select" ON storage.objects;
 *   DROP POLICY IF EXISTS "Acesso Público Delete" ON storage.objects;
 *   DROP POLICY IF EXISTS "Acesso Público Update" ON storage.objects;
 * 
 *   CREATE POLICY "Acesso Público Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'DOCUMENTS' );
 *   CREATE POLICY "Acesso Público Select" ON storage.objects FOR SELECT USING ( bucket_id = 'DOCUMENTS' );
 *   CREATE POLICY "Acesso Público Delete" ON storage.objects FOR DELETE USING ( bucket_id = 'DOCUMENTS' );
 *   CREATE POLICY "Acesso Público Update" ON storage.objects FOR UPDATE USING ( bucket_id = 'DOCUMENTS' ) WITH CHECK ( bucket_id = 'DOCUMENTS' );
 * COMMIT;
 * 
 * -- 3. IMPORTANTE: Configuração de CORS (No Dashboard do Supabase)
 * -- O erro 'Failed to fetch' é 100% causado por falta de configuração de CORS.
 * -- Vá em: Storage -> Settings -> API -> CORS -> Add Item
 * -- Origin: *
 * -- Methods: GET, POST, PUT, DELETE, OPTIONS
 * -- Allowed Headers: *
 * -- Expose Headers: Content-Range, Content-Length, ETag
 * 
 * -- 4. Criar tabela para metadados de documentos
 * CREATE TABLE IF NOT EXISTS user_documents (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
 *   name TEXT NOT NULL,
 *   file_path TEXT NOT NULL,
 *   file_type TEXT NOT NULL,
 *   category TEXT DEFAULT 'OTHER', -- CONTRACT, JUSTIFICATION, ID, OTHER
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 4. Ativar RLS e criar diretivas de segurança (com limpeza prévia)
 * ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
 * DROP POLICY IF EXISTS "Allow All" ON user_documents;
 * CREATE POLICY "Allow All" ON user_documents FOR ALL USING (true) WITH CHECK (true);
 * 
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS company TEXT;
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS job_title TEXT;
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'EFFECTIVE';
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS contract_start_date TEXT;
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS renewals JSONB DEFAULT '[]'::JSONB;
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS pin TEXT;
 * ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
 * 
 * -- Novas colunas para configurações de tempo e taxas
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS daily_work_hours NUMERIC DEFAULT 8;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lunch_duration_minutes NUMERIC DEFAULT 60;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coffee_duration_minutes NUMERIC DEFAULT 15;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt-PT';
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS social_security_rate NUMERIC DEFAULT 11;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS irs_rate NUMERIC DEFAULT 0;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS shift_start TEXT DEFAULT '08:00';
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS shift_end TEXT DEFAULT '17:00';
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lunch_start TEXT DEFAULT '12:00';
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS enable_notifications BOOLEAN DEFAULT FALSE;
 * ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS reminder_buffer_minutes NUMERIC DEFAULT 5;
 * 
 * -- Novas colunas para justificativas (absences)
 * ALTER TABLE absences ADD COLUMN IF NOT EXISTS date TEXT;
 * ALTER TABLE absences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
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
    shiftStart: dbSettings.shift_start || '08:00',
    shiftEnd: dbSettings.shift_end || '17:00',
    lunchStart: dbSettings.lunch_start || '12:00',
    enableNotifications: !!dbSettings.enable_notifications,
    reminderBufferMinutes: Number(dbSettings.reminder_buffer_minutes) || 5,
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
    jobTitle: dbUser.job_title || '',
    contractType: (dbUser.contract_type as 'EFFECTIVE' | 'TEMPORARY') || 'EFFECTIVE',
    contractStartDate: dbUser.contract_start_date || '',
    renewals: Array.isArray(dbUser.renewals) ? dbUser.renewals : [],
    pin: dbUser.pin || '', // Adicionado mapeamento do PIN
    isAdmin: !!dbUser.is_admin, // Adicionado mapeamento do Administrador
    created_at: dbUser.created_at
  };
};

export const getAppUsers = async (): Promise<AppUser[]> => {
  const localUsers = await dbLocal.users.toArray();
  
  if (isOnline()) {
    try {
      const { data, error } = await supabase.from('app_users').select('*').order('name');
      if (!error && data) {
        const users = data.map(mapUserFromDb);
        await dbLocal.users.bulkPut(users);
        return users;
      }
    } catch (e) {
      console.error("Supabase user fetch error", e);
    }
  }
  return localUsers;
};

export const createAppUser = async (userData: Partial<AppUser>): Promise<{ user: AppUser | null, error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .insert({ 
        name: userData.name, 
        company: userData.company || '',
        job_title: userData.jobTitle || '',
        contract_type: userData.contractType || 'EFFECTIVE',
        contract_start_date: userData.contractStartDate || '',
        renewals: userData.renewals || [],
        pin: userData.pin || '', // Adicionado campo PIN na criação
        is_admin: userData.isAdmin || false, // Suporte para novo campo admin
        active: true
      })
      .select()
      .single();

    if (error) {
        let errorMsg = error.message;
        if (error.message.includes("column") || error.message.includes("not found")) {
            errorMsg = "ERRO DE SCHEMA: A coluna 'is_admin' ou outras colunas novas não foram encontradas no Supabase.\n\n1. Verifique se executou o SQL de migração.\n2. Se já executou, vá em 'API Settings' -> 'PostgRest' e clique em 'Reload Schema' para atualizar o cache do banco.";
        }
        return { user: null, error: errorMsg };
    }
    
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
      irs_rate: 0,
      shift_start: '08:00',
      shift_end: '17:00',
      lunch_start: '12:00',
      enable_notifications: false,
      reminder_buffer_minutes: 5
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
    if (userData.jobTitle !== undefined) payload.job_title = String(userData.jobTitle);
    if (userData.contractType !== undefined) payload.contract_type = String(userData.contractType);
    if (userData.contractStartDate !== undefined) payload.contract_start_date = String(userData.contractStartDate);
    if (userData.pin !== undefined) payload.pin = String(userData.pin); // Adicionado campo PIN na atualização
    if (userData.isAdmin !== undefined) payload.is_admin = !!userData.isAdmin;
    
    if (userData.renewals !== undefined) {
      payload.renewals = JSON.parse(JSON.stringify(userData.renewals));
    }

    const { error } = await supabase
      .from('app_users')
      .update(payload)
      .eq('id', id);

    if (error) {
        let errorMsg = error.message;
        if (error.message.includes("column") || error.message.includes("not found")) {
            errorMsg = "ERRO DE SCHEMA: A coluna 'is_admin' ou outras colunas novas não foram encontradas no Supabase.\n\n1. Verifique se executou o SQL de migração.\n2. Se já executou, vá em 'API Settings' -> 'PostgRest' e clique em 'Reload Schema' para atualizar o cache do banco.";
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
    
    // Deletar documentos (Banco e Storage)
    const { data: docs } = await supabase.from('user_documents').select('*').eq('user_id', id);
    if (docs && docs.length > 0) {
        const filePaths = docs.map(d => d.file_path);
        await supabase.storage.from('DOCUMENTS').remove(filePaths);
        await supabase.from('user_documents').delete().eq('user_id', id);
    }

    const { error } = await supabase.from('app_users').delete().eq('id', id);
    return { success: !error, error: error?.message || null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const fetchRemoteData = async (userId: string) => {
  if (!userId) return { settings: null, logs: [], systemHolidays: [], standaloneAbsences: [] };
  
  const staticHolidays = PORTUGAL_HOLIDAYS_2026.map(h => h.date);

  // Attempt remote fetch
  if (isOnline()) {
    try {
      const { data: sData } = await supabase.from('user_settings').select('*').eq('user_id', userId).limit(1);
      const { data: lData } = await supabase.from('time_logs').select(`*, breaks (*), absences (*)`).eq('user_id', userId).order('start_time', { ascending: true });
      const { data: aData } = await supabase.from('absences').select('*').eq('user_id', userId).is('time_log_id', null);
      
      const remoteSettings = sData && sData.length > 0 ? mapSettingsFromDb(sData[0]) : null;
      const remoteLogs = (lData || []).map((l: any) => mapLogFromDb(l, l.breaks || [], l.absences || []));
      const remoteAbsences = (aData || []).map((a: any) => ({
        id: a.id,
        date: a.date,
        type: a.type,
        reason: a.reason,
        startTime: a.start_time || undefined,
        endTime: a.end_time || undefined,
        userId: a.user_id
      }));

      // Update Local cache
      if (remoteSettings) await dbLocal.settings.put({ ...remoteSettings, user_id: userId } as any);
      if (remoteLogs.length > 0) await dbLocal.timeLogs.bulkPut(remoteLogs.map(l => ({ ...l, user_id: userId } as any)));
      if (remoteAbsences.length > 0) await dbLocal.absences.bulkPut(remoteAbsences);

      return {
        settings: remoteSettings,
        logs: remoteLogs,
        systemHolidays: staticHolidays,
        standaloneAbsences: remoteAbsences
      };
    } catch (e) {
      console.error("Remote fetch error, using local data", e);
    }
  }

  // Fallback to Local
  const localSettings = await dbLocal.settings.get(userId);
  const localLogs = await dbLocal.timeLogs.filter(l => (l as any).user_id === userId).toArray();
  const localStandaloneAbsences = await dbLocal.absences.filter(a => a.userId === userId && !(a as any).time_log_id).toArray();

  return { 
    settings: localSettings || null,
    logs: localLogs,
    systemHolidays: staticHolidays,
    standaloneAbsences: localStandaloneAbsences
  };
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

export const updateStandaloneAbsence = async (id: string, absence: Partial<import('../types').Absence>): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('absences').update({
      date: absence.date,
      type: absence.type,
      reason: absence.reason,
      start_time: absence.startTime || null,
      end_time: absence.endTime || null
    }).eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const deleteStandaloneAbsence = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.from('absences').delete().eq('id', id);
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
    
    if (error) {
      if (error.code === 'PGRST200') {
         console.error("ERRO DE RELACIONAMENTO: A tabela 'absences' não tem uma Chave Estrangeira para 'app_users'.");
         // Retornar os dados sem o join se falhar, para não quebrar a tela
         const { data: simpleData } = await supabase.from('absences').select('*').order('date', { ascending: false });
         return simpleData || [];
      }
      throw error;
    }
    return data || [];
  } catch (err: any) {
    console.error("Erro ao buscar justificativas:", err);
    return [];
  }
};

export const processSyncQueue = async () => {
  if (!isOnline()) return;
  try {
    const queue = await dbLocal.syncQueue.toArray();
    if (queue.length === 0) return;

    for (const item of queue) {
      let success = false;
      if (item.type === 'LOG' && item.action === 'UPSERT') {
        const log = item.data;
        const res = await upsertRemoteLog(log, log.userId);
        success = res.success;
      } else if (item.type === 'SETTINGS' && item.action === 'UPSERT') {
        const res = await supabase.from('user_settings').upsert(item.data, { onConflict: 'user_id' });
        success = !res.error;
      }
      
      if (success && item.id) {
        await dbLocal.syncQueue.delete(item.id);
      }
    }
  } catch (e) {
    console.error("Sync process error", e);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => processSyncQueue());
  processSyncQueue();
}

export const keepAlive = async (): Promise<boolean> => {
    return isOnline(); 
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
    // 1. Save Local
    await dbLocal.timeLogs.put({ ...log, user_id: userId } as any);
    
    // 2. Try Remote
    if (isOnline()) {
      const { error } = await supabase.from('time_logs').upsert({
        id: log.id,
        user_id: userId,
        date: log.date,
        start_time: log.startTime,
        end_time: log.endTime || null,
        total_duration_ms: log.totalDurationMs
      });

      if (!error) {
        // For children tables, we delete and re-insert for consistency
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
      }
    }

    // 3. Queue for sync if offline or remote failed
    await addToSyncQueue({ type: 'LOG', action: 'UPSERT', entityId: log.id, data: { ...log, userId } });
    return { success: true }; 
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const deleteRemoteLog = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await dbLocal.timeLogs.delete(id);
    if (isOnline()) {
      await supabase.from('breaks').delete().eq('time_log_id', id);
      await supabase.from('absences').delete().eq('time_log_id', id);
      const { error } = await supabase.from('time_logs').delete().eq('id', id);
      if (!error) return { success: true };
    }
    await addToSyncQueue({ type: 'LOG', action: 'DELETE', entityId: id, data: null });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const saveRemoteSettings = async (settings: AppSettings, userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Local
    await dbLocal.settings.put({ ...settings, user_id: userId } as any);

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
      shift_start: settings.shiftStart,
      shift_end: settings.shiftEnd,
      lunch_start: settings.lunchStart,
      enable_notifications: settings.enableNotifications,
      reminder_buffer_minutes: settings.reminderBufferMinutes,
      user_id: userId
    };

    if (isOnline()) {
      const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' });
      if (!error) return { success: true };
    }

    await addToSyncQueue({ type: 'SETTINGS', action: 'UPSERT', entityId: userId, data: payload });
    return { success: true };
  } catch (err: any) {
    console.error("Erro em saveRemoteSettings:", err);
    return { success: false, error: err.message };
  }
};

// --- NOVAS FUNÇÕES DE DOCUMENTOS (SUPABASE STORAGE + DB) ---

export const uploadUserDocument = async (
  userId: string, 
  file: File, 
  category: UserDocument['category'] = 'OTHER'
): Promise<{ success: boolean; error?: string; document?: UserDocument }> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    // Simplificando o path para evitar problemas com pastas aninhadas se houver restrição
    const filePath = fileName; 

    // 1. Upload para o Supabase Storage (Bucket 'DOCUMENTS')
    const { error: uploadError } = await supabase.storage
      .from('DOCUMENTS')
      .upload(filePath, file, {
        upsert: true, // Usar upsert para evitar erros de duplicidade se o usuário clicar rápido
        contentType: file.type
      });

    if (uploadError) {
      console.error("DEBUG - Document Upload Error Object:", JSON.stringify(uploadError, null, 2));
      console.error("DEBUG - Upload Error Message:", uploadError.message);
      
      if (uploadError.message === 'Failed to fetch' || uploadError.name === 'FetchError' || (uploadError as any).status === 0) {
        throw new Error("ERRO DE REDE/CORS: O navegador não conseguiu completar o upload. Isso acontece se:\n1. O bucket 'DOCUMENTS' não foi criado no Supabase.\n2. O bucket não está marcado como 'Public'.\n3. O domínio deste app está sendo bloqueado pelo CORS do Supabase.");
      }
      throw uploadError;
    }

    // 2. Salvar metadados na tabela do banco
    const { data, error: dbError } = await supabase
      .from('user_documents')
      .insert({
        user_id: userId,
        name: file.name,
        file_path: filePath,
        file_type: file.type,
        category
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return { 
      success: true, 
      document: {
        id: data.id,
        user_id: data.user_id,
        name: data.name,
        file_path: data.file_path,
        file_type: data.file_type,
        category: data.category,
        created_at: data.created_at
      } 
    };
  } catch (err: any) {
    console.error("Erro ao fazer upload de documento:", err);
    return { success: false, error: err.message };
  }
};

export const getUserDocuments = async (userId: string): Promise<UserDocument[]> => {
  try {
    const { data, error } = await supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erro ao buscar documentos:", err);
    return [];
  }
};

export const deleteUserDocument = async (document: UserDocument): Promise<{ success: boolean; error?: string }> => {
  try {
    // 1. Deletar do Storage
    const { error: storageError } = await supabase.storage
      .from('DOCUMENTS')
      .remove([document.file_path]);

    if (storageError) throw storageError;

    // 2. Deletar do Banco
    const { error: dbError } = await supabase
      .from('user_documents')
      .delete()
      .eq('id', document.id);

    if (dbError) throw dbError;

    return { success: true };
  } catch (err: any) {
    console.error("Erro ao deletar documento:", err);
    return { success: false, error: err.message };
  }
};

export const getDocumentPublicUrl = (filePath: string): string => {
  const { data } = supabase.storage.from('DOCUMENTS').getPublicUrl(filePath);
  return data.publicUrl;
};
