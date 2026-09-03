(() => {
  'use strict';

  const NAVIGATION_KEY = 'biblioteca11:navegacao:v1';
  const DRAFTS_KEY = 'biblioteca11:rascunhos:v1';
  const DEFAULT_VIEW = 'Início';

  const toast = document.getElementById('toast');
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

  connectDashboard();
  fetch('/api/health').catch(() => null);
})();
