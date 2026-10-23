// =====================================================================
// ig-insights: métricas para o dashboard (seguidores, novos seguidores
// por dia e alcance por dia, últimos 15 dias). Só para quem está logado.
// =====================================================================
import { CORS, errMsg, graph, IG_ACCOUNT_ID, json, usuarioLogado } from "../_shared/ig.ts";

const DIA = 24 * 3600;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await usuarioLogado(req))) return json({ erro: "faça login" }, 401);

  const conta = IG_ACCOUNT_ID || "me";
  const perfil = await graph(`/${conta}`, { params: { fields: "id,username,followers_count,media_count" } });
  if (!perfil.ok) return json({ connected: false, erro: errMsg(perfil.error) });

  const ate = Math.floor(Date.now() / 1000);
  const desde = ate - 15 * DIA;

  // Transforma a resposta da API em [{ date: "2026-01-31", value: 12 }]
  const serie = async (metric: string) => {
    const r = await graph(`/${conta}/insights`, {
      params: { metric, period: "day", since: String(desde), until: String(ate) },
    });
    if (!r.ok) { console.warn(`insights ${metric}:`, errMsg(r.error)); return []; }
    const valores = r.data?.data?.[0]?.values ?? [];
    return valores.map((v: any) => ({ date: String(v.end_time ?? "").slice(0, 10), value: Number(v.value ?? 0) }));
  };

  const [novos, alcance] = await Promise.all([serie("follower_count"), serie("reach")]);

  return json({
    connected: true,
    username: perfil.data.username,
    followers: perfil.data.followers_count ?? 0,
    media_count: perfil.data.media_count ?? 0,
    new_followers: novos,
    reach: alcance,
  });
});
