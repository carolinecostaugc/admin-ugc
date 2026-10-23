// =====================================================================
// _shared/ig.ts
// Peças usadas por todas as Edge Functions: banco, chamada à API do
// Instagram, envio de um passo do fluxo (com botões), freio e leads.
// =====================================================================
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Lê uma variável de ambiente (segredo) com valor padrão
export const env = (k: string, padrao = "") => (Deno.env.get(k) ?? padrao).trim();

export const GRAPH_VERSION = env("GRAPH_API_VERSION", "v21.0");
export const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;
export const IG_ACCOUNT_ID = env("IG_ACCOUNT_ID");

// Contas de teste: ignoram a regra do "1 por dia"
export const TEST_ACCOUNTS = env("TEST_IG_ACCOUNTS").split(",").map((s) => s.trim()).filter(Boolean);

// ---------------------------------------------------------------------
// Respostas HTTP (com CORS, para o painel conseguir chamar)
// ---------------------------------------------------------------------
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sched-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------
// Banco (service_role: ignora o RLS, por isso só existe aqui no servidor)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontas no Supabase.
// ---------------------------------------------------------------------
let _db: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (!_db) {
    _db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
  }
  return _db;
}

// Confere se quem chamou é um usuário logado no painel (para insights/media)
export async function usuarioLogado(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data, error } = await db().auth.getUser(jwt);
  return !error && !!data?.user;
}

// Protege os robôs agendados (header x-sched-key)
export function chaveAgendadorOk(req: Request): boolean {
  const segredo = env("SCHED_SECRET");
  return !!segredo && req.headers.get("x-sched-key") === segredo;
}

// ---------------------------------------------------------------------
// Token do Instagram: usa o renovado (guardado no banco) ou o da variável
// ---------------------------------------------------------------------
export async function getToken(): Promise<string> {
  try {
    const { data } = await db().from("ig_secrets").select("value").eq("id", "ig_access_token").maybeSingle();
    if (data?.value) return data.value;
  } catch (_) { /* sem tabela ainda: usa a variável */ }
  return env("IG_ACCESS_TOKEN");
}

export function tokenConfigurado(t: string) {
  return !!t && !t.includes("SEU_");
}

// ---------------------------------------------------------------------
// Chamada à API do Instagram (nunca lança erro: devolve ok/erro)
// ---------------------------------------------------------------------
export type GraphResult = { ok: boolean; status: number; data: any; error: any };

export async function graph(
  path: string,
  opts: { method?: string; params?: Record<string, string>; body?: unknown } = {},
): Promise<GraphResult> {
  const token = await getToken();
  if (!tokenConfigurado(token)) {
    return { ok: false, status: 0, data: null, error: { message: "IG_ACCESS_TOKEN não configurado" } };
  }
  const url = new URL(path.startsWith("http") ? path : GRAPH_BASE + path);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data: any = {};
    try { data = await res.json(); } catch (_) { /* resposta sem JSON */ }
    const ok = res.ok && !data?.error;
    return { ok, status: res.status, data, error: ok ? null : (data?.error ?? { message: `HTTP ${res.status}` }) };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: { message: String(e) } };
  }
}

// Falha "dura" = limite ou bloqueio do Instagram. Alimenta o disjuntor.
export function isHardError(err: any): boolean {
  const code = Number(err?.code);
  return [4, 17, 32, 368, 613].includes(code);
}

export function errMsg(err: any): string {
  if (!err) return "";
  return `${err.code ?? ""} ${err.message ?? JSON.stringify(err)}`.trim().slice(0, 500);
}

// ---------------------------------------------------------------------
// Tipos do fluxo (formato do campo "flow", veja o LEIA-ME)
// ---------------------------------------------------------------------
export type Button = { title: string; next?: number | string | null; url?: string | null };
export type Step = {
  id: number | string;
  message: string;
  buttons?: Button[];
  assets?: string[];
  collect?: { field: string; next?: number | string };
  delay?: { seconds: number; next: number | string };
};
export type Automation = {
  id: string;
  nome: string;
  keyword: string;
  match_any: boolean;
  active: boolean;
  media_ids: string[] | null;
  public_reply: string | null;
  public_reply_variants: string[] | null;
  flow: { steps: Step[] } | null;
};
export type Recipient = { comment_id: string } | { id: string };

const corta = (s: string, n: number) => (s ?? "").trim().slice(0, n);
const temNext = (b: Button) => b?.next !== undefined && b?.next !== null && String(b.next) !== "";

// Botão sem destino (nem link nem próximo passo) = "encerrar": é DESCARTADO
export function botoesValidos(step: Step): Button[] {
  return (step.buttons ?? []).filter((b) => b && corta(b.title, 20) && (!!b.url || temNext(b)));
}

export function acharPasso(auto: Automation, stepId: string | number): Step | undefined {
  return (auto.flow?.steps ?? []).find((s) => String(s.id) === String(stepId));
}

