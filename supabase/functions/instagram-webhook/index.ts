// =====================================================================
// instagram-webhook: o cérebro.
// Recebe os eventos do Instagram (comentários, mensagens, toques em botão)
// e responde sozinho.
// Publicar SEMPRE com --no-verify-jwt (o Meta não manda login do Supabase).
// =====================================================================
import {
  acharPasso, type Automation, casaPalavra, db, enviarPrimeiroPasso, env, errMsg, graph, IG_ACCOUNT_ID,
  jaRecebeuHoje, logEntrega, pegarFicha, primeiraVez, salvarLead, sendMessage, sendStep, type Step, tipoDoPasso,
} from "../_shared/ig.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // a) Verificação (aperto de mão do Meta)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode === "subscribe" && token && token === env("VERIFY_TOKEN")) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("token de verificação inválido", { status: 403 });
  }

  if (req.method !== "POST") return new Response("ok", { status: 200 });

  // b) Recebimento: confere a assinatura
  const raw = await req.text();
  const assinaturaOk = await assinaturaValida(raw, req.headers.get("x-hub-signature-256"));
  if (!assinaturaOk) {
    if (env("APP_SECRET_ENFORCE") === "true") {
      console.warn("assinatura inválida: requisição bloqueada");
      return new Response("assinatura inválida", { status: 403 });
    }
    console.warn("assinatura inválida (modo teste, APP_SECRET_ENFORCE desligado): processando mesmo assim");
  }

  let body: any = {};
  try { body = JSON.parse(raw); } catch (_) { return new Response("ok", { status: 200 }); }

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === "comments" && change.value) await handleComment(change.value);
      }
      for (const m of entry.messaging ?? []) await handleMessage(m);
    }
  } catch (e) {
    console.error("erro processando evento:", e);
  }
  // Sempre 200 rápido, senão o Meta reenvia e acaba desligando o webhook
  return new Response("EVENT_RECEIVED", { status: 200 });
});

