-- =====================================================================
-- 09_ugc_mensagens.sql
-- Acrescenta nas propostas da Prospecção os campos "Mensagem 1" e
-- "Mensagem 2" (as abordagens que você vai enviar pra marca).
-- Não apaga nem muda nada do que já está cadastrado.
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem medo.
-- =====================================================================

alter table public.ugc_propostas add column if not exists mensagem_1 text;
alter table public.ugc_propostas add column if not exists mensagem_2 text;

notify pgrst, 'reload schema';