// Rótulo do tipo de envio, para o log
export function tipoDoPasso(step: Step): string {
  const bs = botoesValidos(step);
  if (bs.some((b) => temNext(b) && !b.url)) return "flow";
  if (bs.some((b) => b.url)) return "link";
  return "text";
}

// ---------------------------------------------------------------------
// Envia UMA mensagem e grava o mid (para ignorar o "echo" depois)
// ---------------------------------------------------------------------
export async function sendMessage(recipient: Recipient, message: unknown): Promise<GraphResult> {
  const r = await graph(`/${IG_ACCOUNT_ID || "me"}/messages`, { method: "POST", body: { recipient, message } });
  if (r.ok && r.data?.message_id) {
    await db().from("ig_bot_sends").upsert({ mid: r.data.message_id });
  }
  return r;
}

// ---------------------------------------------------------------------
// sendStep: o pulo do gato dos botões.
// 1) Tenta o button template (botões ANEXADOS ao balão, até 3).
// 2) Se o Instagram recusar: quick_reply (pílulas, até 13).
// 3) Por último: texto puro, com os links escritos no texto.
// Assim a mensagem nunca deixa de chegar.
// ---------------------------------------------------------------------
export async function sendStep(
  automationId: string,
  step: Step,
  recipient: Recipient,
  userId: string,
): Promise<{ ok: boolean; formato: string; error: any; hard: boolean }> {
  const botoes = botoesValidos(step);
  const texto = (step.message ?? "").trim();
  const payloadDe = (b: Button) => `STEP:${automationId}:${b.next}`;
  const falha = (r: GraphResult, formato: string) => ({ ok: false, formato, error: r.error, hard: isHardError(r.error) });

  let r: GraphResult | null = null;
  let formato = "text";

  // 1) Button template (anexado)
  if (botoes.length > 0 && botoes.length <= 3) {
    formato = "template";
    r = await sendMessage(recipient, {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: corta(texto || "👇", 640),
          buttons: botoes.map((b) =>
            b.url
              ? { type: "web_url", url: b.url, title: corta(b.title, 20) }
              : { type: "postback", title: corta(b.title, 20), payload: payloadDe(b) }
          ),
        },
      },
    });
    if (!r.ok) {
      console.warn("button template recusado:", errMsg(r.error));
      if (isHardError(r.error)) return falha(r, formato);
    }
  }

  // Texto com os links escritos (usado nos fallbacks)
  const textoComLinks = () =>
    [texto, ...botoes.filter((b) => b.url).map((b) => `${corta(b.title, 20)}: ${b.url}`)].filter(Boolean).join("\n\n");

  // 2) Quick reply (pílulas). Só botões que avançam viram pílula.
  if ((!r || !r.ok) && botoes.some((b) => !b.url)) {
    formato = "quick_reply";
    r = await sendMessage(recipient, {
      text: corta(textoComLinks() || "👇", 1000),
      quick_replies: botoes.filter((b) => !b.url).slice(0, 13).map((b) => ({
        content_type: "text",
        title: corta(b.title, 20),
        payload: payloadDe(b),
      })),
    });
    if (!r.ok) {
      console.warn("quick_reply recusado:", errMsg(r.error));
      if (isHardError(r.error)) return falha(r, formato);
    }
  }

  // 3) Texto puro
  if (!r || !r.ok) {
    const t = textoComLinks();
    if (t) {
      formato = "text";
      r = await sendMessage(recipient, { text: corta(t, 1000) });
    }
  }

  // Passo só com arquivo (sem texto e sem botão)
  const soArquivo = !r && (step.assets?.length ?? 0) > 0;
  if (!r && !soArquivo) return { ok: false, formato, error: { message: "passo vazio" }, hard: false };
  if (r && !r.ok) return falha(r, formato);

  // Deu certo: arquivos, coleta de dado, atraso e posição do lead
  if (step.assets?.length) await enviarArquivos(step.assets, userId);
  await depoisDoPasso(automationId, step, userId);
  return { ok: true, formato: soArquivo ? "arquivo" : formato, error: null, hard: false };
}

// Arquivos vão sempre para o id da pessoa (DM).
// Atenção: logo depois de uma resposta a comentário, o Instagram só deixa
// mandar mais coisa quando a pessoa responde ou toca num botão.
async function enviarArquivos(ids: string[], userId: string) {
  if (!userId) return;
  const { data } = await db().from("ig_assets").select("*").in("id", ids);
  for (const a of data ?? []) {
    const payload = a.attachment_id ? { attachment_id: a.attachment_id } : { url: a.public_url, is_reusable: true };
    const r = await sendMessage({ id: userId }, { attachment: { type: a.tipo || "file", payload } });
    if (r.ok && r.data?.attachment_id && !a.attachment_id) {
      await db().from("ig_assets").update({ attachment_id: r.data.attachment_id }).eq("id", a.id);
    }
    if (!r.ok) {
      console.warn("arquivo recusado, mandando o link:", errMsg(r.error));
      await sendMessage({ id: userId }, { text: `${a.nome}: ${a.public_url}` });
    }
  }
}

