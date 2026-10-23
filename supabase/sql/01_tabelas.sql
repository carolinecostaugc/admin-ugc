-- =====================================================================
-- 01_tabelas.sql
-- Cria todas as tabelas do sistema. Rode PRIMEIRO no SQL Editor do Supabase.
-- Pode rodar de novo sem medo: usa "if not exists".
-- =====================================================================

create extension if not exists pgcrypto;  -- para gen_random_uuid()

-- ---------------------------------------------------------------------
-- Automações (cada "ManyChat" que você cria no painel)
-- A conversa inteira mora no campo "flow" (veja o LEIA-ME, seção do fluxo).
-- ---------------------------------------------------------------------
create table if not exists public.ig_automations (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null default 'Nova automação',
  keyword               text not null default '',          -- palavras separadas por vírgula
  match_any             boolean not null default false,    -- true = qualquer comentário dispara
  active                boolean not null default true,
  media_ids             text[] not null default '{}',      -- posts escolhidos (vazio = todos)
  public_reply          text default '',                   -- resposta pública no comentário
  public_reply_variants text[] not null default '{}',      -- variações A/B da resposta
  flow                  jsonb not null default '{"steps":[]}'::jsonb,
  asset_ids             text[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Leads (cada pessoa que interagiu)
-- ---------------------------------------------------------------------
create table if not exists public.ig_leads (
  ig_user_id     text primary key,
  username       text,
  last_source    text,              -- comment / dm / story_reply
  last_keyword   text,
  automation_id  uuid,
  flow_step      text,              -- em que passo da conversa a pessoa está
  link_sent      boolean not null default false,
  expecting      jsonb,             -- quando um passo pediu um dado (email/telefone)
  tags           text[] not null default '{}',
  email          text,
  telefone       text,
  dados          jsonb not null default '{}'::jsonb,  -- outros dados livres capturados
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Log de cada envio
-- ---------------------------------------------------------------------
create table if not exists public.ig_deliveries (
  id             bigint generated always as identity primary key,
  ig_user_id     text,
  automation_id  uuid,
  canal          text,              -- private_reply / dm
  tipo           text,              -- flow / link / text
  status         text,              -- ok / erro / na_fila
  motivo         text,
  ts             timestamptz not null default now()
);
create index if not exists ig_deliveries_user_ts on public.ig_deliveries (ig_user_id, ts desc);
create index if not exists ig_deliveries_ts on public.ig_deliveries (ts desc);

-- ---------------------------------------------------------------------
-- Fila de envios segurados pelo freio
-- ---------------------------------------------------------------------
create table if not exists public.ig_send_queue (
  id             bigint generated always as identity primary key,
  comment_id     text unique not null,
  automation_id  uuid,
  ig_user_id     text,
  username       text,
  status         text not null default 'pendente',   -- pendente / enviado / erro / expirado
  tentativas     int not null default 0,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  last_error     text
);
create index if not exists ig_send_queue_status on public.ig_send_queue (status, created_at);

-- ---------------------------------------------------------------------
-- O CONTADOR DO FREIO (balde de fichas). Uma linha por tipo de envio.
-- SEM ESSA TABELA (e sem a linha inicial abaixo), o freio não tem onde
-- contar e NENHUMA DM por comentário sai.
-- ---------------------------------------------------------------------
create table if not exists public.ig_send_budget (
  id            text primary key,                 -- ex: 'private_reply'
  min_count     int not null default 0,
  min_start     timestamptz not null default now(),
  hour_count    int not null default 0,
  hour_start    timestamptz not null default now(),
  day_count     int not null default 0,
  day_start     timestamptz not null default now(),
  err_streak    int not null default 0,           -- falhas seguidas (qualquer tipo)
  hard_streak   int not null default 0,           -- falhas "duras" seguidas (bloqueio, limite)
  cap_minute    int not null default 6,           -- tetos CONSERVADORES, bem abaixo do Instagram
  cap_hour      int not null default 60,
  cap_day       int not null default 180,
  paused_until  timestamptz,                      -- disjuntor: pausado até quando
  updated_at    timestamptz not null default now()
);

-- Linha inicial (seed) com os tetos padrão
insert into public.ig_send_budget (id, cap_minute, cap_hour, cap_day)
values ('private_reply', 6, 60, 180)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Passos com atraso (enviados pelo ig-scheduler quando vencem)
-- ---------------------------------------------------------------------
create table if not exists public.ig_scheduled (
  id             bigint generated always as identity primary key,
  ig_user_id     text not null,
  automation_id  uuid not null,
  step_id        text not null,
  send_at        timestamptz not null,
  sent           boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists ig_scheduled_due on public.ig_scheduled (sent, send_at);

-- ---------------------------------------------------------------------
-- Biblioteca de arquivos (PDF, áudio, foto, vídeo)
-- ---------------------------------------------------------------------
create table if not exists public.ig_assets (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  tipo           text not null default 'file',   -- image / audio / video / file
  public_url     text not null,
  attachment_id  text,                           -- cache do Instagram (reaproveita o upload)
  size_bytes     bigint,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Situação do token do Instagram
-- ---------------------------------------------------------------------
create table if not exists public.ig_token_status (
  id                 text primary key default 'main',
  expires_at         timestamptz,
  last_ok            boolean,
  last_error         text,
  last_refreshed_at  timestamptz,
  updated_at         timestamptz not null default now()
);
insert into public.ig_token_status (id) values ('main') on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Segredos guardados pelas funções (ex: o token renovado).
-- Tem RLS ligado e NENHUMA regra de acesso: só as Edge Functions
-- (service_role) leem. O painel nunca vê.
-- ---------------------------------------------------------------------
create table if not exists public.ig_secrets (
  id          text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Mensagens que o PRÓPRIO sistema enviou (para ignorar os "echos")
-- ---------------------------------------------------------------------
create table if not exists public.ig_bot_sends (
  mid  text primary key,
  ts   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Eventos já processados (evita responder duas vezes o mesmo comentário)
-- ---------------------------------------------------------------------
create table if not exists public.ig_processed_events (
  id  text primary key,
  ts  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Atualiza o updated_at sozinho em cada alteração
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_ig_automations_updated on public.ig_automations;
create trigger trg_ig_automations_updated before update on public.ig_automations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ig_leads_updated on public.ig_leads;
create trigger trg_ig_leads_updated before update on public.ig_leads
  for each row execute function public.set_updated_at();
