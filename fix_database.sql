-- SCRIPT PARA CORREÇÃO DA TABELA DE CONFIGURAÇÕES
-- Execute este SQL no SQL Editor do seu painel do Supabase

-- 1. Remover duplicatas se existirem (mantendo apenas a entrada mais recente)
DELETE FROM user_settings a USING user_settings b
WHERE a.id < b.id AND a.user_id = b.user_id;

-- 2. Adicionar a restrição de unicidade na coluna user_id
-- Isso é essencial para que o comando UPSERT funcione corretamente
ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);

-- 3. Garantir que as colunas de taxas existam
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS social_security_rate NUMERIC DEFAULT 11;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS irs_rate NUMERIC DEFAULT 0;
