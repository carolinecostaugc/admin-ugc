-- =====================================================================
-- 05_leads.sql
-- Prepara a aba "Leads" do painel. Rode no SQL Editor do Supabase.
-- Pode rodar de novo sem medo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Visão "ig_leads_resumo": cada lead + quantas mensagens o robô entregou
-- (interações), a data da última e o nome da automação.
-- security_invoker = on: a visão respeita o RLS das tabelas (só quem
-- está logado no painel enxerga).
-- ---------------------------------------------------------------------
create or replace view public.ig_leads_resumo
with (security_invoker = on) as
select
  l.*,
  coalesce(d.interacoes, 0) as interacoes,
  d.ultima_entrega,
  a.nome as automacao_nome
from public.ig_leads l
left join (
  select ig_user_id, count(*)::int as interacoes, max(ts) as ultima_entrega
  from public.ig_deliveries
  where status = 'ok'
  group by ig_user_id
) d on d.ig_user_id = l.ig_user_id
left join public.ig_automations a on a.id = l.automation_id;

revoke all on public.ig_leads_resumo from anon;
grant select on public.ig_leads_resumo to authenticated;

-- Índices pra planilha ordenar e filtrar rápido
create index if not exists ig_leads_created on public.ig_leads (created_at desc);
create index if not exists ig_leads_source on public.ig_leads (last_source);
create index if not exists ig_leads_tags on public.ig_leads using gin (tags);

-- ---------------------------------------------------------------------
-- Limpeza diária (retenção de 12 meses), agora contando a ÚLTIMA
-- INTERAÇÃO de verdade: editar etiquetas ou anotações no painel não
-- "renova" o prazo do lead.
-- ---------------------------------------------------------------------
select cron.unschedule(jobname) from cron.job where jobname = 'ig-limpeza';
select cron.schedule(
  'ig-limpeza',
  '0 3 * * *',
  $$
  delete from public.ig_leads l
   where l.created_at < now() - interval '12 months'
     and not exists (select 1 from public.ig_deliveries d
                      where d.ig_user_id = l.ig_user_id and d.ts > now() - interval '12 months');
  delete from public.ig_deliveries       where ts < now() - interval '12 months';
  delete from public.ig_send_queue       where status <> 'pendente' and created_at < now() - interval '30 days';
  delete from public.ig_processed_events where ts < now() - interval '30 days';
  delete from public.ig_bot_sends        where ts < now() - interval '30 days';
  delete from public.ig_scheduled        where sent and created_at < now() - interval '30 days';
  $$
);

-- Avisa a API que tem visão nova
notify pgrst, 'reload schema';
