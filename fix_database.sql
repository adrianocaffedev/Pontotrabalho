-- ARQUIVO PARA CORREÇÃO DO BANCO DE DADOS (SUPABASE)
-- Copie estes comandos e execute no painel 'SQL Editor' do seu Supabase.

-- 1. Adicionar colunas de configuração de tempo (se não existirem)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS daily_work_hours NUMERIC DEFAULT 8;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS lunch_duration_minutes NUMERIC DEFAULT 60;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS coffee_duration_minutes NUMERIC DEFAULT 15;

-- 2. Adicionar coluna para identificar regime contratual (Temporário vs Efetivo)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'EFFECTIVE';

-- 3. Notificar o Supabase para recarregar o cache do esquema (Schema Cache)
-- Nota: O Supabase costuma recarregar automaticamente após ALTER TABLE, 
-- mas se o erro persistir, execute:
NOTIFY pgrst, 'reload schema';
