// =====================================================================
// ig-media: lista os posts da conta (com miniatura) para o seletor
// "Em quais posts" do editor. Só para quem está logado.
// =====================================================================
import { CORS, errMsg, graph, IG_ACCOUNT_ID, json, usuarioLogado } from "../_shared/ig.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await usuarioLogado(req))) return json({ erro: "faça login" }, 401);

  const r = await graph(`/${IG_ACCOUNT_ID || "me"}/media`, {
    params: { fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", limit: "50" },
  });
  if (!r.ok) return json({ connected: false, erro: errMsg(r.error), posts: [] });

  const posts = (r.data?.data ?? []).map((p: any) => ({
    id: p.id,
    caption: (p.caption ?? "").slice(0, 120),
    tipo: p.media_type,
    thumb: p.media_type === "VIDEO" ? (p.thumbnail_url ?? "") : (p.media_url ?? ""),
    permalink: p.permalink,
    data: p.timestamp,
  }));
  return json({ connected: true, posts });
});
