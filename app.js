(() => {
  'use strict';

  const NAVIGATION_KEY = 'biblioteca11:navegacao:v1';
  const DRAFTS_KEY = 'biblioteca11:rascunhos:v1';
  const DEFAULT_VIEW = 'Início';
  const ADMIN_ROLES = new Set(['bibliotecario', 'gestao_escolar']);

  const toast = document.getElementById('toast');
  const authScreen = document.getElementById('authScreen');
  const adminApp = document.getElementById('adminApp');
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginButton = document.getElementById('loginButton');
  const passwordToggle = document.getElementById('passwordToggle');
  const authMessage = document.getElementById('authMessage');
  const logoutButton = document.getElementById('logoutButton');
  const profileInitial = document.getElementById('profileInitial');
  const profileName = document.getElementById('profileName');
  const profileRole = document.getElementById('profileRole');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuButton = document.getElementById('menuButton');
  const todayLabel = document.getElementById('todayLabel');
  const pageStart = document.getElementById('pageStart');
  const systemStatus = document.getElementById('systemStatus');
  const metricTitles = document.getElementById('metricTitles');
  const metricCollectionDetail = document.getElementById('metricCollectionDetail');
  const metricAvailable = document.getElementById('metricAvailable');
  const metricBorrowed = document.getElementById('metricBorrowed');
  const metricOverdue = document.getElementById('metricOverdue');
  const metricOverdueNote = document.getElementById('metricOverdueNote');
  let toastTimer;

  function readStorage(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // O APP continua funcionando mesmo quando o navegador bloqueia o armazenamento.
    }
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Sem ação: não deve interromper uma atividade do usuário.
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
  }

  function closeSidebar() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
  }

  function scrollToContent(behavior = 'smooth') {
    const target = document.querySelector('[data-view]:not([hidden])') || pageStart || document.body;
    target.scrollIntoView({ behavior, block: 'start' });
  }

  function forceInitialTop() {
    // Evita que o navegador reabra o APP no meio da tela.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 80);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
  }

  function setConnectionStatus(text, state) {
    if (!systemStatus) return;
    systemStatus.classList.remove('connected', 'offline');
    if (state) systemStatus.classList.add(state);
    systemStatus.lastChild.textContent = ` ${text}`;
  }

  function setAuthMessage(message = '', state = 'error') {
    if (!authMessage) return;
    authMessage.textContent = message;
    authMessage.classList.toggle('success', state === 'success');
  }

  function setLoginLoading(isLoading) {
    if (!loginButton) return;
    loginButton.disabled = isLoading;
    loginButton.querySelector('span').textContent = isLoading
      ? 'Verificando acesso...'
      : 'Entrar no painel';
  }

  function friendlyAuthError(error) {
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (message.includes('email not confirmed')) return 'Este e-mail ainda não foi confirmado.';
    if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    return 'Não foi possível entrar agora. Confira os dados e tente novamente.';
  }

  function showLogin(message = '') {
    adminApp.hidden = true;
    authScreen.hidden = false;
    document.body.classList.add('auth-loading');
    setAuthMessage(message);
    forceInitialTop();
    setTimeout(() => loginEmail?.focus({ preventScroll: true }), 80);
  }

  function showAdmin(profile) {
    const roleLabel = profile.tipo === 'gestao_escolar'
      ? 'Gestão Escolar'
      : 'Bibliotecário';

    profileName.textContent = profile.nome;
    profileRole.textContent = roleLabel;
    profileInitial.textContent = profile.nome.trim().charAt(0).toUpperCase() || 'B';
    authScreen.hidden = true;
    adminApp.hidden = false;
    document.body.classList.remove('auth-loading');
    setAuthMessage('');
    forceInitialTop();
  }

  async function authorizeSession(session) {
    const client = window.bibliotecaSupabase;

    if (!session?.user || !client) {
      showLogin();
      return false;
    }

    const { data: profile, error } = await client
      .from('perfis')
      .select('id,nome,email,tipo,ativo')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !profile || !profile.ativo || !ADMIN_ROLES.has(profile.tipo)) {
      await client.auth.signOut();
      showLogin('Esta conta não possui acesso ao painel administrativo.');
      return false;
    }

    showAdmin(profile);
    await connectDashboard();
    return true;
  }

  async function initializeAuthentication() {
    const client = window.bibliotecaSupabase;

    if (!client) {
      showLogin(window.bibliotecaSupabaseError || 'Não foi possível conectar ao sistema.');
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      showLogin('Não foi possível recuperar o acesso salvo. Entre novamente.');
      return;
    }

    if (data?.session) {
      await authorizeSession(data.session);
    } else {
      showLogin();
    }
  }

  async function loadCompleteCatalog(client) {
    const pageSize = 1000;
    const catalog = [];

    for (let start = 0; start < 20000; start += pageSize) {
      const { data, error } = await client
        .from('acervo_publico')
        .select('id,total_exemplares,disponiveis,emprestados')
        .range(start, start + pageSize - 1);

      if (error) throw error;
      catalog.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    return catalog;
  }

  async function connectDashboard() {
    const client = window.bibliotecaSupabase;

    if (!client) {
      setConnectionStatus(window.bibliotecaSupabaseError || 'Banco indisponível', 'offline');
      return;
    }

    try {
      const catalog = await loadCompleteCatalog(client);
      const totals = catalog.reduce((summary, book) => {
        summary.copies += Number(book.total_exemplares) || 0;
        summary.available += Number(book.disponiveis) || 0;
        summary.borrowed += Number(book.emprestados) || 0;
        return summary;
      }, { copies: 0, available: 0, borrowed: 0 });

      metricTitles.textContent = formatNumber(catalog.length);
      metricCollectionDetail.textContent = `${formatNumber(totals.copies)} exemplares físicos`;
      metricAvailable.textContent = formatNumber(totals.available);
      metricBorrowed.textContent = formatNumber(totals.borrowed);

      const { data: authData } = await client.auth.getSession();
      if (authData?.session) {
        const { count, error } = await client
          .from('emprestimos_detalhados')
          .select('id', { count: 'exact', head: true })
          .eq('situacao', 'em_atraso');

        if (!error) {
          metricOverdue.textContent = formatNumber(count);
          metricOverdueNote.textContent = 'Precisam de acompanhamento';
        }
      }

      setConnectionStatus('Banco conectado', 'connected');
    } catch (error) {
      console.error('Falha ao consultar o Supabase:', error);
      setConnectionStatus('Falha na conexão', 'offline');
    }
  }

  function availableView(name) {
    return [...document.querySelectorAll('[data-view]')]
      .find((view) => view.dataset.view === name);
  }

  function updateActiveNavigation(name) {
    document.querySelectorAll('[data-module]').forEach((button) => {
      button.classList.toggle('active', button.dataset.module === name);
    });
  }

  function activateView(name, options = {}) {
    const requestedView = availableView(name);
    const defaultView = availableView(DEFAULT_VIEW);
    const selectedView = requestedView || defaultView;

    if (!selectedView) return false;

    document.querySelectorAll('[data-view]').forEach((view) => {
      view.hidden = view !== selectedView;
    });

    const selectedName = selectedView.dataset.view || DEFAULT_VIEW;
    updateActiveNavigation(selectedName);
    writeStorage(NAVIGATION_KEY, {
      activeView: selectedName,
      activeActivity: options.activity || null
    });

    if (options.scroll !== false) scrollToContent(options.behavior || 'smooth');
    return Boolean(requestedView);
  }

  function restoreDrafts() {
    const drafts = readStorage(DRAFTS_KEY, {});
    document.querySelectorAll('[data-persist]').forEach((field) => {
      const key = field.dataset.persist;
      if (!(key in drafts)) return;
      if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = Boolean(drafts[key]);
      } else {
        field.value = drafts[key];
      }
    });
  }

  function saveField(field) {
    const key = field.dataset.persist;
    if (!key) return;
    const drafts = readStorage(DRAFTS_KEY, {});
    drafts[key] = field.type === 'checkbox' || field.type === 'radio'
      ? field.checked
      : field.value;
    writeStorage(DRAFTS_KEY, drafts);
  }

  function clearActivity(activityName) {
    const state = readStorage(NAVIGATION_KEY, {});
    const drafts = readStorage(DRAFTS_KEY, {});

    document.querySelectorAll('[data-persist]').forEach((field) => {
      const scope = field.dataset.activity;
      if (!activityName || scope === activityName) {
        delete drafts[field.dataset.persist];
        if (field.type === 'checkbox' || field.type === 'radio') field.checked = false;
        else field.value = '';
      }
    });

    writeStorage(DRAFTS_KEY, drafts);
    writeStorage(NAVIGATION_KEY, { ...state, activeActivity: null });
  }

  function leaveApp() {
    removeStorage(NAVIGATION_KEY);
    removeStorage(DRAFTS_KEY);
    forceInitialTop();
  }

  if (todayLabel) {
    todayLabel.textContent = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }).format(new Date()).toUpperCase();
  }

  restoreDrafts();
  const savedNavigation = readStorage(NAVIGATION_KEY, { activeView: DEFAULT_VIEW });
  activateView(savedNavigation.activeView || DEFAULT_VIEW, { scroll: false });
  forceInitialTop();

  passwordToggle?.addEventListener('click', () => {
    const showing = loginPassword.type === 'text';
    loginPassword.type = showing ? 'password' : 'text';
    passwordToggle.textContent = showing ? 'Mostrar' : 'Ocultar';
    passwordToggle.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
    loginPassword.focus({ preventScroll: true });
  });

  loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      setAuthMessage('Preencha o e-mail e a senha.');
      (!email ? loginEmail : loginPassword).focus();
      return;
    }

    const client = window.bibliotecaSupabase;
    if (!client) {
      setAuthMessage(window.bibliotecaSupabaseError || 'Conexão indisponível.');
      return;
    }

    setLoginLoading(true);
    setAuthMessage('');

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await authorizeSession(data.session);
      loginPassword.value = '';
    } catch (error) {
      setAuthMessage(friendlyAuthError(error));
      loginPassword.select();
    } finally {
      setLoginLoading(false);
    }
  });

  logoutButton?.addEventListener('click', async () => {
    const client = window.bibliotecaSupabase;
    logoutButton.disabled = true;

    try {
      await client?.auth.signOut();
    } finally {
      leaveApp();
      loginForm?.reset();
      showLogin('Acesso encerrado com segurança.');
      logoutButton.disabled = false;
    }
  });

  menuButton?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('show');
  });
  overlay?.addEventListener('click', closeSidebar);

  document.querySelectorAll('[data-persist]').forEach((field) => {
    field.addEventListener('input', () => saveField(field));
    field.addEventListener('change', () => saveField(field));
  });

  document.querySelectorAll('[data-module]').forEach((button) => {
    button.addEventListener('click', () => {
      closeSidebar();
      const moduleName = button.dataset.module;
      if (!activateView(moduleName)) {
        showToast(`${moduleName}: módulo preparado para a próxima etapa.`);
        scrollToContent();
      }
    });
  });

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const activity = button.dataset.action;
      const activityPanel = document.querySelector(`[data-activity-panel="${activity}"]`);
      const label = activity === 'emprestimo' ? 'Novo empréstimo' : 'Registrar devolução';

      if (activityPanel) {
        activityPanel.hidden = false;
        writeStorage(NAVIGATION_KEY, {
          ...readStorage(NAVIGATION_KEY, {}),
          activeActivity: activity
        });
        activityPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        activityPanel.querySelector('input, select, textarea, button')?.focus({ preventScroll: true });
      } else {
        showToast(`${label} será ativado na etapa de operações.`);
        scrollToContent();
      }
    });
  });

  document.querySelectorAll('[data-finalize-activity]').forEach((button) => {
    button.addEventListener('click', () => {
      clearActivity(button.dataset.finalizeActivity || null);
      activateView(DEFAULT_VIEW);
    });
  });

  document.querySelectorAll('[data-exit-app]').forEach((button) => {
    button.addEventListener('click', leaveApp);
  });

  const search = document.querySelector('.global-search input');
  search?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && search.value.trim()) {
      showToast('A busca será conectada ao acervo na próxima etapa.');
      scrollToContent();
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search?.focus();
    }
    if (event.key === 'Escape') closeSidebar();
  });

  window.addEventListener('pageshow', forceInitialTop);

  // API central para as próximas telas: finalizar/cancelar limpa somente a atividade;
  // sair limpa toda a navegação e os rascunhos do usuário.
  window.BibliotecaNavigation = Object.freeze({
    goTo: (viewName) => activateView(viewName),
    finish: (activityName) => {
      clearActivity(activityName);
      activateView(DEFAULT_VIEW);
    },
    cancel: (activityName) => {
      clearActivity(activityName);
      activateView(DEFAULT_VIEW);
    },
    leave: leaveApp
  });

  initializeAuthentication();
  fetch('/api/health').catch(() => null);
})();