// Atualiza o lead e agenda o que vem depois do passo
async function depoisDoPasso(automationId: string, step: Step, userId: string) {
  if (!userId) return;
  const campos: Record<string, unknown> = { flow_step: String(step.id), automation_id: automationId };
  if (botoesValidos(step).some((b) => b.url)) campos.link_sent = true;
  if (step.collect?.field) {
    campos.expecting = { automation_id: automationId, field: step.collect.field, next: step.collect.next ?? null, tentativas: 0 };
  }
  await salvarLead(userId, campos);

  if (step.delay?.next !== undefined && step.delay?.next !== null) {
    await db().from("ig_scheduled").insert({
      ig_user_id: userId,
      automation_id: automationId,
      step_id: String(step.delay.next),
      send_at: new Date(Date.now() + (Number(step.delay.seconds) || 0) * 1000).toISOString(),
    });
  }
}

// ---------------------------------------------------------------------
// Leads e log
// ---------------------------------------------------------------------
export async function salvarLead(userId: string, campos: Record<string, unknown>) {
  const { error } = await db().from("ig_leads").upsert(
    { ig_user_id: userId, ...campos, updated_at: new Date().toISOString() },
    { onConflict: "ig_user_id" },
  );
  if (error) console.error("salvarLead:", error.message);
}

export async function logEntrega(row: {
  ig_user_id: string; automation_id: string | null; canal: string; tipo: string; status: string; motivo?: string;
}) {
  const { error } = await db().from("ig_deliveries").insert(row);
  if (error) console.error("logEntrega:", error.message);
}

// Marca um evento como processado. Retorna false se já tinha sido.
export async function primeiraVez(id: string): Promise<boolean> {
  const { error } = await db().from("ig_processed_events").insert({ id });
  if (!error) return true;
  if (error.code === "23505") return false; // duplicado
  console.error("primeiraVez:", error.message);
  return true; // na dúvida, processa
}

// ---------------------------------------------------------------------
// Regra do "1 por dia" (contas de teste ignoram)
// ---------------------------------------------------------------------
export async function jaRecebeuHoje(userId: string): Promise<boolean> {
  if (TEST_ACCOUNTS.includes(userId)) return false;
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db().from("ig_deliveries").select("id", { count: "exact", head: true })
    .eq("ig_user_id", userId).eq("status", "ok").eq("canal", "private_reply").gte("ts", desde);
  if ((count ?? 0) > 0) return true;
  const { count: naFila } = await db().from("ig_send_queue").select("id", { count: "exact", head: true })
    .eq("ig_user_id", userId).eq("status", "pendente");
  return (naFila ?? 0) > 0;
}

// ---------------------------------------------------------------------
// Palavra-chave
// ---------------------------------------------------------------------
export function normalizar(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function casaPalavra(texto: string, auto: Automation): boolean {
  const t = ` ${normalizar(texto)} `;
  const palavras = (auto.keyword ?? "").split(",").map(normalizar).filter(Boolean);
  return palavras.some((p) => t.includes(` ${p} `));
}

// ---------------------------------------------------------------------
// O FREIO (funções do 02_freio.sql)
// Se a função não existir, falha FECHADO (não envia) e avisa no log.
// ---------------------------------------------------------------------
export async function pegarFicha(): Promise<boolean> {
  const { data, error } = await db().rpc("take_send_slot", { p_key: "private_reply" });
  if (error) {
    console.error("FREIO: take_send_slot falhou. Você rodou o 02_freio.sql? Sem ele nenhuma DM sai.", error.message);
    return false;
  }
  return data === true;
}

export async function registrarResultado(ok: boolean, hard: boolean) {
  const { error } = await db().rpc("record_send_result", { p_key: "private_reply", p_ok: ok, p_hard: hard });
  if (error) console.error("FREIO: record_send_result falhou:", error.message);
}

// Manda a Mensagem 1 (primeiro passo do fluxo) como resposta privada ao
// comentário. Quem chama já pegou a ficha do freio.
export async function enviarPrimeiroPasso(auto: Automation, commentId: string, userId: string) {
  const first = auto.flow?.steps?.[0];
  if (!first) {
    await logEntrega({ ig_user_id: userId, automation_id: auto.id, canal: "private_reply", tipo: "text", status: "erro", motivo: "automação sem mensagem" });
    return { ok: false, hard: false, error: { message: "automação sem mensagem" }, formato: "" };
  }
  const res = await sendStep(auto.id, first, { comment_id: commentId }, userId);
  await registrarResultado(res.ok, res.hard);
  await logEntrega({
    ig_user_id: userId, automation_id: auto.id, canal: "private_reply", tipo: tipoDoPasso(first),
    status: res.ok ? "ok" : "erro", motivo: res.ok ? res.formato : errMsg(res.error),
  });
  return res;
}
