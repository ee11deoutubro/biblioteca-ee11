(() => {
  'use strict';

  const config = window.BIBLIOTECA_CONFIG;

  if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
    window.bibliotecaSupabaseError = 'Configuração do Supabase ausente.';
    return;
  }

  if (!window.supabase?.createClient) {
    window.bibliotecaSupabaseError = 'Biblioteca de conexão indisponível.';
    return;
  }

  window.bibliotecaSupabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
