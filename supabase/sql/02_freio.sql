-- =====================================================================
-- 02_freio.sql
-- O FREIO DE ENVIO (balde de fichas + disjuntor). Rode DEPOIS do 01.
--
-- AVISO IMPORTANTE: sem estas duas funções, o freio "falha fechado":
-- NENHUMA DM por comentário sai. Tudo vai para a fila (ig_send_queue)
-- e a fila nunca anda. É o passo que não pode faltar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- take_send_slot: tenta pegar UMA ficha de envio.
-- Retorna true = pode enviar agora. false = segura (vai para a fila).
-- Usa SELECT ... FOR UPDATE: dois envios ao mesmo tempo não "furam" o teto.
-- ---------------------------------------------------------------------
create or replace function public.take_send_slot(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  b      public.ig_send_budget%rowtype;
  agora  timestamptz := now();
begin
  -- trava a linha do contador até o fim desta transação
  select * into b from public.ig_send_budget where id = p_key for update;

  if not found then
    raise warning 'take_send_slot: a chave % não existe em ig_send_budget (rode o 01_tabelas.sql)', p_key;
    return false;
  end if;

  -- disjuntor ligado? não envia
  if b.paused_until is not null and b.paused_until > agora then
    return false;
  end if;

  -- zera cada janela quando ela vira (minuto, hora, dia)
  if agora - b.min_start  >= interval '1 minute' then b.min_count  := 0; b.min_start  := agora; end if;
  if agora - b.hour_start >= interval '1 hour'   then b.hour_count := 0; b.hour_start := agora; end if;
  if agora - b.day_start  >= interval '1 day'    then b.day_count  := 0; b.day_start  := agora; end if;

  -- chegou em algum teto? grava as janelas zeradas e segura
  if b.min_count >= b.cap_minute or b.hour_count >= b.cap_hour or b.day_count >= b.cap_day then
    update public.ig_send_budget set
      min_count = b.min_count, min_start = b.min_start,
      hour_count = b.hour_count, hour_start = b.hour_start,
      day_count = b.day_count, day_start = b.day_start,
      updated_at = agora
    where id = p_key;
    return false;
  end if;

  -- pega a ficha: soma 1 em cada janela
  update public.ig_send_budget set
    min_count  = b.min_count + 1,  min_start  = b.min_start,
    hour_count = b.hour_count + 1, hour_start = b.hour_start,
    day_count  = b.day_count + 1,  day_start  = b.day_start,
    updated_at = agora
  where id = p_key;

  return true;
end $$;

-- ---------------------------------------------------------------------
-- record_send_result: registra como foi o envio (alimenta o disjuntor).
--   p_ok   = deu certo?
--   p_hard = foi uma falha "dura" (bloqueio, limite do Instagram)?
-- Regras do disjuntor:
--   3 falhas duras seguidas  -> pausa 3 horas
--   8 falhas quaisquer seguidas -> pausa 30 minutos
-- ---------------------------------------------------------------------
create or replace function public.record_send_result(p_key text, p_ok boolean, p_hard boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.ig_send_budget%rowtype;
begin
  select * into b from public.ig_send_budget where id = p_key for update;
  if not found then return; end if;

  if p_ok then
    update public.ig_send_budget
      set err_streak = 0, hard_streak = 0, updated_at = now()
    where id = p_key;
    return;
  end if;

  b.err_streak := b.err_streak + 1;
  if p_hard then b.hard_streak := b.hard_streak + 1; end if;

  if b.hard_streak >= 3 then
    b.paused_until := now() + interval '3 hours';
    b.hard_streak := 0; b.err_streak := 0;
    raise warning 'Freio: 3 falhas duras seguidas, envios pausados por 3 horas';
  elsif b.err_streak >= 8 then
    b.paused_until := now() + interval '30 minutes';
    b.err_streak := 0;
    raise warning 'Freio: 8 falhas seguidas, envios pausados por 30 minutos';
  end if;

  update public.ig_send_budget set
    err_streak = b.err_streak, hard_streak = b.hard_streak,
    paused_until = b.paused_until, updated_at = now()
  where id = p_key;
end $$;

-- Só as Edge Functions (service_role) podem chamar o freio
revoke all on function public.take_send_slot(text) from public, anon, authenticated;
revoke all on function public.record_send_result(text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.take_send_slot(text) to service_role;
grant execute on function public.record_send_result(text, boolean, boolean) to service_role;

-- Dica: para tirar a pausa do disjuntor na mão, rode:
--   update public.ig_send_budget set paused_until = null where id = 'private_reply';
