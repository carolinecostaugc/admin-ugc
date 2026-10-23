// =====================================================================
// config.js: as duas chaves PÚBLICAS do Supabase.
// Pode ficar no site público: quem tranca o banco é o RLS.
// NUNCA coloque aqui a chave service_role nem o token do Instagram.
//
// Onde achar: Supabase > Project Settings > API
// =====================================================================
window.APP_CONFIG = {
  SUPABASE_URL: "SUA_SUPABASE_URL_AQUI",          // ex: https://SEU_PROJETO.supabase.co
  SUPABASE_ANON_KEY: "SUA_SUPABASE_ANON_KEY_AQUI",
};
