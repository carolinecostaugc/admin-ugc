-- =====================================================================
-- 08_ugc.sql
-- Prepara a área "UGC": Marcas e Prospecção (CRM de propostas).
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem medo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Marcas: contato, cupons, links de indicação, contratos e arquivos
-- ---------------------------------------------------------------------
create table if not exists public.ugc_marcas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  segmento     text,
  instagram    text,
  site         text,
  responsavel  text,
  email        text,
  telefone     text,
  parceira     boolean not null default false,          -- parceria ativa
  cupons       jsonb not null default '[]'::jsonb,       -- [{ "codigo": "CAROL10", "descricao": "10% off" }]
  links        jsonb not null default '[]'::jsonb,       -- [{ "rotulo": "Link de indicação", "url": "https://..." }]
  arquivos     jsonb not null default '[]'::jsonb,       -- [{ "nome", "path", "tipo", "tamanho" }] na pasta privada "ugc"
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists ugc_marcas_nome on public.ugc_marcas (lower(nome));

-- ---------------------------------------------------------------------
-- Propostas (CRM): Para enviar > Enviada > Respondeu > Em negociação >
-- Aprovado / Não deu
-- ---------------------------------------------------------------------
create table if not exists public.ugc_propostas (
  id                uuid primary key default gen_random_uuid(),
  marca_id          uuid references public.ugc_marcas(id) on delete set null,
  marca_nome        text not null,
  status            text not null default 'enviar'
                    check (status in ('enviar', 'enviada', 'respondeu', 'negociacao', 'aprovado', 'nao_deu')),
  canal             text not null default 'instagram'
                    check (canal in ('email', 'whatsapp', 'instagram', 'formulario', 'outro')),
  data_envio        date,
  proximo_followup  date,
  respondeu_em      timestamptz,     -- primeira vez que a marca respondeu (pra % de resposta)
  fechado_em        timestamptz,     -- quando virou Aprovado ou Não deu
  valor             numeric(12, 2),  -- valor proposto ou combinado
  proposta          text,            -- o que foi oferecido
  notas             text,
  ordem             double precision not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Mensagens de abordagem (também no 09_ugc_mensagens.sql, pra quem já tinha rodado este)
alter table public.ugc_propostas add column if not exists mensagem_1 text;
alter table public.ugc_propostas add column if not exists mensagem_2 text;

create index if not exists ugc_propostas_status on public.ugc_propostas (status, ordem);
create index if not exists ugc_propostas_envio on public.ugc_propostas (data_envio);
create index if not exists ugc_propostas_marca on public.ugc_propostas (marca_id);

drop trigger if exists trg_ugc_marcas_updated on public.ugc_marcas;
create trigger trg_ugc_marcas_updated before update on public.ugc_marcas
  for each row execute function public.set_updated_at();
drop trigger if exists trg_ugc_propostas_updated on public.ugc_propostas;
create trigger trg_ugc_propostas_updated before update on public.ugc_propostas
  for each row execute function public.set_updated_at();

-- Só quem está logado no painel lê e escreve
alter table public.ugc_marcas enable row level security;
alter table public.ugc_propostas enable row level security;
drop policy if exists "somente_logado" on public.ugc_marcas;
create policy "somente_logado" on public.ugc_marcas for all to authenticated using (true) with check (true);
drop policy if exists "somente_logado" on public.ugc_propostas;
create policy "somente_logado" on public.ugc_propostas for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Pasta PRIVADA dos contratos e arquivos das marcas (até 20 MB cada)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('ugc', 'ugc', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "ugc_ler" on storage.objects;
create policy "ugc_ler" on storage.objects for select to authenticated using (bucket_id = 'ugc');
drop policy if exists "ugc_enviar" on storage.objects;
create policy "ugc_enviar" on storage.objects for insert to authenticated with check (bucket_id = 'ugc');
drop policy if exists "ugc_trocar" on storage.objects;
create policy "ugc_trocar" on storage.objects for update to authenticated using (bucket_id = 'ugc');
drop policy if exists "ugc_apagar" on storage.objects;
create policy "ugc_apagar" on storage.objects for delete to authenticated using (bucket_id = 'ugc');

notify pgrst, 'reload schema';