// ---------------------------------------------------------------------
// Assinatura HMAC SHA-256 com o APP_SECRET
// ---------------------------------------------------------------------
async function assinaturaValida(raw: string, header: string | null): Promise<boolean> {
  const secret = env("APP_SECRET");
  if (!secret || !header) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw)));
  const esperado = "sha256=" + [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  // comparação de tempo constante
  if (esperado.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------
// Busca a automação certa para um texto (e um post, se houver)
// ---------------------------------------------------------------------
async function acharAutomacao(texto: string, mediaId: string | null, origem: "comment" | "dm"): Promise<Automation | null> {
  const { data, error } = await db().from("ig_automations").select("*").eq("active", true).order("updated_at", { ascending: false });
  if (error) { console.error("acharAutomacao:", error.message); return null; }
  const todas = (data ?? []) as Automation[];

  const valePost = (a: Automation) => {
    const ids = a.media_ids ?? [];
    if (origem === "dm") return ids.length === 0;       // na DM não tem post: só automações "todos os posts"
    return ids.length === 0 || (!!mediaId && ids.includes(mediaId));
  };

  // 1) palavra-chave específica ganha  2) depois "qualquer palavra" (só em comentário)
  return todas.find((a) => !a.match_any && valePost(a) && casaPalavra(texto, a))
    ?? (origem === "comment" ? todas.find((a) => a.match_any && valePost(a)) : undefined)
    ?? null;
}

// ---------------------------------------------------------------------
// COMENTÁRIO
// ---------------------------------------------------------------------
async function handleComment(v: any) {
  const commentId: string = v.id;
  const texto: string = v.text ?? "";
  const userId: string = v.from?.id;
  const username: string = v.from?.username ?? "";
  const mediaId: string | null = v.media?.id ?? null;
  if (!commentId || !userId) return;

  // 2) ignora comentário da própria conta (inclusive as respostas públicas do robô)
  if (IG_ACCOUNT_ID && userId === IG_ACCOUNT_ID) return;

  // 1) ignora duplicado
  if (!(await primeiraVez(`c:${commentId}`))) return;

  // 3) acha a automação
  const auto = await acharAutomacao(texto, mediaId, "comment");
  if (!auto) return;

  // 4) regra do "1 por dia"
  if (await jaRecebeuHoje(userId)) {
    console.log(`regra do 1 por dia: ${username || userId} já recebeu nas últimas 24h, pulando`);
    return;
  }

  // 5) entrega
  const status = await deliverAutomation(auto, commentId, userId, username);
  if (status === "ok" || status === "throttled") {
    await responderComentario(commentId, auto);
    const first = auto.flow?.steps?.[0];
    await salvarLead(userId, {
      username, last_source: "comment", last_keyword: auto.match_any ? "(qualquer)" : auto.keyword,
      automation_id: auto.id, ...(first ? { flow_step: String(first.id) } : {}),
    });
  }
}

// Entrega a Mensagem 1 passando pelo FREIO
async function deliverAutomation(auto: Automation, commentId: string, userId: string, username: string): Promise<"ok" | "throttled" | "erro"> {
  if (!(await pegarFicha())) {
    const { error } = await db().from("ig_send_queue").upsert(
      { comment_id: commentId, automation_id: auto.id, ig_user_id: userId, username, status: "pendente" },
      { onConflict: "comment_id", ignoreDuplicates: true },
    );
    if (error) { console.error("fila:", error.message); return "erro"; }
    await logEntrega({ ig_user_id: userId, automation_id: auto.id, canal: "private_reply", tipo: "flow", status: "na_fila", motivo: "freio: sem ficha agora" });
    return "throttled";
  }
  const res = await enviarPrimeiroPasso(auto, commentId, userId);
  return res.ok ? "ok" : "erro";
}

// Resposta pública no comentário (alterna entre as variações A/B)
async function responderComentario(commentId: string, auto: Automation) {
  const opcoes = [auto.public_reply ?? "", ...(auto.public_reply_variants ?? [])].map((s) => s.trim()).filter(Boolean);
  if (!opcoes.length) return;
  const texto = opcoes[Math.floor(Math.random() * opcoes.length)];
  const r = await graph(`/${commentId}/replies`, { method: "POST", body: { message: texto } });
  if (!r.ok) console.warn("resposta pública falhou:", errMsg(r.error));
}

// ---------------------------------------------------------------------
// MENSAGEM / POSTBACK / QUICK REPLY
// ---------------------------------------------------------------------
async function handleMessage(m: any) {
  const senderId: string = m.sender?.id;
  if (!senderId) return;

  // Echo = mensagem que a própria conta mandou (pelo robô ou na mão): ignora
  if (m.message?.is_echo || senderId === IG_ACCOUNT_ID) return;

  const mid: string = m.message?.mid ?? m.postback?.mid ?? "";
  if (mid) {
    const { data: doRobo } = await db().from("ig_bot_sends").select("mid").eq("mid", mid).maybeSingle();
    if (doRobo) return;
    if (!(await primeiraVez(`m:${mid}`))) return;
  }

  // Toque em botão: postback (botão anexado) OU quick_reply (pílula). Trata os dois.
  const payload: string = m.postback?.payload ?? m.message?.quick_reply?.payload ?? "";
  if (payload.startsWith("STEP:")) {
    const [, autoId, stepId] = payload.split(":");
    await avancarFluxo(autoId, stepId, senderId);
    return;
  }

  const texto: string = (m.message?.text ?? "").trim();
  if (!texto) return;

  // Um passo pediu um dado (email/telefone)? Esta mensagem é a resposta.
  const { data: lead } = await db().from("ig_leads").select("*").eq("ig_user_id", senderId).maybeSingle();
  if (lead?.expecting?.field) {
    await receberDado(lead, texto, senderId);
    return;
  }

  // Palavra-chave por DM (ou resposta a story)
  const auto = await acharAutomacao(texto, null, "dm");
  if (!auto) return; // texto solto que não bate nada: silêncio
  if (await jaRecebeuHoje(senderId)) return;
  const first = auto.flow?.steps?.[0];
  if (!first) return;
  const origem = m.message?.reply_to?.story ? "story_reply" : "dm";
  const res = await sendStep(auto.id, first, { id: senderId }, senderId);
  await logEntrega({
    ig_user_id: senderId, automation_id: auto.id, canal: "dm", tipo: tipoDoPasso(first),
    status: res.ok ? "ok" : "erro", motivo: res.ok ? res.formato : errMsg(res.error),
  });
  if (res.ok) await salvarLead(senderId, { last_source: origem, last_keyword: auto.keyword, automation_id: auto.id });
}

// Avança para o passo indicado no payload STEP:idDaAutomacao:proximoPasso
async function avancarFluxo(autoId: string, stepId: string, userId: string) {
  const { data: auto } = await db().from("ig_automations").select("*").eq("id", autoId).maybeSingle();
  if (!auto) { console.warn("automação do botão não existe mais:", autoId); return; }
  const step = acharPasso(auto as Automation, stepId);
  if (!step) { console.warn("passo não encontrado:", stepId); return; }
  await enviarPassoDM(auto as Automation, step, userId);
}

async function enviarPassoDM(auto: Automation, step: Step, userId: string) {
  const res = await sendStep(auto.id, step, { id: userId }, userId);
  await logEntrega({
    ig_user_id: userId, automation_id: auto.id, canal: "dm", tipo: tipoDoPasso(step),
    status: res.ok ? "ok" : "erro", motivo: res.ok ? res.formato : errMsg(res.error),
  });
}

// Coleta de dado com validação
async function receberDado(lead: any, texto: string, userId: string) {
  const exp = lead.expecting;
  const campo: string = exp.field;
  let valor = texto.trim();
  let valido = true;

  if (campo === "email") {
    valor = valor.toLowerCase();
    valido = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
  } else if (campo === "telefone") {
    valor = valor.replace(/\D/g, "");
    valido = valor.length >= 10 && valor.length <= 15;
  }

  if (!valido) {
    const tentativas = (exp.tentativas ?? 0) + 1;
    if (tentativas >= 3) {
      await salvarLead(userId, { expecting: null }); // desiste depois de 3 tentativas
      return;
    }
    await salvarLead(userId, { expecting: { ...exp, tentativas } });
    const pedido = campo === "email" ? "Hmm, esse e-mail não parece certo. Pode mandar de novo?" : "Hmm, esse número não parece certo. Pode mandar de novo com DDD?";
    await sendMessage({ id: userId }, { text: pedido });
    return;
  }

  const campos: Record<string, unknown> = { expecting: null };
  if (campo === "email" || campo === "telefone") campos[campo] = valor;
  else campos.dados = { ...(lead.dados ?? {}), [campo]: valor };
  await salvarLead(userId, campos);

  // segue o fluxo
  if (exp.next !== null && exp.next !== undefined && exp.automation_id) {
    await avancarFluxo(exp.automation_id, String(exp.next), userId);
  }
}
