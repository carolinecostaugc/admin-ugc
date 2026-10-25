-- =====================================================================
-- 10_mentora.sql
-- Prepara a área "Mentora": prospecção de clientes (leads) e Clientes
-- (com os produtos que cada um comprou).
-- Rode no SQL Editor do Supabase. Pode rodar de novo sem medo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Leads: Para abordar > Abordado > Respondeu > Em negociação >
-- Virou cliente / Não deu. Quem vira cliente aparece na aba Clientes.
-- ---------------------------------------------------------------------
create table if not exists public.mentora_leads (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  instagram         text,
  email             text,
  telefone          text,
  origem            text,             -- de onde veio (Instagram, indicação, anúncio...)
  status            text not null default 'abordar'
                    check (status in ('abordar', 'abordado', 'respondeu', 'negociacao', 'cliente', 'nao_deu')),
  canal             text not null default 'instagram'
                    check (canal in ('email', 'whatsapp', 'instagram', 'formulario', 'outro')),
  data_contato      date,             -- quando foi abordado
  proximo_followup  date,
  respondeu_em      timestamptz,      -- primeira vez que respondeu (pra % de resposta)
  fechado_em        timestamptz,      -- quando virou cliente ou não deu
  produto           text,             -- produto oferecido
  valor             numeric(12, 2),   -- valor do produto
  mensagem_1        text,
  mensagem_2        text,
  notas             text,
  ordem             double precision not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists mentora_leads_status on public.mentora_leads (status, ordem);
create index if not exists mentora_leads_contato on public.mentora_leads (data_contato);

-- ---------------------------------------------------------------------
-- Compras de cada cliente (um cliente pode comprar mais de um produto)
-- Apagar o lead apaga as compras dele (on delete cascade).
-- ---------------------------------------------------------------------
create table if not exists public.mentora_compras (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null references public.mentora_leads(id) on delete cascade,
  produto           text not null,
  valor             numeric(12, 2),
  data_compra       date not null default current_date,
  pagamento         text,             -- forma de pagamento (Pix, cartão 3x...)
  status_pagamento  text not null default 'pago' check (status_pagamento in ('pago', 'parcial', 'pendente')),
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists mentora_compras_lead on public.mentora_compras (lead_id);
create index if not exists mentora_compras_data on public.mentora_compras (data_compra);

drop trigger if exists trg_mentora_leads_updated on public.mentora_leads;
create trigger trg_mentora_leads_updated before update on public.mentora_leads
  for each row execute function public.set_updated_at();
drop trigger if exists trg_mentora_compras_updated on public.mentora_compras;
create trigger trg_mentora_compras_updated before update on public.mentora_compras
  for each row execute function public.set_updated_at();

-- Só quem está logado no painel lê e escreve
alter table public.mentora_leads enable row level security;
alter table public.mentora_compras enable row level security;
drop policy if exists "somente_logado" on public.mentora_leads;
create policy "somente_logado" on public.mentora_leads for all to authenticated using (true) with check (true);
drop policy if exists "somente_logado" on public.mentora_compras;
create policy "somente_logado" on public.mentora_compras for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
