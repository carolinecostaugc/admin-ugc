-- =====================================================================
-- 03_rls.sql
-- Regras de acesso (RLS). Rode DEPOIS do 02.
-- - Painel: só quem está logado (authenticated) lê e escreve.
-- - Público anônimo: NADA.
-- - Edge Functions usam a service_role, que ignora o RLS.
-- =====================================================================

alter table public.ig_automations      enable row level security;
alter table public.ig_leads            enable row level security;
alter table public.ig_deliveries       enable row level security;
alter table public.ig_send_queue       enable row level security;
alter table public.ig_send_budget      enable row level security;
alter table public.ig_scheduled        enable row level security;
alter table public.ig_assets           enable row level security;
alter table public.ig_token_status     enable row level security;
alter table public.ig_bot_sends        enable row level security;
alter table public.ig_processed_events enable row level security;
alter table public.ig_secrets          enable row level security;  -- sem regra nenhuma: ninguém do painel lê

-- Cria a mesma regra "só logado" em cada tabela do painel
do $$
declare t text;
begin
  foreach t in array array[
    'ig_automations','ig_leads','ig_deliveries','ig_send_queue','ig_send_budget',
    'ig_scheduled','ig_assets','ig_token_status','ig_bot_sends','ig_processed_events'
  ] loop
    execute format('drop policy if exists "somente_logado" on public.%I', t);
    execute format(
      'create policy "somente_logado" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Avisa a API do Supabase que tem tabela nova (atualiza o cache na hora)
notify pgrst, 'reload schema';

-- A pasta de arquivos (Storage) fica no 03b_storage.sql, separada:
-- se ela der erro, não desfaz as tabelas.
