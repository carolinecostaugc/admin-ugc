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
    if (rota === "calendario") return telaCalendario();
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
          <h1>Bem-vindo ao seu painel</h1>
          <p class="muted">Uma visão rápida de como estão suas automações.</p>
        </div>
      </div>
      <div class="grade grade-3">
        ${kpi("usuarios", "Leads captados", "kpi-leads", "pessoas que interagiram")}
        ${kpi("raio", "Automações ativas", "kpi-ativas", "respondendo agora")}
        ${kpi("enviar", "DMs enviadas", "kpi-dms", "nos últimos 7 dias")}
      </div>
      <h2 class="secao-titulo">Atalhos</h2>
      <div class="atalhos">
        <a class="btn btn-primario" href="#/instagram/automacoes">${ICON.raio} Criar ou editar automações</a>
        <a class="btn" href="#/instagram/metricas">${ICON.grafico} Ver métricas do Instagram</a>
        <a class="btn" href="#/calendario">${ICON.calendario} Calendário</a>
      </div>`;
    const c = await api.contagens();
    if (!$("#kpi-leads")) return; // trocou de tela enquanto carregava
    $("#kpi-leads").textContent = fmtNum(c.leads);
    $("#kpi-ativas").textContent = fmtNum(c.ativas);
    $("#kpi-dms").textContent = fmtNum(c.dms7);
  }

  function kpi(icone, titulo, id, sub) {
    return `<div class="cartao kpi">
      <span class="rotulo">${esc(titulo)}</span>
      <div class="valor" id="${id}">0</div>
      <div class="sub">${esc(sub)}</div>
    </div>`;
  }

  // ---------- Calendário (placeholder) ----------
  function telaCalendario() {
    conteudo().innerHTML = `
      <div class="cartao vazio em-breve">
        <div class="icone-grande">${ICON.calendario}</div>
        <h2>Calendário</h2>
        <p>Essa área vai chegar em breve pra você planejar seus conteúdos.</p>
        <span class="selo off">Em breve</span>
      </div>`;
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
  function abrirModal(html, aoClicar, classe = "") {
    const m = $("#modal");
    m.oninput = null; m.onkeydown = null;
    m.innerHTML = `<div class="modal ${classe}" role="dialog" aria-modal="true">${html}</div>`;
    m.hidden = false;
    m.onclick = (e) => {
      if (e.target === m || e.target.closest("[data-fechar]")) return fecharModal();
      if (aoClicar) aoClicar(e);
    };
  }
  function fecharModal() { const m = $("#modal"); m.hidden = true; m.innerHTML = ""; }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) fecharModal(); });

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
