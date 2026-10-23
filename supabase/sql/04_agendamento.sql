-- =====================================================================
-- 04_agendamento.sql
-- Agenda os "robôs" (pg_cron). Rode por ÚLTIMO, depois de publicar as
-- Edge Functions.
--
-- ANTES DE RODAR, troque:
--   SEU_PROJETO       -> o id do seu projeto (aparece na URL do Supabase)
--   SEU_SCHED_SECRET  -> o mesmo valor que você pôs no segredo SCHED_SECRET
-- =====================================================================

-- pg_cron agenda; pg_net deixa o Postgres chamar uma URL (a Edge Function)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamentos antigos com o mesmo nome (pode rodar de novo sem duplicar)
select cron.unschedule(jobname)
from cron.job
where jobname in ('ig-scheduler', 'ig-token-refresh');

-- O carteiro: a cada 1 minuto esvazia a fila e manda os passos com atraso
select cron.schedule(
  'ig-scheduler',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://SEU_PROJETO.supabase.co/functions/v1/ig-scheduler',
    headers := '{"Content-Type": "application/json", "x-sched-key": "SEU_SCHED_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Renovação do token: toda segunda-feira às 04:00 (UTC)
select cron.schedule(
  'ig-token-refresh',
  '0 4 * * 1',
  $$
  select net.http_post(
    url     := 'https://SEU_PROJETO.supabase.co/functions/v1/ig-token-refresh',
    headers := '{"Content-Type": "application/json", "x-sched-key": "SEU_SCHED_SECRET"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Para conferir se ficou agendado:
--   select jobname, schedule, active from cron.job;
-- Para ver as últimas execuções:
--   select * from cron.job_run_details order by start_time desc limit 20;
