// =====================================================================
// app.js: o painel inteiro (login, menu, Início, Calendário, Instagram).
// JavaScript puro, sem framework. Organizado em blocos:
//   1. Configuração e utilidades
//   2. Dados (Supabase ou, no teste local, o próprio navegador)
//   3. Login
//   4. Menu e rotas
//   5. Telas: Início, Calendário, Instagram (Métricas e Automações)
//   6. Editor de automação (gatilho, resposta, conversa, prévia)
// =====================================================================
(function () {
  "use strict";

  // ===================================================================
  // 1. CONFIGURAÇÃO E UTILIDADES
  // ===================================================================
  const CFG = window.APP_CONFIG || {};

  // Modo teste local: localhost, 127.0.0.1 ou arquivo aberto direto
  const LOCAL = location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "::1", "[::1]", ""].includes(location.hostname);

  // O Supabase está configurado? (sem os placeholders do config.js)
  const SUPA_CONFIGURADO = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
    !/SUA_|SEU_/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY));

  let sb = null;
  try {
    if (SUPA_CONFIGURADO && window.supabase) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  } catch (e) { console.warn("Supabase não iniciou:", e); }

  // No teste local, os dados ficam só neste navegador
  const USA_BANCO = !LOCAL && !!sb;

  const LIMITE_TITULO = 20; // o Instagram corta o título do botão em 20
  const EMOJIS = ["🫶", "👀", "😍", "🥰", "😂", "😮", "🔥", "✨", "💌", "👉", "🙌", "💕"];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pareceLink = (v) => /^(https?:\/\/|www\.)\S+$/i.test(String(v || "").trim());
  const urlValida = (v) => /^https?:\/\/\S+\.\S+/i.test(String(v || "").trim());
  const fmtNum = (n) => Number(n || 0).toLocaleString("pt-BR");
  const fmtDia = (iso) => { const d = String(iso || "").slice(0, 10).split("-"); return d.length === 3 ? `${d[2]}/${d[1]}` : ""; };

  // Ícones (traço simples)
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    inicio: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    calendario: svg('<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
    instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
    sair: svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    chat: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/>'),
    mais: svg('<path d="M12 5v14M5 12h14"/>'),
    lixo: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    editar: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    voltar: svg('<path d="M15 18l-6-6 6-6"/>'),
    avancar: svg('<path d="M9 18l6-6-6-6"/>'),
    // UGC (claquete) e contato
    ugc: svg('<path d="M3.5 10h17v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"/><path d="M3.5 10 4.6 5.6a1.5 1.5 0 0 1 1.8-1.1l13 3.2-.9 2.3M8.5 5.4l1.6 3.6M13.5 6.6l1.6 3.4"/>'),
    email: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>'),
    whatsapp: svg('<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.5-4.3A8.5 8.5 0 1 1 20.5 11.6z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1.2-1.6-2-1-1 1a5 5 0 0 1-3-3l1-1-1-2z"/>'),
    formulario: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    outro: svg('<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'),
    // documentos
    pasta: svg('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>'),
    nota: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'),
    estrela: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
    copiar: svg('<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>'),
    enviarArq: svg('<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>'),
    // tipos de conteúdo
    video: svg('<rect x="2.5" y="5" width="14" height="14" rx="2.5"/><path d="M16.5 10l5-3v10l-5-3"/>'),
    foto: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    carrossel: svg('<rect x="7.5" y="3.5" width="13" height="13" rx="2"/><path d="M4 8v10.5A1.5 1.5 0 0 0 5.5 20H16"/>'),
    story: svg('<circle cx="12" cy="12" r="9" stroke-dasharray="3.2 2.4"/><circle cx="12" cy="12" r="4.2"/>'),
    x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    arquivo: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    grafico: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    raio: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    usuarios: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>'),
    enviar: svg('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>'),
    baixar: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  };
  function pintarIcones(raiz = document) {
    $$("[data-icon]", raiz).forEach((el) => { el.innerHTML = ICON[el.dataset.icon] || ""; });
  }

  // Mensagem rápida no rodapé
  let toastTimer = null;
  function toast(msg, tipo = "", ms = 3200) {
    const el = $("#toast");
    el.textContent = msg;
    el.className = `toast on ${tipo}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = "toast"; }, ms);
  }

  // localStorage com proteção (pode falhar em janela anônima)
  const store = {
    get(k, padrao) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (_) { return padrao; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sem armazenamento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (_) { /* sem armazenamento */ } },
  };

  // ===================================================================
  // 2. DADOS
  // Toda chamada é tolerante a falha: se algo der errado, devolve vazio
  // e a tela mostra um estado simpático em vez de quebrar.
  // ===================================================================
  const CHAVE_AUTOS = "teste_automacoes";
  const CHAVE_ARQS = "teste_arquivos";
  const CHAVE_LEADS = "teste_leads";
  const CHAVE_ENTREGAS = "teste_entregas";
  const CHAVE_CONTEUDOS = "teste_conteudos";
  const CHAVE_DOC = { doc_pastas: "teste_doc_pastas", doc_itens: "teste_doc_itens" };
  let autosMapa = {}; // id da automação -> nome (usado na aba Leads)

  // Conta linhas de uma consulta (zero se falhar)
  async function contar(q) {
    try { const { count, error } = await q; if (error) throw error; return count || 0; }
    catch (e) { console.warn(e); return 0; }
  }

  // Tira da busca os caracteres que atrapalham o filtro do banco
  const limparBusca = (s) => String(s || "").replace(/[,()*%\\:"']/g, " ").trim().replace(/\s+/g, "*").slice(0, 60);
  const normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Modo teste: leads guardados no navegador, com as mesmas contas da visão
  function leadsLocalTodos() {
    const entregas = store.get(CHAVE_ENTREGAS, []);
    const autos = store.get(CHAVE_AUTOS, []);
    return store.get(CHAVE_LEADS, []).map((l) => {
      const ok = entregas.filter((d) => d.ig_user_id === l.ig_user_id && d.status === "ok");
      const a = autos.find((x) => x.id === l.automation_id);
      return { ...l, interacoes: ok.length, ultima_entrega: ok.map((d) => d.ts).sort().pop() || null, automacao_nome: a ? a.nome : null };
    });
  }
  function filtrarLeadsLocal(f, de, ate) {
    let rows = leadsLocalTodos();
    const b = normal(f.busca).trim();
    if (b) rows = rows.filter((l) => [l.username, l.email, l.telefone, l.last_keyword, l.ig_user_id].some((v) => normal(v).includes(b)));
    if (f.origem) rows = rows.filter((l) => l.last_source === f.origem);
    if (f.etiqueta) rows = rows.filter((l) => (l.tags || []).includes(f.etiqueta));
    if (f.contato) rows = rows.filter((l) => l.email || l.telefone);
    rows.sort((x, y) => {
      const a = x[f.ordem], c = y[f.ordem];
      if (a == null && c == null) return 0;
      if (a == null) return 1;
      if (c == null) return -1;
      const r = a < c ? -1 : a > c ? 1 : 0;
      return f.asc ? r : -r;
    });
    return { rows: rows.slice(de, ate + 1), total: rows.length };
  }

  const api = {
    async listarAutomacoes() {
      if (!USA_BANCO) return store.get(CHAVE_AUTOS, []);
      try {
        const { data, error } = await sb.from("ig_automations").select("*").order("updated_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) { console.warn(e); return []; }
    },

    async salvarAutomacao(row) {
      if (!USA_BANCO) {
        const lista = store.get(CHAVE_AUTOS, []);
        const item = { ...row, id: row.id || `teste-${Date.now()}`, updated_at: new Date().toISOString() };
        const i = lista.findIndex((a) => a.id === item.id);
        if (i >= 0) lista[i] = item; else lista.unshift(item);
        store.set(CHAVE_AUTOS, lista);
        return { ok: true, local: true, data: item };
      }
      try {
        const dados = { ...row };
        if (!dados.id) delete dados.id;
        delete dados.created_at; delete dados.updated_at;
        const { data, error } = await sb.from("ig_automations").upsert(dados).select().single();
        if (error) throw error;
        return { ok: true, data };
      } catch (e) { console.warn(e); return { ok: false, erro: e.message }; }
    },

    async alternarAtiva(id, ativa) {
      if (!USA_BANCO) {
        const lista = store.get(CHAVE_AUTOS, []);
        const a = lista.find((x) => x.id === id);
        if (a) a.active = ativa;
        store.set(CHAVE_AUTOS, lista);
        return true;
      }
      try {
        const { error } = await sb.from("ig_automations").update({ active: ativa }).eq("id", id);
        if (error) throw error;
        return true;
      } catch (e) { console.warn(e); return false; }
    },

    async apagarAutomacao(id) {
      if (!USA_BANCO) {
        store.set(CHAVE_AUTOS, store.get(CHAVE_AUTOS, []).filter((a) => a.id !== id));
        return true;
      }
      try {
        const { error } = await sb.from("ig_automations").delete().eq("id", id);
        if (error) throw error;
        return true;
      } catch (e) { console.warn(e); return false; }
    },

    // Contagens do Início (zero se não tiver dado)
    async contagens() {
      const r = { leads: 0, ativas: 0, dms7: 0 };
      if (!USA_BANCO) {
        r.ativas = store.get(CHAVE_AUTOS, []).filter((a) => a.active).length;
        return r;
      }
      const desde = new Date(Date.now() - 7 * 864e5).toISOString();
      const conta = async (q) => { try { const { count, error } = await q; if (error) throw error; return count || 0; } catch (e) { console.warn(e); return 0; } };
      [r.leads, r.ativas, r.dms7] = await Promise.all([
        conta(sb.from("ig_leads").select("ig_user_id", { count: "exact", head: true })),
        conta(sb.from("ig_automations").select("id", { count: "exact", head: true }).eq("active", true)),
        conta(sb.from("ig_deliveries").select("id", { count: "exact", head: true }).eq("status", "ok").gte("ts", desde)),
      ]);
      return r;
    },

    async leadsRecentes() {
      if (!USA_BANCO) return [];
      try {
        const { data, error } = await sb.from("ig_leads")
          .select("ig_user_id, username, last_keyword, last_source, email, telefone, created_at")
          .order("created_at", { ascending: false }).limit(20);
        if (error) throw error;
        return data || [];
      } catch (e) { console.warn(e); return []; }
    },

    // ---------- Leads (aba Leads) ----------
    // Lê da visão ig_leads_resumo (com o total de interações). Se a visão
    // ainda não existe (falta rodar o 05_leads.sql), usa a tabela ig_leads.
    async leads(f, de, ate) {
      if (!USA_BANCO) return filtrarLeadsLocal(f, de, ate);
      const consulta = (fonte, ordem) => {
        let q = sb.from(fonte).select("*", { count: "exact" });
        const b = limparBusca(f.busca);
        if (b) q = q.or(["username", "email", "telefone", "last_keyword", "ig_user_id"].map((c) => `${c}.ilike.*${b}*`).join(","));
        if (f.origem) q = q.eq("last_source", f.origem);
        if (f.etiqueta) q = q.contains("tags", [f.etiqueta]);
        if (f.contato) q = q.or("email.not.is.null,telefone.not.is.null");
        return q.order(ordem, { ascending: f.asc, nullsFirst: false }).range(de, ate);
      };
      try {
        let semView = false;
        let r = await consulta("ig_leads_resumo", f.ordem);
        if (r.error && /ig_leads_resumo|PGRST205|42P01|does not exist/i.test(`${r.error.code} ${r.error.message}`)) {
          semView = true;
          const ordem = ["interacoes", "ultima_entrega", "automacao_nome"].includes(f.ordem) ? "created_at" : f.ordem;
          r = await consulta("ig_leads", ordem);
          if (!r.error) r.data = (r.data || []).map((l) => ({ ...l, automacao_nome: autosMapa[l.automation_id] || null }));
        }
        if (r.error) throw r.error;
        return { rows: r.data || [], total: r.count || 0, semView };
      } catch (e) { console.warn(e); return { rows: [], total: 0, erro: e.message }; }
    },

    async resumoLeads() {
      if (!USA_BANCO) {
        const ls = leadsLocalTodos();
        const desde = Date.now() - 7 * 864e5;
        return { total: ls.length, contato: ls.filter((l) => l.email || l.telefone).length,
          novos: ls.filter((l) => new Date(l.created_at).getTime() >= desde).length, link: ls.filter((l) => l.link_sent).length };
      }
      const desde = new Date(Date.now() - 7 * 864e5).toISOString();
      const base = () => sb.from("ig_leads").select("ig_user_id", { count: "exact", head: true });
      const [total, contato, novos, link] = await Promise.all([
        contar(base()),
        contar(base().or("email.not.is.null,telefone.not.is.null")),
        contar(base().gte("created_at", desde)),
        contar(base().eq("link_sent", true)),
      ]);
      return { total, contato, novos, link };
    },

    // Todas as etiquetas já usadas (pro filtro e pras sugestões)
    async etiquetas() {
      let listas = [];
      if (!USA_BANCO) listas = store.get(CHAVE_LEADS, []).map((l) => l.tags || []);
      else {
        try {
          const { data, error } = await sb.from("ig_leads").select("tags").neq("tags", "{}").limit(1000);
          if (error) throw error;
          listas = (data || []).map((l) => l.tags || []);
        } catch (e) { console.warn(e); }
      }
      return Array.from(new Set(listas.flat())).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },

    async historicoLead(id) {
      if (!USA_BANCO) return store.get(CHAVE_ENTREGAS, []).filter((d) => d.ig_user_id === id).sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 50);
      try {
        const { data, error } = await sb.from("ig_deliveries").select("ts, canal, tipo, status, motivo, automation_id")
          .eq("ig_user_id", id).order("ts", { ascending: false }).limit(50);
        if (error) throw error;
        return data || [];
      } catch (e) { console.warn(e); return []; }
    },

    async atualizarLead(id, campos) {
      if (!USA_BANCO) {
        const ls = store.get(CHAVE_LEADS, []);
        const l = ls.find((x) => x.ig_user_id === id);
        if (l) Object.assign(l, campos);
        store.set(CHAVE_LEADS, ls);
        return true;
      }
      try {
        const { error } = await sb.from("ig_leads").update(campos).eq("ig_user_id", id);
        if (error) throw error;
        return true;
      } catch (e) { console.warn(e); return false; }
    },

    // Apaga TUDO de um lead (pedido de exclusão da LGPD)
    async excluirLead(id) {
      if (!USA_BANCO) {
        store.set(CHAVE_LEADS, store.get(CHAVE_LEADS, []).filter((l) => l.ig_user_id !== id));
        store.set(CHAVE_ENTREGAS, store.get(CHAVE_ENTREGAS, []).filter((d) => d.ig_user_id !== id));
        return true;
      }
      try {
        const rs = await Promise.all(["ig_deliveries", "ig_send_queue", "ig_scheduled"].map((t) => sb.from(t).delete().eq("ig_user_id", id)));
        const falha = rs.find((r) => r.error);
        if (falha) throw falha.error;
        const { error } = await sb.from("ig_leads").delete().eq("ig_user_id", id);
        if (error) throw error;
        return true;
      } catch (e) { console.warn(e); return false; }
    },

    // ---------- Conteúdos (Calendário) ----------
    // Devolve { rows, erro, semTabela } (semTabela = falta rodar o 06_calendario.sql)
    async listarConteudos() {
      if (!USA_BANCO) return { rows: store.get(CHAVE_CONTEUDOS, []) };
      try {
        const { data, error } = await sb.from("conteudos").select("*").order("ordem", { ascending: true });
        if (error) throw error;
        return { rows: data || [] };
      } catch (e) {
        console.warn(e);
        return { rows: [], erro: e.message, semTabela: /conteudos|PGRST205|42P01/.test(`${e.code} ${e.message}`) };
      }
    },

    // Cria ou atualiza (só os campos enviados). Devolve o conteúdo salvo.
    async salvarConteudo(campos) {
      if (!USA_BANCO) {
        const lista = store.get(CHAVE_CONTEUDOS, []);
        const agora = new Date().toISOString();
        let item = campos.id && lista.find((c) => c.id === campos.id);
        if (item) Object.assign(item, campos, { updated_at: agora });
        else { item = { etiquetas: [], links: [], ...campos, id: `teste-c-${Date.now()}`, created_at: agora, updated_at: agora }; lista.push(item); }
        store.set(CHAVE_CONTEUDOS, lista);
        return { ok: true, data: item, local: true };
      }
      try {
        const { id, ...resto } = campos;
        delete resto.created_at; delete resto.updated_at;
        const q = id ? sb.from("conteudos").update(resto).eq("id", id) : sb.from("conteudos").insert(resto);
        const { data, error } = await q.select().single();
        if (error) throw error;
        return { ok: true, data };
      } catch (e) { console.warn(e); return { ok: false, erro: e.message }; }
    },

    async apagarConteudo(c) {
      if (!USA_BANCO) {
        store.set(CHAVE_CONTEUDOS, store.get(CHAVE_CONTEUDOS, []).filter((x) => x.id !== c.id));
        return true;
      }
      try {
        const { error } = await sb.from("conteudos").delete().eq("id", c.id);
        if (error) throw error;
        if (c.miniatura_path) await sb.storage.from("conteudos").remove([c.miniatura_path]);
        return true;
      } catch (e) { console.warn(e); return false; }
    },

    // Envia a miniatura (já reduzida). No teste local vira uma imagem embutida.
    async enviarMiniatura(blob) {
      if (!USA_BANCO) {
        const url = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
        return { ok: true, path: url };
      }
      try {
        const path = `miniaturas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from("conteudos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        return { ok: true, path };
      } catch (e) { console.warn(e); return { ok: false, erro: e.message }; }
    },
    async apagarMiniatura(path) {
      if (!USA_BANCO || !path) return;
      try { await sb.storage.from("conteudos").remove([path]); } catch (_) { /* ignora */ }
    },

    // A pasta é privada: gera links temporários (1 hora) pras miniaturas
    async urlsMiniaturas(paths) {
      const mapa = {};
      const lista = Array.from(new Set(paths.filter(Boolean)));
      lista.filter((p) => p.startsWith("data:")).forEach((p) => { mapa[p] = p; });
      const remotos = lista.filter((p) => !p.startsWith("data:"));
      if (!USA_BANCO || !remotos.length) return mapa;
      try {
        const { data, error } = await sb.storage.from("conteudos").createSignedUrls(remotos, 3600);
        if (error) throw error;
        (data || []).forEach((d) => { if (d.signedUrl) mapa[d.path] = d.signedUrl; });
      } catch (e) { console.warn(e); }
      return mapa;
    },

    // ---------- Genérico (usado pela área UGC) ----------
    // listar devolve { rows, erro, semTabela }. No teste local, tudo fica no navegador.
    async listar(tabela, ordem = "created_at") {
      if (!USA_BANCO) return { rows: store.get(`teste_${tabela}`, []) };
      try {
        const { data, error } = await sb.from(tabela).select("*").order(ordem, { ascending: true }).limit(5000);
        if (error) throw error;
        return { rows: data || [] };
      } catch (e) {
        console.warn(e);
        return { rows: [], erro: e.message, semTabela: new RegExp(`${tabela}|PGRST205|42P01`).test(`${e.code} ${e.message}`) };
      }
    },
    async salvar(tabela, campos) {
      if (!USA_BANCO) {
        const chave = `teste_${tabela}`;
        const lista = store.get(chave, []);
        const agora = new Date().toISOString();
        let item = campos.id && lista.find((x) => x.id === campos.id);
        if (item) Object.assign(item, campos, { updated_at: agora });
        else { item = { ...campos, id: `teste-${tabela}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, created_at: agora, updated_at: agora }; lista.push(item); }
        try { localStorage.setItem(chave, JSON.stringify(lista)); }
        catch (_) { return { ok: false, erro: "o navegador não tem mais espaço no modo de teste" }; }
        return { ok: true, data: item, local: true };
      }
      try {
        const { id, ...resto } = campos;
        delete resto.created_at; delete resto.updated_at;
        const q = id ? sb.from(tabela).update(resto).eq("id", id) : sb.from(tabela).insert(resto);
        const { data, error } = await q.select().single();
        if (error) throw error;
        return { ok: true, data };
      } catch (e) {
        console.warn(e);
        return { ok: false, erro: e.code === "23505" ? "já existe um cadastro com esse nome" : e.message };
      }
    },
    async apagar(tabela, ids) {
      if (!ids.length) return true;
      if (!USA_BANCO) {
        store.set(`teste_${tabela}`, store.get(`teste_${tabela}`, []).filter((x) => !ids.includes(x.id)));
        return true;
      }
      try {
        const { error } = await sb.from(tabela).delete().in("id", ids);
        if (error) throw error;
        return true;
      } catch (e) { console.warn(e); return false; }
    },
    // Arquivos numa pasta privada do Storage (bucket). No teste local viram dados embutidos.
    async enviarArquivo(bucket, arquivo) {
      if (!USA_BANCO) {
        const url = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(arquivo); });
        return { ok: true, path: url };
      }
      try {
        const limpo = arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-80);
        const path = `arquivos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${limpo}`;
        const { error } = await sb.storage.from(bucket).upload(path, arquivo, { contentType: arquivo.type || "application/octet-stream" });
        if (error) throw error;
        return { ok: true, path };
      } catch (e) { console.warn(e); return { ok: false, erro: e.message }; }
    },
    async urlArquivo(bucket, path) {
      if (path.startsWith("data:")) return URL.createObjectURL(await (await fetch(path)).blob());
      if (!USA_BANCO) return "";
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 600);
      if (error) throw error;
      return data.signedUrl;
    },
    async apagarArquivos(bucket, paths) {
      const remotos = paths.filter((p) => p && !p.startsWith("data:"));
      if (!USA_BANCO || !remotos.length) return;
      try { await sb.storage.from(bucket).remove(remotos); } catch (_) { /* ignora */ }
    },

    // ---------- Documentos ----------
    // Devolve { pastas, itens, erro, semTabela } (semTabela = falta rodar o 07_documentos.sql)
    async listarDocs() {
      if (!USA_BANCO) return { pastas: store.get(CHAVE_DOC.doc_pastas, []), itens: store.get(CHAVE_DOC.doc_itens, []) };
      try {
        const [p, i] = await Promise.all([
          sb.from("doc_pastas").select("*").order("ordem").order("nome"),
          sb.from("doc_itens").select("*").order("updated_at", { ascending: false }).limit(5000),
        ]);
        if (p.error) throw p.error;
        if (i.error) throw i.error;
        return { pastas: p.data || [], itens: i.data || [] };
      } catch (e) {
        console.warn(e);
        return { pastas: [], itens: [], erro: e.message, semTabela: /doc_pastas|doc_itens|PGRST205|42P01/.test(`${e.code} ${e.message}`) };
      }
    },

    // Cria ou atualiza uma pasta (tabela "doc_pastas") ou item ("doc_itens")
    async salvarDoc(tabela, campos) {
      if (!USA_BANCO) {
        const lista = store.get(CHAVE_DOC[tabela], []);
        const agora = new Date().toISOString();
        let item = campos.id && lista.find((x) => x.id === campos.id);
        if (item) Object.assign(item, campos, { updated_at: agora });
        else { item = { ordem: 0, fixado: false, ...campos, id: `teste-${tabela}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, created_at: agora, updated_at: agora }; lista.push(item); }
        try { localStorage.setItem(CHAVE_DOC[tabela], JSON.stringify(lista)); }
        catch (_) { return { ok: false, erro: "o navegador não tem mais espaço no modo de teste" }; }
        return { ok: true, data: item, local: true };
      }
      try {
        const { id, ...resto } = campos;
        delete resto.created_at; delete resto.updated_at;
        const q = id ? sb.from(tabela).update(resto).eq("id", id) : sb.from(tabela).insert(resto);
        const { data, error } = await q.select().single();
        if (error) throw error;
        return { ok: true, data };
      } catch (e) { console.warn(e); return { ok: false, erro: e.message }; }
    },

    async apagarDocs(tabela, ids) {
      if (!ids.length) return true;
      if (!USA_BANCO) {
        store.set(CHAVE_DOC[tabela], store.get(CHAVE_DOC[tabela], []).filter((x) => !ids.includes(x.id)));
        return true;
      }
      try {
        const { error } = await sb.from(tabela).delete().in("id", ids);
        if (error) throw error;
        return true;
      } catch (e) { console.warn(e); return false; }
    },

    // Arquivos: pasta privada "documentos". No teste local viram dados embutidos.
    async enviarArquivoDoc(arquivo) {
      if (!USA_BANCO) {
        const url = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(arquivo); });
        return { ok: true, path: url };
      }
      try {
        const limpo = arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-80);
        const path = `arquivos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${limpo}`;
        const { error } = await sb.storage.from("documentos").upload(path, arquivo, { contentType: arquivo.type || "application/octet-stream" });
        if (error) throw error;
        return { ok: true, path };
      } catch (e) { console.warn(e); return { ok: false, erro: e.message }; }
    },
    async apagarArquivosDoc(paths) {
      const remotos = paths.filter((p) => p && !p.startsWith("data:"));
      if (!USA_BANCO || !remotos.length) return;
      try { await sb.storage.from("documentos").remove(remotos); } catch (_) { /* ignora */ }
    },
    // Link temporário pra abrir um arquivo (no teste local, um link do próprio navegador)
    async urlArquivoDoc(path) {
      if (path.startsWith("data:")) {
        const blob = await (await fetch(path)).blob();
        return URL.createObjectURL(blob);
      }
      if (!USA_BANCO) return "";
      const { data, error } = await sb.storage.from("documentos").createSignedUrl(path, 600);
      if (error) throw error;
      return data.signedUrl;
    },
    // Links temporários (1 hora) pras miniaturas das imagens
    async urlsArquivosDoc(paths) {
      const mapa = {};
      paths.filter((p) => p && p.startsWith("data:")).forEach((p) => { mapa[p] = p; });
      const remotos = paths.filter((p) => p && !p.startsWith("data:"));
      if (!USA_BANCO || !remotos.length) return mapa;
      try {
        const { data, error } = await sb.storage.from("documentos").createSignedUrls(remotos, 3600);
        if (error) throw error;
        (data || []).forEach((d) => { if (d.signedUrl) mapa[d.path] = d.signedUrl; });
      } catch (e) { console.warn(e); }
      return mapa;
    },

    // Edge Functions (só no ar, com login)
    // Sempre devolve um objeto; se falhar, vem { connected: false, erro: "motivo" }
    async funcao(nome) {
      if (!USA_BANCO) return { connected: false };
      try {
        const { data, error } = await sb.functions.invoke(nome);
        if (error) {
          let msg = error.message;
          try { const j = await error.context.json(); msg = j.erro || msg; } catch (_) { /* sem corpo */ }
          console.warn(`${nome}:`, msg);
          return { connected: false, erro: msg };
        }
        return data || { connected: false };
      } catch (e) { console.warn(`${nome}:`, e); return { connected: false, erro: String(e && e.message || e) }; }
    },
    async insights() { return api.funcao("ig-insights"); },
    async posts() { return { posts: [], ...(await api.funcao("ig-media")) }; },

    // Biblioteca de arquivos
    async listarArquivos() {
      if (!USA_BANCO) return store.get(CHAVE_ARQS, []);
      try {
        const { data, error } = await sb.from("ig_assets").select("*").order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        return data || [];
      } catch (e) { console.warn(e); return []; }
    },
    async adicionarArquivo({ nome, tipo, url, file }) {
      if (!USA_BANCO) {
        const lista = store.get(CHAVE_ARQS, []);
        const item = { id: `teste-arq-${Date.now()}`, nome, tipo, public_url: url, created_at: new Date().toISOString() };
        lista.unshift(item);
        store.set(CHAVE_ARQS, lista);
        return { ok: true, data: item };
      }
      try {
        let publicUrl = url;
        let tamanho = null;
        if (file) {
          const caminho = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
          const up = await sb.storage.from("ig-assets").upload(caminho, file, { upsert: false });
          if (up.error) throw up.error;
          publicUrl = sb.storage.from("ig-assets").getPublicUrl(caminho).data.publicUrl;
          tamanho = file.size;
        }
        const { data, error } = await sb.from("ig_assets").insert({ nome, tipo, public_url: publicUrl, size_bytes: tamanho }).select().single();
        if (error) throw error;
        return { ok: true, data };
      } catch (e) { console.warn(e); return { ok: false, erro: e.message }; }
    },
  };

  // ===================================================================
  // 3. LOGIN
  // ===================================================================
  async function iniciar() {
    pintarIcones();
    $("#menu-toggle").innerHTML = ICON.menu;

    if (LOCAL) {
      $("#login-aviso").hidden = false;
      const salvo = store.get("login_local", null);
      if (salvo && salvo.email) return entrarNoApp(salvo.email);
      return mostrarLogin();
    }

    if (!sb) return mostrarLogin();
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session) entrarNoApp(data.session.user.email);
      else mostrarLogin();
    } catch (_) { mostrarLogin(); }

    // Sessão expirou ou saiu em outra aba: volta pro login
    sb.auth.onAuthStateChange((evento, sessao) => {
      if (!sessao && !$("#app").hidden) mostrarLogin();
    });
  }

  function mostrarLogin() {
    fecharEditor(true);
    $("#app").hidden = true;
    $("#tela-login").hidden = false;
    $("#login-senha").value = "";
    setTimeout(() => $("#login-email").focus(), 50);
  }

  function erroLogin(msg) {
    const el = $("#login-erro");
    el.textContent = msg;
    el.hidden = !msg;
  }

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#login-email").value.trim();
    const senha = $("#login-senha").value;
    erroLogin("");

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return erroLogin("Digite um e-mail válido.");

    // Modo teste local: senha de 5 dígitos entra direto (NÃO é segurança, só teste)
    if (LOCAL) {
      if (!/^\d{5}$/.test(senha)) return erroLogin("No modo de teste local, a senha precisa ter 5 dígitos (só números).");
      store.set("login_local", { email });
      return entrarNoApp(email);
    }

    // Produção: Supabase Auth
    if (!sb) return erroLogin("O sistema ainda não foi configurado. Siga o LEIA-ME pra ligar o Supabase.");
    const btn = $("#btn-entrar");
    btn.disabled = true; btn.textContent = "Entrando...";
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error || !data.session) throw error || new Error("sem sessão");
      entrarNoApp(data.session.user.email);
    } catch (err) {
      console.warn(err);
      const msg = String(err && err.message || "");
      erroLogin(/fetch|network/i.test(msg) ? "Não foi possível conectar. Confira sua internet e tente de novo." : "E-mail ou senha incorretos.");
    } finally {
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });

  $("#btn-sair").addEventListener("click", async () => {
    if (ED.aberto && !(await fecharEditor())) return;
    if (LOCAL) store.del("login_local");
    else if (sb) { try { await sb.auth.signOut(); } catch (_) { /* ignora */ } }
    mostrarLogin();
  });

  function entrarNoApp(email) {
    $("#tela-login").hidden = true;
    $("#app").hidden = false;
    $("#usuario-email").textContent = email || "";
    $("#aviso-local").hidden = !LOCAL;
    if (!location.hash || location.hash === "#") location.hash = "#/inicio";
    else rotear();
  }

  // ===================================================================
  // 4. MENU E ROTAS (#/inicio, #/calendario, #/instagram/metricas ...)
  // ===================================================================
  $("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("aberto"));

  window.addEventListener("hashchange", rotear);

  function rotear() {
    if ($("#app").hidden) return;
    const partes = location.hash.replace(/^#\/?/, "").split("/");
    const rota = partes[0] || "inicio";
    $$(".menu a").forEach((a) => a.classList.toggle("ativo", a.dataset.rota === rota));
    $("#sidebar").classList.remove("aberto");
    window.scrollTo(0, 0);
    if (rota === "calendario") return telaCalendario(partes[1] || "quadro");
    if (rota === "documentos") return telaDocumentos(partes[1] || null);
    if (rota === "ugc") return telaUgc(partes[1] || "prospeccao");
    if (rota === "instagram") return telaInstagram(partes[1] || "metricas");
    return telaInicio();
  }

  const conteudo = () => $("#conteudo");

  // ===================================================================
  // 5. TELAS
  // ===================================================================

  // ---------- Início ----------
  async function telaInicio() {
    conteudo().innerHTML = `
      <div class="cabecalho">
        <div>
          <p class="sobretitulo">Início</p>
          <h1>Olá, que bom te ver por aqui</h1>
          <p class="muted">Uma visão rápida de como estão suas automações.</p>
        </div>
      </div>
      <div class="grade grade-3">
        ${kpi("usuarios", "Leads captados", "kpi-leads", "pessoas que interagiram")}
        ${kpi("raio", "Automações ativas", "kpi-ativas", "respondendo agora")}
        ${kpi("enviar", "DMs enviadas", "kpi-dms", "nos últimos 7 dias")}
      </div>
      <h2 class="secao-titulo">Agenda dos próximos 7 dias</h2>
      <div class="cartao" id="inicio-agenda"><p class="muted">Carregando...</p></div>
      <h2 class="secao-titulo">Atalhos</h2>
      <div class="atalhos">
        <a class="btn btn-primario" href="#/instagram/automacoes">${ICON.raio} Criar ou editar automações</a>
        <a class="btn" href="#/instagram/metricas">${ICON.grafico} Ver métricas do Instagram</a>
        <a class="btn" href="#/calendario">${ICON.calendario} Calendário</a>
        <a class="btn" href="#/documentos">${ICON.pasta} Documentos</a>
      </div>`;
    agendaInicio();
    const c = await api.contagens();
    if (!$("#kpi-leads")) return; // trocou de tela enquanto carregava
    $("#kpi-leads").textContent = fmtNum(c.leads);
    $("#kpi-ativas").textContent = fmtNum(c.ativas);
    $("#kpi-dms").textContent = fmtNum(c.dms7);
  }

  // O que gravar, editar e postar nos próximos 7 dias (e o que está atrasado)
  async function agendaInicio() {
    const r = await api.listarConteudos();
    const alvo = $("#inicio-agenda");
    if (!alvo) return;
    const h = hoje();
    const limite = dataISO(new Date(Date.now() + 7 * 864e5));
    const itens = [];
    r.rows.forEach((c) => prazos(c).forEach((p) => {
      if (p.cor === "vermelho" || (p.cor === "amarelo" && p.data <= limite)) itens.push({ c, p });
    }));
    itens.sort((a, b) => (a.p.data < b.p.data ? -1 : a.p.data > b.p.data ? 1 : 0));
    if (!itens.length) {
      alvo.innerHTML = `<p class="muted" style="margin:0">${r.semTabela ? "O calendário ainda não foi ativado no banco (veja o LEIA-ME)." : "Nada pra gravar, editar ou postar nos próximos dias."} <a href="#/calendario">Abrir o calendário</a></p>`;
      return;
    }
    const amanha = dataISO(new Date(Date.now() + 864e5));
    const quando = (d) => (d < h ? "Atrasado" : d === h ? "Hoje" : d === amanha ? "Amanhã" : new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }));
    alvo.innerHTML = `<ul class="agenda-inicio">${itens.slice(0, 8).map(({ c, p }) => `
      <li><a href="#/calendario/mes" class="cor-${p.cor}">
        <span class="quando">${esc(quando(p.data))}</span>
        <span class="prazo cor-${p.cor}"><i></i>${p.t}</span>
        <span class="oque">${esc(c.titulo)}${COM_MARCA.includes(c.categoria) && c.marca ? ` <span class="sub">· ${esc(c.marca)}</span>` : ""}</span>
      </a></li>`).join("")}</ul>
      ${itens.length > 8 ? `<p class="muted" style="margin:10px 0 0;font-size:13px">E mais ${itens.length - 8}. <a href="#/calendario/mes">Ver tudo</a></p>` : ""}`;
  }

  function kpi(icone, titulo, id, sub) {
    return `<div class="cartao kpi">
      <span class="rotulo">${esc(titulo)}</span>
      <div class="valor" id="${id}">0</div>
      <div class="sub">${esc(sub)}</div>
    </div>`;
  }

  // ===================================================================
  // CALENDÁRIO DE CONTEÚDO
  // Quadro (Para criar > Para postar > Postados), visão do mês e a ficha
  // de cada conteúdo. Desempenho e Ideias chegam na fase 2.
  // Cores: verde = feito, amarelo = a fazer, vermelho = atrasado.
  // ===================================================================
  const TIPOS = { reels: "Reels / vídeo", carrossel: "Carrossel", foto: "Foto", story: "Story" };
  const TIPO_ICONE = { reels: "video", carrossel: "carrossel", foto: "foto", story: "story" };
  const iconeTipo = (tipo) => `<span class="ic-tipo" aria-hidden="true">${ICON[TIPO_ICONE[tipo]] || ""}</span>`;
  const CATEGORIAS = { pessoal: "Pessoal", publi: "Publi", ugc: "UGC", mentora: "Mentora" };
  const COM_MARCA = ["publi", "ugc"]; // categorias feitas pra uma marca (mostra o campo Marca)
  const ETAPAS = [
    { s: "criar", t: "Para criar" },
    { s: "postar", t: "Para postar" },
    { s: "postado", t: "Postados" },
  ];
  const CAL = {
    sub: "quadro", lista: [], urls: {}, urlsEm: 0, mes: null, semTabela: false, erro: "",
    filtro: { busca: "", tipo: "", categoria: "", etiqueta: "" },
    soltou: false,
  };

  const pad2 = (n) => String(n).padStart(2, "0");
  const dataISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const hoje = () => dataISO(new Date());
  const diaMes = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

  function corPrazo(data, feito) {
    if (feito) return "verde";
    if (!data) return "neutro";
    return data < hoje() ? "vermelho" : "amarelo";
  }
  // Os prazos de um conteúdo (gravar, editar, postar), cada um com sua cor
  function prazos(c) {
    const postado = c.status === "postado";
    return [
      { k: "gravar", t: "Gravar", data: c.data_gravar, cor: corPrazo(c.data_gravar, c.gravado || postado) },
      { k: "editar", t: "Editar", data: c.data_editar, cor: corPrazo(c.data_editar, c.editado || postado) },
      { k: "postar", t: postado ? "Postado" : "Postar", data: c.data_postagem, cor: corPrazo(c.data_postagem, postado) },
    ].filter((p) => p.data);
  }
  function corGeral(c) {
    if (c.status === "postado") return "verde";
    const ps = prazos(c);
    if (ps.some((p) => p.cor === "vermelho")) return "vermelho";
    return ps.some((p) => p.cor === "amarelo") ? "amarelo" : "neutro";
  }

  async function carregarConteudos() {
    const r = await api.listarConteudos();
    CAL.lista = r.rows;
    CAL.semTabela = !!r.semTabela;
    CAL.erro = r.semTabela ? "" : r.erro || "";
    // links temporários das miniaturas (renova a cada 50 minutos)
    if (Date.now() - CAL.urlsEm > 50 * 60 * 1000) { CAL.urls = {}; CAL.urlsEm = Date.now(); }
    const faltam = CAL.lista.map((c) => c.miniatura_path).filter((p) => p && !CAL.urls[p]);
    if (faltam.length) Object.assign(CAL.urls, await api.urlsMiniaturas(faltam));
  }

  async function telaCalendario(sub) {
    if (!["quadro", "mes", "desempenho", "ideias"].includes(sub)) sub = "quadro";
    CAL.sub = sub;
    if (!CAL.mes) { const d = new Date(); CAL.mes = new Date(d.getFullYear(), d.getMonth(), 1); }
    conteudo().innerHTML = `
      <div class="cabecalho">
        <div>
          <p class="sobretitulo">Planejamento</p>
          <h1>Calendário</h1>
          <p class="muted">Do roteiro ao post: o que gravar, editar e postar.</p>
        </div>
        <button class="btn btn-primario" id="cal-novo">${ICON.mais} Novo conteúdo</button>
      </div>
      <nav class="abas">
        ${[["quadro", "Quadro"], ["mes", "Calendário"], ["desempenho", "Desempenho"], ["ideias", "Ideias"]]
          .map(([k, t]) => `<a href="#/calendario/${k}" class="${sub === k ? "ativo" : ""}">${t}</a>`).join("")}
      </nav>
      <div id="cal-conteudo"><p class="muted">Carregando...</p></div>`;
    $("#cal-novo").addEventListener("click", () => abrirConteudo(null, { status: "criar" }));
    if (sub === "desempenho" || sub === "ideias") return telaFase2(sub);
    await carregarConteudos();
    if (!$("#cal-conteudo") || CAL.sub !== sub) return; // trocou de tela enquanto carregava
    desenharCal();
  }

  // Monta aviso + filtros + área (quadro ou mês) e liga os eventos
  function desenharCal() {
    const alvo = $("#cal-conteudo");
    if (!alvo) return;
    alvo.innerHTML = `
      ${CAL.semTabela ? `<p class="alerta" style="margin:0 0 14px">Pra salvar seus conteúdos, rode o script <b>06_calendario.sql</b> no Supabase (veja o LEIA-ME).</p>` : ""}
      ${CAL.erro ? `<p class="erro">Não foi possível carregar: ${esc(CAL.erro)}</p>` : ""}
      ${barraFiltros()}
      <div id="cal-area"></div>`;
    desenharArea();

    const area = $("#cal-area");
    // (propriedades em vez de addEventListener: redesenhar não acumula eventos)
    alvo.oninput = (e) => {
      if (e.target.id === "cf-busca") { CAL.filtro.busca = e.target.value; desenharArea(); }
    };
    alvo.onchange = (e) => {
      const k = { "cf-tipo": "tipo", "cf-categoria": "categoria", "cf-etiqueta": "etiqueta" }[e.target.id];
      if (k) { CAL.filtro[k] = e.target.value; desenharArea(); }
    };
    area.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mover],[data-novo],[data-abrir],[data-mes],.card-conteudo");
      if (!b) return;
      if (b.dataset.mover) return moverConteudo(b.closest(".card-conteudo").dataset.id, b.dataset.mover);
      if (b.dataset.novo) return abrirConteudo(null, { status: b.dataset.novo });
      if (b.dataset.mes !== undefined) {
        const n = Number(b.dataset.mes);
        const d = new Date();
        CAL.mes = n === 0 ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(CAL.mes.getFullYear(), CAL.mes.getMonth() + n, 1);
        return desenharArea();
      }
      const id = b.dataset.abrir || b.dataset.id;
      const c = CAL.lista.find((x) => x.id === id);
      if (c) abrirConteudo(c);
    });
    area.addEventListener("keydown", (e) => {
      const card = e.target.closest(".card-conteudo");
      if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        const c = CAL.lista.find((x) => x.id === card.dataset.id);
        if (c) abrirConteudo(c);
      }
    });

    // Arrastar e soltar (computador). No celular use os botões ‹ › do card.
    area.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".card-conteudo");
      if (!card) return;
      CAL.soltou = false;
      CAL.arrastando = card.dataset.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.id);
      setTimeout(() => card.classList.add("arrastando"), 0); // depois, pra imagem do arraste sair normal
    });
    const cardArrastado = () => CAL.arrastando && area.querySelector(`.card-conteudo[data-id="${CSS.escape(CAL.arrastando)}"]`);
    area.addEventListener("dragover", (e) => {
      const lista = e.target.closest(".coluna") && e.target.closest(".coluna").querySelector(".coluna-lista");
      const card = cardArrastado();
      if (!lista || !card) return;
      e.preventDefault();
      $$(".coluna-lista.alvo").forEach((l) => l !== lista && l.classList.remove("alvo"));
      lista.classList.add("alvo");
      const depois = [...lista.querySelectorAll(".card-conteudo")].filter((c) => c !== card)
        .find((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (depois) lista.insertBefore(card, depois); else lista.appendChild(card);
    });
    area.addEventListener("drop", (e) => {
      const card = cardArrastado();
      const lista = card && card.closest(".coluna-lista");
      if (!lista) return;
      e.preventDefault();
      CAL.soltou = true;
      const ids = [...lista.querySelectorAll(".card-conteudo")].map((x) => x.dataset.id);
      const i = ids.indexOf(card.dataset.id);
      const ord = (id) => (CAL.lista.find((x) => x.id === id) || {}).ordem || 0;
      const ant = ids[i - 1], prox = ids[i + 1];
      const ordem = ant && prox ? (ord(ant) + ord(prox)) / 2 : ant ? ord(ant) + 1 : prox ? ord(prox) - 1 : 0;
      moverConteudo(card.dataset.id, lista.dataset.status, ordem);
    });
    area.addEventListener("dragend", () => {
      $$(".coluna-lista.alvo").forEach((l) => l.classList.remove("alvo"));
      const c = cardArrastado();
      if (c) c.classList.remove("arrastando");
      CAL.arrastando = null;
      if (!CAL.soltou) desenharArea(); // soltou fora: volta como estava
    });
  }

  function desenharArea() {
    const area = $("#cal-area");
    if (!area) return;
    area.innerHTML = CAL.sub === "mes" ? htmlMes() : htmlQuadro();
  }

  function filtrados() {
    const f = CAL.filtro;
    const b = normal(f.busca).trim();
    return CAL.lista.filter((c) =>
      (!b || [c.titulo, c.marca, c.legenda, ...(c.etiquetas || [])].some((v) => normal(v).includes(b))) &&
      (!f.tipo || c.tipo === f.tipo) &&
      (!f.categoria || c.categoria === f.categoria) &&
      (!f.etiqueta || (c.etiquetas || []).includes(f.etiqueta)));
  }
  const etiquetasConteudo = () => Array.from(new Set(CAL.lista.flatMap((c) => c.etiquetas || []))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  function barraFiltros() {
    const f = CAL.filtro;
    const etqs = etiquetasConteudo();
    if (f.etiqueta && !etqs.includes(f.etiqueta)) f.etiqueta = "";
    return `<div class="ferramentas">
      <input type="search" id="cf-busca" placeholder="Buscar título, marca, legenda" value="${esc(f.busca)}" aria-label="Buscar conteúdos">
      <select id="cf-tipo" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option>
        ${Object.entries(TIPOS).map(([v, t]) => `<option value="${v}" ${f.tipo === v ? "selected" : ""}>${t}</option>`).join("")}</select>
      <select id="cf-categoria" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>
        ${Object.entries(CATEGORIAS).map(([v, t]) => `<option value="${v}" ${f.categoria === v ? "selected" : ""}>Só ${t.toLowerCase() === "ugc" ? "UGC" : t.toLowerCase()}</option>`).join("")}</select>
      <select id="cf-etiqueta" aria-label="Filtrar por etiqueta"><option value="">Todas as etiquetas</option>
        ${etqs.map((t) => `<option value="${esc(t)}" ${f.etiqueta === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
    </div>`;
  }

  // ---------- Quadro ----------
  function htmlQuadro() {
    const lista = filtrados();
    return `<div class="quadro">${ETAPAS.map((e, i) => {
      const cards = lista.filter((c) => c.status === e.s).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      return `<section class="coluna coluna-${e.s}" aria-label="${e.t}">
        <header class="coluna-cab"><h3>${e.t}</h3><span class="contagem">${cards.length}</span></header>
        <div class="coluna-lista" data-status="${e.s}">
          ${cards.map((c) => htmlCard(c, i)).join("") || `<p class="coluna-vazia">${i === 0 ? "Suas ideias e roteiros começam aqui" : "Arraste um card pra cá"}</p>`}
        </div>
        <button type="button" class="btn btn-fantasma btn-pequeno coluna-add" data-novo="${e.s}">${ICON.mais} Adicionar</button>
      </section>`;
    }).join("")}</div>`;
  }

  function htmlCard(c, i) {
    const thumb = c.miniatura_path && CAL.urls[c.miniatura_path];
    const ant = ETAPAS[i - 1], prox = ETAPAS[i + 1];
    const ps = prazos(c);
    return `<article class="card-conteudo cor-${corGeral(c)}" draggable="true" data-id="${esc(c.id)}" tabindex="0" aria-label="${esc(c.titulo)}, abrir">
      ${thumb ? `<img class="card-thumb" src="${esc(thumb)}" alt="" loading="lazy">` : ""}
      <div class="card-corpo">
        <div class="card-selos">
          <span class="selo-tipo">${iconeTipo(c.tipo)}${esc(TIPOS[c.tipo] || c.tipo || "")}</span>
          ${c.categoria && c.categoria !== "pessoal" ? `<span class="selo-cat cat-${esc(c.categoria)}">${esc(CATEGORIAS[c.categoria] || c.categoria)}${COM_MARCA.includes(c.categoria) && c.marca ? " · " + esc(c.marca) : ""}</span>` : ""}
        </div>
        <h4>${esc(c.titulo)}</h4>
        ${ps.length ? `<div class="card-prazos">${ps.map((p) => `<span class="prazo cor-${p.cor}"><i></i>${p.t} ${diaMes(p.data)}</span>`).join("")}</div>` : ""}
        ${chips(c.etiquetas, 3)}
        <div class="card-mover">
          ${ant ? `<button type="button" class="btn-icone" data-mover="${ant.s}" aria-label="Mover para ${ant.t}" title="Mover para ${ant.t}">${ICON.voltar}</button>` : ""}
          ${prox ? `<button type="button" class="btn-icone" data-mover="${prox.s}" aria-label="Mover para ${prox.t}" title="Mover para ${prox.t}">${ICON.avancar}</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  // Muda a etapa (e a posição) de um card. Atualiza a tela na hora e salva.
  async function moverConteudo(id, status, ordem) {
    const c = CAL.lista.find((x) => x.id === id);
    if (!c) return;
    if (ordem === undefined) {
      const na = CAL.lista.filter((x) => x.status === status && x.id !== id);
      ordem = na.length ? Math.max(...na.map((x) => x.ordem || 0)) + 1 : 0;
    }
    const campos = { id, status, ordem };
    if (status === "postado" && !c.data_postagem) campos.data_postagem = hoje();
    const antes = { ...c };
    Object.assign(c, campos);
    desenharArea();
    const r = await api.salvarConteudo(campos);
    if (!r.ok) {
      Object.assign(c, antes);
      desenharArea();
      return toast("Não foi possível mover: " + (r.erro || ""), "erro", 5000);
    }
    if (status === "postado" && antes.status !== "postado") {
      toast(c.link_post ? "Postado! 🎉" : "Postado! 🎉 Quando puder, cole o link do post no card.", "ok", 4500);
    }
  }

  // ---------- Visão do mês ----------
  function htmlMes() {
    const lista = filtrados();
    const ano = CAL.mes.getFullYear(), mes = CAL.mes.getMonth();
    const dias = new Date(ano, mes + 1, 0).getDate();
    const inicio = new Date(ano, mes, 1).getDay(); // 0 = domingo
    const prefixo = `${ano}-${pad2(mes + 1)}`;
    const ordemK = { gravar: 0, editar: 1, postar: 2 };
    const porDia = {};
    lista.forEach((c) => prazos(c).forEach((p) => { (porDia[p.data] = porDia[p.data] || []).push({ c, p }); }));
    Object.values(porDia).forEach((evs) => evs.sort((a, b) => ordemK[a.p.k] - ordemK[b.p.k]));
    // bolinha = status (cor), ícone = tipo (vídeo, foto, carrossel, story)
    const evento = ({ c, p }) => `<button type="button" class="evento cor-${p.cor}" data-abrir="${esc(c.id)}" title="${esc(`${p.t}: ${c.titulo} (${TIPOS[c.tipo] || c.tipo})`)}"><i></i>${iconeTipo(c.tipo)}<b>${p.t}</b> ${esc(c.titulo)}</button>`;

    let celulas = "";
    for (let i = 0; i < inicio; i++) celulas += `<div class="dia fora"></div>`;
    for (let d = 1; d <= dias; d++) {
      const iso = `${prefixo}-${pad2(d)}`;
      const evs = porDia[iso] || [];
      celulas += `<div class="dia ${iso === hoje() ? "hoje" : ""}"><span class="dia-num">${d}</span>
        ${evs.slice(0, 4).map(evento).join("")}${evs.length > 4 ? `<span class="mais">+${evs.length - 4} no dia</span>` : ""}</div>`;
    }

    // No celular a grade vira uma agenda (só os dias com algo marcado)
    const diasCom = Object.keys(porDia).filter((k) => k.startsWith(prefixo)).sort();
    const agenda = diasCom.length
      ? diasCom.map((k) => {
        const nome = new Date(k + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
        return `<div class="agenda-dia ${k === hoje() ? "hoje" : ""}"><h4>${esc(nome.charAt(0).toUpperCase() + nome.slice(1))}</h4>${porDia[k].map(evento).join("")}</div>`;
      }).join("")
      : `<p class="muted">Nada marcado neste mês.</p>`;
    const semData = lista.filter((c) => c.status !== "postado" && !prazos(c).length);
    const titulo = new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    return `
      <div class="mes-nav">
        <button type="button" class="btn-icone" data-mes="-1" aria-label="Mês anterior">${ICON.voltar}</button>
        <h2>${esc(titulo.charAt(0).toUpperCase() + titulo.slice(1))}</h2>
        <button type="button" class="btn-icone" data-mes="1" aria-label="Próximo mês">${ICON.avancar}</button>
        <button type="button" class="btn btn-pequeno" data-mes="0">Hoje</button>
        <span class="espaco"></span>
        <span class="legenda"><span class="prazo cor-verde"><i></i>Feito</span><span class="prazo cor-amarelo"><i></i>A fazer</span><span class="prazo cor-vermelho"><i></i>Atrasado</span></span>
      </div>
      <div class="mes-grade">${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => `<div class="dia-semana">${d}</div>`).join("")}${celulas}</div>
      <div class="agenda">${agenda}</div>
      ${semData.length ? `<h3 class="secao-titulo">Sem data definida</h3><div class="sem-data">${semData.map((c) => `<button type="button" class="evento cor-neutro" data-abrir="${esc(c.id)}"><i></i>${iconeTipo(c.tipo)}${esc(c.titulo)}</button>`).join("")}</div>` : ""}`;
  }

  // ---------- Desempenho e Ideias (fase 2) ----------
  function telaFase2(sub) {
    const info = sub === "desempenho"
      ? { t: "Desempenho", i: ICON.grafico, p: "Aqui vão aparecer os resultados dos seus posts (curtidas, comentários, alcance, salvamentos e compartilhamentos) e a área \"O que está funcionando\", que compara tipos, categorias e etiquetas pra te dar ideias do que postar." }
      : { t: "Ideias de conteúdo", i: ICON.chat, p: "Aqui vão aparecer as perguntas que as pessoas fazem nos comentários dos seus posts e o seu banco de ideias. Com um clique, uma ideia vira um card no Quadro." };
    $("#cal-conteudo").innerHTML = `<div class="cartao vazio em-breve">
      <div class="icone-grande">${info.i}</div><h2>${info.t}</h2><p>${info.p}</p><span class="selo off">Chega na fase 2</span></div>`;
  }

  // ---------- Reduz a imagem antes de enviar (miniatura leve) ----------
  async function reduzirImagem(arquivo, max = 720) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * escala);
      cv.height = Math.round(img.height * escala);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      return await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.82));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------- Ficha do conteúdo (criar e editar) ----------
  function abrirConteudo(c, padrao = {}) {
    const novo = !c;
    const ed = {
      titulo: "", status: "criar", tipo: "reels", categoria: "pessoal", marca: "", gravado: false, editado: false,
      ...(c || {}), ...padrao,
    };
    ed.etiquetas = [...(ed.etiquetas || [])];
    ed.links = (ed.links || []).map((l) => ({ rotulo: l.rotulo || "", url: l.url || "" }));
    let mediaId = ed.ig_media_id || null;
    let novaMini = null;                       // imagem nova (já reduzida)
    let removerMini = false;
    let miniPreview = (ed.miniatura_path && CAL.urls[ed.miniatura_path]) || "";
    let sujo = false;

    const opcoes = (mapa, atual) => Object.entries(mapa).map(([v, t]) => `<option value="${v}" ${atual === v ? "selected" : ""}>${t}</option>`).join("");
    const miniHtml = () => miniPreview ? `<img src="${esc(miniPreview)}" alt="Miniatura do post">` : `<span class="muted">${ICON.arquivo} Sem imagem</span>`;
    const linksHtml = () => ed.links.length
      ? ed.links.map((l, i) => `<div class="link-linha">
          <input type="text" data-l="${i}" data-c="rotulo" value="${esc(l.rotulo)}" placeholder="Ex: Vídeo bruto" aria-label="Nome do link ${i + 1}">
          <input type="url" data-l="${i}" data-c="url" value="${esc(l.url)}" placeholder="https://..." aria-label="Endereço do link ${i + 1}">
          <button type="button" class="btn-icone" data-link-abrir="${i}" aria-label="Abrir link ${i + 1}" title="Abrir">${ICON.link}</button>
          <button type="button" class="btn-icone" data-link-del="${i}" aria-label="Remover link ${i + 1}" title="Remover">${ICON.x}</button>
        </div>`).join("")
      : `<p class="muted" style="font-size:13px;margin:0 0 6px">Nenhum link ainda.</p>`;
    const tagsHtml = () => ed.etiquetas.map((t, i) => `<span class="chip">${esc(t)}<button type="button" data-tag-del="${i}" aria-label="Remover ${esc(t)}">×</button></span>`).join("");
    const contaLegenda = () => {
      const t = ($("#ce-legenda") || {}).value || "";
      const tags = (t.match(/#[\p{L}\p{N}_]+/gu) || []).length;
      const el = $("#ce-leg-cont");
      if (el) { el.textContent = `${t.length}/2200 · ${tags} hashtag${tags === 1 ? "" : "s"}`; el.classList.toggle("cheio", t.length > 2200 || tags > 30); }
    };

    abrirModal(`
      <div class="modal-cab"><h2>${novo ? "Novo conteúdo" : "Editar conteúdo"}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <label class="campo"><span class="rotulo">Título</span>
        <input type="text" id="ce-titulo" value="${esc(ed.titulo)}" placeholder="Ex: Rotina de skincare da manhã" maxlength="120"></label>
      <div class="grade grade-3">
        <label class="campo"><span class="rotulo">Tipo</span><select id="ce-tipo">${opcoes(TIPOS, ed.tipo)}</select></label>
        <label class="campo"><span class="rotulo">Categoria</span><select id="ce-categoria">${opcoes({ pessoal: "Pessoal", publi: "Publi (marca)", ugc: "UGC (marca)", mentora: "Mentora" }, ed.categoria)}</select></label>
        <label class="campo"><span class="rotulo">Etapa</span><select id="ce-status">${opcoes(Object.fromEntries(ETAPAS.map((e) => [e.s, e.t])), ed.status)}</select></label>
      </div>
      <label class="campo" id="ce-marca-campo" ${COM_MARCA.includes(ed.categoria) ? "" : "hidden"}><span class="rotulo">Marca</span>
        <input type="text" id="ce-marca" value="${esc(ed.marca || "")}" placeholder="Nome da marca"></label>

      <span class="rotulo">Datas</span>
      <div class="grade grade-3 ce-datas">
        <div class="campo"><label for="ce-gravar" class="sub-rotulo">Gravar</label><input type="date" id="ce-gravar" value="${esc(ed.data_gravar || "")}">
          <label class="check"><input type="checkbox" id="ce-gravado" ${ed.gravado ? "checked" : ""}> Gravado</label></div>
        <div class="campo"><label for="ce-editar" class="sub-rotulo">Editar</label><input type="date" id="ce-editar" value="${esc(ed.data_editar || "")}">
          <label class="check"><input type="checkbox" id="ce-editado" ${ed.editado ? "checked" : ""}> Editado</label></div>
        <div class="campo"><label for="ce-postar" class="sub-rotulo">Postar</label><input type="date" id="ce-postar" value="${esc(ed.data_postagem || "")}"></div>
      </div>

      <div class="grade grade-2">
        <div class="campo">
          <span class="rotulo">Miniatura</span>
          <div class="mini-caixa" id="ce-mini">${miniHtml()}</div>
          <input type="file" id="ce-mini-arquivo" accept="image/jpeg,image/png,image/webp" hidden>
          <div class="linha-btns">
            <button type="button" class="btn btn-pequeno" data-mini="escolher">Escolher imagem</button>
            <button type="button" class="btn btn-fantasma btn-pequeno" data-mini="remover" id="ce-mini-remover" ${miniPreview ? "" : "hidden"}>Remover</button>
          </div>
          <p class="ajuda">Só pra você reconhecer o post. A imagem é reduzida antes de enviar.</p>
        </div>
        <div class="campo">
          <span class="rotulo">Links das mídias</span>
          <div id="ce-links">${linksHtml()}</div>
          <button type="button" class="btn btn-fantasma btn-pequeno" data-link-add>${ICON.mais} Adicionar link</button>
          <p class="ajuda">Vídeo bruto, edição, cards do carrossel (Google Drive, Dropbox...).</p>
        </div>
      </div>

      <div class="campo">
        <div class="linha-topo"><label for="ce-legenda" class="rotulo">Legenda</label><span class="contador" id="ce-leg-cont"></span></div>
        <textarea id="ce-legenda" rows="5" placeholder="Escreva a legenda do post...">${esc(ed.legenda || "")}</textarea>
      </div>

      <div class="campo">
        <span class="rotulo">Etiquetas</span>
        <div class="tags-box">
          <span id="ce-tags" style="display:contents">${tagsHtml()}</span>
          <input type="text" id="ce-tag-input" list="ce-tag-sug" placeholder="Digite e aperte Enter (ex: rotina, bastidores)" aria-label="Nova etiqueta">
        </div>
        <datalist id="ce-tag-sug">${etiquetasConteudo().map((t) => `<option value="${esc(t)}">`).join("")}</datalist>
      </div>

      <div class="campo">
        <label for="ce-link-post" class="rotulo">Link do post publicado</label>
        <div class="linha">
          <input type="url" id="ce-link-post" value="${esc(ed.link_post || "")}" placeholder="https://www.instagram.com/p/...">
          <button type="button" class="btn btn-pequeno" data-escolher-post>Escolher dos meus posts</button>
        </div>
        <div id="ce-posts" hidden></div>
        <p class="ajuda">Na fase 2, o painel usa esse link pra trazer curtidas, alcance e salvamentos.</p>
      </div>

      <label class="campo"><span class="rotulo">Anotações</span>
        <textarea id="ce-notas" rows="3" placeholder="Roteiro, referências, combinados com a marca...">${esc(ed.notas || "")}</textarea></label>

      <div class="modal-rodape" style="justify-content:space-between">
        ${novo ? "<span></span>" : `<button type="button" class="btn btn-perigo" data-apagar>${ICON.lixo} Excluir</button>`}
        <span style="display:flex;gap:8px"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primario" data-salvar>Salvar</button></span>
      </div>`, aoClicar, "largo", () => !sujo || confirm("Você tem alterações não salvas. Fechar mesmo assim?"));

    contaLegenda();
    if (novo) setTimeout(() => { const t = $("#ce-titulo"); if (t) t.focus(); }, 50);

    const m = $("#modal");
    m.oninput = (e) => {
      sujo = true;
      const t = e.target;
      if (t.dataset.l !== undefined) ed.links[+t.dataset.l][t.dataset.c] = t.value;
      if (t.id === "ce-legenda") contaLegenda();
      if (t.id === "ce-link-post") mediaId = null; // link digitado à mão: o id do post é descoberto na fase 2
    };
    m.onchange = async (e) => {
      sujo = true;
      const t = e.target;
      if (t.id === "ce-categoria") $("#ce-marca-campo").hidden = !COM_MARCA.includes(t.value);
      if (t.id === "ce-mini-arquivo" && t.files[0]) {
        try {
          novaMini = await reduzirImagem(t.files[0]);
          removerMini = false;
          miniPreview = URL.createObjectURL(novaMini);
          $("#ce-mini").innerHTML = miniHtml();
          $("#ce-mini-remover").hidden = false;
        } catch (_) {
          toast("Não consegui abrir essa imagem. Use JPG, PNG ou WEBP.", "erro", 5000);
        }
        t.value = "";
      }
    };
    m.onkeydown = (e) => {
      if (e.target.id === "ce-tag-input" && (e.key === "Enter" || e.key === ",")) { e.preventDefault(); adicionarTag(); }
    };

    function adicionarTag() {
      const inp = $("#ce-tag-input");
      if (!inp || !inp.value.trim()) return;
      inp.value.split(",").map((s) => s.trim().slice(0, 30)).filter(Boolean).forEach((t) => {
        if (!ed.etiquetas.some((x) => x.toLowerCase() === t.toLowerCase())) ed.etiquetas.push(t);
      });
      inp.value = "";
      sujo = true;
      $("#ce-tags").innerHTML = tagsHtml();
    }

    async function aoClicar(e) {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.mini === "escolher") return $("#ce-mini-arquivo").click();
      if (b.dataset.mini === "remover") {
        novaMini = null; removerMini = true; miniPreview = ""; sujo = true;
        $("#ce-mini").innerHTML = miniHtml(); b.hidden = true;
        return;
      }
      if (b.dataset.linkAdd !== undefined) {
        ed.links.push({ rotulo: "", url: "" }); sujo = true;
        $("#ce-links").innerHTML = linksHtml();
        const ult = $(`#ce-links [data-l="${ed.links.length - 1}"][data-c="rotulo"]`);
        if (ult) ult.focus();
        return;
      }
      if (b.dataset.linkDel !== undefined) { ed.links.splice(+b.dataset.linkDel, 1); sujo = true; $("#ce-links").innerHTML = linksHtml(); return; }
      if (b.dataset.linkAbrir !== undefined) {
        const u = (ed.links[+b.dataset.linkAbrir] || {}).url;
        if (urlValida(u)) window.open(u.trim(), "_blank", "noopener"); else toast("Cole o link completo (começando com https://).", "erro");
        return;
      }
      if (b.dataset.tagDel !== undefined) { ed.etiquetas.splice(+b.dataset.tagDel, 1); sujo = true; $("#ce-tags").innerHTML = tagsHtml(); return; }
      if (b.dataset.escolherPost !== undefined) return escolherPost();
      if (b.dataset.postId) {
        $("#ce-link-post").value = b.dataset.permalink;
        mediaId = b.dataset.postId; sujo = true;
        $("#ce-posts").hidden = true;
        return;
      }
      if (b.dataset.apagar !== undefined) {
        if (!confirm(`Excluir "${ed.titulo || "este conteúdo"}"? Não dá pra desfazer.`)) return;
        if (!(await api.apagarConteudo(c))) return toast("Não foi possível excluir. Tente de novo.", "erro");
        fecharModal(); toast("Conteúdo excluído.");
        return depoisDeSalvar();
      }
      if (b.dataset.salvar !== undefined) return salvar(b);
    }

    // Lista os posts publicados (ig-media) pra escolher em vez de colar o link
    async function escolherPost() {
      const caixa = $("#ce-posts");
      caixa.hidden = false;
      caixa.innerHTML = `<p class="muted" style="font-size:13px">Carregando seus posts...</p>`;
      const r = await api.posts();
      if (!$("#ce-posts")) return;
      if (!r.connected || !(r.posts || []).length) {
        caixa.innerHTML = `<p class="muted" style="font-size:13px">Não consegui listar seus posts agora${LOCAL ? " (no modo de teste local o Instagram não está conectado)" : ""}. Cole o link do post no campo acima.</p>`;
        return;
      }
      caixa.innerHTML = `<div class="posts posts-mini">${r.posts.slice(0, 24).map((p) => `
        <button type="button" class="post" data-post-id="${esc(p.id)}" data-permalink="${esc(p.permalink || "")}" title="${esc(p.caption || "")}">
          ${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : ""}<span class="leg">${esc(fmtDia(p.data))}</span>
        </button>`).join("")}</div>`;
    }

    async function salvar(btn) {
      adicionarTag();
      const v = (id) => $("#" + id).value;
      const titulo = v("ce-titulo").trim();
      if (!titulo) { toast("Dê um título pro conteúdo.", "erro"); $("#ce-titulo").focus(); return; }
      const linkPost = v("ce-link-post").trim();
      if (linkPost && !urlValida(linkPost)) return toast("O link do post precisa começar com https://", "erro");
      const links = ed.links.map((l) => ({ rotulo: l.rotulo.trim(), url: l.url.trim() })).filter((l) => l.rotulo || l.url);
      if (links.some((l) => l.url && !urlValida(l.url))) return toast("Algum link das mídias está incompleto (precisa começar com https://).", "erro");

      btn.disabled = true; btn.textContent = "Salvando...";
      const pronto = () => { btn.disabled = false; btn.textContent = "Salvar"; };
      const antigo = ed.miniatura_path || null;
      let miniatura_path = removerMini ? null : antigo;
      if (novaMini) {
        const up = await api.enviarMiniatura(novaMini);
        if (!up.ok) { pronto(); return toast("Não foi possível enviar a miniatura: " + (up.erro || ""), "erro", 5000); }
        miniatura_path = up.path;
      }
      const status = v("ce-status");
      const categoria = v("ce-categoria");
      const campos = {
        ...(novo ? {} : { id: ed.id }),
        titulo, status, tipo: v("ce-tipo"), categoria,
        marca: COM_MARCA.includes(categoria) ? v("ce-marca").trim() || null : null,
        data_gravar: v("ce-gravar") || null,
        data_editar: v("ce-editar") || null,
        data_postagem: v("ce-postar") || (status === "postado" ? hoje() : null),
        gravado: $("#ce-gravado").checked,
        editado: $("#ce-editado").checked,
        legenda: v("ce-legenda"),
        links, etiquetas: ed.etiquetas, miniatura_path,
        link_post: linkPost || null,
        ig_media_id: linkPost ? mediaId : null,
        notas: v("ce-notas"),
      };
      // card novo ou que mudou de etapa vai pro fim da coluna
      if (novo || status !== (c && c.status)) {
        const na = CAL.lista.filter((x) => x.status === status && x.id !== ed.id);
        campos.ordem = na.length ? Math.max(...na.map((x) => x.ordem || 0)) + 1 : 0;
      }
      const r = await api.salvarConteudo(campos);
      if (!r.ok) { pronto(); return toast("Não foi possível salvar: " + (r.erro || ""), "erro", 5000); }
      if (antigo && antigo !== miniatura_path) api.apagarMiniatura(antigo);
      if (r.data.miniatura_path && miniPreview) CAL.urls[r.data.miniatura_path] = miniPreview;
      sujo = false;
      fecharModal();
      toast(r.local ? "Salvo neste navegador (modo de teste)." : "Conteúdo salvo.", "ok");
      depoisDeSalvar();
    }
  }

  // Atualiza a tela atual depois de criar, editar ou excluir um conteúdo
  async function depoisDeSalvar() {
    if (location.hash.startsWith("#/calendario")) {
      await carregarConteudos();
      if (["quadro", "mes"].includes(CAL.sub)) desenharCal();
    } else if (location.hash.startsWith("#/inicio") || !location.hash) {
      rotear();
    }
  }

  // ===================================================================
  // DOCUMENTOS
  // Pastas (com subpastas) e itens de 3 tipos: texto escrito (nota),
  // link e arquivo. Estrela = aparece no "Acesso rápido".
  // ===================================================================
  const DOC = { atual: null, pastas: [], itens: [], urls: {}, urlsEm: 0, busca: "", semTabela: false, erro: "" };
  const CORES_PASTA = { oliva: "#5c6450", terracota: "#b8633a", caramelo: "#d99a5b", carvalho: "#8a6244", salvia: "#9aa58a", cafe: "#4a423a" };
  const LIMITE_ARQUIVO = 20 * 1024 * 1024;  // igual ao limite da pasta no Supabase
  const LIMITE_LOCAL = 3 * 1024 * 1024;     // modo de teste: o navegador guarda pouco

  const fmtTam = (b) => (b == null ? "" : b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1).replace(".", ",")} MB`);
  const ehImagem = (it) => it.tipo === "arquivo" && /^image\//.test(it.arquivo_tipo || "");
  const extensao = (nome) => { const m = String(nome || "").match(/\.([a-z0-9]{1,5})$/i); return m ? m[1].toUpperCase() : "Arquivo"; };
  const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return u || ""; } };
  const pastaPorId = (id) => DOC.pastas.find((p) => p.id === id) || null;

  // Pastas do topo até a pasta atual (pra trilha "Documentos › Mentora › Produtos")
  function caminhoPasta(id) {
    const trilha = [];
    let p = pastaPorId(id);
    while (p && trilha.length < 20) { trilha.unshift(p); p = pastaPorId(p.parent_id); }
    return trilha;
  }
  // A pasta e todas as que estão dentro dela
  function descendentes(id) {
    const ids = [id];
    for (let i = 0; i < ids.length; i++) DOC.pastas.filter((p) => p.parent_id === ids[i]).forEach((p) => ids.push(p.id));
    return ids;
  }

  // Texto escrito com formatação simples:
  //   ## Título   - item de lista   **negrito**   links viram clicáveis
  //   códigos de cor como #5c6450 ganham uma amostra da cor
  function textoFormatado(texto) {
    const linha = (s) => esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(:])#([0-9a-fA-F]{6})\b/g, '$1<span class="amostra" style="background:#$2"></span>#$2');
    let html = "", lista = false;
    String(texto || "").split(/\r?\n/).forEach((l) => {
      const t = l.trim();
      const item = t.match(/^[-*]\s+(.*)$/);
      if (item) { if (!lista) { html += "<ul>"; lista = true; } html += `<li>${linha(item[1])}</li>`; return; }
      if (lista) { html += "</ul>"; lista = false; }
      const tit = t.match(/^(#{1,3})\s+(.*)$/);
      if (tit) html += `<h${tit[1].length === 1 ? 3 : 4}>${linha(tit[2])}</h${tit[1].length === 1 ? 3 : 4}>`;
      else if (t) html += `<p>${linha(t)}</p>`;
    });
    if (lista) html += "</ul>";
    return html || `<p class="muted">Sem texto ainda.</p>`;
  }
  const resumoTexto = (t) => String(t || "").replace(/[#*]/g, "").replace(/\s+/g, " ").trim().slice(0, 90);

  async function copiarTexto(texto, aviso = "Texto copiado.") {
    try { await navigator.clipboard.writeText(texto); }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = texto; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    toast(aviso, "ok");
  }

  async function carregarDocs() {
    const r = await api.listarDocs();
    DOC.pastas = r.pastas; DOC.itens = r.itens;
    DOC.semTabela = !!r.semTabela;
    DOC.erro = r.semTabela ? "" : r.erro || "";
    if (Date.now() - DOC.urlsEm > 50 * 60 * 1000) { DOC.urls = {}; DOC.urlsEm = Date.now(); }
    const faltam = DOC.itens.filter((i) => ehImagem(i) && i.arquivo_path && !DOC.urls[i.arquivo_path]).map((i) => i.arquivo_path);
    if (faltam.length) Object.assign(DOC.urls, await api.urlsArquivosDoc(faltam));
  }

  async function telaDocumentos(pastaId) {
    if (pastaId !== DOC.atual) DOC.busca = ""; // entrou em outra pasta: limpa a busca
    DOC.atual = pastaId;
    conteudo().innerHTML = `
      <div class="cabecalho">
        <div>
          <p class="sobretitulo">Organização</p>
          <h1>Documentos</h1>
          <p class="muted">Tudo o que você precisa, organizado e à mão.</p>
        </div>
      </div>
      <div id="doc-conteudo"><p class="muted">Carregando...</p></div>`;
    await carregarDocs();
    if (!$("#doc-conteudo") || DOC.atual !== pastaId) return;
    if (pastaId && !pastaPorId(pastaId)) { location.hash = "#/documentos"; return; }
    desenharDocs();
  }

  function desenharDocs() {
    const alvo = $("#doc-conteudo");
    if (!alvo) return;
    const atual = pastaPorId(DOC.atual);
    alvo.innerHTML = `
      ${DOC.semTabela ? `<p class="alerta" style="margin:0 0 14px">Pra salvar seus documentos, rode o script <b>07_documentos.sql</b> no Supabase (veja o LEIA-ME).</p>` : ""}
      ${DOC.erro ? `<p class="erro">Não foi possível carregar: ${esc(DOC.erro)}</p>` : ""}
      <div class="doc-barra">
        <nav class="trilha" aria-label="Você está em">
          <a href="#/documentos">Documentos</a>${caminhoPasta(DOC.atual).map((p) => `<span aria-hidden="true">›</span><a href="#/documentos/${esc(p.id)}">${esc(p.nome)}</a>`).join("")}
        </nav>
        <input type="search" id="doc-busca" placeholder="Buscar em todos os documentos" value="${esc(DOC.busca)}" aria-label="Buscar documentos">
      </div>
      <div class="doc-acoes">
        <button type="button" class="btn btn-pequeno" data-novo="pasta">${ICON.pasta} Nova pasta</button>
        <button type="button" class="btn btn-pequeno" data-novo="nota">${ICON.nota} Texto</button>
        <button type="button" class="btn btn-pequeno" data-novo="link">${ICON.link} Link</button>
        <button type="button" class="btn btn-pequeno btn-primario" data-novo="arquivo">${ICON.enviarArq} Enviar arquivo</button>
        <input type="file" id="doc-arquivo" multiple hidden>
        ${atual ? `<span class="espaco"></span><button type="button" class="btn btn-fantasma btn-pequeno" data-editar-pasta="${esc(atual.id)}">${ICON.editar} Editar pasta</button>` : ""}
      </div>
      <div id="doc-area" class="doc-area"></div>
      ${!DOC.atual ? `<p class="doc-espaco">${usoEspaco()}</p>` : ""}`;
    desenharDocArea();

    // (propriedades em vez de addEventListener: redesenhar não acumula eventos)
    alvo.oninput = (e) => { if (e.target.id === "doc-busca") { DOC.busca = e.target.value; desenharDocArea(); } };
    alvo.onchange = (e) => { if (e.target.id === "doc-arquivo" && e.target.files.length) { enviarArquivos([...e.target.files]); e.target.value = ""; } };
    alvo.onclick = (e) => {
      const b = e.target.closest("[data-novo],[data-editar-pasta],[data-abrir-item],[data-fixar],[data-copiar],[data-editar-item],[data-sugeridas]");
      if (!b) return;
      const item = (id) => DOC.itens.find((x) => x.id === id);
      if (b.dataset.novo === "arquivo") return $("#doc-arquivo").click();
      if (b.dataset.novo) return editarDoc(b.dataset.novo, null);
      if (b.dataset.editarPasta) return editarDoc("pasta", pastaPorId(b.dataset.editarPasta));
      if (b.dataset.abrirItem) return abrirItem(item(b.dataset.abrirItem));
      if (b.dataset.fixar) return alternarFixado(item(b.dataset.fixar));
      if (b.dataset.copiar) return copiarTexto((item(b.dataset.copiar) || {}).texto || "");
      if (b.dataset.editarItem) { const it = item(b.dataset.editarItem); return editarDoc(it.tipo, it); }
      if (b.dataset.sugeridas !== undefined) return criarSugeridas(b);
    };
    // Arrastar arquivos do computador pra dentro da pasta
    const temArquivos = (e) => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    alvo.ondragover = (e) => { if (temArquivos(e)) { e.preventDefault(); $("#doc-area").classList.add("soltar"); } };
    alvo.ondragleave = (e) => { if (!alvo.contains(e.relatedTarget)) $("#doc-area").classList.remove("soltar"); };
    alvo.ondrop = (e) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      $("#doc-area").classList.remove("soltar");
      enviarArquivos([...e.dataTransfer.files]);
    };
  }

  function usoEspaco() {
    const total = DOC.itens.reduce((s, i) => s + (Number(i.arquivo_tamanho) || 0), 0);
    return `${ICON.arquivo} Arquivos usando ${fmtTam(total) || "0 KB"} de 1 GB (plano gratuito do Supabase).`;
  }

  function desenharDocArea() {
    const area = $("#doc-area");
    if (!area) return;
    const b = normal(DOC.busca).trim();

    // Busca: procura em tudo, de todas as pastas
    if (b) {
      const pastas = DOC.pastas.filter((p) => normal(p.nome).includes(b));
      const itens = DOC.itens.filter((i) => [i.titulo, i.texto, i.arquivo_nome, i.url].some((v) => normal(v).includes(b)));
      area.innerHTML = !pastas.length && !itens.length
        ? `<div class="vazio" style="padding:30px 10px"><h2>Nada encontrado</h2><p>Tente outra palavra.</p></div>`
        : `${pastas.length ? `<h2 class="secao-titulo">Pastas</h2><div class="doc-pastas">${pastas.map(htmlPasta).join("")}</div>` : ""}
           ${itens.length ? `<h2 class="secao-titulo">Itens</h2><div class="doc-itens">${itens.map((i) => htmlItem(i, true)).join("")}</div>` : ""}`;
      return;
    }

    const subpastas = DOC.pastas.filter((p) => (p.parent_id || null) === DOC.atual)
      .sort((x, y) => (x.ordem || 0) - (y.ordem || 0) || x.nome.localeCompare(y.nome, "pt-BR"));
    const itens = DOC.itens.filter((i) => (i.pasta_id || null) === DOC.atual)
      .sort((x, y) => Number(y.fixado) - Number(x.fixado) || x.titulo.localeCompare(y.titulo, "pt-BR"));
    const fixados = DOC.atual ? [] : DOC.itens.filter((i) => i.fixado);

    if (!DOC.atual && !subpastas.length && !itens.length) {
      area.innerHTML = `<div class="cartao vazio">
        <div class="icone-grande">${ICON.pasta}</div>
        <h2>Seu espaço de documentos</h2>
        <p>Crie pastas pra sua marca, sua mentoria e o que mais precisar. Pode começar com as pastas sugeridas, já com modelos prontos.</p>
        <button type="button" class="btn btn-primario" data-sugeridas>${ICON.mais} Criar pastas sugeridas</button>
        <p class="ajuda" style="margin-top:12px">Minha marca (com sua identidade visual) e Mentora (Produtos, Esteira de produtos, Conceitos).</p>
      </div>`;
      return;
    }

    area.innerHTML = `
      ${fixados.length ? `<h2 class="secao-titulo">${ICON.estrela} Acesso rápido</h2><div class="doc-itens">${fixados.map((i) => htmlItem(i, true)).join("")}</div>` : ""}
      ${subpastas.length ? `<h2 class="secao-titulo">Pastas</h2><div class="doc-pastas">${subpastas.map(htmlPasta).join("")}</div>` : ""}
      ${itens.length ? `<h2 class="secao-titulo">${DOC.atual ? "Nesta pasta" : "Fora de pastas"}</h2><div class="doc-itens">${itens.map((i) => htmlItem(i, false)).join("")}</div>` : ""}
      ${DOC.atual && !subpastas.length && !itens.length ? `<div class="doc-vazia">${ICON.enviarArq}<p>Pasta vazia. Arraste arquivos do computador pra cá ou use os botões acima.</p></div>` : ""}`;
  }

  function htmlPasta(p) {
    const nItens = DOC.itens.filter((i) => i.pasta_id === p.id).length;
    const nPastas = DOC.pastas.filter((x) => x.parent_id === p.id).length;
    const partes = [nItens ? `${nItens} ${nItens === 1 ? "item" : "itens"}` : "", nPastas ? `${nPastas} ${nPastas === 1 ? "pasta" : "pastas"}` : ""].filter(Boolean);
    return `<a class="doc-pasta" href="#/documentos/${esc(p.id)}" style="--cor-pasta:${CORES_PASTA[p.cor] || CORES_PASTA.oliva}">
      <span class="doc-pasta-ic">${ICON.pasta}</span>
      <span class="doc-pasta-txt"><b>${esc(p.nome)}</b><span class="sub">${partes.join(" · ") || "vazia"}</span></span>
    </a>`;
  }

  function htmlItem(it, mostrarPasta) {
    const thumb = ehImagem(it) && DOC.urls[it.arquivo_path];
    const icone = it.tipo === "nota" ? ICON.nota : it.tipo === "link" ? ICON.link : ehImagem(it) ? ICON.foto : ICON.arquivo;
    const meta = it.tipo === "nota" ? resumoTexto(it.texto) || "Texto"
      : it.tipo === "link" ? dominio(it.url)
      : [extensao(it.arquivo_nome), fmtTam(it.arquivo_tamanho)].filter(Boolean).join(" · ");
    const pasta = mostrarPasta && it.pasta_id && pastaPorId(it.pasta_id);
    return `<article class="doc-item tipo-${it.tipo}">
      <button type="button" class="doc-item-abrir" data-abrir-item="${esc(it.id)}" aria-label="Abrir ${esc(it.titulo)}">
        <span class="doc-item-visual">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : icone}</span>
        <span class="doc-item-txt">
          <b>${esc(it.titulo)}</b>
          <span class="sub">${esc(meta)}</span>
          ${pasta ? `<span class="sub doc-onde">${ICON.pasta} ${esc(pasta.nome)}</span>` : ""}
        </span>
      </button>
      <div class="doc-item-acoes">
        ${it.tipo === "nota" ? `<button type="button" class="btn-icone" data-copiar="${esc(it.id)}" aria-label="Copiar texto" title="Copiar texto">${ICON.copiar}</button>` : ""}
        <button type="button" class="btn-icone estrela ${it.fixado ? "ativa" : ""}" data-fixar="${esc(it.id)}" aria-pressed="${it.fixado ? "true" : "false"}" aria-label="${it.fixado ? "Tirar do acesso rápido" : "Colocar no acesso rápido"}" title="${it.fixado ? "Tirar do acesso rápido" : "Acesso rápido"}">${ICON.estrela}</button>
        <button type="button" class="btn-icone" data-editar-item="${esc(it.id)}" aria-label="Editar ${esc(it.titulo)}" title="Editar">${ICON.editar}</button>
      </div>
    </article>`;
  }

  async function alternarFixado(it) {
    if (!it) return;
    it.fixado = !it.fixado;
    desenharDocArea();
    const r = await api.salvarDoc("doc_itens", { id: it.id, fixado: it.fixado });
    if (!r.ok) { it.fixado = !it.fixado; desenharDocArea(); toast("Não foi possível salvar: " + (r.erro || ""), "erro"); }
  }

  // Abre: texto numa janela de leitura, link numa aba nova, arquivo com link temporário
  async function abrirItem(it) {
    if (!it) return;
    if (it.tipo === "link") {
      if (urlValida(it.url)) window.open(it.url.trim(), "_blank", "noopener");
      else toast("Esse link está incompleto. Edite e cole o endereço completo (https://).", "erro", 5000);
      return;
    }
    if (it.tipo === "arquivo") {
      const janela = window.open("about:blank", "_blank"); // abre já (senão o navegador bloqueia)
      try {
        const url = await api.urlArquivoDoc(it.arquivo_path);
        if (!url) throw new Error("arquivo indisponível no modo de teste");
        if (janela) { janela.opener = null; janela.location.href = url; } else location.href = url;
      } catch (e) {
        if (janela) janela.close();
        toast("Não foi possível abrir o arquivo: " + e.message, "erro", 5000);
      }
      return;
    }
    abrirModal(`
      <div class="modal-cab"><h2>${esc(it.titulo)}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <div class="doc-leitura">${textoFormatado(it.texto)}</div>
      <div class="modal-rodape">
        <button type="button" class="btn" data-copiar-nota>${ICON.copiar} Copiar texto</button>
        <button type="button" class="btn" data-editar-nota>${ICON.editar} Editar</button>
        <button type="button" class="btn btn-primario" data-fechar>Fechar</button>
      </div>`, (e) => {
      if (e.target.closest("[data-copiar-nota]")) copiarTexto(it.texto || "");
      if (e.target.closest("[data-editar-nota]")) editarDoc("nota", it);
    }, "largo");
  }

  // Envia arquivos (do botão ou arrastados) pra pasta atual
  async function enviarArquivos(arquivos) {
    if (DOC.semTabela) return toast("Rode o 07_documentos.sql no Supabase antes de enviar arquivos.", "erro", 5000);
    const limite = USA_BANCO ? LIMITE_ARQUIVO : LIMITE_LOCAL;
    const grandes = arquivos.filter((a) => a.size > limite);
    if (grandes.length) toast(`${grandes.map((a) => a.name).join(", ")}: passa de ${fmtTam(limite)}. Use um link do Google Drive pra esse.`, "erro", 7000);
    const ok = arquivos.filter((a) => a.size <= limite);
    let enviados = 0;
    for (const [i, a] of ok.entries()) {
      toast(`Enviando ${i + 1} de ${ok.length}: ${a.name}`, "", 60000);
      const up = await api.enviarArquivoDoc(a);
      if (!up.ok) { toast(`Não foi possível enviar ${a.name}: ${up.erro || ""}`, "erro", 6000); continue; }
      const r = await api.salvarDoc("doc_itens", {
        tipo: "arquivo", titulo: a.name.replace(/\.[^.]+$/, "").slice(0, 120) || a.name, pasta_id: DOC.atual,
        arquivo_path: up.path, arquivo_nome: a.name, arquivo_tipo: a.type || "", arquivo_tamanho: a.size,
      });
      if (!r.ok) { api.apagarArquivosDoc([up.path]); toast(`Não foi possível salvar ${a.name}: ${r.erro || ""}`, "erro", 6000); continue; }
      enviados++;
    }
    if (enviados) toast(enviados === 1 ? "Arquivo enviado." : `${enviados} arquivos enviados.`, "ok");
    await carregarDocs();
    desenharDocs();
  }

  // Opções de pasta pro seletor "Onde fica" (em árvore)
  function opcoesPastas(selecionada, excluir = []) {
    const linhas = [`<option value="">Fora de pastas (início)</option>`];
    const andar = (pai, nivel) => DOC.pastas
      .filter((p) => (p.parent_id || null) === pai && !excluir.includes(p.id))
      .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"))
      .forEach((p) => {
        linhas.push(`<option value="${esc(p.id)}" ${p.id === selecionada ? "selected" : ""}>${"   ".repeat(nivel)}${nivel ? "› " : ""}${esc(p.nome)}</option>`);
        andar(p.id, nivel + 1);
      });
    andar(null, 0);
    return linhas.join("");
  }

  // Criar e editar: pasta, texto, link ou arquivo
  function editarDoc(tipo, existente) {
    const novo = !existente;
    const e0 = existente || {};
    let sujo = false;
    const titulos = { pasta: novo ? "Nova pasta" : "Editar pasta", nota: novo ? "Novo texto" : "Editar texto", link: novo ? "Novo link" : "Editar link", arquivo: "Editar arquivo" };
    const ondeAtual = tipo === "pasta" ? (novo ? DOC.atual : e0.parent_id) : (novo ? DOC.atual : e0.pasta_id);
    const excluir = tipo === "pasta" && !novo ? descendentes(e0.id) : [];
    const corAtual = e0.cor || "oliva";

    const campoOnde = `<label class="campo"><span class="rotulo">${tipo === "pasta" ? "Dentro de" : "Pasta"}</span><select id="de-onde">${opcoesPastas(ondeAtual || null, excluir)}</select></label>`;
    const campoFixado = `<label class="check" style="margin-bottom:6px"><input type="checkbox" id="de-fixado" ${e0.fixado ? "checked" : ""}> ${ICON.estrela} Mostrar no acesso rápido</label>`;
    let corpo = "";
    if (tipo === "pasta") {
      corpo = `
        <label class="campo"><span class="rotulo">Nome</span><input type="text" id="de-titulo" value="${esc(e0.nome || "")}" placeholder="Ex: Minha marca" maxlength="80"></label>
        <div class="campo"><span class="rotulo">Cor</span><div class="cores-pasta" role="radiogroup" aria-label="Cor da pasta">
          ${Object.entries(CORES_PASTA).map(([k, v]) => `<label class="cor-op" title="${k}"><input type="radio" name="de-cor" value="${k}" ${k === corAtual ? "checked" : ""}><span style="background:${v}"></span></label>`).join("")}
        </div></div>
        ${campoOnde}`;
    } else if (tipo === "nota") {
      corpo = `
        <label class="campo"><span class="rotulo">Título</span><input type="text" id="de-titulo" value="${esc(e0.titulo || "")}" placeholder="Ex: Bio do Instagram, Guia de marca" maxlength="120"></label>
        <div class="campo"><label class="rotulo" for="de-texto">Texto</label>
          <textarea id="de-texto" rows="14" placeholder="Escreva aqui...">${esc(e0.texto || "")}</textarea>
          <p class="ajuda">Formatação: <code>## Título</code>, <code>- item de lista</code>, <code>**negrito**</code>. Códigos de cor como <code>#5c6450</code> mostram a amostra da cor.</p></div>
        <div class="grade grade-2">${campoOnde}<div class="campo" style="align-self:end">${campoFixado}</div></div>`;
    } else if (tipo === "link") {
      corpo = `
        <label class="campo"><span class="rotulo">Título</span><input type="text" id="de-titulo" value="${esc(e0.titulo || "")}" placeholder="Ex: Mídia kit no Canva" maxlength="120"></label>
        <label class="campo"><span class="rotulo">Link</span><input type="url" id="de-url" value="${esc(e0.url || "")}" placeholder="https://..."></label>
        <label class="campo"><span class="rotulo">Descrição (opcional)</span><textarea id="de-texto" rows="3" placeholder="Pra que serve, senha de acesso fica fora daqui...">${esc(e0.texto || "")}</textarea></label>
        <div class="grade grade-2">${campoOnde}<div class="campo" style="align-self:end">${campoFixado}</div></div>`;
    } else {
      corpo = `
        <p class="doc-arquivo-info">${ICON.arquivo} <b>${esc(e0.arquivo_nome || "")}</b> <span class="muted">${esc(fmtTam(e0.arquivo_tamanho))}</span>
          <button type="button" class="btn btn-pequeno" data-abrir-este>Abrir</button></p>
        <label class="campo"><span class="rotulo">Título</span><input type="text" id="de-titulo" value="${esc(e0.titulo || "")}" maxlength="120"></label>
        <label class="campo"><span class="rotulo">Descrição (opcional)</span><textarea id="de-texto" rows="3" placeholder="Ex: versão aprovada pela marca em outubro">${esc(e0.texto || "")}</textarea></label>
        <div class="grade grade-2">${campoOnde}<div class="campo" style="align-self:end">${campoFixado}</div></div>`;
    }

    abrirModal(`
      <div class="modal-cab"><h2>${titulos[tipo]}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      ${corpo}
      <div class="modal-rodape" style="justify-content:space-between">
        ${novo ? "<span></span>" : `<button type="button" class="btn btn-perigo" data-excluir>${ICON.lixo} Excluir</button>`}
        <span style="display:flex;gap:8px"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primario" data-salvar>Salvar</button></span>
      </div>`, aoClicar, tipo === "nota" ? "largo" : "", () => !sujo || confirm("Você tem alterações não salvas. Fechar mesmo assim?"));
    const m = $("#modal");
    m.oninput = () => { sujo = true; };
    m.onchange = () => { sujo = true; };
    setTimeout(() => { const t = $("#de-titulo"); if (t && novo) t.focus(); }, 50);

    async function aoClicar(e) {
      if (e.target.closest("[data-abrir-este]")) return abrirItem(e0);
      if (e.target.closest("[data-excluir]")) return excluir_();
      const btn = e.target.closest("[data-salvar]");
      if (!btn) return;
      const titulo = $("#de-titulo").value.trim();
      if (!titulo) { toast(tipo === "pasta" ? "Dê um nome pra pasta." : "Dê um título.", "erro"); $("#de-titulo").focus(); return; }
      const onde = $("#de-onde").value || null;
      let tabela = "doc_itens", campos;
      if (tipo === "pasta") {
        tabela = "doc_pastas";
        campos = { nome: titulo, parent_id: onde, cor: (m.querySelector("input[name='de-cor']:checked") || {}).value || "oliva" };
      } else {
        campos = { titulo, pasta_id: onde, texto: $("#de-texto").value, fixado: $("#de-fixado").checked };
        if (novo) campos.tipo = tipo;
        if (tipo === "link") {
          const url = $("#de-url").value.trim();
          if (!urlValida(url)) { toast("Cole o link completo (começando com https://).", "erro"); return; }
          campos.url = url;
        }
      }
      if (!novo) campos.id = e0.id;
      btn.disabled = true; btn.textContent = "Salvando...";
      const r = await api.salvarDoc(tabela, campos);
      if (!r.ok) { btn.disabled = false; btn.textContent = "Salvar"; return toast("Não foi possível salvar: " + (r.erro || ""), "erro", 5000); }
      sujo = false;
      fecharModal();
      toast(r.local ? "Salvo neste navegador (modo de teste)." : "Salvo.", "ok");
      await carregarDocs();
      if (tipo === "pasta" && novo) { location.hash = `#/documentos/${r.data.id}`; return; }
      desenharDocs();
    }

    async function excluir_() {
      if (tipo === "pasta") {
        const ids = descendentes(e0.id);
        const itens = DOC.itens.filter((i) => ids.includes(i.pasta_id));
        const aviso = itens.length || ids.length > 1
          ? `Excluir a pasta "${e0.nome}" e TUDO que tem dentro (${itens.length} ${itens.length === 1 ? "item" : "itens"}${ids.length > 1 ? ` e ${ids.length - 1} ${ids.length === 2 ? "subpasta" : "subpastas"}` : ""})? Não dá pra desfazer.`
          : `Excluir a pasta "${e0.nome}"?`;
        if (!confirm(aviso)) return;
        await api.apagarArquivosDoc(itens.map((i) => i.arquivo_path));
        const ok = await api.apagarDocs("doc_itens", itens.map((i) => i.id)) && await api.apagarDocs("doc_pastas", ids);
        if (!ok) return toast("Não foi possível excluir. Tente de novo.", "erro");
        sujo = false; fecharModal(); toast("Pasta excluída.");
        await carregarDocs();
        location.hash = e0.parent_id ? `#/documentos/${e0.parent_id}` : "#/documentos";
        if (DOC.atual === (e0.parent_id || null)) desenharDocs();
        return;
      }
      if (!confirm(`Excluir "${e0.titulo}"? Não dá pra desfazer.`)) return;
      if (e0.arquivo_path) await api.apagarArquivosDoc([e0.arquivo_path]);
      if (!(await api.apagarDocs("doc_itens", [e0.id]))) return toast("Não foi possível excluir. Tente de novo.", "erro");
      sujo = false; fecharModal(); toast("Excluído.");
      await carregarDocs();
      desenharDocs();
    }
  }

  // Pastas sugeridas, com modelos prontos pra preencher
  async function criarSugeridas(btn) {
    if (DOC.semTabela) return toast("Rode o 07_documentos.sql no Supabase antes.", "erro", 5000);
    btn.disabled = true; btn.textContent = "Criando...";
    const pasta = async (nome, cor, parent_id, ordem) => (await api.salvarDoc("doc_pastas", { nome, cor, parent_id, ordem })).data;
    const nota = (titulo, pasta_id, texto, fixado = false) => api.salvarDoc("doc_itens", { tipo: "nota", titulo, pasta_id, texto, fixado });
    try {
      const marca = await pasta("Minha marca", "terracota", null, 0);
      await nota("Identidade visual", marca.id, [
        "## Cores",
        "- Cortina (fundo): #f4f0e8",
        "- Areia: #d8c8ae",
        "- Oliva (cor principal): #5c6450",
        "- Terracota (detalhes): #b8633a",
        "- Caramelo: #d99a5b",
        "- Carvalho: #8a6244",
        "- Café (textos): #1f1c19",
        "",
        "## Fontes",
        "- Títulos: **Cormorant Garamond**",
        "- Textos: **Jost**",
        "",
        "## Logo",
        "Máscaras do teatro (comédia e tragédia) dentro de uma câmera. Envie os arquivos do logo pra esta pasta.",
        "",
        "## Links",
        "- Portfólio: https://carolinecostaugc.github.io/",
      ].join("\n"), true);
      await nota("Guia de marca", marca.id, [
        "## Quem eu sou",
        "Escreva aqui em poucas linhas.",
        "",
        "## Tom de voz",
        "- ",
        "",
        "## Pra quem eu falo",
        "- ",
        "",
        "## Palavras que uso",
        "- ",
        "",
        "## Palavras que evito",
        "- ",
      ].join("\n"));
      const mentora = await pasta("Mentora", "oliva", null, 1);
      await pasta("Produtos", "caramelo", mentora.id, 0);
      const esteira = await pasta("Esteira de produtos", "carvalho", mentora.id, 1);
      await pasta("Conceitos", "salvia", mentora.id, 2);
      await nota("Esteira de produtos", esteira.id, [
        "## Isca gratuita",
        "- Produto:",
        "- Objetivo:",
        "",
        "## Produto de entrada",
        "- Produto:",
        "- Preço:",
        "",
        "## Produto principal",
        "- Produto:",
        "- Preço:",
        "",
        "## Produto premium",
        "- Produto:",
        "- Preço:",
      ].join("\n"));
      toast("Pastas criadas. Agora é só preencher.", "ok");
    } catch (e) {
      toast("Não foi possível criar todas as pastas: " + e.message, "erro", 5000);
    }
    await carregarDocs();
    desenharDocs();
  }

  // ===================================================================
  // UGC: Prospecção (CRM de propostas) e Marcas
  // Uma proposta sempre aponta pra uma marca. Ao cadastrar proposta pra
  // uma marca nova, a marca é criada sozinha com os dados do responsável.
  // ===================================================================
  const ETAPAS_P = [
    { s: "enviar", t: "Para enviar" },
    { s: "enviada", t: "Enviada" },
    { s: "respondeu", t: "Respondeu" },
    { s: "negociacao", t: "Em negociação" },
    { s: "aprovado", t: "Aprovado" },
    { s: "nao_deu", t: "Não deu" },
  ];
  const ETAPA_P = Object.fromEntries(ETAPAS_P.map((e, i) => [e.s, { ...e, i }]));
  const CANAIS_P = { email: "E-mail", whatsapp: "WhatsApp", instagram: "Instagram (DM)", formulario: "Formulário", outro: "Outro" };
  const RESPONDEU = ["respondeu", "negociacao", "aprovado"]; // contam como "a marca respondeu"
  const ABERTAS = ["enviada", "respondeu", "negociacao"];   // ainda pedem follow-up
  const UGC = {
    sub: "prospeccao", vista: "quadro", marcas: [], propostas: [], busca: "", canal: "",
    buscaM: "", soParceiras: false, ordem: "data_envio", asc: false,
    semTabela: false, erro: "", arrastando: null, soltou: false,
  };

  const fmtReal = (v) => (v == null || v === "" ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  const fmtDataCurta = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("pt-BR") : "");
  // "R$ 1.200,50" -> 1200.5 ; "950" -> 950 ; "1.200" -> 1200
  function lerValor(txt) {
    let s = String(txt || "").replace(/[^\d,.]/g, "");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    const n = Number(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  const marcaDe = (p) => (p && p.marca_id && UGC.marcas.find((m) => m.id === p.marca_id)) || null;
  const nomeMarca = (p) => (marcaDe(p) || {}).nome || p.marca_nome || "Sem marca";
  const acharMarcaPorNome = (nome) => UGC.marcas.find((m) => normal(m.nome).trim() === normal(nome).trim()) || null;

  // Botões pra falar com a marca (e-mail, WhatsApp, Instagram, site)
  function linksContato(m) {
    if (!m) return [];
    const out = [];
    if (m.email && /^\S+@\S+\.\S+$/.test(m.email.trim())) out.push({ t: "E-mail", url: `mailto:${m.email.trim()}`, ic: ICON.email });
    const tel = String(m.telefone || "").replace(/\D/g, "");
    if (tel.length >= 10) out.push({ t: "WhatsApp", url: `https://wa.me/${tel.length <= 11 ? "55" + tel : tel}`, ic: ICON.whatsapp });
    const ig = String(m.instagram || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?].*$/, "");
    if (/^[\w.]{1,30}$/.test(ig)) out.push({ t: "Instagram", url: `https://www.instagram.com/${ig}/`, ic: ICON.instagram });
    if (urlValida(m.site)) out.push({ t: "Site", url: m.site.trim(), ic: ICON.link });
    return out;
  }
  const botoesContato = (m) => linksContato(m).map((l) => `<a class="btn btn-pequeno" href="${esc(l.url)}" target="_blank" rel="noopener">${l.ic} ${l.t}</a>`).join("");

  async function carregarUgc() {
    const [m, p] = await Promise.all([api.listar("ugc_marcas", "nome"), api.listar("ugc_propostas", "ordem")]);
    UGC.marcas = m.rows;
    UGC.propostas = p.rows;
    UGC.semTabela = !!(m.semTabela || p.semTabela);
    UGC.erro = UGC.semTabela ? "" : m.erro || p.erro || "";
  }
  const avisoUgc = () => `
    ${UGC.semTabela ? `<p class="alerta" style="margin:0 0 14px">Pra salvar marcas e propostas, rode o script <b>08_ugc.sql</b> no Supabase (veja o LEIA-ME).</p>` : ""}
    ${UGC.erro ? `<p class="erro">Não foi possível carregar: ${esc(UGC.erro)}</p>` : ""}`;

  async function telaUgc(sub) {
    if (!["prospeccao", "marcas"].includes(sub)) sub = "prospeccao";
    UGC.sub = sub;
    conteudo().innerHTML = `
      <div class="cabecalho">
        <div>
          <p class="sobretitulo">Trabalho com marcas</p>
          <h1>UGC</h1>
          <p class="muted">Prospecção, propostas e tudo de cada marca num lugar só.</p>
        </div>
        <button class="btn btn-primario" id="ugc-novo">${ICON.mais} ${sub === "marcas" ? "Nova marca" : "Nova proposta"}</button>
      </div>
      <nav class="abas">
        <a href="#/ugc/prospeccao" class="${sub === "prospeccao" ? "ativo" : ""}">Prospecção</a>
        <a href="#/ugc/marcas" class="${sub === "marcas" ? "ativo" : ""}">Marcas</a>
      </nav>
      <div id="ugc-conteudo"><p class="muted">Carregando...</p></div>`;
    $("#ugc-novo").addEventListener("click", () => (sub === "marcas" ? abrirMarca(null) : abrirProposta(null, { status: "enviar" })));
    await carregarUgc();
    if (!$("#ugc-conteudo") || UGC.sub !== sub) return;
    if (sub === "marcas") desenharMarcas(); else desenharProspeccao();
  }
  async function recarregarUgc() {
    await carregarUgc();
    if (!$("#ugc-conteudo")) return;
    if (UGC.sub === "marcas") desenharMarcasArea(); else { desenharDash(); desenharUgcArea(); }
  }

  // ---------- Prospecção ----------
  function desenharProspeccao() {
    const alvo = $("#ugc-conteudo");
    alvo.innerHTML = `${avisoUgc()}
      <div id="ugc-dash"></div>
      <div class="ferramentas" style="margin-top:22px">
        <div class="alternar" role="group" aria-label="Ver como">
          <button type="button" data-vista="quadro" aria-pressed="${UGC.vista === "quadro"}">Quadro</button>
          <button type="button" data-vista="planilha" aria-pressed="${UGC.vista === "planilha"}">Planilha</button>
        </div>
        <input type="search" id="ugc-busca" placeholder="Buscar marca, responsável, anotação" value="${esc(UGC.busca)}" aria-label="Buscar propostas">
        <select id="ugc-canal" aria-label="Filtrar por canal"><option value="">Todos os canais</option>
          ${Object.entries(CANAIS_P).map(([v, t]) => `<option value="${v}" ${UGC.canal === v ? "selected" : ""}>${t}</option>`).join("")}</select>
        <button type="button" class="btn" id="ugc-baixar">${ICON.baixar} Baixar planilha</button>
      </div>
      <div id="ugc-area"></div>`;
    desenharDash();
    desenharUgcArea();

    // (propriedades em vez de addEventListener: redesenhar não acumula eventos)
    alvo.oninput = (e) => { if (e.target.id === "ugc-busca") { UGC.busca = e.target.value; desenharUgcArea(); } };
    alvo.onchange = (e) => { if (e.target.id === "ugc-canal") { UGC.canal = e.target.value; desenharUgcArea(); } };
    alvo.onclick = (e) => {
      const b = e.target.closest("[data-vista],#ugc-baixar,[data-mover-p],[data-nova-p],[data-ordem-p],[data-abrir-p],.card-prop");
      if (!b || e.target.closest("a")) return;
      if (b.dataset.vista) {
        UGC.vista = b.dataset.vista;
        $$("[data-vista]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.vista === UGC.vista)));
        return desenharUgcArea();
      }
      if (b.id === "ugc-baixar") return baixarPropostas();
      if (b.dataset.moverP) return moverProposta(b.closest(".card-prop").dataset.id, b.dataset.moverP);
      if (b.dataset.novaP) return abrirProposta(null, { status: b.dataset.novaP });
      if (b.dataset.ordemP) {
        const k = b.dataset.ordemP;
        if (UGC.ordem === k) UGC.asc = !UGC.asc; else { UGC.ordem = k; UGC.asc = ["marca", "status", "canal"].includes(k); }
        return desenharUgcArea();
      }
      const id = b.dataset.abrirP || b.dataset.id;
      const p = UGC.propostas.find((x) => x.id === id);
      if (p) abrirProposta(p);
    };
    alvo.onkeydown = (e) => {
      const alvoEl = e.target.closest(".card-prop, tr[data-abrir-p]");
      if (alvoEl && e.target === alvoEl && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        const p = UGC.propostas.find((x) => x.id === (alvoEl.dataset.id || alvoEl.dataset.abrirP));
        if (p) abrirProposta(p);
      }
    };

    // Arrastar e soltar entre colunas (no celular, use as setinhas do card)
    const cardArrastado = () => UGC.arrastando && alvo.querySelector(`.card-prop[data-id="${CSS.escape(UGC.arrastando)}"]`);
    alvo.ondragstart = (e) => {
      const card = e.target.closest(".card-prop");
      if (!card) return;
      UGC.soltou = false; UGC.arrastando = card.dataset.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.id);
      setTimeout(() => card.classList.add("arrastando"), 0);
    };
    alvo.ondragover = (e) => {
      const col = e.target.closest(".coluna");
      const lista = col && col.querySelector(".coluna-lista");
      const card = cardArrastado();
      if (!lista || !card) return;
      e.preventDefault();
      $$(".coluna-lista.alvo").forEach((l) => l !== lista && l.classList.remove("alvo"));
      lista.classList.add("alvo");
      const depois = [...lista.querySelectorAll(".card-prop")].filter((c) => c !== card)
        .find((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (depois) lista.insertBefore(card, depois); else lista.appendChild(card);
    };
    alvo.ondrop = (e) => {
      const card = cardArrastado();
      const lista = card && card.closest(".coluna-lista");
      if (!lista) return;
      e.preventDefault();
      UGC.soltou = true;
      const ids = [...lista.querySelectorAll(".card-prop")].map((x) => x.dataset.id);
      const i = ids.indexOf(card.dataset.id);
      const ord = (id) => (UGC.propostas.find((x) => x.id === id) || {}).ordem || 0;
      const ant = ids[i - 1], prox = ids[i + 1];
      moverProposta(card.dataset.id, lista.dataset.status, ant && prox ? (ord(ant) + ord(prox)) / 2 : ant ? ord(ant) + 1 : prox ? ord(prox) - 1 : 0);
    };
    alvo.ondragend = () => {
      $$(".coluna-lista.alvo").forEach((l) => l.classList.remove("alvo"));
      const c = cardArrastado();
      if (c) c.classList.remove("arrastando");
      UGC.arrastando = null;
      if (!UGC.soltou) desenharUgcArea();
    };
  }

  // Números do topo e gráficos (sempre de TODAS as propostas, sem filtro)
  function desenharDash() {
    const el = $("#ugc-dash");
    if (!el) return;
    const ps = UGC.propostas, h = hoje(), d = new Date();
    const seg = dataISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
    const enviadas = ps.filter((p) => p.status !== "enviar" && p.data_envio);
    const responderam = enviadas.filter((p) => p.respondeu_em || RESPONDEU.includes(p.status)).length;
    const aprovadas = ps.filter((p) => p.status === "aprovado");
    const pct = (n) => (enviadas.length ? Math.round((n / enviadas.length) * 100) : 0);
    const valor = aprovadas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const follow = ps.filter((p) => ABERTAS.includes(p.status) && p.proximo_followup && p.proximo_followup <= h).length;
    const cartao = (v, t, sub, cls = "") => `<div class="cartao kpi ${cls}"><span class="rotulo">${t}</span><div class="valor">${v}</div><div class="sub">${sub}</div></div>`;

    const porDia = [];
    for (let i = 13; i >= 0; i--) {
      const dia = dataISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i));
      porDia.push({ date: dia, value: enviadas.filter((p) => p.data_envio === dia).length });
    }
    const porSemana = [];
    for (let i = 7; i >= 0; i--) {
      const ini = new Date(seg + "T12:00:00"); ini.setDate(ini.getDate() - 7 * i);
      const fim = new Date(ini); fim.setDate(fim.getDate() + 6);
      const a = dataISO(ini), b = dataISO(fim);
      porSemana.push({ date: a, value: enviadas.filter((p) => p.data_envio >= a && p.data_envio <= b).length });
    }

    el.innerHTML = `
      <div class="grade grade-4">
        ${cartao(fmtNum(enviadas.length), "Propostas enviadas", "no total")}
        ${cartao(fmtNum(enviadas.filter((p) => p.data_envio === h).length), "Enviadas hoje", esc(fmtDataCurta(h)))}
        ${cartao(fmtNum(enviadas.filter((p) => p.data_envio >= seg && p.data_envio <= h).length), "Nesta semana", "de segunda até hoje")}
        ${cartao(fmtNum(ps.filter((p) => p.status === "enviada").length), "Aguardando resposta", "ainda sem retorno")}
        ${cartao(pct(responderam) + "%", "Já responderam", `${fmtNum(responderam)} de ${fmtNum(enviadas.length)} enviadas`)}
        ${cartao(fmtNum(ps.filter((p) => p.status === "negociacao").length), "Em negociação", "conversando sobre valores")}
        ${cartao(fmtNum(aprovadas.length), "Aprovadas", `${pct(aprovadas.length)}% das enviadas${valor ? " · " + esc(fmtReal(valor)) : ""}`)}
        ${cartao(fmtNum(follow), "Follow-ups pra hoje", follow ? "inclui os atrasados" : "tudo em dia", follow ? "kpi-alerta" : "")}
      </div>
      <div class="grade grade-2" style="margin-top:16px">
        <div class="cartao"><h3>Envios por dia</h3><p class="muted" style="font-size:13px">últimos 14 dias</p>${barras(porDia, "propostas")}</div>
        <div class="cartao"><h3>Envios por semana</h3><p class="muted" style="font-size:13px">últimas 8 semanas (cada barra começa na segunda)</p>${barras(porSemana, "propostas")}</div>
      </div>`;
  }

  function filtradasP() {
    const b = normal(UGC.busca).trim();
    return UGC.propostas.filter((p) => {
      const m = marcaDe(p) || {};
      return (!UGC.canal || p.canal === UGC.canal) &&
        (!b || [nomeMarca(p), m.responsavel, m.email, m.telefone, m.instagram, p.proposta, p.notas].some((v) => normal(v).includes(b)));
    });
  }

  function desenharUgcArea() {
    const area = $("#ugc-area");
    if (!area) return;
    area.innerHTML = UGC.vista === "planilha" ? htmlPlanilhaP() : htmlQuadroP();
  }

  function htmlQuadroP() {
    const lista = filtradasP();
    return `<div class="quadro quadro-p">${ETAPAS_P.map((e, i) => {
      const cards = lista.filter((p) => p.status === e.s).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      return `<section class="coluna" aria-label="${e.t}">
        <header class="coluna-cab"><h3><i class="ponto etapa-${e.s}"></i>${e.t}</h3><span class="contagem">${cards.length}</span></header>
        <div class="coluna-lista" data-status="${e.s}">
          ${cards.map((p) => htmlCardP(p, i)).join("") || `<p class="coluna-vazia">${i === 0 ? "Marcas que você quer abordar" : "Arraste uma proposta pra cá"}</p>`}
        </div>
        ${i === 0 ? `<button type="button" class="btn btn-fantasma btn-pequeno coluna-add" data-nova-p="enviar">${ICON.mais} Adicionar</button>` : ""}
      </section>`;
    }).join("")}</div>`;
  }

  function htmlCardP(p, i) {
    const m = marcaDe(p);
    const ant = ETAPAS_P[i - 1], prox = ETAPAS_P[i + 1];
    const fu = p.proximo_followup && ABERTAS.includes(p.status) ? corPrazo(p.proximo_followup, false) : "";
    return `<article class="card-conteudo card-prop etapa-${esc(p.status)}" draggable="true" data-id="${esc(p.id)}" tabindex="0" aria-label="${esc(nomeMarca(p))}, abrir">
      <div class="card-corpo">
        <h4>${esc(nomeMarca(p))}</h4>
        <div class="prop-linha">${ICON[p.canal] || ICON.outro}<span>${esc(CANAIS_P[p.canal] || p.canal)}</span></div>
        ${m && m.responsavel ? `<div class="prop-linha muted">${esc(m.responsavel)}</div>` : ""}
        <div class="prop-linha muted">${p.data_envio && p.status !== "enviar" ? `Enviada em ${esc(fmtDataCurta(p.data_envio))}` : "Ainda não enviada"}</div>
        ${fu ? `<span class="prazo cor-${fu}"><i></i>Follow-up ${p.proximo_followup === hoje() ? "hoje" : diaMes(p.proximo_followup)}${fu === "vermelho" ? " (atrasado)" : ""}</span>` : ""}
        ${p.valor ? `<div class="prop-valor">${esc(fmtReal(p.valor))}</div>` : ""}
        <div class="card-mover">
          ${ant ? `<button type="button" class="btn-icone" data-mover-p="${ant.s}" aria-label="Mover para ${ant.t}" title="Mover para ${ant.t}">${ICON.voltar}</button>` : ""}
          ${prox ? `<button type="button" class="btn-icone" data-mover-p="${prox.s}" aria-label="Mover para ${prox.t}" title="Mover para ${prox.t}">${ICON.avancar}</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  // O que muda sozinho quando a proposta troca de etapa
  function efeitosStatus(p, status) {
    const c = {};
    const agora = new Date().toISOString();
    if (status !== "enviar" && !p.data_envio) c.data_envio = hoje();
    if (RESPONDEU.includes(status) && !p.respondeu_em) c.respondeu_em = agora;
    if (["aprovado", "nao_deu"].includes(status)) { if (p.status !== status || !p.fechado_em) c.fechado_em = agora; }
    else if (p.fechado_em) c.fechado_em = null;
    return c;
  }

  async function moverProposta(id, status, ordem) {
    const p = UGC.propostas.find((x) => x.id === id);
    if (!p) return;
    if (ordem === undefined) {
      const na = UGC.propostas.filter((x) => x.status === status && x.id !== id);
      ordem = na.length ? Math.max(...na.map((x) => x.ordem || 0)) + 1 : 0;
    }
    const campos = { id, status, ordem, ...efeitosStatus(p, status) };
    const antes = { ...p };
    Object.assign(p, campos);
    desenharDash(); desenharUgcArea();
    const r = await api.salvar("ugc_propostas", campos);
    if (!r.ok) {
      Object.assign(p, antes);
      desenharDash(); desenharUgcArea();
      return toast("Não foi possível mover: " + (r.erro || ""), "erro", 5000);
    }
    if (status === "aprovado" && antes.status !== "aprovado") toast(`${nomeMarca(p)} aprovou! 🎉`, "ok", 4500);
  }

  // ---------- Planilha ----------
  const COLS_P = [
    { k: "marca", t: "Marca" }, { k: "status", t: "Status" }, { k: "canal", t: "Por onde" }, { k: null, t: "Contato" },
    { k: "data_envio", t: "Envio" }, { k: "proximo_followup", t: "Follow-up" }, { k: "valor", t: "Valor" }, { k: "updated_at", t: "Atualizada" },
  ];
  function ordenadasP() {
    const val = (p) => UGC.ordem === "marca" ? normal(nomeMarca(p)) : UGC.ordem === "status" ? ETAPA_P[p.status].i
      : UGC.ordem === "valor" ? (p.valor == null ? null : Number(p.valor)) : p[UGC.ordem];
    return filtradasP().sort((x, y) => {
      const a = val(x), b = val(y);
      if (a == null && b == null) return 0;
      if (a == null || a === "") return 1;
      if (b == null || b === "") return -1;
      const r = a < b ? -1 : a > b ? 1 : 0;
      return UGC.asc ? r : -r;
    });
  }
  function htmlPlanilhaP() {
    const lista = ordenadasP();
    if (!lista.length) {
      return `<div class="cartao vazio" style="padding:36px 12px"><div class="icone-grande">${ICON.ugc}</div>
        <h2>${UGC.busca || UGC.canal ? "Nada encontrado" : "Nenhuma proposta ainda"}</h2>
        <p>${UGC.busca || UGC.canal ? "Tente outra busca ou limpe o filtro." : "Clique em \"Nova proposta\" pra começar."}</p></div>`;
    }
    const cab = COLS_P.map((c) => {
      if (!c.k) return `<th scope="col">${c.t}</th>`;
      const ativo = UGC.ordem === c.k;
      return `<th scope="col" ${ativo ? `aria-sort="${UGC.asc ? "ascending" : "descending"}"` : ""}><button type="button" class="th-ordem" data-ordem-p="${c.k}">${c.t}${ativo ? (UGC.asc ? " ▲" : " ▼") : ""}</button></th>`;
    }).join("");
    const linhas = lista.map((p) => {
      const m = marcaDe(p) || {};
      const fu = p.proximo_followup && ABERTAS.includes(p.status) ? corPrazo(p.proximo_followup, false) : "neutro";
      return `<tr data-abrir-p="${esc(p.id)}" tabindex="0" aria-label="Abrir proposta de ${esc(nomeMarca(p))}">
        <td><b>${esc(nomeMarca(p))}</b></td>
        <td><span class="selo-etapa etapa-${esc(p.status)}">${esc(ETAPA_P[p.status] ? ETAPA_P[p.status].t : p.status)}</span></td>
        <td>${esc(CANAIS_P[p.canal] || p.canal)}</td>
        <td>${m.responsavel ? `<div>${esc(m.responsavel)}</div>` : ""}${m.email ? `<div class="sub">${esc(m.email)}</div>` : ""}${m.telefone ? `<div class="sub">${esc(fmtTel(m.telefone))}</div>` : ""}${m.instagram ? `<div class="sub">${esc(m.instagram)}</div>` : ""}</td>
        <td>${esc(p.status !== "enviar" ? fmtDataCurta(p.data_envio) : "")}</td>
        <td>${p.proximo_followup ? `<span class="prazo cor-${fu}"><i></i>${esc(fmtDataCurta(p.proximo_followup))}</span>` : ""}</td>
        <td class="num">${esc(fmtReal(p.valor))}</td>
        <td>${esc(fmtData(p.updated_at))}</td>
      </tr>`;
    }).join("");
    return `<div class="tabela-rolagem"><table class="tabela tabela-leads tabela-prop"><thead><tr>${cab}</tr></thead><tbody>${linhas}</tbody></table></div>
      <p class="muted" style="font-size:13px;margin-top:10px">${fmtNum(lista.length)} proposta(s). Clique numa linha pra abrir.</p>`;
  }

  // CSV que abre no Excel e no Google Planilhas (com os filtros atuais)
  function baixarPropostas() {
    const lista = ordenadasP();
    if (!lista.length) return toast("Nenhuma proposta pra baixar com esses filtros.");
    const cel = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // protege contra fórmulas
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cab = ["Marca", "Status", "Por onde", "Responsável", "E-mail", "Telefone", "Instagram", "Data de envio", "Próximo follow-up", "Valor", "O que foi proposto", "Anotações"];
    const linhas = lista.map((p) => {
      const m = marcaDe(p) || {};
      return [nomeMarca(p), (ETAPA_P[p.status] || {}).t || p.status, CANAIS_P[p.canal] || p.canal, m.responsavel, m.email, fmtTel(m.telefone), m.instagram,
        p.status !== "enviar" ? fmtDataCurta(p.data_envio) : "", fmtDataCurta(p.proximo_followup),
        p.valor != null ? String(p.valor).replace(".", ",") : "", p.proposta, p.notas].map(cel).join(";");
    });
    const url = URL.createObjectURL(new Blob(["﻿" + [cab.join(";"), ...linhas].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `prospeccao-${hoje()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Planilha com ${fmtNum(lista.length)} proposta(s) baixada.`, "ok");
  }

  // ---------- Ficha da proposta ----------
  function abrirProposta(p, padrao = {}) {
    const nova = !p;
    const ed = { status: "enviar", canal: "instagram", ...(p || {}), ...padrao };
    const m0 = marcaDe(ed);
    let sujo = false;
    const opcoes = (mapa, atual) => Object.entries(mapa).map(([v, t]) => `<option value="${v}" ${atual === v ? "selected" : ""}>${t}</option>`).join("");

    abrirModal(`
      <div class="modal-cab"><h2>${nova ? "Nova proposta" : "Proposta"}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <label class="campo"><span class="rotulo">Marca</span>
        <input type="text" id="pp-marca" list="pp-marcas" value="${esc((m0 && m0.nome) || ed.marca_nome || "")}" placeholder="Ex: Marca X" maxlength="100">
        <datalist id="pp-marcas">${UGC.marcas.map((m) => `<option value="${esc(m.nome)}">`).join("")}</datalist></label>
      <div class="grade grade-2">
        <label class="campo"><span class="rotulo">Por onde</span><select id="pp-canal">${opcoes(CANAIS_P, ed.canal)}</select></label>
        <label class="campo"><span class="rotulo">Como está</span><select id="pp-status">${opcoes(Object.fromEntries(ETAPAS_P.map((e) => [e.s, e.t])), ed.status)}</select></label>
      </div>
      <div class="grade grade-2">
        <label class="campo"><span class="rotulo">Data de envio</span><input type="date" id="pp-envio" value="${esc(ed.data_envio || (nova && ed.status !== "enviar" ? hoje() : ""))}"></label>
        <div class="campo"><label class="rotulo" for="pp-follow">Próximo follow-up</label><input type="date" id="pp-follow" value="${esc(ed.proximo_followup || "")}">
          <div class="linha-btns" style="margin-top:6px">
            <button type="button" class="btn btn-fantasma btn-pequeno" data-follow="3">+3 dias</button>
            <button type="button" class="btn btn-fantasma btn-pequeno" data-follow="7">+7 dias</button>
            <button type="button" class="btn btn-fantasma btn-pequeno" data-follow="0">Limpar</button>
          </div></div>
      </div>

      <h3 class="sub-titulo">Dados da marca</h3>
      <div class="grade grade-2">
        <label class="campo"><span class="rotulo">Responsável</span><input type="text" id="pp-responsavel" value="${esc((m0 && m0.responsavel) || "")}" placeholder="Nome de quem cuida"></label>
        <label class="campo"><span class="rotulo">E-mail</span><input type="email" id="pp-email" value="${esc((m0 && m0.email) || "")}" placeholder="contato@marca.com"></label>
        <label class="campo"><span class="rotulo">Telefone / WhatsApp</span><input type="text" id="pp-telefone" value="${esc((m0 && m0.telefone) || "")}" placeholder="(47) 99999-0000"></label>
        <label class="campo"><span class="rotulo">Instagram</span><input type="text" id="pp-instagram" value="${esc((m0 && m0.instagram) || "")}" placeholder="@marca"></label>
      </div>
      <div class="contato-rapido" id="pp-contato"></div>

      <label class="campo"><span class="rotulo">Valor proposto ou combinado (opcional)</span>
        <input type="text" id="pp-valor" inputmode="decimal" value="${ed.valor != null ? esc(String(ed.valor).replace(".", ",")) : ""}" placeholder="Ex: R$ 950"></label>
      <label class="campo"><span class="rotulo">O que você propôs</span>
        <textarea id="pp-proposta" rows="3" placeholder="Ex: 3 vídeos UGC + direitos de uso por 3 meses">${esc(ed.proposta || "")}</textarea></label>
      <label class="campo"><span class="rotulo">Anotações</span>
        <textarea id="pp-notas" rows="3" placeholder="O que a marca disse, o que falta mandar...">${esc(ed.notas || "")}</textarea></label>

      <div class="modal-rodape" style="justify-content:space-between">
        ${nova ? "<span></span>" : `<button type="button" class="btn btn-perigo" data-excluir>${ICON.lixo} Excluir</button>`}
        <span style="display:flex;gap:8px"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primario" data-salvar>Salvar</button></span>
      </div>`, aoClicar, "largo", () => !sujo || confirm("Você tem alterações não salvas. Fechar mesmo assim?"));

    const v = (id) => $("#" + id).value.trim();
    const dadosContato = () => ({ responsavel: v("pp-responsavel"), email: v("pp-email"), telefone: v("pp-telefone"), instagram: v("pp-instagram") });
    const atualizarContato = () => {
      const html = botoesContato({ ...dadosContato(), site: (m0 && m0.site) || "" });
      $("#pp-contato").innerHTML = html ? `<span class="rotulo" style="margin:0">Falar com a marca</span>${html}` : "";
    };
    atualizarContato();
    if (nova) setTimeout(() => { const t = $("#pp-marca"); if (t && !t.value) t.focus(); }, 50);

    const m = $("#modal");
    m.oninput = (e) => {
      sujo = true;
      if (e.target.id === "pp-marca") {
        // escolheu uma marca já cadastrada: completa os dados que estão vazios
        const achada = acharMarcaPorNome(e.target.value);
        if (achada) ["responsavel", "email", "telefone", "instagram"].forEach((k) => { const c = $("#pp-" + k); if (!c.value && achada[k]) c.value = achada[k]; });
      }
      atualizarContato();
    };
    m.onchange = (e) => {
      sujo = true;
      if (e.target.id === "pp-status" && e.target.value !== "enviar" && !$("#pp-envio").value) $("#pp-envio").value = hoje();
    };

    async function aoClicar(e) {
      const fb = e.target.closest("[data-follow]");
      if (fb) {
        const n = Number(fb.dataset.follow);
        const d = new Date(); d.setDate(d.getDate() + n);
        $("#pp-follow").value = n ? dataISO(d) : "";
        sujo = true;
        return;
      }
      if (e.target.closest("[data-excluir]")) {
        if (!confirm(`Excluir a proposta de ${nomeMarca(ed)}? A marca continua cadastrada.`)) return;
        if (!(await api.apagar("ugc_propostas", [ed.id]))) return toast("Não foi possível excluir. Tente de novo.", "erro");
        sujo = false; fecharModal(); toast("Proposta excluída.");
        return recarregarUgc();
      }
      const btn = e.target.closest("[data-salvar]");
      if (!btn) return;
      const nome = v("pp-marca");
      if (!nome) { toast("Escreva o nome da marca.", "erro"); $("#pp-marca").focus(); return; }
      const contato = dadosContato();
      if (contato.email && !/^\S+@\S+\.\S+$/.test(contato.email)) { toast("Esse e-mail parece incompleto.", "erro"); $("#pp-email").focus(); return; }
      const valorTxt = v("pp-valor");
      const valor = lerValor(valorTxt);
      if (valorTxt && valor == null) { toast("Não entendi o valor. Use só números, ex: 950 ou 1.200,50", "erro"); return; }

      btn.disabled = true; btn.textContent = "Salvando...";
      const pronto = () => { btn.disabled = false; btn.textContent = "Salvar"; };

      // 1) a marca: cria se não existe, ou atualiza os dados de contato
      let marca = acharMarcaPorNome(nome);
      if (!marca) {
        const r = await api.salvar("ugc_marcas", { nome, cupons: [], links: [], arquivos: [], parceira: false,
          ...Object.fromEntries(Object.entries(contato).map(([k, x]) => [k, x || null])) });
        if (!r.ok) { pronto(); return toast("Não foi possível salvar a marca: " + (r.erro || ""), "erro", 5000); }
        marca = r.data; UGC.marcas.push(marca);
      } else {
        const mudou = Object.fromEntries(Object.entries(contato).filter(([k, x]) => x !== (marca[k] || "")).map(([k, x]) => [k, x || null]));
        if (Object.keys(mudou).length) {
          const r = await api.salvar("ugc_marcas", { id: marca.id, ...mudou });
          if (!r.ok) { pronto(); return toast("Não foi possível atualizar a marca: " + (r.erro || ""), "erro", 5000); }
        }
      }

      // 2) a proposta
      const status = $("#pp-status").value;
      const base = { ...ed, data_envio: $("#pp-envio").value || null };
      const campos = {
        marca_id: marca.id, marca_nome: marca.nome, status, canal: $("#pp-canal").value,
        data_envio: $("#pp-envio").value || null, proximo_followup: $("#pp-follow").value || null,
        valor, proposta: $("#pp-proposta").value, notas: $("#pp-notas").value,
        ...efeitosStatus(base, status),
      };
      if (nova || status !== ed.status) {
        const na = UGC.propostas.filter((x) => x.status === status && x.id !== ed.id);
        campos.ordem = na.length ? Math.max(...na.map((x) => x.ordem || 0)) + 1 : 0;
      }
      if (!nova) campos.id = ed.id;
      const r = await api.salvar("ugc_propostas", campos);
      if (!r.ok) { pronto(); return toast("Não foi possível salvar: " + (r.erro || ""), "erro", 5000); }
      sujo = false;
      fecharModal();
      toast(r.local ? "Salvo neste navegador (modo de teste)." : status === "aprovado" && ed.status !== "aprovado" ? `${marca.nome} aprovou! 🎉` : "Proposta salva.", "ok");
      recarregarUgc();
    }
  }

  // ---------- Marcas ----------
  function desenharMarcas() {
    const alvo = $("#ugc-conteudo");
    alvo.innerHTML = `${avisoUgc()}
      <div class="ferramentas">
        <input type="search" id="mc-busca" placeholder="Buscar marca, segmento, cupom, responsável" value="${esc(UGC.buscaM)}" aria-label="Buscar marcas">
        <label class="switch"><input type="checkbox" id="mc-parceiras" ${UGC.soParceiras ? "checked" : ""}><span class="trilho"></span><span>Só parcerias ativas</span></label>
      </div>
      <div id="mc-area"></div>`;
    desenharMarcasArea();
    alvo.oninput = (e) => { if (e.target.id === "mc-busca") { UGC.buscaM = e.target.value; desenharMarcasArea(); } };
    alvo.onchange = (e) => { if (e.target.id === "mc-parceiras") { UGC.soParceiras = e.target.checked; desenharMarcasArea(); } };
    alvo.onclick = (e) => {
      const b = e.target.closest("[data-abrir-m],[data-copiar-v]");
      if (!b) return;
      if (b.dataset.copiarV) return copiarTexto(b.dataset.copiarV, "Copiado.");
      const m = UGC.marcas.find((x) => x.id === b.dataset.abrirM);
      if (m) abrirMarca(m);
    };
    alvo.onkeydown = null; alvo.ondragstart = null; alvo.ondragover = null; alvo.ondrop = null; alvo.ondragend = null;
  }

  function desenharMarcasArea() {
    const area = $("#mc-area");
    if (!area) return;
    const b = normal(UGC.buscaM).trim();
    const lista = UGC.marcas
      .filter((m) => (!UGC.soParceiras || m.parceira) &&
        (!b || [m.nome, m.segmento, m.responsavel, m.email, m.instagram, ...(m.cupons || []).map((c) => c.codigo)].some((v) => normal(v).includes(b))))
      .sort((x, y) => Number(y.parceira) - Number(x.parceira) || x.nome.localeCompare(y.nome, "pt-BR"));
    if (!lista.length) {
      area.innerHTML = `<div class="cartao vazio"><div class="icone-grande">${ICON.ugc}</div>
        <h2>${b || UGC.soParceiras ? "Nenhuma marca encontrada" : "Nenhuma marca ainda"}</h2>
        <p>${b || UGC.soParceiras ? "Tente outra busca." : "Cadastre uma marca aqui, ou crie uma proposta na Prospecção: a marca é cadastrada sozinha."}</p></div>`;
      return;
    }
    area.innerHTML = `<div class="marcas-grade">${lista.map((m) => {
      const ps = UGC.propostas.filter((p) => p.marca_id === m.id).sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1));
      const ult = ps[0];
      const cupons = m.cupons || [], links = m.links || [], arqs = m.arquivos || [];
      return `<article class="marca-card">
        <button type="button" class="marca-card-topo" data-abrir-m="${esc(m.id)}" aria-label="Abrir ${esc(m.nome)}">
          <span class="marca-inicial">${esc((m.nome || "?").trim().charAt(0).toUpperCase())}</span>
          <span class="marca-card-txt"><b>${esc(m.nome)}</b><span class="sub">${esc(m.segmento || m.responsavel || m.instagram || "")}</span></span>
          ${m.parceira ? `<span class="selo ok">Parceria ativa</span>` : ""}
        </button>
        ${cupons.length ? `<div class="marca-cupons">${cupons.slice(0, 3).map((c) => `<button type="button" class="cupom" data-copiar-v="${esc(c.codigo)}" title="Copiar cupom ${esc(c.codigo)}">${ICON.copiar}<span>${esc(c.codigo)}</span></button>`).join("")}</div>` : ""}
        ${links.length ? `<div class="marca-links">${links.slice(0, 2).map((l) => `<button type="button" class="link-copiar" data-copiar-v="${esc(l.url)}" title="Copiar ${esc(l.rotulo || "link")}">${ICON.link}<span>${esc(l.rotulo || dominio(l.url))}</span></button>`).join("")}</div>` : ""}
        <div class="marca-rodape">
          <span>${arqs.length ? `${ICON.arquivo} ${arqs.length} ${arqs.length === 1 ? "arquivo" : "arquivos"}` : ""}</span>
          ${ult ? `<span class="selo-etapa etapa-${esc(ult.status)}">${esc(ETAPA_P[ult.status] ? ETAPA_P[ult.status].t : ult.status)}</span>` : ""}
        </div>
      </article>`;
    }).join("")}</div>`;
  }

  // Ficha da marca: contato, cupons, links, contratos/arquivos, propostas
  function abrirMarca(m) {
    const nova = !m;
    const ed = { nome: "", parceira: false, ...(m || {}) };
    ed.cupons = (ed.cupons || []).map((c) => ({ codigo: c.codigo || "", descricao: c.descricao || "" }));
    ed.links = (ed.links || []).map((l) => ({ rotulo: l.rotulo || "", url: l.url || "" }));
    let arquivos = (ed.arquivos || []).slice();
    const pendentes = [];   // arquivos escolhidos, enviados só ao salvar
    const removidos = [];   // caminhos pra apagar do Storage ao salvar
    let sujo = false;
    const propostas = nova ? [] : UGC.propostas.filter((p) => p.marca_id === ed.id).sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1));

    const cuponsHtml = () => ed.cupons.length ? ed.cupons.map((c, i) => `<div class="linha-edit">
        <input type="text" data-cupom="${i}" data-c="codigo" value="${esc(c.codigo)}" placeholder="CUPOM10" aria-label="Código do cupom ${i + 1}">
        <input type="text" data-cupom="${i}" data-c="descricao" value="${esc(c.descricao)}" placeholder="Ex: 10% off no site" aria-label="Descrição do cupom ${i + 1}">
        <button type="button" class="btn-icone" data-copiar-cupom="${i}" aria-label="Copiar cupom" title="Copiar">${ICON.copiar}</button>
        <button type="button" class="btn-icone" data-del-cupom="${i}" aria-label="Remover cupom" title="Remover">${ICON.x}</button>
      </div>`).join("") : `<p class="muted" style="font-size:13px;margin:0 0 6px">Nenhum cupom.</p>`;
    const linksHtml = () => ed.links.length ? ed.links.map((l, i) => `<div class="linha-edit linha-edit-5">
        <input type="text" data-lnk="${i}" data-c="rotulo" value="${esc(l.rotulo)}" placeholder="Ex: Link de indicação" aria-label="Nome do link ${i + 1}">
        <input type="url" data-lnk="${i}" data-c="url" value="${esc(l.url)}" placeholder="https://..." aria-label="Endereço do link ${i + 1}">
        <button type="button" class="btn-icone" data-copiar-lnk="${i}" aria-label="Copiar link" title="Copiar">${ICON.copiar}</button>
        <button type="button" class="btn-icone" data-abrir-lnk="${i}" aria-label="Abrir link" title="Abrir">${ICON.link}</button>
        <button type="button" class="btn-icone" data-del-lnk="${i}" aria-label="Remover link" title="Remover">${ICON.x}</button>
      </div>`).join("") : `<p class="muted" style="font-size:13px;margin:0 0 6px">Nenhum link.</p>`;
    const arquivosHtml = () => (arquivos.length || pendentes.length) ? `<ul class="arq-lista">
        ${arquivos.map((a, i) => `<li>${ICON.arquivo}<span class="arq-nome">${esc(a.nome)}</span><span class="muted">${esc(fmtTam(a.tamanho))}</span>
          <button type="button" class="btn btn-pequeno" data-abrir-arq="${i}">Abrir</button>
          <button type="button" class="btn-icone" data-del-arq="${i}" aria-label="Remover ${esc(a.nome)}">${ICON.x}</button></li>`).join("")}
        ${pendentes.map((f, i) => `<li class="pendente">${ICON.enviarArq}<span class="arq-nome">${esc(f.name)}</span><span class="muted">${esc(fmtTam(f.size))} · enviado ao salvar</span>
          <button type="button" class="btn-icone" data-del-pend="${i}" aria-label="Remover ${esc(f.name)}">${ICON.x}</button></li>`).join("")}
      </ul>` : `<p class="muted" style="font-size:13px;margin:0 0 6px">Nenhum contrato ou arquivo.</p>`;

    abrirModal(`
      <div class="modal-cab"><h2>${nova ? "Nova marca" : esc(ed.nome)}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <div class="grade grade-2">
        <label class="campo"><span class="rotulo">Nome da marca</span><input type="text" id="mm-nome" value="${esc(ed.nome)}" placeholder="Ex: Marca X" maxlength="100"></label>
        <label class="campo"><span class="rotulo">Segmento</span><input type="text" id="mm-segmento" value="${esc(ed.segmento || "")}" placeholder="Ex: skincare, moda infantil"></label>
      </div>
      <label class="switch" style="margin-bottom:16px"><input type="checkbox" id="mm-parceira" ${ed.parceira ? "checked" : ""}><span class="trilho"></span><span>Parceria ativa</span></label>

      <h3 class="sub-titulo">Contato</h3>
      <div class="grade grade-2">
        <label class="campo"><span class="rotulo">Responsável</span><input type="text" id="mm-responsavel" value="${esc(ed.responsavel || "")}"></label>
        <label class="campo"><span class="rotulo">E-mail</span><input type="email" id="mm-email" value="${esc(ed.email || "")}"></label>
        <label class="campo"><span class="rotulo">Telefone / WhatsApp</span><input type="text" id="mm-telefone" value="${esc(ed.telefone || "")}"></label>
        <label class="campo"><span class="rotulo">Instagram</span><input type="text" id="mm-instagram" value="${esc(ed.instagram || "")}" placeholder="@marca"></label>
      </div>
      <label class="campo"><span class="rotulo">Site</span><input type="url" id="mm-site" value="${esc(ed.site || "")}" placeholder="https://..."></label>
      <div class="contato-rapido" id="mm-contato"></div>

      <h3 class="sub-titulo">Cupons</h3>
      <div id="mm-cupons">${cuponsHtml()}</div>
      <button type="button" class="btn btn-fantasma btn-pequeno" data-add-cupom>${ICON.mais} Adicionar cupom</button>

      <h3 class="sub-titulo">Links (indicação, briefing, mídia kit...)</h3>
      <div id="mm-links">${linksHtml()}</div>
      <button type="button" class="btn btn-fantasma btn-pequeno" data-add-lnk>${ICON.mais} Adicionar link</button>

      <h3 class="sub-titulo">Contratos e arquivos</h3>
      <div id="mm-arquivos">${arquivosHtml()}</div>
      <input type="file" id="mm-arquivo" multiple hidden>
      <button type="button" class="btn btn-fantasma btn-pequeno" data-add-arq>${ICON.enviarArq} Anexar arquivo</button>
      <p class="ajuda">PDF de contrato, briefing, nota fiscal... até 20 MB cada, numa pasta privada.</p>

      <label class="campo" style="margin-top:14px"><span class="rotulo">Anotações</span>
        <textarea id="mm-notas" rows="3" placeholder="Prazos de pagamento, regras de uso de imagem, preferências da marca...">${esc(ed.notas || "")}</textarea></label>

      ${nova ? "" : `<h3 class="sub-titulo">Propostas</h3>
        ${propostas.length ? `<ul class="historico">${propostas.map((p) => `<li>
          <span class="quando">${esc(p.data_envio && p.status !== "enviar" ? fmtDataCurta(p.data_envio) : "não enviada")}</span>
          <span class="oque">${esc(CANAIS_P[p.canal] || p.canal)}${p.valor ? ` · ${esc(fmtReal(p.valor))}` : ""}${p.proposta ? `<span class="sub">${esc(p.proposta)}</span>` : ""}</span>
          <span class="selo-etapa etapa-${esc(p.status)}">${esc(ETAPA_P[p.status] ? ETAPA_P[p.status].t : p.status)}</span></li>`).join("")}</ul>` : `<p class="muted" style="font-size:13px">Nenhuma proposta ainda.</p>`}
        <button type="button" class="btn btn-pequeno" style="margin-top:8px" data-nova-prop>${ICON.mais} Nova proposta pra esta marca</button>`}

      <div class="modal-rodape" style="justify-content:space-between">
        ${nova ? "<span></span>" : `<button type="button" class="btn btn-perigo" data-excluir>${ICON.lixo} Excluir</button>`}
        <span style="display:flex;gap:8px"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primario" data-salvar>Salvar</button></span>
      </div>`, aoClicar, "largo", () => !sujo || confirm("Você tem alterações não salvas. Fechar mesmo assim?"));

    const v = (id) => $("#" + id).value.trim();
    const atualizarContato = () => {
      const html = botoesContato({ email: v("mm-email"), telefone: v("mm-telefone"), instagram: v("mm-instagram"), site: v("mm-site") });
      $("#mm-contato").innerHTML = html ? `<span class="rotulo" style="margin:0">Falar com a marca</span>${html}` : "";
    };
    atualizarContato();
    if (nova) setTimeout(() => { const t = $("#mm-nome"); if (t) t.focus(); }, 50);

    const md = $("#modal");
    md.oninput = (e) => {
      sujo = true;
      const t = e.target;
      if (t.dataset.cupom !== undefined) ed.cupons[+t.dataset.cupom][t.dataset.c] = t.value;
      if (t.dataset.lnk !== undefined) ed.links[+t.dataset.lnk][t.dataset.c] = t.value;
      if (/^mm-(email|telefone|instagram|site)$/.test(t.id)) atualizarContato();
    };
    md.onchange = (e) => {
      sujo = true;
      if (e.target.id === "mm-arquivo" && e.target.files.length) {
        const limite = USA_BANCO ? LIMITE_ARQUIVO : LIMITE_LOCAL;
        [...e.target.files].forEach((f) => {
          if (f.size > limite) toast(`${f.name} passa de ${fmtTam(limite)}. Use um link do Google Drive pra esse.`, "erro", 6000);
          else pendentes.push(f);
        });
        e.target.value = "";
        $("#mm-arquivos").innerHTML = arquivosHtml();
      }
    };

    async function aoClicar(e) {
      const b = e.target.closest("button");
      if (!b) return;
      const d = b.dataset;
      if (d.addCupom !== undefined) { ed.cupons.push({ codigo: "", descricao: "" }); sujo = true; $("#mm-cupons").innerHTML = cuponsHtml(); const x = $(`[data-cupom="${ed.cupons.length - 1}"]`); if (x) x.focus(); return; }
      if (d.delCupom !== undefined) { ed.cupons.splice(+d.delCupom, 1); sujo = true; $("#mm-cupons").innerHTML = cuponsHtml(); return; }
      if (d.copiarCupom !== undefined) { const c = ed.cupons[+d.copiarCupom].codigo.trim(); if (c) copiarTexto(c, "Cupom copiado."); return; }
      if (d.addLnk !== undefined) { ed.links.push({ rotulo: "", url: "" }); sujo = true; $("#mm-links").innerHTML = linksHtml(); const x = $(`[data-lnk="${ed.links.length - 1}"]`); if (x) x.focus(); return; }
      if (d.delLnk !== undefined) { ed.links.splice(+d.delLnk, 1); sujo = true; $("#mm-links").innerHTML = linksHtml(); return; }
      if (d.copiarLnk !== undefined) { const u = ed.links[+d.copiarLnk].url.trim(); if (u) copiarTexto(u, "Link copiado."); return; }
      if (d.abrirLnk !== undefined) { const u = ed.links[+d.abrirLnk].url; if (urlValida(u)) window.open(u.trim(), "_blank", "noopener"); else toast("Cole o link completo (começando com https://).", "erro"); return; }
      if (d.addArq !== undefined) return $("#mm-arquivo").click();
      if (d.delPend !== undefined) { pendentes.splice(+d.delPend, 1); $("#mm-arquivos").innerHTML = arquivosHtml(); return; }
      if (d.delArq !== undefined) {
        const a = arquivos[+d.delArq];
        if (!confirm(`Remover "${a.nome}"? Ele é apagado quando você salvar.`)) return;
        removidos.push(a.path); arquivos.splice(+d.delArq, 1); sujo = true;
        $("#mm-arquivos").innerHTML = arquivosHtml();
        return;
      }
      if (d.abrirArq !== undefined) {
        const a = arquivos[+d.abrirArq];
        const janela = window.open("about:blank", "_blank");
        try {
          const url = await api.urlArquivo("ugc", a.path);
          if (!url) throw new Error("indisponível no modo de teste");
          if (janela) { janela.opener = null; janela.location.href = url; } else location.href = url;
        } catch (err) { if (janela) janela.close(); toast("Não foi possível abrir: " + err.message, "erro", 5000); }
        return;
      }
      if (d.novaProp !== undefined) {
        if (sujo && !confirm("Você tem alterações não salvas nesta marca. Continuar mesmo assim?")) return;
        return abrirProposta(null, { marca_id: ed.id, marca_nome: ed.nome, status: "enviar" });
      }
      if (d.excluir !== undefined) {
        const n = propostas.length;
        if (!confirm(`Excluir a marca ${ed.nome}?${n ? ` As ${n} proposta(s) dela continuam na Prospecção, só sem o cadastro da marca.` : ""} Os arquivos anexados são apagados. Não dá pra desfazer.`)) return;
        await api.apagarArquivos("ugc", arquivos.map((a) => a.path).concat(removidos));
        if (!(await api.apagar("ugc_marcas", [ed.id]))) return toast("Não foi possível excluir. Tente de novo.", "erro");
        sujo = false; fecharModal(); toast("Marca excluída.");
        return recarregarUgc();
      }
      if (d.salvar === undefined) return;

      const nome = v("mm-nome");
      if (!nome) { toast("Escreva o nome da marca.", "erro"); $("#mm-nome").focus(); return; }
      const outra = acharMarcaPorNome(nome);
      if (outra && outra.id !== ed.id) { toast(`Já existe uma marca chamada ${outra.nome}.`, "erro", 5000); return; }
      const email = v("mm-email");
      if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast("Esse e-mail parece incompleto.", "erro"); $("#mm-email").focus(); return; }
      const site = v("mm-site");
      if (site && !urlValida(site)) { toast("O site precisa começar com https://", "erro"); $("#mm-site").focus(); return; }
      const links = ed.links.map((l) => ({ rotulo: l.rotulo.trim(), url: l.url.trim() })).filter((l) => l.rotulo || l.url);
      if (links.some((l) => !urlValida(l.url))) { toast("Algum link está incompleto (precisa começar com https://).", "erro", 5000); return; }

      b.disabled = true; b.textContent = "Salvando...";
      const pronto = () => { b.disabled = false; b.textContent = "Salvar"; };
      for (const [i, f] of pendentes.entries()) {
        toast(`Enviando ${i + 1} de ${pendentes.length}: ${f.name}`, "", 60000);
        const up = await api.enviarArquivo("ugc", f);
        if (!up.ok) { pronto(); return toast(`Não foi possível enviar ${f.name}: ${up.erro || ""}`, "erro", 6000); }
        arquivos.push({ nome: f.name, path: up.path, tipo: f.type || "", tamanho: f.size });
      }
      pendentes.length = 0;
      const campos = {
        nome, segmento: v("mm-segmento") || null, parceira: $("#mm-parceira").checked,
        responsavel: v("mm-responsavel") || null, email: email || null, telefone: v("mm-telefone") || null,
        instagram: v("mm-instagram") || null, site: site || null,
        cupons: ed.cupons.map((c) => ({ codigo: c.codigo.trim(), descricao: c.descricao.trim() })).filter((c) => c.codigo),
        links, arquivos, notas: $("#mm-notas").value,
      };
      if (!nova) campos.id = ed.id;
      const r = await api.salvar("ugc_marcas", campos);
      if (!r.ok) { pronto(); return toast("Não foi possível salvar: " + (r.erro || ""), "erro", 5000); }
      if (removidos.length) api.apagarArquivos("ugc", removidos);
      // mantém o nome nas propostas em dia (aparece na planilha mesmo se a marca for apagada depois)
      if (!nova && nome !== ed.nome) {
        for (const p of propostas) await api.salvar("ugc_propostas", { id: p.id, marca_nome: nome });
      }
      sujo = false;
      fecharModal();
      toast(r.local ? "Salvo neste navegador (modo de teste)." : "Marca salva.", "ok");
      recarregarUgc();
    }
  }

  // ---------- Instagram ----------
  function telaInstagram(sub) {
    if (!["automacoes", "leads"].includes(sub)) sub = "metricas";
    conteudo().innerHTML = `
      <div class="cabecalho">
        <div>
          <h1>Instagram</h1>
          <p class="muted">Métricas da conta e respostas automáticas no direct.</p>
        </div>
      </div>
      <nav class="abas">
        <a href="#/instagram/metricas" class="${sub === "metricas" ? "ativo" : ""}">Métricas</a>
        <a href="#/instagram/automacoes" class="${sub === "automacoes" ? "ativo" : ""}">Automações</a>
        <a href="#/instagram/leads" class="${sub === "leads" ? "ativo" : ""}">Leads</a>
      </nav>
      <div id="sub-conteudo"></div>`;
    if (sub === "automacoes") return telaAutomacoes();
    if (sub === "leads") return telaLeads();
    return telaMetricas();
  }

  // ---------- Métricas ----------
  async function telaMetricas() {
    const alvo = $("#sub-conteudo");
    alvo.innerHTML = `<p class="muted">Carregando métricas...</p>`;
    const [ins, cont, leads] = await Promise.all([api.insights(), api.contagens(), api.leadsRecentes()]);
    if (!$("#sub-conteudo")) return;

    const blocoLeads = `
      <div class="cartao" style="margin-top:16px">
        <div class="linha-topo"><h3>Últimos leads</h3><span class="muted" style="font-size:13px">${fmtNum(cont.leads)} no total · <a href="#/instagram/leads">ver todos</a></span></div>
        ${leads.length ? `<div style="overflow-x:auto;margin-top:10px"><table class="tabela">
          <thead><tr><th>Usuário</th><th>Palavra</th><th>Origem</th><th>Contato</th><th>Desde</th></tr></thead>
          <tbody>${leads.map((l) => `<tr>
            <td>${l.username ? "@" + esc(l.username) : esc(l.ig_user_id)}</td>
            <td>${esc(l.last_keyword || "")}</td>
            <td>${esc({ comment: "comentário", dm: "direct", story_reply: "story" }[l.last_source] || l.last_source || "")}</td>
            <td>${esc(l.email || l.telefone || "")}</td>
            <td>${esc(fmtDia(l.created_at))}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="muted" style="margin-top:8px;font-size:14px">Ainda não tem leads. Eles aparecem aqui quando alguém comentar a palavra-chave.</p>`}
      </div>`;

    if (!ins || !ins.connected) {
      alvo.innerHTML = `
        <div class="cartao vazio">
          <div class="icone-grande">${ICON.instagram}</div>
          <h2>Conecte seu Instagram pra ver as métricas</h2>
          <p>Quando o Supabase e a API do Instagram estiverem configurados (veja o LEIA-ME), seus seguidores e o alcance aparecem aqui.</p>
          ${diagnostico(ins)}
        </div>
        <div class="grade grade-3" style="margin-top:16px">
          <div class="cartao kpi"><span class="rotulo">Leads captados</span><div class="valor">${fmtNum(cont.leads)}</div><div class="sub">vem do seu banco</div></div>
        </div>
        ${blocoLeads}`;
      return;
    }

    const somaNovos = (ins.new_followers || []).reduce((s, d) => s + (d.value || 0), 0);
    const somaAlcance = (ins.reach || []).reduce((s, d) => s + (d.value || 0), 0);
    alvo.innerHTML = `
      <div class="grade grade-3">
        <div class="cartao kpi"><span class="rotulo">Seguidores</span><div class="valor">${fmtNum(ins.followers)}</div><div class="sub">@${esc(ins.username || "")}</div></div>
        <div class="cartao kpi"><span class="rotulo">Novos seguidores</span><div class="valor">${fmtNum(somaNovos)}</div><div class="sub">últimos 15 dias</div></div>
        <div class="cartao kpi"><span class="rotulo">Leads captados</span><div class="valor">${fmtNum(cont.leads)}</div><div class="sub">pelas automações</div></div>
      </div>
      <div class="grade grade-2" style="margin-top:16px">
        <div class="cartao"><h3>Novos seguidores por dia</h3>${barras(ins.new_followers, "novos")}</div>
        <div class="cartao"><h3>Alcance por dia</h3><p class="muted" style="font-size:13px">${fmtNum(somaAlcance)} no período</p>${barras(ins.reach, "contas")}</div>
      </div>
      ${blocoLeads}`;
  }

  // Explica por que as métricas não carregaram (mostra o que falta configurar)
  function diagnostico(r) {
    if (!USA_BANCO || !r || !r.erro) return "";
    const e = String(r.erro);
    let dica = "Confira os segredos do Instagram no Supabase (Edge Functions > Secrets).";
    if (/IG_ACCESS_TOKEN/.test(e)) dica = "Falta o token do Instagram: crie o segredo IG_ACCESS_TOKEN no Supabase (Edge Functions > Secrets).";
    else if (/\b190\b|expired|Invalid OAuth|access token/i.test(e)) dica = "O token do Instagram é inválido ou venceu. Gere um novo no Meta e atualize o segredo IG_ACCESS_TOKEN.";
    else if (/\b(10|100|200)\b|permission/i.test(e)) dica = "O token não tem a permissão necessária, ou o IG_ACCOUNT_ID está errado. Gere o token de novo no Meta e confira o id da conta.";
    else if (/login|401/i.test(e)) dica = "Sua sessão expirou. Saia e entre de novo.";
    else if (/fetch|Failed to send|network/i.test(e)) dica = "Não foi possível falar com a função ig-insights. Confira se ela está publicada no Supabase.";
    return `<p class="alerta" style="max-width:520px;margin:0 auto 8px;text-align:left"><strong>O que falta:</strong> ${esc(dica)}<br><span class="muted" style="font-size:12px">Detalhe técnico: ${esc(e)}</span></p>`;
  }

  // Mini gráfico de barras com hover mostrando o número de cada dia
  function barras(serie, unidade) {
    const dados = (serie || []).slice(-15);
    if (!dados.length) return `<p class="muted" style="margin-top:12px;font-size:14px">Sem dados no período.</p>`;
    const max = Math.max(1, ...dados.map((d) => d.value || 0));
    return `<div class="barras">${dados.map((d) =>
      `<div class="barra" style="height:${Math.max(2, ((d.value || 0) / max) * 100)}%" data-tip="${esc(fmtDia(d.date))}: ${fmtNum(d.value)} ${esc(unidade)}"></div>`).join("")}</div>
      <div class="eixo"><span>${esc(fmtDia(dados[0].date))}</span><span>${esc(fmtDia(dados[dados.length - 1].date))}</span></div>`;
  }

  // ---------- Automações (lista) ----------
  async function telaAutomacoes() {
    const alvo = $("#sub-conteudo");
    alvo.innerHTML = `<p class="muted">Carregando automações...</p>`;
    const lista = await api.listarAutomacoes();
    if (!$("#sub-conteudo")) return;

    const topo = `<div class="linha" style="margin-bottom:14px">
      <p class="muted" style="font-size:14px">Quem comenta a palavra recebe a DM sozinho.</p>
      <button class="btn btn-primario" data-acao="nova">${ICON.mais} Nova automação</button>
    </div>`;

    if (!lista.length) {
      alvo.innerHTML = `
        <div class="cartao vazio">
          <div class="icone-grande">${ICON.raio}</div>
          <h2>Nenhuma automação ainda</h2>
          <p>Crie a primeira: escolha uma palavra, escreva a mensagem e veja na prévia como ela chega no direct.</p>
          <button class="btn btn-primario" data-acao="nova">${ICON.mais} Nova automação</button>
        </div>`;
    } else {
      alvo.innerHTML = topo + `<div class="lista">${lista.map((a) => {
        const palavras = a.match_any ? [] : String(a.keyword || "").split(",").map((s) => s.trim()).filter(Boolean);
        return `<div class="cartao item-auto" data-id="${esc(a.id)}">
          <div class="info">
            <div class="nome">${esc(a.nome || "Sem nome")} <span class="selo ${a.active ? "ok" : "off"}">${a.active ? "Ligada" : "Desligada"}</span></div>
            <div class="chips">${a.match_any ? `<span class="chip">qualquer palavra</span>` : palavras.map((p) => `<span class="chip">${esc(p)}</span>`).join("")}</div>
          </div>
          <div class="acoes">
            <label class="switch" title="Ligar ou desligar"><input type="checkbox" data-acao="ativa" ${a.active ? "checked" : ""}><span class="trilho"></span></label>
            <button class="btn-icone" data-acao="editar" title="Editar" aria-label="Editar">${ICON.editar}</button>
            <button class="btn-icone" data-acao="apagar" title="Apagar" aria-label="Apagar">${ICON.lixo}</button>
          </div>
        </div>`;
      }).join("")}</div>`;
    }

    alvo.onclick = async (e) => {
      const b = e.target.closest("[data-acao]");
      if (!b) return;
      const id = b.closest("[data-id]") && b.closest("[data-id]").dataset.id;
      const auto = lista.find((x) => x.id === id);
      if (b.dataset.acao === "nova") abrirEditor(null);
      if (b.dataset.acao === "editar" && auto) abrirEditor(auto);
      if (b.dataset.acao === "apagar" && auto) {
        if (!confirm(`Apagar a automação "${auto.nome || "Sem nome"}"? Isso não pode ser desfeito.`)) return;
        if (await api.apagarAutomacao(id)) { toast("Automação apagada."); telaAutomacoes(); }
        else toast("Não foi possível apagar. Tente de novo.", "erro");
      }
    };
    alvo.onchange = async (e) => {
      const b = e.target.closest("[data-acao='ativa']");
      if (!b) return;
      const id = b.closest("[data-id]").dataset.id;
      if (await api.alternarAtiva(id, b.checked)) { toast(b.checked ? "Automação ligada." : "Automação desligada."); telaAutomacoes(); }
      else { b.checked = !b.checked; toast("Não foi possível alterar. Tente de novo.", "erro"); }
    };
  }

  // ---------- Leads (planilha) ----------
  const ORIGENS = { comment: "Comentário", dm: "Direct", story_reply: "Story" };
  const CANAIS = { private_reply: "Resposta ao comentário", dm: "Direct" };
  const SITUACAO = { ok: ["ok", "Enviado"], erro: ["erro", "Erro"], na_fila: ["fila", "Na fila"] };
  // Filtros e ordem atuais (ficam guardados enquanto a página estiver aberta)
  const LD = { busca: "", origem: "", etiqueta: "", contato: false, ordem: "created_at", asc: false, pagina: 0, porPagina: 50 };
  let ldLinhas = [];     // linhas da página atual
  let ldSemView = false; // true = falta rodar o 05_leads.sql
  let ldEtiquetas = [];
  let ldTimer = null;

  const COLUNAS = [
    { k: "username", t: "Usuário" },
    { k: "last_source", t: "Origem" },
    { k: "last_keyword", t: "Palavra" },
    { k: "email", t: "Contato" },
    { k: null, t: "Etiquetas" },
    { k: "interacoes", t: "Interações", view: true, dica: "Mensagens que o robô entregou pra essa pessoa" },
    { k: "link_sent", t: "Link" },
    { k: "created_at", t: "Primeiro contato" },
    { k: "ultima_entrega", t: "Última interação", view: true },
  ];

  const fmtData = (iso, comHora) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("pt-BR") + (comHora ? " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");
  };
  const fmtTel = (t) => {
    const m = String(t || "").replace(/\D/g, "").match(/^(?:55)?(\d{2})(\d{4,5})(\d{4})$/);
    return m ? `(${m[1]}) ${m[2]}-${m[3]}` : String(t || "");
  };
  const chips = (tags, max = 3) => {
    const t = tags || [];
    if (!t.length) return "";
    return `<div class="chips">${t.slice(0, max).map((x) => `<span class="chip">${esc(x)}</span>`).join("")}${t.length > max ? `<span class="chip">+${t.length - max}</span>` : ""}</div>`;
  };

  async function telaLeads() {
    const alvo = $("#sub-conteudo");
    alvo.innerHTML = `
      <div class="grade grade-4">
        ${kpi("", "Total de leads", "ld-k-total", "pessoas que interagiram")}
        ${kpi("", "Com contato", "ld-k-contato", "deixaram e-mail ou telefone")}
        ${kpi("", "Novos", "ld-k-novos", "nos últimos 7 dias")}
        ${kpi("", "Receberam link", "ld-k-link", "receberam um botão de link")}
      </div>
      <div class="cartao" style="margin-top:16px">
        <div class="ferramentas">
          <input type="search" id="ld-busca" placeholder="Buscar @, e-mail, telefone, palavra" value="${esc(LD.busca)}" aria-label="Buscar leads">
          <select id="ld-origem" aria-label="Filtrar por origem">
            <option value="">Todas as origens</option>
            ${Object.entries(ORIGENS).map(([v, t]) => `<option value="${v}" ${LD.origem === v ? "selected" : ""}>${t}</option>`).join("")}
          </select>
          <select id="ld-etiqueta" aria-label="Filtrar por etiqueta"><option value="">Todas as etiquetas</option></select>
          <label class="switch"><input type="checkbox" id="ld-contato" ${LD.contato ? "checked" : ""}><span class="trilho"></span><span>Só com contato</span></label>
          <span class="espaco"></span>
          <button class="btn" id="ld-exportar">${ICON.baixar} Exportar planilha</button>
        </div>
        <div id="ld-aviso"></div>
        <div id="ld-tabela"><p class="muted">Carregando leads...</p></div>
        <div id="ld-pag" class="paginacao"></div>
      </div>`;

    const recarregar = () => { LD.pagina = 0; carregarLeads(); };
    $("#ld-busca").addEventListener("input", (e) => {
      clearTimeout(ldTimer);
      ldTimer = setTimeout(() => { LD.busca = e.target.value; recarregar(); }, 300);
    });
    $("#ld-origem").addEventListener("change", (e) => { LD.origem = e.target.value; recarregar(); });
    $("#ld-etiqueta").addEventListener("change", (e) => { LD.etiqueta = e.target.value; recarregar(); });
    $("#ld-contato").addEventListener("change", (e) => { LD.contato = e.target.checked; recarregar(); });
    $("#ld-exportar").addEventListener("click", exportarLeads);

    const tabela = $("#ld-tabela");
    tabela.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // link do perfil abre normal
      const th = e.target.closest("[data-ordem]");
      if (th) {
        const k = th.dataset.ordem;
        if (LD.ordem === k) LD.asc = !LD.asc; else { LD.ordem = k; LD.asc = ["username", "last_source", "last_keyword", "email"].includes(k); }
        return recarregar();
      }
      const tr = e.target.closest("tr[data-lead]");
      if (tr) abrirLead(tr.dataset.lead);
    });
    tabela.addEventListener("keydown", (e) => {
      const tr = e.target.closest("tr[data-lead]");
      if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirLead(tr.dataset.lead); }
    });
    $("#ld-pag").addEventListener("click", (e) => {
      const b = e.target.closest("[data-pg]");
      if (b) { LD.pagina += Number(b.dataset.pg); carregarLeads(); }
    });

    // nomes das automações (pra ficha e pro modo sem a visão)
    const autos = await api.listarAutomacoes();
    autosMapa = Object.fromEntries(autos.map((a) => [a.id, a.nome || "Sem nome"]));
    carregarKpisLeads();
    carregarEtiquetas();
    carregarLeads();
  }

  async function carregarKpisLeads() {
    const r = await api.resumoLeads();
    const por = { "ld-k-total": r.total, "ld-k-contato": r.contato, "ld-k-novos": r.novos, "ld-k-link": r.link };
    Object.entries(por).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.textContent = fmtNum(v); });
  }

  async function carregarEtiquetas() {
    ldEtiquetas = await api.etiquetas();
    const sel = $("#ld-etiqueta");
    if (!sel) return;
    if (LD.etiqueta && !ldEtiquetas.includes(LD.etiqueta)) LD.etiqueta = "";
    sel.innerHTML = `<option value="">Todas as etiquetas</option>` +
      ldEtiquetas.map((t) => `<option value="${esc(t)}" ${LD.etiqueta === t ? "selected" : ""}>${esc(t)}</option>`).join("");
  }

  async function carregarLeads() {
    if (!$("#ld-tabela")) return;
    const de = LD.pagina * LD.porPagina;
    const r = await api.leads(LD, de, de + LD.porPagina - 1);
    const alvo = $("#ld-tabela");
    if (!alvo) return; // trocou de tela enquanto carregava
    ldLinhas = r.rows;
    ldSemView = !!r.semView;

    $("#ld-aviso").innerHTML = r.erro
      ? `<p class="erro">Não foi possível carregar os leads: ${esc(r.erro)}</p>`
      : ldSemView ? `<p class="alerta" style="margin:0 0 12px">Pra ver as interações e a última interação, rode o script <b>05_leads.sql</b> no Supabase (veja o LEIA-ME).</p>` : "";

    if (!r.rows.length) {
      const filtrando = LD.busca || LD.origem || LD.etiqueta || LD.contato;
      alvo.innerHTML = `<div class="vazio" style="padding:36px 12px">
        <div class="icone-grande">${ICON.usuarios}</div>
        <h2>${filtrando ? "Nenhum lead encontrado" : "Ainda não tem leads"}</h2>
        <p>${filtrando ? "Tente outra busca ou limpe os filtros." : "Eles aparecem aqui quando alguém comentar a palavra-chave de uma automação ligada."}</p>
      </div>`;
      $("#ld-pag").innerHTML = "";
      return;
    }

    const cab = COLUNAS.map((c) => {
      const ordenavel = c.k && !(c.view && ldSemView);
      const ativo = ordenavel && LD.ordem === c.k;
      const seta = ativo ? (LD.asc ? " ▲" : " ▼") : "";
      const sort = ativo ? ` aria-sort="${LD.asc ? "ascending" : "descending"}"` : "";
      const titulo = c.dica ? ` title="${esc(c.dica)}"` : "";
      return ordenavel
        ? `<th scope="col"${sort}${titulo}><button type="button" class="th-ordem" data-ordem="${c.k}">${c.t}${seta}</button></th>`
        : `<th scope="col"${titulo}>${c.t}</th>`;
    }).join("");

    const linhas = r.rows.map((l) => `
      <tr data-lead="${esc(l.ig_user_id)}" tabindex="0" aria-label="Abrir ficha de ${esc(l.username ? "@" + l.username : l.ig_user_id)}">
        <td>${l.username ? `<a href="https://www.instagram.com/${encodeURIComponent(l.username)}/" target="_blank" rel="noopener">@${esc(l.username)}</a>` : `<span class="muted">ID ${esc(l.ig_user_id)}</span>`}</td>
        <td>${esc(ORIGENS[l.last_source] || l.last_source || "")}</td>
        <td>${esc(l.last_keyword || "")}${l.automacao_nome ? `<div class="sub">${esc(l.automacao_nome)}</div>` : ""}</td>
        <td>${l.email ? `<div>${esc(l.email)}</div>` : ""}${l.telefone ? `<div>${esc(fmtTel(l.telefone))}</div>` : ""}${!l.email && !l.telefone ? `<span class="muted">sem contato</span>` : ""}</td>
        <td>${chips(l.tags)}</td>
        <td class="num">${ldSemView ? `<span class="muted">?</span>` : fmtNum(l.interacoes)}</td>
        <td>${l.link_sent ? `<span class="selo ok">Sim</span>` : `<span class="selo off">Não</span>`}</td>
        <td>${esc(fmtData(l.created_at))}</td>
        <td>${esc(fmtData(l.ultima_entrega || l.updated_at, true))}</td>
      </tr>`).join("");

    alvo.innerHTML = `<div class="tabela-rolagem"><table class="tabela tabela-leads"><thead><tr>${cab}</tr></thead><tbody>${linhas}</tbody></table></div>`;

    const ate = de + r.rows.length;
    $("#ld-pag").innerHTML = `
      <span>Mostrando ${fmtNum(de + 1)} a ${fmtNum(ate)} de ${fmtNum(r.total)}. Clique numa linha pra ver a ficha.</span>
      <span>
        <button class="btn btn-pequeno" data-pg="-1" ${LD.pagina === 0 ? "disabled" : ""}>Anterior</button>
        <button class="btn btn-pequeno" data-pg="1" ${ate >= r.total ? "disabled" : ""}>Próxima</button>
      </span>`;
  }

  // Baixa a planilha (CSV que abre no Excel e no Google Planilhas), com os filtros atuais
  async function exportarLeads() {
    const btn = $("#ld-exportar");
    btn.disabled = true; btn.textContent = "Gerando...";
    const todos = [];
    let erro = "";
    for (let de = 0; de < 20000; de += 1000) { // o banco devolve no máximo 1000 por vez
      const r = await api.leads(LD, de, de + 999);
      if (r.erro) { erro = r.erro; break; }
      todos.push(...r.rows);
      if (r.rows.length < 1000) break;
    }
    btn.disabled = false; btn.innerHTML = `${ICON.baixar} Exportar planilha`;
    if (erro) return toast("Não foi possível exportar: " + erro, "erro", 5000);
    if (!todos.length) return toast("Nenhum lead pra exportar com esses filtros.");

    // Protege contra fórmulas (célula começando com = + - @ vira texto)
    const cel = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const cab = ["Usuário", "ID do Instagram", "Origem", "Palavra", "Automação", "E-mail", "Telefone", "Etiquetas", "Interações", "Recebeu link", "Primeiro contato", "Última interação", "Anotações"];
    const linhas = todos.map((l) => [
      l.username || "", l.ig_user_id, ORIGENS[l.last_source] || l.last_source || "", l.last_keyword || "",
      l.automacao_nome || autosMapa[l.automation_id] || "", l.email || "", fmtTel(l.telefone), (l.tags || []).join(", "),
      ldSemView ? "" : (l.interacoes ?? 0), l.link_sent ? "Sim" : "Não", fmtData(l.created_at, true),
      fmtData(l.ultima_entrega || l.updated_at, true), (l.dados && l.dados.notas) || "",
    ].map(cel).join(";"));
    const csv = "﻿" + [cab.join(";"), ...linhas].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Planilha com ${fmtNum(todos.length)} lead(s) baixada.`, "ok");
  }

  // Ficha do lead: dados, etiquetas, anotações, histórico e exclusão
  async function abrirLead(id) {
    const l = ldLinhas.find((x) => x.ig_user_id === id);
    if (!l) return;
    const est = { tags: [...(l.tags || [])], notas: (l.dados && l.dados.notas) || "" };
    const nome = l.username ? "@" + l.username : "ID " + l.ig_user_id;
    // campos internos (começam com "_") não aparecem na ficha
    const extras = Object.entries(l.dados || {}).filter(([k]) => k !== "notas" && !k.startsWith("_"));
    const info = (rot, val) => `<div><span class="rotulo">${rot}</span><div>${val || `<span class="muted">sem informação</span>`}</div></div>`;
    const desenharTags = () => est.tags.map((t, i) => `<span class="chip">${esc(t)}<button type="button" data-del-tag="${i}" aria-label="Remover ${esc(t)}">×</button></span>`).join("");

    abrirModal(`
      <div class="modal-cab"><h2>${esc(nome)}</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <div class="info-grade">
        ${info("Origem", esc(ORIGENS[l.last_source] || l.last_source || ""))}
        ${info("Palavra que ativou", esc(l.last_keyword || ""))}
        ${info("Automação", esc(l.automacao_nome || autosMapa[l.automation_id] || ""))}
        ${info("Recebeu link", l.link_sent ? "Sim" : "Não")}
        ${info("E-mail", l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : "")}
        ${info("Telefone", l.telefone ? esc(fmtTel(l.telefone)) : "")}
        ${info("Primeiro contato", esc(fmtData(l.created_at, true)))}
        ${info("Última interação", esc(fmtData(l.ultima_entrega || l.updated_at, true)))}
        ${ldSemView ? "" : info("Interações", fmtNum(l.interacoes))}
        ${info("ID do Instagram", esc(l.ig_user_id))}
        ${l.expecting && l.expecting.field ? info("Situação", `Esperando a pessoa mandar ${esc(l.expecting.field)}`) : ""}
        ${extras.map(([k, v]) => info(esc(k), esc(typeof v === "object" ? JSON.stringify(v) : v))).join("")}
        ${l.username ? info("Perfil", `<a href="https://www.instagram.com/${encodeURIComponent(l.username)}/" target="_blank" rel="noopener">abrir no Instagram</a>`) : ""}
      </div>

      <div class="campo">
        <span class="rotulo">Etiquetas</span>
        <div class="tags-box">
          <span id="ld-tags" style="display:contents">${desenharTags()}</span>
          <input type="text" id="ld-tag-input" list="ld-tag-sug" placeholder="Digite e aperte Enter (ex: cliente, quente)">
        </div>
        <datalist id="ld-tag-sug">${ldEtiquetas.map((t) => `<option value="${esc(t)}">`).join("")}</datalist>
      </div>
      <label class="campo">
        <span class="rotulo">Anotações</span>
        <textarea id="ld-notas" placeholder="Ex: pediu orçamento, retornar na segunda">${esc(est.notas)}</textarea>
      </label>

      <span class="rotulo">Histórico de mensagens do robô</span>
      <div id="ld-hist"><p class="muted" style="font-size:14px">Carregando...</p></div>

      <div class="modal-rodape" style="justify-content:space-between">
        <button class="btn btn-perigo" data-excluir>${ICON.lixo} Excluir dados</button>
        <span style="display:flex;gap:8px"><button class="btn" data-fechar>Fechar</button><button class="btn btn-primario" data-salvar>Salvar</button></span>
      </div>`, async (e) => {
      const del = e.target.closest("[data-del-tag]");
      if (del) { est.tags.splice(+del.dataset.delTag, 1); $("#ld-tags").innerHTML = desenharTags(); return; }

      if (e.target.closest("[data-salvar]")) {
        adicionarTag();
        const ok = await api.atualizarLead(id, { tags: est.tags, dados: { ...(l.dados || {}), notas: est.notas.trim() } });
        if (!ok) return toast("Não foi possível salvar. Tente de novo.", "erro");
        toast("Lead atualizado.", "ok");
        fecharModal(); carregarLeads(); carregarEtiquetas();
        return;
      }

      if (e.target.closest("[data-excluir]")) {
        if (!confirm(`Apagar TODOS os dados de ${nome}?\n\nUse isso pra atender um pedido de exclusão (LGPD). Apaga o lead, o histórico e o que estiver na fila. Não dá pra desfazer.`)) return;
        if (!(await api.excluirLead(id))) return toast("Não foi possível excluir. Tente de novo.", "erro");
        toast("Dados do lead apagados.", "ok");
        fecharModal(); carregarLeads(); carregarKpisLeads(); carregarEtiquetas();
      }
    }, "largo");

    // Etiquetas: Enter ou vírgula adiciona
    function adicionarTag() {
      const inp = $("#ld-tag-input");
      if (!inp) return;
      inp.value.split(",").map((s) => s.trim().slice(0, 30)).filter(Boolean).forEach((t) => {
        if (!est.tags.some((x) => x.toLowerCase() === t.toLowerCase())) est.tags.push(t);
      });
      inp.value = "";
      $("#ld-tags").innerHTML = desenharTags();
    }
    const m = $("#modal");
    m.onkeydown = (e) => {
      if (e.target.id === "ld-tag-input" && (e.key === "Enter" || e.key === ",")) { e.preventDefault(); adicionarTag(); }
    };
    m.oninput = (e) => { if (e.target.id === "ld-notas") est.notas = e.target.value; };

    // Histórico
    const hist = await api.historicoLead(id);
    const alvo = $("#ld-hist");
    if (!alvo) return;
    alvo.innerHTML = hist.length ? `<ul class="historico">${hist.map((d) => {
      const [cls, txt] = SITUACAO[d.status] || ["off", d.status];
      return `<li>
        <span class="quando">${esc(fmtData(d.ts, true))}</span>
        <span class="oque">${esc(autosMapa[d.automation_id] || "Automação apagada")}<span class="sub">${esc(CANAIS[d.canal] || d.canal || "")}</span>${d.status === "erro" && d.motivo ? `<span class="sub">${esc(d.motivo)}</span>` : ""}</span>
        <span class="selo ${cls}">${esc(txt)}</span>
      </li>`;
    }).join("")}</ul>` : `<p class="muted" style="font-size:14px">Nenhuma mensagem registrada.</p>`;
  }

  // ===================================================================
  // 6. EDITOR DE AUTOMAÇÃO
  //
  // Estado do editor (ED.st):
  //   message1 + button_title = a Mensagem 1 (primeiro passo do fluxo)
  //   mode: "link" (o botão abre um site) ou "conversa" (continua)
  //   steps: Mensagem 2 em diante, cada uma com botões
  //     botão: { title, kind: "next" | "link" | "end", next, url }
  //     o "kind" fica guardado à parte: escolher "abrir um link" mostra o
  //     campo do link NA HORA, mesmo com a URL ainda vazia.
  // Ao salvar, tudo vira o campo "flow" (veja flowDoEstado).
  // ===================================================================
  const ED = { aberto: false, st: null, snap: "", arquivos: [] };

  function novoEstado() {
    return {
      id: null, nome: "", active: true,
      keywords: [], match_any: false, media_ids: [],
      public_reply: "", variants: [],
      first_id: 1, message1: "", button_on: true, button_title: "", mode: "link", link_url: "",
      steps: [], assets: [],
    };
  }

  const temNext = (b) => b && b.next !== undefined && b.next !== null && b.next !== "";

  // Automação salva -> estado do editor
  function estadoDeAutomacao(a) {
    const steps = (a.flow && a.flow.steps) || [];
    const first = steps[0] || { id: 1, message: "", buttons: [] };
    const b0 = (first.buttons || [])[0];
    return {
      id: a.id, nome: a.nome || "", active: a.active !== false,
      keywords: String(a.keyword || "").split(",").map((s) => s.trim()).filter(Boolean),
      match_any: !!a.match_any, media_ids: a.media_ids || [],
      public_reply: a.public_reply || "", variants: a.public_reply_variants || [],
      first_id: first.id ?? 1,
      message1: first.message || "",
      button_on: !!b0,
      button_title: (b0 && b0.title) || "",
      mode: b0 && !b0.url && temNext(b0) ? "conversa" : "link",
      link_url: (b0 && b0.url) || "",
      assets: first.assets || a.asset_ids || [],
      steps: steps.slice(1).map((s) => ({
        id: s.id,
        message: s.message || "",
        buttons: (s.buttons || []).map((b) => ({
          title: b.title || "",
          kind: b.url ? "link" : temNext(b) ? "next" : "end",
          next: temNext(b) ? b.next : null,
          url: b.url || "",
        })),
        // campos avançados (coleta de dado, atraso) são preservados
        extra: { collect: s.collect, delay: s.delay, assets: s.assets },
      })),
    };
  }

  // Estado do editor -> campo "flow" (o formato que o webhook entende)
  function flowDoEstado(st) {
    const botoes1 = [];
    const t = st.button_title.trim();
    if (st.button_on && t) {
      if (st.mode === "link" && st.link_url.trim()) botoes1.push({ title: t, url: st.link_url.trim() });
      if (st.mode === "conversa" && st.steps[0]) botoes1.push({ title: t, next: st.steps[0].id });
    }
    const steps = [{ id: st.first_id, message: st.message1, buttons: botoes1, assets: st.assets.slice() }];
    if (st.mode === "conversa" && st.button_on) {
      st.steps.forEach((s) => {
        const passo = {
          id: s.id,
          message: s.message,
          buttons: s.buttons.map((b) =>
            b.kind === "link" ? { title: b.title.trim(), url: b.url.trim() }
              : b.kind === "next" ? { title: b.title.trim(), next: b.next }
              : { title: b.title.trim() }), // "encerrar": não é enviado
        };
        if (s.extra && s.extra.collect) passo.collect = s.extra.collect;
        if (s.extra && s.extra.delay) passo.delay = s.extra.delay;
        if (s.extra && s.extra.assets) passo.assets = s.extra.assets;
        steps.push(passo);
      });
    }
    return { steps };
  }

  function linhaDoEstado(st) {
    return {
      ...(st.id ? { id: st.id } : {}),
      nome: st.nome.trim(),
      keyword: st.keywords.join(","),
      match_any: st.match_any,
      active: st.active,
      media_ids: st.media_ids,
      public_reply: st.public_reply.trim(),
      public_reply_variants: st.variants.map((v) => v.trim()).filter(Boolean),
      flow: flowDoEstado(st),
      asset_ids: st.assets,
    };
  }

  const fotografia = (st) => JSON.stringify(linhaDoEstado(st)) + st.mode + st.button_on;
  const sujo = () => ED.aberto && fotografia(ED.st) !== ED.snap;

  function proximoId(st) {
    const ids = [Number(st.first_id) || 1, ...st.steps.map((s) => Number(s.id) || 0)];
    return Math.max(...ids) + 1;
  }

  // ---------- Abrir / fechar ----------
  async function abrirEditor(auto) {
    ED.st = auto ? estadoDeAutomacao(auto) : novoEstado();
    ED.snap = fotografia(ED.st);
    ED.aberto = true;
    document.body.classList.add("sem-scroll");
    const el = $("#editor");
    el.hidden = false;
    el.innerHTML = `
      <header class="ed-topo">
        <button class="btn btn-fantasma btn-pequeno" data-acao="fechar">${ICON.voltar} Voltar</button>
        <input type="text" class="nome-auto" data-bind="nome" placeholder="Nome da automação (ex: Guia grátis)" value="${esc(ED.st.nome)}" aria-label="Nome da automação">
        <span class="espaco"></span>
        <span class="ed-sujo" id="ed-sujo" hidden>Alterações não salvas</span>
        <label class="switch"><input type="checkbox" data-bind="active" ${ED.st.active ? "checked" : ""}><span class="trilho"></span><span>Ligada</span></label>
        <button class="btn btn-primario" data-acao="salvar">Salvar</button>
      </header>
      <div class="ed-corpo">
        <div class="ed-grade">
          <div id="ed-form"></div>
          <div class="ed-previa-col">
            <div id="ed-previa"></div>
            <p class="previa-legenda">Prévia ao vivo: é assim que a DM chega.</p>
          </div>
        </div>
      </div>`;
    renderForm();
    atualizarPrevia();
    if (!ED.st.nome) setTimeout(() => { const n = $(".nome-auto"); if (n) n.focus(); }, 50);
    ED.arquivos = await api.listarArquivos();
    atualizarPrevia();
  }

  // Retorna true se fechou. Pergunta antes se tem algo não salvo.
  async function fecharEditor(forcar) {
    if (!ED.aberto) return true;
    if (!forcar && sujo() && !confirm("Você tem alterações não salvas. Sair mesmo assim e perder o que digitou?")) return false;
    ED.aberto = false;
    $("#editor").hidden = true;
    $("#editor").innerHTML = "";
    document.body.classList.remove("sem-scroll");
    return true;
  }

  window.addEventListener("beforeunload", (e) => {
    if (sujo()) { e.preventDefault(); e.returnValue = ""; }
  });

  function marcarSujo() {
    const el = $("#ed-sujo");
    if (el) el.hidden = !sujo();
  }

  // ---------- Formulário ----------
  function barraEmojis(alvoId) {
    return `<div class="emojis">${EMOJIS.map((em) => `<button type="button" data-acao="emoji" data-alvo="${alvoId}" data-emoji="${em}" aria-label="Inserir ${em}">${em}</button>`).join("")}</div>`;
  }

  function contador(n) {
    return `<span class="contador ${n >= LIMITE_TITULO ? "cheio" : ""}">${n}/${LIMITE_TITULO}</span>`;
  }

  function renderForm() {
    const st = ED.st;
    const nomesArq = st.assets.map((id) => { const a = ED.arquivos.find((x) => x.id === id); return a ? a.nome : "arquivo"; });

    $("#ed-form").innerHTML = `
      <!-- BLOCO 1: GATILHO -->
      <section class="cartao bloco">
        <div class="bloco-cab"><span class="bloco-num">1</span><div><h2>O gatilho</h2><p class="muted">O que faz a DM disparar.</p></div></div>

        <div class="campo">
          <span class="rotulo">Palavras que ativam</span>
          <div class="tags-box ${st.match_any ? "desligado" : ""}" data-acao="focar-tags">
            ${st.keywords.map((k, i) => `<span class="chip">${esc(k)}<button type="button" data-acao="del-tag" data-i="${i}" aria-label="Remover ${esc(k)}">×</button></span>`).join("")}
            <input type="text" id="kw-input" placeholder="${st.keywords.length ? "Adicionar outra" : "Digite uma palavra e aperte Enter"}" ${st.match_any ? "disabled" : ""}>
          </div>
          <p class="ajuda">Maiúsculas e acentos não importam: "Guia" e "guia" ativam igual.</p>
        </div>
        <label class="switch" style="margin-bottom:16px"><input type="checkbox" data-bind="match_any" ${st.match_any ? "checked" : ""}><span class="trilho"></span><span>Qualquer palavra ativa (todo comentário no post dispara)</span></label>

        <div class="separador"></div>

        <div class="campo">
          <span class="rotulo">Em quais posts</span>
          <div class="linha">
            <span style="font-size:14px">${st.media_ids.length ? `${st.media_ids.length} post(s) escolhido(s)` : "Todos os posts"}</span>
            <span>
              ${st.media_ids.length ? `<button type="button" class="btn btn-fantasma btn-pequeno" data-acao="limpar-posts">Usar todos</button>` : ""}
              <button type="button" class="btn btn-pequeno" data-acao="posts">Escolher posts</button>
            </span>
          </div>
        </div>

        <div class="separador"></div>

        <div class="campo">
          <span class="rotulo">Resposta no comentário</span>
          <input type="text" data-bind="public_reply" placeholder='Ex: te chamei no direct 💌' value="${esc(st.public_reply)}">
          ${st.variants.map((v, i) => `
            <div class="linha" style="margin-top:8px">
              <input type="text" data-variant="${i}" placeholder="Variação ${i + 2}" value="${esc(v)}">
              <button type="button" class="btn-icone" data-acao="del-variant" data-i="${i}" aria-label="Remover variação">${ICON.x}</button>
            </div>`).join("")}
          <button type="button" class="btn btn-fantasma btn-pequeno" style="margin-top:8px" data-acao="add-variant">${ICON.mais} Adicionar variação A/B</button>
          <p class="ajuda">É a resposta pública. Com variações, o sistema alterna entre elas (parece menos robô).</p>
        </div>
      </section>

      <!-- BLOCO 2: RESPOSTA -->
      <section class="cartao bloco">
        <div class="bloco-cab"><span class="bloco-num">2</span><div><h2>A resposta</h2><p class="muted">O que a pessoa recebe na DM.</p></div></div>

        <div class="campo">
          <span class="rotulo">Sua mensagem</span>
          ${barraEmojis("msg1")}
          <textarea id="msg1" data-bind="message1" placeholder="Oi! Que bom que você comentou. Aqui está o que eu prometi 👇">${esc(st.message1)}</textarea>
        </div>

        <label class="switch" style="margin-bottom:14px"><input type="checkbox" data-bind="button_on" ${st.button_on ? "checked" : ""}><span class="trilho"></span><span>Botão na mensagem</span></label>

        ${st.button_on ? `
          <div class="campo">
            <div class="linha-topo"><span class="rotulo">Texto do botão</span>${contador(st.button_title.length)}</div>
            <input type="text" data-bind="button_title" placeholder="Ex: Quero o guia" value="${esc(st.button_title)}">
            <p class="ajuda">Até 20 caracteres (o Instagram corta o resto). O link nunca vai aqui.</p>
          </div>

          <div class="campo">
            <span class="rotulo">O que o botão faz quando ela toca</span>
            <div class="opcoes-modo">
              <button type="button" class="opcao ${st.mode === "link" ? "ativo" : ""}" data-acao="modo" data-valor="link">
                <strong>${ICON.link} Um link</strong><span>Leva a pessoa pra um site.</span>
              </button>
              <button type="button" class="opcao ${st.mode === "conversa" ? "ativo" : ""}" data-acao="modo" data-valor="conversa">
                <strong>${ICON.chat} Continua a conversa</strong><span>Ela te envia o texto do botão e chega a próxima mensagem.</span>
              </button>
            </div>
          </div>

          ${st.mode === "link" ? `
            <div class="campo">
              <span class="rotulo">Link completo</span>
              <textarea class="link-grande" data-bind="link_url" placeholder="https://seusite.com/pagina?com=parametros&quanto=quiser">${esc(st.link_url)}</textarea>
              <p class="ajuda">A pessoa vê só o nome bonito do botão. O link fica invisível.</p>
            </div>` : renderSequencia(st)}
        ` : `<p class="ajuda" style="margin-bottom:14px">Sem botão: a pessoa recebe só a mensagem.</p>`}

        <div class="separador"></div>

        <div class="campo" style="margin-bottom:0">
          <div class="linha"><span class="rotulo" style="margin:0">Anexar um arquivo (opcional)</span>
            <button type="button" class="btn btn-pequeno" data-acao="arquivos">${ICON.arquivo} Biblioteca</button></div>
          ${st.assets.length ? `<div class="arquivo-lista">${st.assets.map((id, i) => `<span class="chip">${esc(nomesArq[i])}<button type="button" data-acao="del-asset" data-i="${i}" aria-label="Remover arquivo">×</button></span>`).join("")}</div>` : ""}
          <p class="ajuda">PDF, áudio, foto ou vídeo. Dica: depois de uma resposta a comentário, o Instagram só entrega arquivo quando a pessoa interage. Pra garantir, use "Continua a conversa".</p>
        </div>
      </section>`;
    pintarIcones($("#ed-form"));
  }

  // O mini-chat: Mensagem 1 como referência + Mensagem 2, 3...
  function renderSequencia(st) {
    const opcoesNext = (idxAtual, valor) => {
      const outras = st.steps.map((s, i) => ({ s, i })).filter((o) => o.i !== idxAtual);
      if (!outras.length) return `<option value="">Adicione outra mensagem primeiro</option>`;
      return `<option value="">Escolha a mensagem</option>` +
        outras.map((o) => `<option value="${esc(o.s.id)}" ${String(valor) === String(o.s.id) ? "selected" : ""}>Mensagem ${o.i + 2}</option>`).join("");
    };

    const qtdValidos = (s) => s.buttons.filter((b) => b.title.trim() && (b.kind === "link" ? b.url.trim() : b.kind === "next" && temNext(b))).length;

    return `
      <div class="campo">
        <span class="rotulo">A conversa</span>
        <div class="passo referencia">
          <div class="passo-cab"><h4>Mensagem 1</h4><span class="muted" style="font-size:12px">edite lá em cima</span></div>
          <div class="ref-texto">${st.message1.trim() ? esc(st.message1) : `<span class="muted">(escreva em "Sua mensagem")</span>`}</div>
          <div class="ref-botao">Botão: <b>${esc(st.button_title || "sem nome")}</b> → ${st.steps.length ? "vai pra Mensagem 2" : "adicione a Mensagem 2"}</div>
        </div>

        ${st.steps.map((s, i) => `
          <div class="passo">
            <div class="passo-cab"><h4>Mensagem ${i + 2}</h4>
              <button type="button" class="btn-icone" data-acao="del-step" data-step="${i}" aria-label="Apagar mensagem">${ICON.lixo}</button></div>
            ${barraEmojis(`step-msg-${i}`)}
            <textarea id="step-msg-${i}" data-step="${i}" data-field="message" placeholder="O que chega quando ela toca no botão">${esc(s.message)}</textarea>

            ${s.buttons.map((b, j) => `
              <div class="botao-ed">
                <div class="grade-btn">
                  <div>
                    <div class="linha-topo"><span class="rotulo">Nome do botão</span>${contador(b.title.length)}</div>
                    <input type="text" data-step="${i}" data-btn="${j}" data-field="title" placeholder="Ex: Quero saber mais" value="${esc(b.title)}">
                  </div>
                  <div>
                    <span class="rotulo">Destino</span>
                    <select data-step="${i}" data-btn="${j}" data-field="kind">
                      <option value="next" ${b.kind === "next" ? "selected" : ""}>Ir pra outra mensagem</option>
                      <option value="link" ${b.kind === "link" ? "selected" : ""}>Abrir um link</option>
                      <option value="end" ${b.kind === "end" ? "selected" : ""}>Encerrar</option>
                    </select>
                  </div>
                  <button type="button" class="btn-icone" style="margin-top:22px" data-acao="del-btn" data-step="${i}" data-btn="${j}" aria-label="Apagar botão">${ICON.x}</button>
                </div>
                ${b.kind === "next" ? `
                  <div style="margin-top:8px"><span class="rotulo">Vai pra</span>
                    <select data-step="${i}" data-btn="${j}" data-field="next">${opcoesNext(i, b.next)}</select></div>` : ""}
                ${b.kind === "link" ? `
                  <div style="margin-top:8px"><span class="rotulo">Link completo</span>
                    <textarea class="link-grande" data-step="${i}" data-btn="${j}" data-field="url" placeholder="https://...">${esc(b.url)}</textarea></div>` : ""}
                ${b.kind === "end" ? `<p class="fim-nota">A conversa acaba aqui. Esse botão não aparece pra pessoa.</p>` : ""}
              </div>`).join("")}

            ${qtdValidos(s) > 3 ? `<p class="alerta">Mais de 3 botões: a mensagem vai com pílulas de resposta rápida, e os links vão escritos no texto.</p>` : ""}
            <button type="button" class="btn btn-fantasma btn-pequeno" style="margin-top:10px" data-acao="add-btn" data-step="${i}">${ICON.mais} Adicionar botão</button>
            ${!s.buttons.length ? `<p class="fim-nota">Sem botões: a conversa termina nesta mensagem.</p>` : ""}
          </div>`).join("")}

        <button type="button" class="btn btn-pequeno" data-acao="add-step">${ICON.mais} Adicionar mensagem</button>
      </div>`;
  }

  // ---------- Eventos do editor (delegados) ----------
  const editorEl = $("#editor");

  // Digitação: atualiza o estado e só a prévia (não redesenha o formulário, pra não perder o cursor)
  editorEl.addEventListener("input", (e) => {
    const t = e.target;
    if (t.type === "checkbox" || t.tagName === "SELECT") return; // tratados no "change"
    const st = ED.st;

    if (t.dataset.bind) {
      const k = t.dataset.bind;
      if (k === "button_title") return tituloBotao1(t);
      st[k] = t.value;
    } else if (t.dataset.variant !== undefined) {
      st.variants[+t.dataset.variant] = t.value;
    } else if (t.dataset.step !== undefined) {
      const s = st.steps[+t.dataset.step];
      if (t.dataset.btn !== undefined) {
        const b = s.buttons[+t.dataset.btn];
        if (t.dataset.field === "title") return tituloBotao(b, t);
        if (t.dataset.field === "url") b.url = t.value;
      } else if (t.dataset.field === "message") {
        s.message = t.value;
      }
    }
    // a referência da Mensagem 1 no mini-chat acompanha
    if (t.dataset.bind === "message1" && st.mode === "conversa" && st.button_on) {
      const ref = $(".passo.referencia .ref-texto");
      if (ref) ref.innerHTML = st.message1.trim() ? esc(st.message1) : `<span class="muted">(escreva em "Sua mensagem")</span>`;
    }
    atualizarPrevia();
    marcarSujo();
  });

  // Título do botão da Mensagem 1: se colar um link, move pro campo certo
  function tituloBotao1(input) {
    const st = ED.st;
    const v = input.value;
    if (pareceLink(v)) {
      st.link_url = v.trim();
      st.button_title = "Acessar";
      st.mode = "link";
      renderForm(); atualizarPrevia(); marcarSujo();
      toast('Isso é um link: movemos pro campo do link e demos o nome "Acessar".');
      return;
    }
    if (v.length > LIMITE_TITULO) input.value = v.slice(0, LIMITE_TITULO);
    st.button_title = input.value;
    atualizarContador(input);
    atualizarPrevia(); marcarSujo();
  }

  // Título de um botão do mini-chat
  function tituloBotao(b, input) {
    const v = input.value;
    if (pareceLink(v)) {
      b.url = v.trim();
      b.title = "Acessar";
      b.kind = "link";
      renderForm(); atualizarPrevia(); marcarSujo();
      toast('Isso é um link: movemos pro campo do link e demos o nome "Acessar".');
      return;
    }
    if (v.length > LIMITE_TITULO) input.value = v.slice(0, LIMITE_TITULO);
    b.title = input.value;
    atualizarContador(input);
    atualizarPrevia(); marcarSujo();
  }

  function atualizarContador(input) {
    const c = input.parentElement.querySelector(".contador");
    if (c) c.outerHTML = contador(input.value.length);
  }

  // Interruptores e seletores: mudam a estrutura, então redesenham o formulário
  editorEl.addEventListener("change", (e) => {
    const t = e.target;
    const st = ED.st;
    if (t.type === "checkbox" && t.dataset.bind) {
      st[t.dataset.bind] = t.checked;
      if (t.dataset.bind !== "active") renderForm();
    } else if (t.tagName === "SELECT" && t.dataset.step !== undefined) {
      const b = st.steps[+t.dataset.step].buttons[+t.dataset.btn];
      if (t.dataset.field === "kind") {
        b.kind = t.value; // guardado no próprio estado: o campo do link aparece na hora
        if (b.kind === "link" && pareceLink(b.title)) {
          b.url = b.title.trim();
          b.title = "Acessar";
          toast('Movemos o link pro campo certo e demos o nome "Acessar".');
        }
        renderForm();
      }
      if (t.dataset.field === "next") b.next = t.value === "" ? null : (isNaN(+t.value) ? t.value : +t.value);
    } else {
      return;
    }
    atualizarPrevia();
    marcarSujo();
  });

  // Palavras-chave: Enter ou vírgula adiciona; apagar com campo vazio remove a última
  editorEl.addEventListener("keydown", (e) => {
    if (e.target.id !== "kw-input") return;
    const inp = e.target;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      adicionarPalavras(inp.value);
    } else if (e.key === "Backspace" && !inp.value && ED.st.keywords.length) {
      ED.st.keywords.pop();
      redesenharTags();
    }
  });
  editorEl.addEventListener("focusout", (e) => {
    if (e.target.id === "kw-input" && e.target.value.trim()) adicionarPalavras(e.target.value, false);
  });

  function adicionarPalavras(texto, focar = true) {
    const novas = String(texto).split(",").map((s) => s.trim()).filter(Boolean);
    novas.forEach((p) => { if (!ED.st.keywords.some((k) => k.toLowerCase() === p.toLowerCase())) ED.st.keywords.push(p); });
    redesenharTags(focar);
  }
  function redesenharTags(focar = true) {
    renderForm(); atualizarPrevia(); marcarSujo();
    if (focar) { const i = $("#kw-input"); if (i) i.focus(); }
  }

  // Cliques nos botões do editor
  editorEl.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-acao]");
    if (!b) return;
    const st = ED.st;
    const acao = b.dataset.acao;
    const i = +b.dataset.i;

    switch (acao) {
      case "fechar": fecharEditor(); return;
      case "salvar": salvar(); return;
      case "focar-tags": { const inp = $("#kw-input"); if (inp && e.target === b) inp.focus(); return; }
      case "del-tag": st.keywords.splice(i, 1); break;
      case "add-variant": st.variants.push(""); break;
      case "del-variant": st.variants.splice(i, 1); break;
      case "limpar-posts": st.media_ids = []; break;
      case "posts": escolherPosts(); return;
      case "arquivos": escolherArquivos(); return;
      case "del-asset": st.assets.splice(i, 1); break;
      case "modo": st.mode = b.dataset.valor; break;
      case "emoji": inserirEmoji(b.dataset.alvo, b.dataset.emoji); return;
      case "add-step": {
        st.steps.push({ id: proximoId(st), message: "", buttons: [] });
        renderForm(); atualizarPrevia(); marcarSujo();
        const ult = $(`#step-msg-${st.steps.length - 1}`);
        if (ult) ult.focus();
        return;
      }
      case "del-step": {
        const idx = +b.dataset.step;
        const removido = st.steps[idx];
        const temTexto = removido.message.trim() || removido.buttons.length;
        if (temTexto && !confirm(`Apagar a Mensagem ${idx + 2}?`)) return;
        st.steps.splice(idx, 1);
        // botões que apontavam pra ela ficam sem destino
        st.steps.forEach((s) => s.buttons.forEach((bt) => { if (String(bt.next) === String(removido.id)) bt.next = null; }));
        break;
      }
      case "add-btn": st.steps[+b.dataset.step].buttons.push({ title: "", kind: "next", next: null, url: "" }); break;
      case "del-btn": st.steps[+b.dataset.step].buttons.splice(+b.dataset.btn, 1); break;
      default: return;
    }
    renderForm(); atualizarPrevia(); marcarSujo();
  });

  // Insere o emoji onde está o cursor
  function inserirEmoji(alvoId, emoji) {
    const ta = document.getElementById(alvoId);
    if (!ta) return;
    const ini = ta.selectionStart ?? ta.value.length;
    const fim = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, ini) + emoji + ta.value.slice(fim);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ini + emoji.length;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ---------- Prévia ao vivo (mockup de celular) ----------
  function atualizarPrevia() {
    const alvo = $("#ed-previa");
    if (!alvo || !ED.st) return;
    const st = ED.st;
    const flow = flowDoEstado(st);
    // Mostra só os botões que têm destino (igual ao que é enviado de verdade)
    const visiveis = (passo) => (passo.buttons || []).filter((b) => b.title && (b.url || temNext(b)));
    const nomeArq = (id) => { const a = ED.arquivos.find((x) => x.id === id); return a ? a.nome : "Arquivo"; };

    let html = "";
    const palavra = st.match_any ? "qualquer coisa" : (st.keywords[0] || "palavra");
    html += `<div class="cel-comentario"><b>alguem</b> comentou: "${esc(palavra)}"${st.public_reply.trim() ? `<br><b>você</b> respondeu: ${esc(st.public_reply)}` : ""}</div>`;

    flow.steps.forEach((passo, idx) => {
      const bts = visiveis(passo);
      const texto = (passo.message || "").trim();
      if (!texto && !bts.length && !(passo.assets || []).length) {
        if (idx === 0) html += `<p class="cel-dica">Escreva sua mensagem pra ver a prévia.</p>`;
        return;
      }
      const anexado = bts.length > 0 && bts.length <= 3;
      html += `<div class="dm ${anexado ? "com-botoes" : ""}">
        <div class="dm-bolha">${texto ? esc(texto) : "👇"}</div>
        ${anexado ? `<div class="dm-botoes">${bts.map((b) => `<div class="dm-botao">${b.url ? ICON.link : ""}${esc(b.title)}</div>`).join("")}</div>` : ""}
        ${bts.length > 3 ? `<div class="pilulas">${bts.filter((b) => !b.url).map((b) => `<span class="pilula">${esc(b.title)}</span>`).join("")}</div>` : ""}
        ${(passo.assets || []).map((id) => `<div class="dm-arquivo">${ICON.arquivo}${esc(nomeArq(id))}</div>`).join("")}
      </div>`;
      // Se um botão leva pra próxima mensagem mostrada, simula o toque dela
      const prox = flow.steps[idx + 1];
      const toque = prox && bts.find((b) => !b.url && String(b.next) === String(prox.id));
      if (toque) html += `<div class="dm-eu">${esc(toque.title)}</div>`;
    });

    alvo.innerHTML = `
      <div class="celular">
        <div class="cel-topo"><div class="cel-avatar"></div><div><div class="cel-nome">sua_conta</div><div class="cel-sub">Instagram</div></div></div>
        <div class="cel-chat">${html}</div>
      </div>`;
  }

  // ---------- Validação e salvar ----------
  function validar(st) {
    const e = [];
    if (!st.nome.trim()) e.push("Dê um nome pra automação (no topo).");
    if (!st.match_any && !st.keywords.length) e.push('Adicione pelo menos uma palavra que ativa, ou ligue "qualquer palavra ativa".');
    if (!st.message1.trim()) e.push('Escreva a mensagem em "Sua mensagem".');
    if (st.button_on) {
      if (!st.button_title.trim()) e.push("Dê um nome pro botão da mensagem.");
      if (st.mode === "link" && !urlValida(st.link_url)) e.push("Cole o link completo do botão (começando com https://).");
      if (st.mode === "conversa") {
        if (!st.steps.length) e.push("Adicione a Mensagem 2: é o que chega quando a pessoa toca no botão.");
        st.steps.forEach((s, i) => {
          const n = i + 2;
          if (!s.message.trim()) e.push(`A Mensagem ${n} está vazia.`);
          s.buttons.forEach((b, j) => {
            if (b.kind === "end") return;
            if (!b.title.trim()) e.push(`Mensagem ${n}: o botão ${j + 1} está sem nome.`);
            if (b.kind === "link" && !urlValida(b.url)) e.push(`Mensagem ${n}: cole o link completo do botão ${j + 1}.`);
            if (b.kind === "next" && !temNext(b)) e.push(`Mensagem ${n}: escolha pra qual mensagem o botão ${j + 1} vai.`);
          });
        });
      }
    }
    return e;
  }

  async function salvar() {
    const st = ED.st;
    if (st.keywords.length === 0) { const inp = $("#kw-input"); if (inp && inp.value.trim()) adicionarPalavras(inp.value, false); }
    const erros = validar(st);
    if (erros.length) {
      abrirModal(`
        <div class="modal-cab"><h2>Falta pouco</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
        <p class="muted" style="margin-bottom:10px">Ajuste estes pontos antes de salvar:</p>
        <ul style="margin:0;padding-left:20px;line-height:1.8">${erros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <div class="modal-rodape"><button class="btn btn-primario" data-fechar>Entendi</button></div>`);
      return;
    }

    const btn = $("[data-acao='salvar']");
    btn.disabled = true; btn.textContent = "Salvando...";
    const r = await api.salvarAutomacao(linhaDoEstado(st));
    btn.disabled = false; btn.textContent = "Salvar";

    if (!r.ok) return toast("Não foi possível salvar: " + (r.erro || "erro desconhecido"), "erro", 5000);
    st.id = r.data.id;
    ED.snap = fotografia(st);
    marcarSujo();
    if (r.local) toast("Salvo só neste navegador (modo de teste). Pra salvar de verdade, configure o Supabase (veja o LEIA-ME).", "", 6000);
    else toast("Automação salva.", "ok");
    await fecharEditor(true);
    if (location.hash !== "#/instagram/automacoes") location.hash = "#/instagram/automacoes";
    else rotear();
  }

  // ---------- Modal genérico ----------
  // "guarda": função opcional que pode impedir o fechamento (ex: alterações não salvas)
  let modalGuarda = null;
  function abrirModal(html, aoClicar, classe = "", guarda = null) {
    const m = $("#modal");
    m.oninput = null; m.onkeydown = null; m.onchange = null;
    m.innerHTML = `<div class="modal ${classe}" role="dialog" aria-modal="true">${html}</div>`;
    m.hidden = false;
    modalGuarda = guarda;
    m.onclick = (e) => {
      if (e.target === m || e.target.closest("[data-fechar]")) return tentarFecharModal();
      if (aoClicar) aoClicar(e);
    };
  }
  function tentarFecharModal() { if (modalGuarda && !modalGuarda()) return; fecharModal(); }
  function fecharModal() { const m = $("#modal"); m.hidden = true; m.innerHTML = ""; modalGuarda = null; }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) tentarFecharModal(); });

  // ---------- Seletor de posts ----------
  async function escolherPosts() {
    abrirModal(`<div class="modal-cab"><h2>Em quais posts</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div><p class="muted">Carregando posts...</p>`);
    const r = await api.posts();
    if ($("#modal").hidden) return;
    const sel = new Set(ED.st.media_ids);

    if (!r.connected || !(r.posts || []).length) {
      abrirModal(`
        <div class="modal-cab"><h2>Em quais posts</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
        <div class="vazio" style="padding:24px 8px">
          <div class="icone-grande">${ICON.instagram}</div>
          <h2>Conecte seu Instagram pra listar os posts</h2>
          <p>Sem escolher nenhum, a automação vale pra todos os posts.</p>
        </div>
        <div class="modal-rodape"><button class="btn btn-primario" data-fechar>Ok</button></div>`);
      return;
    }

    const desenhar = () => `
      <div class="modal-cab"><h2>Em quais posts</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      <p class="muted" style="margin-bottom:12px">Toque pra escolher. Nenhum escolhido = vale pra todos.</p>
      <div class="posts">${r.posts.map((p) => `
        <div class="post ${sel.has(p.id) ? "sel" : ""}" data-post="${esc(p.id)}" title="${esc(p.caption)}">
          ${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : ""}
          <div class="leg">${esc(fmtDia(p.data))}</div>
        </div>`).join("")}</div>
      <div class="modal-rodape">
        <button class="btn" data-fechar>Cancelar</button>
        <button class="btn btn-primario" data-ok>Usar ${sel.size || "todos os"} post(s)</button>
      </div>`;

    const clique = (e) => {
      const p = e.target.closest("[data-post]");
      if (p) { const id = p.dataset.post; sel.has(id) ? sel.delete(id) : sel.add(id); abrirModal(desenhar(), clique); return; }
      if (e.target.closest("[data-ok]")) {
        ED.st.media_ids = Array.from(sel);
        fecharModal(); renderForm(); marcarSujo();
      }
    };
    abrirModal(desenhar(), clique);
  }

  // ---------- Biblioteca de arquivos ----------
  async function escolherArquivos() {
    ED.arquivos = await api.listarArquivos();
    const sel = new Set(ED.st.assets);

    const desenhar = () => `
      <div class="modal-cab"><h2>Biblioteca de arquivos</h2><button class="btn-icone" data-fechar aria-label="Fechar">${ICON.x}</button></div>
      ${ED.arquivos.length ? ED.arquivos.map((a) => `
        <div class="arq-item ${sel.has(a.id) ? "sel" : ""}" data-arq="${esc(a.id)}">
          ${ICON.arquivo}<div style="flex:1;min-width:0"><div style="font-weight:560">${esc(a.nome)}</div>
          <div class="muted" style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc({ image: "Foto", audio: "Áudio", video: "Vídeo", file: "Arquivo (PDF)" }[a.tipo] || a.tipo)}</div></div>
          ${sel.has(a.id) ? `<span class="selo ok">Anexado</span>` : ""}
        </div>`).join("") : `<p class="muted" style="margin-bottom:8px">A biblioteca está vazia. Adicione um arquivo abaixo.</p>`}

      <div class="separador"></div>
      <h3 style="margin-bottom:10px">Adicionar arquivo</h3>
      <div class="grade grade-2">
        <label class="campo"><span class="rotulo">Nome</span><input type="text" id="arq-nome" placeholder="Ex: Guia em PDF"></label>
        <label class="campo"><span class="rotulo">Tipo</span>
          <select id="arq-tipo"><option value="file">Arquivo (PDF)</option><option value="image">Foto</option><option value="audio">Áudio</option><option value="video">Vídeo</option></select></label>
      </div>
      ${USA_BANCO ? `<label class="campo"><span class="rotulo">Enviar do computador</span><input type="file" id="arq-file"></label>
        <p class="ajuda" style="margin:-8px 0 12px">Ou cole um link público abaixo.</p>` : ""}
      <label class="campo"><span class="rotulo">Link público do arquivo</span><input type="url" id="arq-url" placeholder="https://..."></label>
      ${!USA_BANCO ? `<p class="ajuda">Modo de teste: o arquivo fica salvo só neste navegador.</p>` : ""}
      <div class="modal-rodape">
        <button class="btn" data-add>Adicionar à biblioteca</button>
        <button class="btn btn-primario" data-ok>Pronto</button>
      </div>`;

    const clique = async (e) => {
      const item = e.target.closest("[data-arq]");
      if (item) { const id = item.dataset.arq; sel.has(id) ? sel.delete(id) : sel.add(id); abrirModal(desenhar(), clique); return; }
      if (e.target.closest("[data-add]")) {
        const nome = $("#arq-nome").value.trim();
        const tipo = $("#arq-tipo").value;
        const url = $("#arq-url").value.trim();
        const file = $("#arq-file") && $("#arq-file").files[0];
        if (!nome) return toast("Dê um nome pro arquivo.", "erro");
        if (!file && !urlValida(url)) return toast("Escolha um arquivo ou cole um link completo (https://).", "erro");
        const r = await api.adicionarArquivo({ nome, tipo, url, file });
        if (!r.ok) return toast("Não foi possível adicionar: " + (r.erro || ""), "erro", 5000);
        ED.arquivos.unshift(r.data);
        sel.add(r.data.id);
        toast("Arquivo adicionado.", "ok");
        abrirModal(desenhar(), clique);
        return;
      }
      if (e.target.closest("[data-ok]")) {
        ED.st.assets = Array.from(sel);
        fecharModal(); renderForm(); atualizarPrevia(); marcarSujo();
      }
    };
    abrirModal(desenhar(), clique);
  }

  // ===================================================================
  // Começa!
  // ===================================================================
  iniciar();
})();
