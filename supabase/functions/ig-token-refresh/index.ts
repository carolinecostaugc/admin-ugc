// =====================================================================
// ig-token-refresh: renova o token long-lived (~60 dias). Roda 1x por
// semana pelo pg_cron. Protegido pelo header x-sched-key = SCHED_SECRET.
// Publicar com --no-verify-jwt.
//
// Detalhe: o endpoint de renovação NÃO tem a versão no caminho
// (é graph.instagram.com/refresh_access_token, sem /v21.0).
// O token novo fica guardado na tabela ig_secrets (só o servidor lê)
// e passa a ser usado no lugar do IG_ACCESS_TOKEN.
// =====================================================================
import { chaveAgendadorOk, db, errMsg, getToken, json, tokenConfigurado } from "../_shared/ig.ts";

Deno.serve(async (req) => {
  if (!chaveAgendadorOk(req)) return json({ erro: "não autorizado" }, 401);

  const agora = new Date().toISOString();
  const token = await getToken();
  if (!tokenConfigurado(token)) {
    await db().from("ig_token_status").upsert({ id: "main", last_ok: false, last_error: "IG_ACCESS_TOKEN não configurado", updated_at: agora });
    return json({ ok: false, erro: "IG_ACCESS_TOKEN não configurado" }, 400);
  }

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);

  let data: any = {};
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (e) {
    data = { error: { message: String(e) } };
  }

  if (!data?.access_token) {
    await db().from("ig_token_status").upsert({ id: "main", last_ok: false, last_error: errMsg(data?.error), updated_at: agora });
    return json({ ok: false, erro: errMsg(data?.error) }, 502);
  }

  const expira = new Date(Date.now() + Number(data.expires_in ?? 0) * 1000).toISOString();
  await db().from("ig_secrets").upsert({ id: "ig_access_token", value: data.access_token, updated_at: agora });
  await db().from("ig_token_status").upsert({
    id: "main", expires_at: expira, last_ok: true, last_error: null, last_refreshed_at: agora, updated_at: agora,
  });
  return json({ ok: true, expires_at: expira });
});
