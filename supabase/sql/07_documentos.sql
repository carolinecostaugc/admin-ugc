-- =====================================================================
-- 07_documentos.sql
-- Prepara a área "Documentos" (pastas, textos, links e arquivos).
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem medo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pastas (podem ter subpastas: parent_id aponta pra pasta de cima)
-- Apagar uma pasta apaga as subpastas e os itens dela (on delete cascade).
-- ---------------------------------------------------------------------
create table if not exists public.doc_pastas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  parent_id   uuid references public.doc_pastas(id) on delete cascade,
  cor         text not null default 'oliva',   -- oliva / terracota / caramelo / carvalho / salvia / cafe
  ordem       double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists doc_pastas_parent on public.doc_pastas (parent_id);

-- ---------------------------------------------------------------------
-- Itens: texto escrito (nota), link ou arquivo
-- ---------------------------------------------------------------------
create table if not exists public.doc_itens (
  id               uuid primary key default gen_random_uuid(),
  pasta_id         uuid references public.doc_pastas(id) on delete cascade,  -- vazio = fora de pasta
  tipo             text not null check (tipo in ('nota', 'link', 'arquivo')),
  titulo           text not null,
  texto            text,           -- conteúdo da nota, ou descrição do link/arquivo
  url              text,           -- endereço (links)
  arquivo_path     text,           -- caminho na pasta privada "documentos"
  arquivo_nome     text,
  arquivo_tipo     text,           -- ex: application/pdf, image/png
  arquivo_tamanho  bigint,
  fixado           boolean not null default false,  -- aparece em "Acesso rápido"
  ordem            double precision not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists doc_itens_pasta on public.doc_itens (pasta_id);

drop trigger if exists trg_doc_pastas_updated on public.doc_pastas;
create trigger trg_doc_pastas_updated before update on public.doc_pastas
  for each row execute function public.set_updated_at();
drop trigger if exists trg_doc_itens_updated on public.doc_itens;
create trigger trg_doc_itens_updated before update on public.doc_itens
  for each row execute function public.set_updated_at();

-- Só quem está logado no painel lê e escreve
alter table public.doc_pastas enable row level security;
alter table public.doc_itens enable row level security;
drop policy if exists "somente_logado" on public.doc_pastas;
create policy "somente_logado" on public.doc_pastas for all to authenticated using (true) with check (true);
drop policy if exists "somente_logado" on public.doc_itens;
create policy "somente_logado" on public.doc_itens for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Pasta PRIVADA dos arquivos (até 20 MB cada). O painel abre os
-- arquivos com links temporários.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists "documentos_ler" on storage.objects;
create policy "documentos_ler" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');
drop policy if exists "documentos_enviar" on storage.objects;
create policy "documentos_enviar" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');
drop policy if exists "documentos_trocar" on storage.objects;
create policy "documentos_trocar" on storage.objects
  for update to authenticated using (bucket_id = 'documentos');
drop policy if exists "documentos_apagar" on storage.objects;
create policy "documentos_apagar" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos');

notify pgrst, 'reload schema';
