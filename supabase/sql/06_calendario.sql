-- =====================================================================
-- 06_calendario.sql
-- Prepara a área "Calendário" (planejamento de conteúdo).
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem medo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Conteúdos (cada card do quadro: Para criar > Para postar > Postados)
-- ---------------------------------------------------------------------
create table if not exists public.conteudos (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null default 'Novo conteúdo',
  status          text not null default 'criar'
                  check (status in ('criar', 'postar', 'postado')),
  ordem           double precision not null default 0,   -- posição dentro da coluna
  tipo            text not null default 'reels',          -- reels / carrossel / foto / story
  categoria       text not null default 'pessoal',        -- pessoal / publi
  marca           text,                                   -- nome da marca (quando é publi)
  etiquetas       text[] not null default '{}',
  data_gravar     date,
  data_editar     date,
  data_postagem   date,
  gravado         boolean not null default false,
  editado         boolean not null default false,
  legenda         text,
  links           jsonb not null default '[]'::jsonb,     -- [{ "rotulo": "Vídeo bruto", "url": "https://..." }]
  miniatura_path  text,                                   -- caminho da imagem na pasta "conteudos"
  link_post       text,                                   -- link do post depois de publicado
  ig_media_id     text,                                   -- id do post no Instagram (pras métricas)
  metricas        jsonb,                                  -- preenchido na fase 2 (desempenho)
  metricas_em     timestamptz,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists conteudos_status_ordem on public.conteudos (status, ordem);
create index if not exists conteudos_data_postagem on public.conteudos (data_postagem);

drop trigger if exists trg_conteudos_updated on public.conteudos;
create trigger trg_conteudos_updated before update on public.conteudos
  for each row execute function public.set_updated_at();

-- Só quem está logado no painel lê e escreve
alter table public.conteudos enable row level security;
drop policy if exists "somente_logado" on public.conteudos;
create policy "somente_logado" on public.conteudos
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Pasta PRIVADA das miniaturas (publis podem ser confidenciais antes de
-- sair). O painel mostra as imagens com links temporários.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('conteudos', 'conteudos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "conteudos_ler" on storage.objects;
create policy "conteudos_ler" on storage.objects
  for select to authenticated using (bucket_id = 'conteudos');

drop policy if exists "conteudos_enviar" on storage.objects;
create policy "conteudos_enviar" on storage.objects
  for insert to authenticated with check (bucket_id = 'conteudos');

drop policy if exists "conteudos_trocar" on storage.objects;
create policy "conteudos_trocar" on storage.objects
  for update to authenticated using (bucket_id = 'conteudos');

drop policy if exists "conteudos_apagar" on storage.objects;
create policy "conteudos_apagar" on storage.objects
  for delete to authenticated using (bucket_id = 'conteudos');

-- Avisa a API que tem tabela nova
notify pgrst, 'reload schema';
