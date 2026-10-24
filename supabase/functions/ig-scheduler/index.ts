// =====================================================================
// ig-scheduler: o carteiro. Roda a cada 1 minuto pelo pg_cron.
// 1) Esvazia a fila do freio (ig_send_queue)
// 2) Manda os passos com atraso que já venceram (ig_scheduled)
// Protegido pelo header x-sched-key = SCHED_SECRET.
// Publicar com --no-verify-jwt (o pg_cron não manda login).
// =====================================================================
import {
  acharPasso, type Automation, chaveAgendadorOk, db, enviarPrimeiroPasso, errMsg, garantirUsername, json, logEntrega,
  pegarFicha, salvarLead, sendStep, tipoDoPasso,
} from "../_shared/ig.ts";

const SETE_DIAS = 7 * 24 * 3600 * 1000;
const MAX_TENTATIVAS = 3;

Deno.serve(async (req) => {
  if (!chaveAgendadorOk(req)) return json({ erro: "não autorizado" }, 401);

  const resumo = { enviados: 0, erros: 0, expirados: 0, sem_ficha: false, agendados_enviados: 0, usernames_buscados: 0 };

  // ---------------- 1) Fila do freio ----------------
  const { data: fila } = await db().from("ig_send_queue").select("*")
    .eq("status", "pendente").order("created_at", { ascending: true }).limit(50);

  for (const item of fila ?? []) {
    // Comentário velho demais: o Instagram não aceita mais resposta privada
    if (Date.now() - new Date(item.created_at).getTime() > SETE_DIAS) {
      await db().from("ig_send_queue").update({ status: "expirado" }).eq("id", item.id);
      resumo.expirados++;
      continue;
    }

    // Sem ficha: para por aqui e tenta no próximo minuto
    if (!(await pegarFicha())) { resumo.sem_ficha = true; break; }

    const { data: auto } = await db().from("ig_automations").select("*").eq("id", item.automation_id).maybeSingle();
    if (!auto) {
      await db().from("ig_send_queue").update({ status: "erro", last_error: "automação apagada" }).eq("id", item.id);
      resumo.erros++;
      continue;
    }

    const res = await enviarPrimeiroPasso(auto as Automation, item.comment_id, item.ig_user_id);
    const tentativas = (item.tentativas ?? 0) + 1;

    if (res.ok) {
      await db().from("ig_send_queue").update({ status: "enviado", sent_at: new Date().toISOString(), tentativas }).eq("id", item.id);
      await salvarLead(item.ig_user_id, { username: item.username, last_source: "comment", automation_id: auto.id });
      resumo.enviados++;
    } else {
      await db().from("ig_send_queue").update({
        status: tentativas >= MAX_TENTATIVAS ? "erro" : "pendente",
        tentativas, last_error: errMsg(res.error),
      }).eq("id", item.id);
      resumo.erros++;
      if (res.hard) break; // bloqueio/limite: o disjuntor cuida, não insiste
    }
  }

  // ---------------- 2) Passos com atraso ----------------
  const { data: vencidos } = await db().from("ig_scheduled").select("*")
    .eq("sent", false).lte("send_at", new Date().toISOString()).order("send_at").limit(50);

  for (const ag of vencidos ?? []) {
    // marca antes de enviar, para não mandar duas vezes se der timeout
    await db().from("ig_scheduled").update({ sent: true }).eq("id", ag.id);
    const { data: auto } = await db().from("ig_automations").select("*").eq("id", ag.automation_id).maybeSingle();
    if (!auto) continue;
    const step = acharPasso(auto as Automation, ag.step_id);
    if (!step) continue;
    const res = await sendStep(auto.id, step, { id: ag.ig_user_id }, ag.ig_user_id);
    await logEntrega({
      ig_user_id: ag.ig_user_id, automation_id: auto.id, canal: "dm", tipo: tipoDoPasso(step),
      status: res.ok ? "ok" : "erro", motivo: res.ok ? `atraso, ${res.formato}` : errMsg(res.error),
    });
    if (res.ok) resumo.agendados_enviados++;
  }

  // ---------------- 3) Completa o @ de leads que chegaram sem ----------------
  const { data: semNome } = await db().from("ig_leads").select("ig_user_id")
    .is("username", null).is("dados->>_username_falhou", null).limit(10);
  for (const l of semNome ?? []) await garantirUsername(l.ig_user_id);
  resumo.usernames_buscados = semNome?.length ?? 0;

  return json(resumo);
});
