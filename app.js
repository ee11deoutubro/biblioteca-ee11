(() => {
  'use strict';

  const NAVIGATION_KEY = 'biblioteca11:navegacao:v2';
  const DRAFTS_KEY = 'biblioteca11:rascunhos:v2';
  const CATEGORY_KEY = 'biblioteca11:categoria-acervo:v1';
  const DEFAULT_VIEW = 'Início';
  const ADMIN_ROLES = new Set(['bibliotecario', 'gestao_escolar']);

  const toast = document.getElementById('toast');
  const publicPortal = document.getElementById('publicPortal');
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
  const catalogGrid = document.getElementById('catalogGrid');
  const catalogEmpty = document.getElementById('catalogEmpty');
  const catalogSearch = document.getElementById('catalogSearch');
  const catalogAvailability = document.getElementById('catalogAvailability');
  const catalogCount = document.getElementById('catalogCount');
  const catalogCopies = document.getElementById('catalogCopies');
  const catalogAvailable = document.getElementById('catalogAvailable');
  const refreshCatalog = document.getElementById('refreshCatalog');
  const catalogCategories = document.getElementById('catalogCategories');
  const catalogClassification = document.getElementById('catalogClassification');
  const catalogViewSwitch = document.getElementById('catalogViewSwitch');
  const bookFormPanel = document.getElementById('bookFormPanel');
  const bookForm = document.getElementById('bookForm');
  const openBookForm = document.getElementById('openBookForm');
  const closeBookForm = document.getElementById('closeBookForm');
  const cancelBookForm = document.getElementById('cancelBookForm');
  const saveBookButton = document.getElementById('saveBookButton');
  const bookFormFeedback = document.getElementById('bookFormFeedback');
  const bookFormKicker = document.getElementById('bookFormKicker');
  const bookFormTitle = document.getElementById('bookFormTitle');
  const bookFormDescription = document.getElementById('bookFormDescription');
  const editCoverPreview = document.getElementById('editCoverPreview');
  const copyFieldsList = document.getElementById('copyFieldsList');
  const copyFieldsHelp = document.getElementById('copyFieldsHelp');
  const addCopyButton = document.getElementById('addCopyButton');
  const bookDetailsPanel = document.getElementById('bookDetailsPanel');
  const bookDetailsContent = document.getElementById('bookDetailsContent');
  const closeBookDetails = document.getElementById('closeBookDetails');
  const editBookFromDetails = document.getElementById('editBookFromDetails');
  const refreshRequests = document.getElementById('refreshRequests');
  const requestStatusFilter = document.getElementById('requestStatusFilter');
  const requestCount = document.getElementById('requestCount');
  const requestsList = document.getElementById('requestsList');
  const requestsEmpty = document.getElementById('requestsEmpty');
  const openAdminLogin = document.getElementById('openAdminLogin');
  const backToCatalog = document.getElementById('backToCatalog');
  const loanOperationPanel = document.getElementById('loanOperationPanel');
  const closeLoanOperation = document.getElementById('closeLoanOperation');
  const loanStudentCode = document.getElementById('loanStudentCode');
  const findLoanStudentButton = document.getElementById('findLoanStudent');
  const loanStudentFeedback = document.getElementById('loanStudentFeedback');
  const loanStudentCard = document.getElementById('loanStudentCard');
  const loanStudentRecords = document.getElementById('loanStudentRecords');
  const loanCopyStep = document.getElementById('loanCopyStep');
  const loanCopySearch = document.getElementById('loanCopySearch');
  const searchLoanCopiesButton = document.getElementById('searchLoanCopies');
  const loanCopyFeedback = document.getElementById('loanCopyFeedback');
  const loanCopyResults = document.getElementById('loanCopyResults');
  const loanConfirmStep = document.getElementById('loanConfirmStep');
  const loanSelectedCopy = document.getElementById('loanSelectedCopy');
  const loanForm = document.getElementById('loanForm');
  const loanDueDate = document.getElementById('loanDueDate');
  const saveLoanButton = document.getElementById('saveLoanButton');
  const loanFormFeedback = document.getElementById('loanFormFeedback');
  let toastTimer;
  let releaseTopLock = () => {};
  let activeProfile = null;
  let catalogCache = [];
  let selectedCategory = readStorage(CATEGORY_KEY, 'todos');
  let editingBookId = null;
  let editingCoverUrl = null;
  let pendingEditBookId = null;
  let requestsCache = [];
  let editingCopies = [];
  let selectedBookDetailsId = null;
  let selectedLoanStudent = null;
  let selectedLoanCopy = null;

  const CLASSIFICATION_COLORS = Object.freeze({
    Amarela: '#eab308',
    Laranja: '#f59e0b',
    Rosa: '#ec4899',
    Verde: '#16a34a'
  });

  function readStorage(key, fallback) {
    try {
      return JSON.parse(sessionStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // O APP continua funcionando mesmo quando o navegador bloqueia o armazenamento.
    }
  }

  function removeStorage(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Sem ação: não deve interromper uma atividade do usuário.
    }
  }

  function categoryKey(value) {
    return value ? normalizeSearch(value) : '__sem_categoria__';
  }

  function validHexColor(value, fallback = '#1768d4') {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }

  function classificationColor(book) {
    return validHexColor(
      book?.classificacao_cor_hex || CLASSIFICATION_COLORS[book?.classificacao_cor],
      '#94a3b8'
    );
  }

  function classificationColorLabel(book) {
    return book?.classificacao_cor || 'Cor não informada';
  }

  function originalCatalogMetadata(book) {
    return window.BIBLIOTECA_CATALOG_METADATA?.[normalizeSearch(book?.titulo)] || null;
  }

  function mergeCatalogMetadata(book, databaseMetadata = null) {
    const merged = { ...book };
    const reference = originalCatalogMetadata(book);
    const fields = [
      'ordem_planilha',
      'genero_codigo',
      'classificacao_numero',
      'classificacao_cor',
      'classificacao_cor_hex'
    ];

    if (reference) {
      fields.forEach((field) => {
        if ((merged[field] === null || merged[field] === undefined || merged[field] === '') && reference[field] !== null) {
          merged[field] = reference[field];
        }
      });
    }

    if (databaseMetadata) {
      fields.forEach((field) => {
        if (databaseMetadata[field] !== null && databaseMetadata[field] !== undefined && databaseMetadata[field] !== '') {
          merged[field] = databaseMetadata[field];
        }
      });
    }

    return merged;
  }

  function copyFieldValue(row, selector) {
    return String(row?.querySelector(selector)?.value || '').trim();
  }

  function copyRowsPayload() {
    return [...(copyFieldsList?.querySelectorAll('[data-copy-row]') || [])].map((row, index) => ({
      id: row.dataset.copyId || null,
      codigo: row.dataset.copyCode || null,
      numero_exemplar: Number(row.dataset.copyNumber) || index + 1,
      tombamento: copyFieldValue(row, '[data-copy-field="tombamento"]') || null,
      localizacao: copyFieldValue(row, '[data-copy-field="localizacao"]') || null,
      conservacao: copyFieldValue(row, '[data-copy-field="conservacao"]') || 'bom',
      origem: copyFieldValue(row, '[data-copy-field="origem"]') || null,
      ativo: row.querySelector('[data-copy-field="ativo"]')?.checked ?? true,
      status: row.dataset.copyStatus || 'disponivel'
    }));
  }

  function renderCopyFields(quantity = 1, copies = []) {
    if (!copyFieldsList) return;
    const total = Math.max(1, Math.min(100, Number(quantity) || copies.length || 1));
    const defaultLocation = String(bookForm?.elements.namedItem('localizacao')?.value || '').trim();
    const defaultOrigin = String(bookForm?.elements.namedItem('origem')?.value || '').trim();
    const options = (items, selected) => items.map(([value, label]) =>
      `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`
    ).join('');
    const conservationOptions = [['novo', 'Novo'], ['otimo', 'Ótimo'], ['bom', 'Bom'], ['regular', 'Regular'], ['danificado', 'Danificado']];
    const originOptions = [['', 'Não informada'], ['Compra', 'Compra'], ['Doação', 'Doação'], ['PNLD', 'PNLD'], ['Outro', 'Outro']];

    copyFieldsList.innerHTML = Array.from({ length: total }, (_, index) => {
      const copy = copies[index] || {};
      const copyNumber = Number(copy.numero_exemplar) || index + 1;
      const location = copy.localizacao ?? defaultLocation;
      const origin = copy.origem ?? defaultOrigin;
      const isExisting = Boolean(copy.id);
      const isActive = copy.ativo !== false;
      const canChangeActive = !isExisting || !copy.status || copy.status === 'disponivel';
      const pendingLabel = isExisting && !copy.tombamento
        ? '<small class="tombamento-pending">Tombamento pendente</small>'
        : '';
      return `<div class="copy-field-row" data-copy-row data-copy-id="${escapeHtml(copy.id || '')}" data-copy-code="${escapeHtml(copy.codigo || '')}" data-copy-number="${copyNumber}" data-copy-status="${escapeHtml(copy.status || 'disponivel')}">
        <div class="copy-field-identity"><strong>Exemplar ${copyNumber}</strong><span>${escapeHtml(copy.codigo || 'Código gerado ao salvar')}</span>${pendingLabel}</div>
        <label class="app-field"><span>Tombamento${isExisting ? '' : ' *'}</span><input type="text" maxlength="80" value="${escapeHtml(copy.tombamento || '')}" placeholder="Número patrimonial" data-copy-field="tombamento" ${isExisting ? '' : 'required'} /></label>
        <label class="app-field"><span>Localização</span><input type="text" maxlength="80" value="${escapeHtml(location || '')}" placeholder="Ex.: 6V" data-copy-field="localizacao" /></label>
        <label class="app-field copy-field-conservation"><span>Conservação</span><select data-copy-field="conservacao">${options(conservationOptions, copy.conservacao || 'bom')}</select></label>
        <label class="app-field copy-field-origin"><span>Origem</span><select data-copy-field="origem">${options(originOptions, origin || '')}</select></label>
        <label class="copy-active-control ${canChangeActive ? '' : 'is-locked'}"><input type="checkbox" data-copy-field="ativo" ${isActive ? 'checked' : ''} ${canChangeActive ? '' : 'disabled'} /><span>${isActive ? 'Ativo no acervo' : 'Exemplar desativado'}</span>${canChangeActive ? '' : '<small>Não pode ser desativado durante reserva ou empréstimo.</small>'}</label>
      </div>`;
    }).join('');
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
    // Safari/iOS pode restaurar a rolagem depois que a tela visível é trocada.
    const reset = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };

    reset();
    requestAnimationFrame(() => {
      reset();
      requestAnimationFrame(reset);
    });
    [80, 220, 500].forEach((delay) => setTimeout(reset, delay));
  }

  function lockViewAtTop() {
    // Impede a restauração tardia de rolagem do Safari antes da primeira ação real.
    releaseTopLock();
    let locked = true;

    const reset = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    };

    const keepAtTop = () => {
      if (locked && window.scrollY !== 0) reset();
    };

    const release = () => {
      if (!locked) return;
      locked = false;
      window.removeEventListener('scroll', keepAtTop);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('pointerdown', release);
      window.removeEventListener('wheel', release);
      window.removeEventListener('keydown', release);
    };

    window.addEventListener('scroll', keepAtTop, { passive: true });
    window.addEventListener('touchstart', release, { passive: true, once: true });
    window.addEventListener('pointerdown', release, { passive: true, once: true });
    window.addEventListener('wheel', release, { passive: true, once: true });
    window.addEventListener('keydown', release, { once: true });
    releaseTopLock = release;

    reset();
    requestAnimationFrame(() => requestAnimationFrame(reset));
    setTimeout(reset, 100);
    setTimeout(reset, 450);
    setTimeout(reset, 1000);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
  }

  function normalizeSearch(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

  function showPortal(message = '') {
    activeProfile = null;
    adminApp.hidden = true;
    authScreen.hidden = true;
    publicPortal.hidden = false;
    document.body.classList.remove('auth-loading');
    setAuthMessage('');
    window.BibliotecaPortal?.show(message);
    lockViewAtTop();
  }

  function showLogin(message = '') {
    activeProfile = null;
    removeStorage(NAVIGATION_KEY);
    removeStorage(DRAFTS_KEY);
    removeStorage(CATEGORY_KEY);
    selectedCategory = 'todos';
    editingBookId = null;
    editingCoverUrl = null;
    pendingEditBookId = null;
    activateView(DEFAULT_VIEW, { scroll: false });
    removeStorage(NAVIGATION_KEY);
    if (bookFormPanel) bookFormPanel.hidden = true;
    bookForm?.reset();
    if (catalogSearch) catalogSearch.value = '';
    if (catalogAvailability) catalogAvailability.value = 'todos';
    publicPortal.hidden = true;
    adminApp.hidden = true;
    authScreen.hidden = false;
    document.body.classList.add('auth-loading');
    setAuthMessage(message);
    lockViewAtTop();
  }

  function showAdmin(profile) {
    const roleLabel = profile.tipo === 'gestao_escolar'
      ? 'Gestão Escolar'
      : 'Bibliotecário';

    activeProfile = profile;
    profileName.textContent = profile.nome;
    profileRole.textContent = roleLabel;
    profileInitial.textContent = profile.nome.trim().charAt(0).toUpperCase() || 'B';
    publicPortal.hidden = true;
    authScreen.hidden = true;
    adminApp.hidden = false;
    document.body.classList.remove('auth-loading');
    setAuthMessage('');
    lockViewAtTop();
  }

  function clearLegacyNavigation() {
    try {
      localStorage.removeItem('biblioteca11:navegacao:v1');
      localStorage.removeItem('biblioteca11:rascunhos:v1');
    } catch {
      // A migração não deve impedir o acesso quando o armazenamento está bloqueado.
    }
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
      showPortal(window.bibliotecaSupabaseError || 'Não foi possível conectar ao sistema.');
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      showPortal('Não foi possível recuperar o acesso salvo.');
      return;
    }

    if (data?.session) {
      await authorizeSession(data.session);
    } else {
      showPortal();
    }
  }

  async function loadCompleteCatalog(client) {
    const { data: refreshedCatalog, error: refreshError } = await client
      .rpc('consultar_acervo_publico_atualizado');

    if (!refreshError) {
      return enrichCatalogClassification(client, refreshedCatalog || []);
    }

    const pageSize = 1000;
    const catalog = [];

    for (let start = 0; start < 20000; start += pageSize) {
      const { data, error } = await client
        .from('acervo_publico')
        .select('id,titulo,subtitulo,autor,isbn,editora,ano_publicacao,categoria,capa_url,total_exemplares,disponiveis,reservados,emprestados')
        .order('titulo', { ascending: true })
        .range(start, start + pageSize - 1);

      if (error) throw error;
      catalog.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    return enrichCatalogClassification(client, catalog);
  }

  async function enrichCatalogClassification(client, catalog) {
    if (!catalog.length) return [];
    const metadata = [];
    const pageSize = 1000;
    for (let start = 0; start < catalog.length; start += pageSize) {
      const ids = catalog.slice(start, start + pageSize).map((book) => book.id);
      const { data, error } = await client
        .from('livros')
        .select('id,ordem_planilha,genero_codigo,classificacao_numero,classificacao_cor,classificacao_cor_hex')
        .in('id', ids);
      if (error) {
        console.info('Classificação detalhada aguardando atualização do banco.');
        return catalog
          .map((book) => mergeCatalogMetadata(book))
          .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
      }
      metadata.push(...(data || []));
    }
    const byId = new Map(metadata.map((item) => [item.id, item]));
    return catalog
      .map((book) => mergeCatalogMetadata(book, byId.get(book.id)))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }

  function renderCategoryTabs() {
    if (!catalogCategories) return;

    const categories = new Map();
    catalogCache.forEach((book) => {
      const key = categoryKey(book.categoria);
      const current = categories.get(key);
      categories.set(key, {
        label: book.categoria?.trim() || 'Sem categoria',
        count: (current?.count || 0) + 1
      });
    });

    if (selectedCategory !== 'todos' && !categories.has(selectedCategory)) {
      selectedCategory = 'todos';
      writeStorage(CATEGORY_KEY, selectedCategory);
    }

    const options = [
      { key: 'todos', label: 'Todos', count: catalogCache.length },
      ...[...categories.entries()]
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => {
          const preferred = ['literatura juvenil', 'contos', 'literatura estrangeira', 'drama', 'hq'];
          const aIndex = preferred.indexOf(normalizeSearch(a.label));
          const bIndex = preferred.indexOf(normalizeSearch(b.label));
          if (aIndex !== -1 || bIndex !== -1) {
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          }
          return a.label.localeCompare(b.label, 'pt-BR');
        })
    ];

    catalogCategories.replaceChildren(...options.map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-tab';
      button.dataset.category = option.key;
      button.classList.toggle('active', option.key === selectedCategory);
      button.setAttribute('aria-pressed', String(option.key === selectedCategory));
      button.textContent = option.key === 'todos'
        ? `${option.label} (${formatNumber(option.count)})`
        : option.label;
      return button;
    }));

    if (catalogClassification) {
      catalogClassification.replaceChildren(...options.map((option) => {
        const item = document.createElement('option');
        item.value = option.key;
        item.textContent = option.key === 'todos'
          ? 'Todos os gêneros'
          : `${option.label} (${formatNumber(option.count)})`;
        item.selected = option.key === selectedCategory;
        return item;
      }));
    }
  }

  function syncCatalogAvailabilityControls(value = 'todos') {
    const availability = ['todos', 'disponiveis', 'indisponiveis'].includes(value) ? value : 'todos';
    if (catalogAvailability) catalogAvailability.value = availability;
    catalogViewSwitch?.querySelectorAll('[data-catalog-availability]').forEach((button) => {
      const active = button.dataset.catalogAvailability === availability;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function renderCatalog() {
    if (!catalogGrid) return;

    const query = normalizeSearch(catalogSearch?.value);
    const availability = catalogAvailability?.value || 'todos';
    const filtered = catalogCache.filter((book) => {
      const searchable = normalizeSearch([
        book.titulo,
        book.autor,
        book.isbn,
        book.categoria,
        book.editora,
        book.ordem_planilha,
        book.genero_codigo,
        book.classificacao_numero,
        book.classificacao_cor
      ].filter(Boolean).join(' '));
      const matchesQuery = !query || searchable.includes(query);
      const matchesCategory = selectedCategory === 'todos'
        || categoryKey(book.categoria) === selectedCategory;
      const availableCopies = Number(book.disponiveis) || 0;
      const matchesAvailability = availability === 'todos'
        || (availability === 'disponiveis' && availableCopies > 0)
        || (availability === 'indisponiveis' && availableCopies === 0);
      return matchesQuery && matchesCategory && matchesAvailability;
    });

    const totals = filtered.reduce((summary, book) => {
      summary.copies += Number(book.total_exemplares) || 0;
      summary.available += Number(book.disponiveis) || 0;
      return summary;
    }, { copies: 0, available: 0 });

    catalogCount.textContent = formatNumber(filtered.length);
    catalogCopies.textContent = formatNumber(totals.copies);
    catalogAvailable.textContent = formatNumber(totals.available);
    catalogEmpty.hidden = filtered.length > 0;
    catalogGrid.hidden = filtered.length === 0;

    catalogGrid.innerHTML = filtered.map((book) => {
      const available = Number(book.disponiveis) || 0;
      const total = Number(book.total_exemplares) || 0;
      const cover = book.capa_url
        ? `<img src="${escapeHtml(book.capa_url)}" alt="Capa de ${escapeHtml(book.titulo)}" loading="lazy" />`
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zm2 0v16m3-12h6m-6 4h6"/></svg>';
      const classification = [book.genero_codigo, book.classificacao_numero].filter(Boolean).join(' • ');
      const metadata = [
        book.ordem_planilha ? `Ordem ${String(book.ordem_planilha).padStart(3, '0')}` : 'Ordem não informada',
        classification || book.categoria || 'Classificação não informada',
        book.ano_publicacao,
        book.isbn ? `ISBN ${book.isbn}` : null
      ]
        .filter(Boolean)
        .map((item) => `<span>${escapeHtml(item)}</span>`)
        .join('');
      const color = classificationColor(book);
      const colorLabel = classificationColorLabel(book);
      const colorTag = `<span class="classification-color-tag${book.classificacao_cor ? '' : ' is-empty'}" style="--classification-color:${color}">${escapeHtml(colorLabel)}</span>`;

      return `<article class="catalog-card" data-book-id="${escapeHtml(book.id)}" data-view-book="${escapeHtml(book.id)}" style="--classification-color:${color}" role="button" tabindex="0" aria-label="Ver informações de ${escapeHtml(book.titulo)}">
        <div class="book-cover">${cover}</div>
        <div class="catalog-card-content">
          <div class="catalog-title-row">
            <h2 title="${escapeHtml(book.titulo)}">${escapeHtml(book.titulo)}</h2>
            <span class="view-book-hint">Ver ficha <b>›</b></span>
          </div>
          <p class="catalog-author">${escapeHtml(book.autor)}</p>
          <div class="catalog-meta">${metadata}${colorTag}</div>
          <div class="availability-line"><strong class="${available ? '' : 'unavailable'}">${available ? `${available} disponível${available === 1 ? '' : 'is'}` : 'Indisponível'}</strong><span>${total} exemplar${total === 1 ? '' : 'es'}</span></div>
        </div>
      </article>`;
    }).join('');
  }

  function copyStatusLabel(copy) {
    if (copy.ativo === false) return 'Desativado';
    const labels = {
      disponivel: 'Disponível',
      reservado: 'Reservado',
      emprestado: 'Emprestado',
      manutencao: 'Em manutenção'
    };
    return labels[copy.status] || String(copy.status || 'Disponível').replaceAll('_', ' ');
  }

  function detailValue(value, fallback = 'Não informado') {
    return value === null || value === undefined || String(value).trim() === ''
      ? fallback
      : String(value);
  }

  function renderBookDetails(book, copies = []) {
    if (!bookDetailsContent) return;
    const cover = book.capa_url
      ? `<img src="${escapeHtml(book.capa_url)}" alt="Capa de ${escapeHtml(book.titulo)}" />`
      : '<span class="book-details-cover-placeholder"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zm2 0v16m3-12h6m-6 4h6"/></svg><small>Sem capa</small></span>';
    const color = classificationColor(book);
    const colorLabel = classificationColorLabel(book);
    const items = [
      ['Autor ou autora', detailValue(book.autor)],
      ['Editora', detailValue(book.editora)],
      ['ISBN', detailValue(book.isbn)],
      ['Ano de publicação', detailValue(book.ano_publicacao)],
      ['Gênero ou categoria', detailValue(book.categoria)],
      ['Código do gênero', detailValue(book.genero_codigo)],
      ['Número da classificação', detailValue(book.classificacao_numero)],
      ['Ordem da planilha', book.ordem_planilha ? String(book.ordem_planilha).padStart(3, '0') : 'Não informada']
    ];
    const copiesMarkup = copies.length
      ? copies.map((copy) => {
        const tombamento = detailValue(copy.tombamento, 'Tombamento pendente');
        const pending = !copy.tombamento;
        const status = copyStatusLabel(copy);
        const statusClass = copy.ativo === false ? 'inactive' : normalizeSearch(copy.status || 'disponivel').replaceAll(' ', '-');
        return `<article class="book-copy-detail ${copy.ativo === false ? 'is-inactive' : ''}">
          <div class="book-copy-number"><strong>Exemplar ${escapeHtml(copy.numero_exemplar)}</strong><span>${escapeHtml(copy.codigo || 'Código não informado')}</span></div>
          <dl><div><dt>Tombamento</dt><dd class="${pending ? 'is-pending' : ''}">${escapeHtml(tombamento)}</dd></div><div><dt>Localização</dt><dd>${escapeHtml(detailValue(copy.localizacao))}</dd></div><div><dt>Conservação</dt><dd>${escapeHtml(detailValue(copy.conservacao))}</dd></div><div><dt>Origem</dt><dd>${escapeHtml(detailValue(copy.origem))}</dd></div></dl>
          <span class="copy-status ${escapeHtml(statusClass)}">${escapeHtml(status)}</span>
        </article>`;
      }).join('')
      : '<div class="book-details-empty">Este título ainda não possui exemplar físico cadastrado.</div>';

    bookDetailsContent.innerHTML = `<div class="book-details-main">
      <div class="book-details-cover">${cover}</div>
      <div class="book-details-summary"><span class="book-details-color" style="--classification-color:${color}"><i></i>${escapeHtml(colorLabel)}</span><h3>${escapeHtml(book.titulo)}</h3>${book.subtitulo ? `<p class="book-details-subtitle">${escapeHtml(book.subtitulo)}</p>` : ''}<div class="book-details-grid">${items.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div></div>
    </div><div class="book-details-copies-heading"><div><span>EXEMPLARES</span><h3>Unidades físicas</h3></div><strong>${copies.length} exemplar${copies.length === 1 ? '' : 'es'}</strong></div><div class="book-details-copies">${copiesMarkup}</div>`;
  }

  async function openBookDetails(bookId) {
    const book = catalogCache.find((item) => item.id === bookId);
    if (!book || !bookDetailsPanel || !bookDetailsContent) {
      showToast('Não foi possível localizar este título.');
      return;
    }

    selectedBookDetailsId = book.id;
    if (bookFormPanel) bookFormPanel.hidden = true;
    bookDetailsPanel.hidden = false;
    bookDetailsContent.innerHTML = '<div class="book-details-loading">Carregando informações e exemplares...</div>';
    if (editBookFromDetails) editBookFromDetails.dataset.bookId = book.id;
    writeStorage(NAVIGATION_KEY, { activeView: 'Acervo', activeActivity: `detalhes-livro:${book.id}` });
    bookDetailsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const client = window.bibliotecaSupabase;
    if (!client) {
      renderBookDetails(book, []);
      return;
    }

    let { data: copies, error } = await client
      .from('exemplares')
      .select('id,codigo,numero_exemplar,tombamento,conservacao,localizacao,origem,status,ativo')
      .eq('livro_id', book.id)
      .order('numero_exemplar', { ascending: true });
    if (error && String(error.message || '').toLowerCase().includes('tombamento')) {
      const fallback = await client
        .from('exemplares')
        .select('id,codigo,numero_exemplar,conservacao,localizacao,origem,status,ativo')
        .eq('livro_id', book.id)
        .order('numero_exemplar', { ascending: true });
      copies = fallback.data;
      error = fallback.error;
    }
    if (error) {
      bookDetailsContent.innerHTML = '<div class="book-details-empty">Não foi possível carregar os exemplares deste título.</div>';
      return;
    }
    renderBookDetails(book, copies || []);
  }

  function hideBookDetails() {
    if (bookDetailsPanel) bookDetailsPanel.hidden = true;
    selectedBookDetailsId = null;
    const state = readStorage(NAVIGATION_KEY, {});
    writeStorage(NAVIGATION_KEY, { ...state, activeActivity: null });
    scrollToContent();
  }

  async function refreshCompleteCatalog(showLoading = false) {
    const client = window.bibliotecaSupabase;
    if (!client) return;
    if (showLoading && refreshCatalog) {
      refreshCatalog.disabled = true;
      refreshCatalog.textContent = 'Atualizando...';
    }
    try {
      catalogCache = await loadCompleteCatalog(client);
      renderCategoryTabs();
      renderCatalog();
      resumePendingEdit();
    } catch (error) {
      console.error('Falha ao carregar o acervo:', error);
      showToast('Não foi possível atualizar o acervo.');
    } finally {
      if (refreshCatalog) {
        refreshCatalog.disabled = false;
        refreshCatalog.textContent = 'Atualizar';
      }
    }
  }

  async function connectDashboard() {
    const client = window.bibliotecaSupabase;

    if (!client) {
      setConnectionStatus(window.bibliotecaSupabaseError || 'Banco indisponível', 'offline');
      return;
    }

    try {
      const catalog = await loadCompleteCatalog(client);
      catalogCache = catalog;
      renderCategoryTabs();
      renderCatalog();
      resumePendingEdit();
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
      await loadAdminRequests();
    } catch (error) {
      console.error('Falha ao consultar o Supabase:', error);
      setConnectionStatus('Falha na conexão', 'offline');
    }
  }

  function requestStatusLabel(status) {
    return ({
      aguardando_retirada: 'Aguardando retirada',
      retirada_confirmada: 'Retirada confirmada',
      cancelada: 'Cancelada',
      expirada: 'Reserva expirada',
      recusada: 'Recusada'
    })[status] || status;
  }

  function formatDateTime(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  function renderAdminRequests() {
    if (!requestsList) return;
    const status = requestStatusFilter?.value || 'todos';
    const filtered = requestsCache.filter((item) => status === 'todos' || item.status === status);
    requestCount.textContent = formatNumber(filtered.length);
    requestsEmpty.hidden = filtered.length > 0;
    requestsList.hidden = filtered.length === 0;
    requestsList.innerHTML = filtered.map((item) => {
      const pending = item.status === 'aguardando_retirada';
      const code = item.aluno_codigo ? `Código SGDE: ${escapeHtml(item.aluno_codigo)}` : 'Código SGDE não informado';
      return `<article class="request-card">
        <div class="request-cover">${item.capa_url ? `<img src="${escapeHtml(item.capa_url)}" alt="" />` : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zm2 0v16"/></svg>'}</div>
        <div class="request-main"><span class="request-badge status-${escapeHtml(item.status)}">${escapeHtml(requestStatusLabel(item.status))}</span><h2>${escapeHtml(item.titulo)}</h2><p>${escapeHtml(item.autor)}</p><div class="request-student"><strong>${escapeHtml(item.aluno_nome)}</strong><span>${code}${item.turma ? ` • ${escapeHtml(item.turma)}` : ''}</span></div></div>
        <div class="request-deadline"><small>Solicitada em</small><strong>${formatDateTime(item.solicitado_em)}</strong><small>${pending ? 'Retirar até' : 'Prazo da reserva'}</small><strong class="${item.status === 'expirada' ? 'expired' : ''}">${formatDateTime(item.reservado_ate)}</strong>${pending ? `<button class="confirm-pickup-button" type="button" data-confirm-pickup="${escapeHtml(item.id)}">Confirmar retirada</button>` : ''}</div>
      </article>`;
    }).join('');
  }

  async function loadAdminRequests(showLoading = false) {
    const client = window.bibliotecaSupabase;
    if (!client || !activeProfile || !requestsList) return;
    if (showLoading) {
      refreshRequests.disabled = true;
      refreshRequests.textContent = 'Atualizando...';
    }
    try {
      const { data, error } = await client.rpc('listar_solicitacoes_administracao');
      if (error) throw error;
      requestsCache = data || [];
      renderAdminRequests();
      document.querySelectorAll('.nav-count').forEach((badge) => {
        badge.textContent = formatNumber(requestsCache.filter((item) => item.status === 'aguardando_retirada').length);
      });
    } catch (error) {
      console.error('Falha ao carregar solicitações:', error);
      requestsList.innerHTML = '<div class="catalog-empty"><h2>Atualização do Supabase pendente</h2><p>Execute o arquivo ativar-reservas-online.sql para habilitar as reservas.</p></div>';
      requestsList.hidden = false;
      requestsEmpty.hidden = true;
    } finally {
      if (refreshRequests) {
        refreshRequests.disabled = false;
        refreshRequests.textContent = 'Atualizar solicitações';
      }
    }
  }

  async function confirmPickup(requestId, button) {
    const client = window.bibliotecaSupabase;
    if (!client || !requestId) return false;
    button.disabled = true;
    button.textContent = 'Confirmando...';
    try {
      const { error } = await client.rpc('confirmar_retirada', { p_solicitacao_id: requestId });
      if (error) throw error;
      showToast('Retirada confirmada. O livro agora consta como emprestado.');
      await connectDashboard();
      return true;
    } catch (error) {
      console.error('Falha ao confirmar retirada:', error);
      showToast(error?.message || 'Não foi possível confirmar a retirada.');
      button.disabled = false;
      button.textContent = 'Confirmar retirada';
      return false;
    }
  }

  function formatDateOnly(value) {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  }

  function loanDefaultDueDate() {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date.toISOString().slice(0, 10);
  }

  function setLoanFeedback(element, message = '', success = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('success', success);
  }

  function enableLoanCopyStep(enabled) {
    loanCopyStep?.setAttribute('aria-disabled', String(!enabled));
    if (loanCopySearch) loanCopySearch.disabled = !enabled;
    if (searchLoanCopiesButton) searchLoanCopiesButton.disabled = !enabled;
  }

  function enableLoanConfirmStep(enabled) {
    loanConfirmStep?.setAttribute('aria-disabled', String(!enabled));
    if (loanDueDate) loanDueDate.disabled = !enabled;
    if (saveLoanButton) saveLoanButton.disabled = !enabled;
  }

  function resetLoanOperation({ clearCode = false } = {}) {
    selectedLoanStudent = null;
    selectedLoanCopy = null;
    if (clearCode && loanStudentCode) loanStudentCode.value = '';
    if (loanStudentCard) {
      loanStudentCard.hidden = true;
      loanStudentCard.replaceChildren();
    }
    if (loanStudentRecords) {
      loanStudentRecords.hidden = true;
      loanStudentRecords.replaceChildren();
    }
    if (loanCopySearch) loanCopySearch.value = '';
    if (loanCopyResults) loanCopyResults.replaceChildren();
    if (loanSelectedCopy) {
      loanSelectedCopy.hidden = true;
      loanSelectedCopy.replaceChildren();
    }
    if (loanDueDate) {
      loanDueDate.min = new Date().toISOString().slice(0, 10);
      loanDueDate.value = loanDefaultDueDate();
    }
    enableLoanCopyStep(false);
    enableLoanConfirmStep(false);
    setLoanFeedback(loanStudentFeedback);
    setLoanFeedback(loanCopyFeedback);
    setLoanFeedback(loanFormFeedback);
  }

  function renderLoanStudentRecords(loans, reservations) {
    if (!loanStudentRecords) return;
    const activeLoans = loans.filter((loan) => loan.emprestimo_id);
    const pendingReservations = reservations.filter((request) => request.status === 'aguardando_retirada');
    const loansMarkup = activeLoans.length
      ? activeLoans.map((loan) => `<article><span class="loan-record-badge ${loan.situacao === 'em_atraso' ? 'overdue' : ''}">${loan.situacao === 'em_atraso' ? 'Em atraso' : 'Emprestado'}</span><strong>${escapeHtml(loan.titulo)}</strong><small>Exemplar ${escapeHtml(loan.exemplar_codigo || 'sem código')} • devolver em ${escapeHtml(formatDateOnly(loan.devolucao_prevista))}</small></article>`).join('')
      : '<p>Nenhum empréstimo ativo.</p>';
    const reservationsMarkup = pendingReservations.length
      ? pendingReservations.map((request) => `<article><span class="loan-record-badge reserved">Reserva</span><strong>${escapeHtml(request.titulo)}</strong><small>Retirar até ${escapeHtml(formatDateTime(request.reservado_ate))}</small><button class="confirm-pickup-button" type="button" data-loan-confirm-pickup="${escapeHtml(request.id)}">Confirmar retirada</button></article>`).join('')
      : '<p>Nenhuma reserva aguardando retirada.</p>';

    loanStudentRecords.hidden = false;
    loanStudentRecords.innerHTML = `<div><h4>Empréstimos ativos</h4>${loansMarkup}</div><div><h4>Reservas do aluno</h4>${reservationsMarkup}</div>`;
  }

  async function findLoanStudent() {
    const client = window.bibliotecaSupabase;
    const code = String(loanStudentCode?.value || '').trim();
    if (!client || !code) {
      setLoanFeedback(loanStudentFeedback, 'Digite o Código SGDE do aluno.');
      loanStudentCode?.focus();
      return;
    }

    findLoanStudentButton.disabled = true;
    findLoanStudentButton.textContent = 'Buscando...';
    setLoanFeedback(loanStudentFeedback, 'Consultando o cadastro do aluno...', true);
    resetLoanOperation();
    if (loanStudentCode) loanStudentCode.value = code;

    try {
      const { data: studentRows, error: studentError } = await client.rpc('localizar_aluno_por_codigo', { p_codigo: code });
      if (studentError) throw studentError;
      const student = studentRows?.[0];
      if (!student) throw new Error('Aluno não localizado. Confira o Código SGDE.');

      const [loansResponse, requestsResponse] = await Promise.all([
        client.rpc('consultar_emprestimos_por_codigo', { p_codigo: code }),
        client.rpc('listar_solicitacoes_administracao')
      ]);
      if (loansResponse.error) throw loansResponse.error;
      if (requestsResponse.error) throw requestsResponse.error;

      selectedLoanStudent = student;
      loanStudentCard.hidden = false;
      loanStudentCard.innerHTML = `<span class="loan-student-avatar">${escapeHtml(String(student.nome || 'A').charAt(0).toUpperCase())}</span><div><small>ALUNO LOCALIZADO</small><strong>${escapeHtml(student.nome)}</strong><span>Código SGDE: ${escapeHtml(student.codigo)}${student.turma ? ` • ${escapeHtml(student.turma)}` : ''}</span></div><i>✓</i>`;
      const reservations = (requestsResponse.data || []).filter((request) => normalizeSearch(request.aluno_codigo) === normalizeSearch(student.codigo));
      renderLoanStudentRecords(loansResponse.data || [], reservations);
      enableLoanCopyStep(true);
      setLoanFeedback(loanStudentFeedback, 'Aluno confirmado. Agora selecione o exemplar.', true);
      loanCopySearch?.focus({ preventScroll: true });
      loanCopyStep?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      console.error('Falha ao localizar aluno para empréstimo:', error);
      setLoanFeedback(loanStudentFeedback, error?.message || 'Não foi possível localizar o aluno.');
    } finally {
      findLoanStudentButton.disabled = false;
      findLoanStudentButton.textContent = 'Buscar aluno';
    }
  }

  async function searchAvailableLoanCopies() {
    const client = window.bibliotecaSupabase;
    const query = String(loanCopySearch?.value || '').trim();
    if (!client || !selectedLoanStudent) return;
    if (!query) {
      setLoanFeedback(loanCopyFeedback, 'Digite o título, autor, código ou tombamento.');
      loanCopySearch?.focus();
      return;
    }

    searchLoanCopiesButton.disabled = true;
    searchLoanCopiesButton.textContent = 'Buscando...';
    setLoanFeedback(loanCopyFeedback, 'Consultando exemplares disponíveis...', true);
    selectedLoanCopy = null;
    enableLoanConfirmStep(false);
    if (loanSelectedCopy) loanSelectedCopy.hidden = true;

    try {
      const { data, error } = await client.rpc('buscar_exemplares_disponiveis', { p_busca: query });
      if (error) throw error;
      const copies = data || [];
      setLoanFeedback(loanCopyFeedback, copies.length ? `${copies.length} exemplar${copies.length === 1 ? '' : 'es'} encontrado${copies.length === 1 ? '' : 's'}.` : 'Nenhum exemplar disponível encontrado.', copies.length > 0);
      loanCopyResults.innerHTML = copies.map((copy) => `<button type="button" class="loan-copy-option" data-loan-copy='${escapeHtml(JSON.stringify(copy))}'><span class="loan-copy-cover">${copy.capa_url ? `<img src="${escapeHtml(copy.capa_url)}" alt="" />` : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zm2 0v16"/></svg>'}</span><span><strong>${escapeHtml(copy.titulo)}</strong><small>${escapeHtml(copy.autor || 'Autor não informado')}</small><em>${escapeHtml(copy.tombamento ? `Tombamento ${copy.tombamento}` : copy.exemplar_codigo)}${copy.localizacao ? ` • ${escapeHtml(copy.localizacao)}` : ''}</em></span><b>Selecionar</b></button>`).join('');
    } catch (error) {
      console.error('Falha ao buscar exemplares:', error);
      loanCopyResults.replaceChildren();
      setLoanFeedback(loanCopyFeedback, error?.message || 'Não foi possível buscar os exemplares.');
    } finally {
      searchLoanCopiesButton.disabled = false;
      searchLoanCopiesButton.textContent = 'Buscar exemplar';
    }
  }

  function selectLoanCopy(copy) {
    selectedLoanCopy = copy;
    loanCopyResults?.querySelectorAll('.loan-copy-option').forEach((button) => {
      button.classList.toggle('selected', JSON.parse(button.dataset.loanCopy).exemplar_id === copy.exemplar_id);
    });
    loanSelectedCopy.hidden = false;
    loanSelectedCopy.innerHTML = `<span>EXEMPLAR SELECIONADO</span><strong>${escapeHtml(copy.titulo)}</strong><small>${escapeHtml(copy.tombamento ? `Tombamento ${copy.tombamento}` : `Código ${copy.exemplar_codigo}`)}${copy.localizacao ? ` • ${escapeHtml(copy.localizacao)}` : ''}</small>`;
    enableLoanConfirmStep(true);
    setLoanFeedback(loanFormFeedback);
    loanConfirmStep?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    loanDueDate?.focus({ preventScroll: true });
  }

  async function saveDirectLoan(event) {
    event.preventDefault();
    const client = window.bibliotecaSupabase;
    if (!client || !selectedLoanStudent || !selectedLoanCopy || !loanDueDate?.value) {
      setLoanFeedback(loanFormFeedback, 'Confirme o aluno, o exemplar e a data de devolução.');
      return;
    }

    saveLoanButton.disabled = true;
    saveLoanButton.querySelector('span').textContent = 'Registrando...';
    setLoanFeedback(loanFormFeedback, 'Registrando o empréstimo...', true);
    try {
      const { data, error } = await client.rpc('registrar_emprestimo_por_codigo', {
        p_codigo: selectedLoanStudent.codigo,
        p_exemplar_id: selectedLoanCopy.exemplar_id,
        p_devolucao_prevista: loanDueDate.value
      });
      if (error) throw error;
      const result = data?.[0];
      const confirmedDueDate = result?.devolucao_prevista || loanDueDate.value;
      showToast('Empréstimo registrado com sucesso.');
      selectedLoanCopy = null;
      loanCopySearch.value = '';
      loanCopyResults.replaceChildren();
      loanSelectedCopy.hidden = true;
      enableLoanConfirmStep(false);
      await connectDashboard();
      await findLoanStudent();
      setLoanFeedback(loanFormFeedback, `Empréstimo registrado. Devolução prevista para ${formatDateOnly(confirmedDueDate)}.`, true);
    } catch (error) {
      console.error('Falha ao registrar empréstimo:', error);
      setLoanFeedback(loanFormFeedback, error?.message || 'Não foi possível registrar o empréstimo.');
    } finally {
      saveLoanButton.disabled = !selectedLoanCopy;
      saveLoanButton.querySelector('span').textContent = 'Registrar empréstimo';
    }
  }

  function prepareLoanOperation() {
    if (!loanDueDate?.value) loanDueDate.value = loanDefaultDueDate();
    if (loanDueDate) loanDueDate.min = new Date().toISOString().slice(0, 10);
  }

  function closeLoanPanel() {
    if (loanOperationPanel) loanOperationPanel.hidden = true;
    resetLoanOperation({ clearCode: true });
    clearActivity('emprestimo');
    scrollToContent();
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
    const currentNavigation = readStorage(NAVIGATION_KEY, {});
    const keepsCurrentActivity = currentNavigation.activeView === selectedName
      && !Object.prototype.hasOwnProperty.call(options, 'activity');
    updateActiveNavigation(selectedName);
    writeStorage(NAVIGATION_KEY, {
      activeView: selectedName,
      activeActivity: keepsCurrentActivity
        ? (currentNavigation.activeActivity || null)
        : (options.activity || null)
    });

    if (options.scroll !== false) scrollToContent(options.behavior || 'smooth');
    if (selectedName === 'Acervo' && window.bibliotecaSupabase) refreshCompleteCatalog();
    if (selectedName === 'Solicitações' && window.bibliotecaSupabase) loadAdminRequests();
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

  function setBookFormFeedback(message = '', success = false) {
    if (!bookFormFeedback) return;
    bookFormFeedback.textContent = message;
    bookFormFeedback.classList.toggle('success', success);
  }

  function bookSaveErrorMessage(error, fallback) {
    const message = String(error?.message || '');
    const normalized = message.toLowerCase();
    if (normalized.includes('tombamento_obrigatorio')) return 'Informe o tombamento de todos os novos exemplares.';
    if (message.includes('exemplares_tombamento_unico') || normalized.includes('duplicate') && normalized.includes('tombamento')) {
      return 'Este tombamento já pertence a outro exemplar.';
    }
    if (message.includes('duplicate key')) return 'Este ISBN já pertence a outro título.';
    return message || fallback;
  }

  function setBookFormMode(mode, book = null) {
    const isEditing = mode === 'edit' && book;
    editingBookId = isEditing ? book.id : null;
    editingCoverUrl = isEditing ? (book.capa_url || null) : null;

    bookFormKicker.textContent = isEditing ? 'EDITAR TÍTULO' : 'NOVO CADASTRO';
    bookFormTitle.textContent = isEditing ? 'Editar informações do título' : 'Cadastrar título e exemplares';
    bookFormDescription.textContent = isEditing
      ? 'Altere os dados bibliográficos, a classificação, a capa ou a identificação dos exemplares.'
      : 'Preencha o que estiver disponível. As informações que faltarem poderão ser completadas depois.';
    saveBookButton.querySelector('span').textContent = isEditing ? 'Salvar alterações' : 'Salvar no acervo';
    if (addCopyButton) addCopyButton.hidden = !isEditing;

    document.querySelectorAll('[data-create-only]').forEach((field) => {
      field.hidden = Boolean(isEditing);
    });
    const quantityField = bookForm?.elements.namedItem('quantidade');
    if (quantityField) quantityField.required = !isEditing;
    if (!isEditing) {
      editingCopies = [];
      renderCopyFields(Number(quantityField?.value) || 1);
      if (copyFieldsHelp) copyFieldsHelp.textContent = 'O tombamento é obrigatório e deve ser diferente em cada exemplar.';
    }

    if (editCoverPreview) {
      editCoverPreview.replaceChildren();
      editCoverPreview.hidden = !isEditing;
      if (isEditing) {
        const label = document.createElement('span');
        label.textContent = editingCoverUrl ? 'Capa atual' : 'Este título ainda não possui capa';
        editCoverPreview.append(label);
        if (editingCoverUrl) {
          const image = document.createElement('img');
          image.src = editingCoverUrl;
          image.alt = `Capa atual de ${book.titulo}`;
          editCoverPreview.prepend(image);
        }
      }
    }
  }

  function populateBookForm(book) {
    if (!bookForm || !book) return;
    bookForm.reset();
    const values = {
      titulo: book.titulo,
      autor: book.autor,
      isbn: book.isbn,
      categoria: book.categoria,
      editora: book.editora,
      ano_publicacao: book.ano_publicacao,
      ordem_planilha: book.ordem_planilha,
      genero_codigo: book.genero_codigo,
      classificacao_numero: book.classificacao_numero,
      classificacao_cor: book.classificacao_cor,
      classificacao_cor_hex: classificationColor(book),
      localizacao: book.localizacao
    };
    Object.entries(values).forEach(([name, value]) => {
      const field = bookForm.elements.namedItem(name);
      if (field) field.value = value ?? '';
    });
    bookForm.querySelectorAll('[data-persist]').forEach(saveField);
  }

  function openCatalogForm() {
    if (!bookFormPanel) return;
    if (bookDetailsPanel) bookDetailsPanel.hidden = true;
    selectedBookDetailsId = null;
    clearActivity('cadastro-livro');
    bookForm?.reset();
    setBookFormMode('create');
    bookFormPanel.hidden = false;
    writeStorage(NAVIGATION_KEY, {
      activeView: 'Acervo',
      activeActivity: 'cadastro-livro'
    });
    setBookFormFeedback();
    bookFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    bookForm?.elements.namedItem('titulo')?.focus({ preventScroll: true });
  }

  async function openEditBookForm(bookId, options = {}) {
    const book = catalogCache.find((item) => item.id === bookId);
    if (!book || !bookFormPanel) {
      showToast('Não foi possível localizar este título.');
      return;
    }

    if (bookDetailsPanel) bookDetailsPanel.hidden = true;
    selectedBookDetailsId = null;

    if (!options.preserveDraft) {
      clearActivity('cadastro-livro');
      populateBookForm(book);
    } else if (!bookForm?.elements.namedItem('titulo')?.value) {
      populateBookForm(book);
    }
    setBookFormMode('edit', book);
    bookFormPanel.hidden = false;
    if (copyFieldsList) copyFieldsList.innerHTML = '<div class="copy-loading">Carregando exemplares e tombamentos...</div>';
    writeStorage(NAVIGATION_KEY, {
      activeView: 'Acervo',
      activeActivity: `editar-livro:${book.id}`
    });
    setBookFormFeedback();
    const client = window.bibliotecaSupabase;
    if (client) {
      let { data: copies, error } = await client
        .from('exemplares')
        .select('id,codigo,numero_exemplar,tombamento,conservacao,localizacao,origem,status,ativo')
        .eq('livro_id', book.id)
        .order('numero_exemplar', { ascending: true });
      if (error && String(error.message || '').includes('tombamento')) {
        const fallback = await client
          .from('exemplares')
          .select('id,codigo,numero_exemplar,conservacao,localizacao,origem,status,ativo')
          .eq('livro_id', book.id)
          .order('numero_exemplar', { ascending: true });
        copies = fallback.data;
        error = fallback.error;
      }
      if (error) {
        setBookFormFeedback('Não foi possível carregar os exemplares deste título.');
        renderCopyFields(1);
      } else {
        editingCopies = copies || [];
        const locationField = bookForm?.elements.namedItem('localizacao');
        if (locationField && !locationField.value && editingCopies[0]?.localizacao) {
          locationField.value = editingCopies[0].localizacao;
        }
        renderCopyFields(editingCopies.length || 1, editingCopies);
        if (copyFieldsHelp) copyFieldsHelp.textContent = editingCopies.length
          ? 'Complete os tombamentos pendentes quando possível. Todo exemplar novo precisa de tombamento antes de ser salvo.'
          : 'Este título ainda não possui exemplar físico cadastrado.';
      }
    }
    if (options.scroll !== false) {
      bookFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      bookForm?.elements.namedItem('titulo')?.focus({ preventScroll: true });
    }
  }

  function resumePendingEdit() {
    if (!pendingEditBookId) return;
    const bookId = pendingEditBookId;
    pendingEditBookId = null;
    openEditBookForm(bookId, { preserveDraft: true, scroll: false });
  }

  function hideCatalogForm({ clear = false } = {}) {
    if (clear) {
      clearActivity('cadastro-livro');
      bookForm?.reset();
      setBookFormFeedback();
    }
    if (bookFormPanel) bookFormPanel.hidden = true;
    editingBookId = null;
    editingCoverUrl = null;
    editingCopies = [];
    if (!clear) {
      const state = readStorage(NAVIGATION_KEY, {});
      writeStorage(NAVIGATION_KEY, { ...state, activeActivity: null });
    }
    scrollToContent();
  }

  async function uploadBookCover(client, file) {
    if (!file || !file.size) return { url: null, path: null };
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('A capa deve estar em JPG, PNG ou WebP.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('A imagem da capa deve ter no máximo 5 MB.');
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${activeProfile.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage
      .from('capas-livros')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = client.storage.from('capas-livros').getPublicUrl(path);
    return { url: data.publicUrl, path };
  }

  function coverStoragePath(url) {
    const marker = '/storage/v1/object/public/capas-livros/';
    const position = String(url || '').indexOf(marker);
    if (position < 0) return null;
    try {
      return decodeURIComponent(String(url).slice(position + marker.length));
    } catch {
      return null;
    }
  }

  async function saveEditedBook(client) {
    const book = catalogCache.find((item) => item.id === editingBookId);
    if (!book || !bookForm) {
      setBookFormFeedback('Não foi possível localizar o título para edição.');
      return;
    }

    const formData = new FormData(bookForm);
    const title = String(formData.get('titulo') || '').trim();
    const author = String(formData.get('autor') || '').trim();
    const isbn = String(formData.get('isbn') || '').replace(/[^0-9Xx]/g, '').toUpperCase();
    const publicationYear = Number(formData.get('ano_publicacao')) || null;
    const coverFile = formData.get('capa');
    const copies = copyRowsPayload();
    const existingCopies = copies.filter((copy) => copy.id);
    const newCopies = copies.filter((copy) => !copy.id);
    const tombamentos = copies.map((copy) => copy.tombamento).filter(Boolean);

    if (!title || !author) {
      setBookFormFeedback('Preencha o título e o autor.');
      (!title ? bookForm.elements.namedItem('titulo') : bookForm.elements.namedItem('autor'))?.focus();
      return;
    }
    const newCopyWithoutTombamento = newCopies.find((copy) => !copy.tombamento);
    if (newCopyWithoutTombamento) {
      setBookFormFeedback(`Informe o tombamento do exemplar ${newCopyWithoutTombamento.numero_exemplar}.`);
      copyFieldsList?.querySelector(`[data-copy-number="${newCopyWithoutTombamento.numero_exemplar}"] [data-copy-field="tombamento"]`)?.focus();
      return;
    }
    if (new Set(tombamentos.map((item) => normalizeSearch(item))).size !== tombamentos.length) {
      setBookFormFeedback('Há tombamentos repetidos entre os exemplares deste título.');
      return;
    }

    saveBookButton.disabled = true;
    saveBookButton.querySelector('span').textContent = 'Salvando alterações...';
    setBookFormFeedback('Atualizando as informações do título...', true);

    let uploadedCover = { url: null, path: null };
    try {
      if (coverFile instanceof File && coverFile.size) {
        uploadedCover = await uploadBookCover(client, coverFile);
      }

      const payload = {
        titulo: title,
        autor: author,
        isbn: isbn || null,
        categoria: String(formData.get('categoria') || '').trim() || null,
        editora: String(formData.get('editora') || '').trim() || null,
        ano_publicacao: publicationYear,
        ordem_planilha: Number(formData.get('ordem_planilha')) || null,
        genero_codigo: String(formData.get('genero_codigo') || '').trim().toUpperCase() || null,
        classificacao_numero: String(formData.get('classificacao_numero') || '').trim() || null,
        classificacao_cor: String(formData.get('classificacao_cor') || '').trim() || null,
        classificacao_cor_hex: formData.get('classificacao_cor')
          ? validHexColor(formData.get('classificacao_cor_hex'))
          : null
      };
      if (uploadedCover.url) payload.capa_url = uploadedCover.url;

      const { error } = await client
        .from('livros')
        .update(payload)
        .eq('id', book.id);
      if (error) throw error;

      for (const copy of existingCopies) {
        const { error: copyError } = await client
          .from('exemplares')
          .update({
            tombamento: copy.tombamento,
            localizacao: copy.localizacao,
            conservacao: copy.conservacao,
            origem: copy.origem,
            ativo: copy.ativo
          })
          .eq('id', copy.id);
        if (copyError) throw copyError;
      }

      if (newCopies.length) {
        const codePrefix = book.id.replace(/-/g, '').slice(0, 8).toUpperCase();
        const rows = newCopies.map((copy) => ({
          livro_id: book.id,
          codigo: `BIB-${codePrefix}-${String(copy.numero_exemplar).padStart(3, '0')}`,
          numero_exemplar: copy.numero_exemplar,
          tombamento: copy.tombamento,
          conservacao: copy.conservacao || 'bom',
          localizacao: copy.localizacao,
          origem: copy.origem,
          ativo: copy.ativo,
          criado_por: activeProfile.id
        }));
        const { error: insertError } = await client.from('exemplares').insert(rows);
        if (insertError) throw insertError;
      }

      if (uploadedCover.url && editingCoverUrl) {
        const oldPath = coverStoragePath(editingCoverUrl);
        if (oldPath) await client.storage.from('capas-livros').remove([oldPath]);
      }

      clearActivity('cadastro-livro');
      bookForm.reset();
      bookFormPanel.hidden = true;
      editingBookId = null;
      editingCoverUrl = null;
      setBookFormMode('create');
      await connectDashboard();
      setBookFormFeedback();
      showToast(newCopies.length
        ? `Título atualizado e ${newCopies.length} exemplar${newCopies.length === 1 ? '' : 'es'} adicionado${newCopies.length === 1 ? '' : 's'}.`
        : 'Informações do título atualizadas.');
      scrollToContent();
    } catch (error) {
      if (uploadedCover.path) await client.storage.from('capas-livros').remove([uploadedCover.path]);
      console.error('Falha ao editar título:', error);
      setBookFormFeedback(bookSaveErrorMessage(error, 'Não foi possível atualizar o título. Tente novamente.'));
    } finally {
      saveBookButton.disabled = false;
      saveBookButton.querySelector('span').textContent = editingBookId ? 'Salvar alterações' : 'Salvar no acervo';
    }
  }

  async function saveBookAndCopies(event) {
    event.preventDefault();
    if (!bookForm || !activeProfile) return;

    const client = window.bibliotecaSupabase;
    if (!client) {
      setBookFormFeedback('Não foi possível conectar ao banco.');
      return;
    }

    if (editingBookId) {
      await saveEditedBook(client);
      return;
    }

    const formData = new FormData(bookForm);
    const title = String(formData.get('titulo') || '').trim();
    const author = String(formData.get('autor') || '').trim();
    const isbn = String(formData.get('isbn') || '').replace(/[^0-9Xx]/g, '').toUpperCase();
    const quantity = Number(formData.get('quantidade'));
    const publicationYear = Number(formData.get('ano_publicacao')) || null;
    const coverFile = formData.get('capa');
    const copyDetails = copyRowsPayload();
    const tombamentos = copyDetails.map((copy) => copy.tombamento).filter(Boolean);

    if (!title || !author) {
      setBookFormFeedback('Preencha o título e o autor.');
      (!title ? bookForm.elements.namedItem('titulo') : bookForm.elements.namedItem('autor'))?.focus();
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      setBookFormFeedback('Informe uma quantidade entre 1 e 100 exemplares.');
      bookForm.elements.namedItem('quantidade')?.focus();
      return;
    }
    if (copyDetails.length !== quantity) {
      renderCopyFields(quantity);
      setBookFormFeedback('Confira os dados dos exemplares antes de salvar.');
      return;
    }
    const copyWithoutTombamento = copyDetails.find((copy) => !copy.tombamento);
    if (copyWithoutTombamento) {
      setBookFormFeedback(`Informe o tombamento do exemplar ${copyWithoutTombamento.numero_exemplar}.`);
      copyFieldsList?.querySelector(`[data-copy-number="${copyWithoutTombamento.numero_exemplar}"] [data-copy-field="tombamento"]`)?.focus();
      return;
    }
    if (new Set(tombamentos.map((item) => normalizeSearch(item))).size !== tombamentos.length) {
      setBookFormFeedback('Há tombamentos repetidos entre os exemplares informados.');
      return;
    }

    saveBookButton.disabled = true;
    saveBookButton.querySelector('span').textContent = 'Salvando...';
    setBookFormFeedback('Enviando os dados do livro...', true);

    let uploadedCover = { url: null, path: null };
    let createdBookId = null;
    let updatedExistingCoverId = null;

    try {
      let book = null;
      if (isbn) {
        const { data, error } = await client
          .from('livros')
          .select('id,capa_url')
          .eq('isbn', isbn)
          .eq('ativo', true)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        book = data;
      }

      if (coverFile instanceof File && coverFile.size && (!book || !book.capa_url)) {
        uploadedCover = await uploadBookCover(client, coverFile);
      }

      if (!book) {
        const payload = {
          titulo: title,
          autor: author,
          isbn: isbn || null,
          categoria: String(formData.get('categoria') || '').trim() || null,
          editora: String(formData.get('editora') || '').trim() || null,
          ano_publicacao: publicationYear,
          ordem_planilha: Number(formData.get('ordem_planilha')) || null,
          genero_codigo: String(formData.get('genero_codigo') || '').trim().toUpperCase() || null,
          classificacao_numero: String(formData.get('classificacao_numero') || '').trim() || null,
          classificacao_cor: String(formData.get('classificacao_cor') || '').trim() || null,
          classificacao_cor_hex: formData.get('classificacao_cor')
            ? validHexColor(formData.get('classificacao_cor_hex'))
            : null,
          capa_url: uploadedCover.url,
          criado_por: activeProfile.id
        };
        const { data, error } = await client
          .from('livros')
          .insert(payload)
          .select('id,capa_url')
          .single();
        if (error) throw error;
        book = data;
        createdBookId = book.id;
      } else if (uploadedCover.url && !book.capa_url) {
        const { error } = await client
          .from('livros')
          .update({ capa_url: uploadedCover.url })
          .eq('id', book.id);
        if (error) throw error;
        updatedExistingCoverId = book.id;
      }

      const { data: lastCopy, error: lastCopyError } = await client
        .from('exemplares')
        .select('numero_exemplar')
        .eq('livro_id', book.id)
        .order('numero_exemplar', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastCopyError) throw lastCopyError;

      const firstNumber = (Number(lastCopy?.numero_exemplar) || 0) + 1;
      const codePrefix = book.id.replace(/-/g, '').slice(0, 8).toUpperCase();
      const copies = Array.from({ length: quantity }, (_, index) => {
        const copyNumber = firstNumber + index;
        const detail = copyDetails[index] || {};
        return {
          livro_id: book.id,
          codigo: `BIB-${codePrefix}-${String(copyNumber).padStart(3, '0')}`,
          numero_exemplar: copyNumber,
          tombamento: detail.tombamento,
          conservacao: detail.conservacao || 'bom',
          localizacao: detail.localizacao || String(formData.get('localizacao') || '').trim() || null,
          origem: detail.origem || String(formData.get('origem') || '').trim() || null,
          criado_por: activeProfile.id
        };
      });

      const { error: copiesError } = await client.from('exemplares').insert(copies);
      if (copiesError) throw copiesError;

      clearActivity('cadastro-livro');
      bookForm.reset();
      bookFormPanel.hidden = true;
      await connectDashboard();
      setBookFormFeedback();
      showToast(createdBookId
        ? `Livro cadastrado com ${quantity} exemplar${quantity === 1 ? '' : 'es'}.`
        : `${quantity} novo${quantity === 1 ? '' : 's'} exemplar${quantity === 1 ? '' : 'es'} adicionado${quantity === 1 ? '' : 's'} ao título existente.`);
      scrollToContent();
    } catch (error) {
      if (createdBookId) await client.from('livros').delete().eq('id', createdBookId);
      if (updatedExistingCoverId) await client.from('livros').update({ capa_url: null }).eq('id', updatedExistingCoverId);
      if (uploadedCover.path) await client.storage.from('capas-livros').remove([uploadedCover.path]);
      console.error('Falha ao cadastrar livro:', error);
      setBookFormFeedback(bookSaveErrorMessage(error, 'Não foi possível salvar o livro. Tente novamente.'));
    } finally {
      saveBookButton.disabled = false;
      saveBookButton.querySelector('span').textContent = 'Salvar no acervo';
    }
  }

  function leaveApp() {
    removeStorage(NAVIGATION_KEY);
    removeStorage(DRAFTS_KEY);
    removeStorage(CATEGORY_KEY);
    selectedCategory = 'todos';
    forceInitialTop();
  }

  if (todayLabel) {
    todayLabel.textContent = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }).format(new Date()).toUpperCase();
  }

  clearLegacyNavigation();
  restoreDrafts();
  const savedNavigation = readStorage(NAVIGATION_KEY, { activeView: DEFAULT_VIEW });
  activateView(savedNavigation.activeView || DEFAULT_VIEW, { scroll: false });
  if (savedNavigation.activeActivity === 'cadastro-livro' && bookFormPanel) {
    setBookFormMode('create');
    bookFormPanel.hidden = false;
  } else if (String(savedNavigation.activeActivity || '').startsWith('editar-livro:')) {
    pendingEditBookId = String(savedNavigation.activeActivity).slice('editar-livro:'.length);
  } else if (savedNavigation.activeActivity === 'emprestimo' && loanOperationPanel) {
    loanOperationPanel.hidden = false;
    prepareLoanOperation();
  }
  forceInitialTop();

  passwordToggle?.addEventListener('click', () => {
    const showing = loginPassword.type === 'text';
    loginPassword.type = showing ? 'password' : 'text';
    passwordToggle.textContent = showing ? 'Mostrar' : 'Ocultar';
    passwordToggle.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
    loginPassword.focus({ preventScroll: true });
  });

  openAdminLogin?.addEventListener('click', () => showLogin());
  backToCatalog?.addEventListener('click', () => showPortal());

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
      showPortal('Acesso administrativo encerrado com segurança.');
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

  const quantityField = bookForm?.elements.namedItem('quantidade');
  const locationField = bookForm?.elements.namedItem('localizacao');
  const originField = bookForm?.elements.namedItem('origem');
  const classificationColorField = bookForm?.elements.namedItem('classificacao_cor');
  const classificationHexField = bookForm?.elements.namedItem('classificacao_cor_hex');

  quantityField?.addEventListener('input', () => {
    const quantity = Number(quantityField.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return;
    renderCopyFields(quantity, copyRowsPayload());
  });
  locationField?.addEventListener('change', () => {
    copyFieldsList?.querySelectorAll('[data-copy-field="localizacao"]').forEach((field) => {
      field.value = locationField.value;
    });
  });
  originField?.addEventListener('change', () => {
    copyFieldsList?.querySelectorAll('[data-copy-field="origem"]').forEach((field) => {
      field.value = originField.value;
    });
  });
  addCopyButton?.addEventListener('click', () => {
    const copies = copyRowsPayload();
    const nextNumber = copies.reduce((largest, copy) => Math.max(largest, Number(copy.numero_exemplar) || 0), 0) + 1;
    copies.push({
      numero_exemplar: nextNumber,
      tombamento: null,
      localizacao: String(locationField?.value || '').trim() || null,
      conservacao: 'bom',
      origem: String(originField?.value || '').trim() || null,
      ativo: true,
      status: 'disponivel'
    });
    renderCopyFields(copies.length, copies);
    setBookFormFeedback(`Exemplar ${nextNumber} adicionado. Informe o tombamento para salvar.`);
    copyFieldsList?.querySelector(`[data-copy-number="${nextNumber}"] [data-copy-field="tombamento"]`)?.focus();
  });
  copyFieldsList?.addEventListener('change', (event) => {
    const activeField = event.target.closest('[data-copy-field="ativo"]');
    if (!activeField) return;
    const label = activeField.closest('.copy-active-control')?.querySelector('span');
    if (label) label.textContent = activeField.checked ? 'Ativo no acervo' : 'Exemplar desativado';
  });
  classificationColorField?.addEventListener('change', () => {
    const mapped = CLASSIFICATION_COLORS[classificationColorField.value];
    if (mapped && classificationHexField) classificationHexField.value = mapped;
  });

  openBookForm?.addEventListener('click', openCatalogForm);
  closeBookForm?.addEventListener('click', () => hideCatalogForm());
  cancelBookForm?.addEventListener('click', () => hideCatalogForm({ clear: true }));
  bookForm?.addEventListener('submit', saveBookAndCopies);
  catalogSearch?.addEventListener('input', renderCatalog);
  catalogAvailability?.addEventListener('change', () => {
    syncCatalogAvailabilityControls(catalogAvailability.value);
    renderCatalog();
  });
  catalogClassification?.addEventListener('change', () => {
    selectedCategory = catalogClassification.value || 'todos';
    writeStorage(CATEGORY_KEY, selectedCategory);
    renderCategoryTabs();
    renderCatalog();
  });
  catalogViewSwitch?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-catalog-availability]');
    if (!button) return;
    syncCatalogAvailabilityControls(button.dataset.catalogAvailability);
    renderCatalog();
  });
  refreshCatalog?.addEventListener('click', () => refreshCompleteCatalog(true));
  refreshRequests?.addEventListener('click', () => loadAdminRequests(true));
  requestStatusFilter?.addEventListener('change', renderAdminRequests);
  requestsList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-confirm-pickup]');
    if (!button) return;
    confirmPickup(button.dataset.confirmPickup, button);
  });
  findLoanStudentButton?.addEventListener('click', findLoanStudent);
  loanStudentCode?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    findLoanStudent();
  });
  searchLoanCopiesButton?.addEventListener('click', searchAvailableLoanCopies);
  loanCopySearch?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    searchAvailableLoanCopies();
  });
  loanCopyResults?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-loan-copy]');
    if (!button) return;
    try {
      selectLoanCopy(JSON.parse(button.dataset.loanCopy));
    } catch (error) {
      console.error('Falha ao selecionar exemplar:', error);
      setLoanFeedback(loanCopyFeedback, 'Não foi possível selecionar este exemplar. Atualize a busca.');
    }
  });
  loanStudentRecords?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-loan-confirm-pickup]');
    if (!button) return;
    const confirmed = await confirmPickup(button.dataset.loanConfirmPickup, button);
    if (confirmed) await findLoanStudent();
  });
  loanForm?.addEventListener('submit', saveDirectLoan);
  closeLoanOperation?.addEventListener('click', closeLoanPanel);
  catalogCategories?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    selectedCategory = button.dataset.category || 'todos';
    writeStorage(CATEGORY_KEY, selectedCategory);
    renderCategoryTabs();
    renderCatalog();
  });
  catalogGrid?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-view-book]');
    if (!card) return;
    openBookDetails(card.dataset.viewBook);
  });
  catalogGrid?.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const card = event.target.closest('[data-view-book]');
    if (!card) return;
    event.preventDefault();
    openBookDetails(card.dataset.viewBook);
  });
  closeBookDetails?.addEventListener('click', hideBookDetails);
  editBookFromDetails?.addEventListener('click', () => {
    const bookId = editBookFromDetails.dataset.bookId || selectedBookDetailsId;
    if (bookId) openEditBookForm(bookId);
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
        if (activity === 'emprestimo') prepareLoanOperation();
        writeStorage(NAVIGATION_KEY, {
          ...readStorage(NAVIGATION_KEY, {}),
          activeActivity: activity
        });
        activityPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (activity === 'emprestimo') loanStudentCode?.focus({ preventScroll: true });
        else activityPanel.querySelector('input, select, textarea, button')?.focus({ preventScroll: true });
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
      catalogSearch.value = search.value.trim();
      saveField(catalogSearch);
      activateView('Acervo');
      renderCatalog();
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search?.focus();
    }
    if (event.key === 'Escape') closeSidebar();
  });

  window.addEventListener('load', () => {
    if (!authScreen.hidden) lockViewAtTop();
    else forceInitialTop();
  });
  window.addEventListener('pageshow', (event) => {
    // Login sempre no topo; páginas internas preservam a posição ao voltar.
    if (!authScreen.hidden || !event.persisted) lockViewAtTop();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !authScreen.hidden) lockViewAtTop();
  });

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
