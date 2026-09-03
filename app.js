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
  const catalogGrid = document.getElementById('catalogGrid');
  const catalogEmpty = document.getElementById('catalogEmpty');
  const catalogSearch = document.getElementById('catalogSearch');
  const catalogAvailability = document.getElementById('catalogAvailability');
  const catalogCount = document.getElementById('catalogCount');
  const catalogCopies = document.getElementById('catalogCopies');
  const catalogAvailable = document.getElementById('catalogAvailable');
  const refreshCatalog = document.getElementById('refreshCatalog');
  const bookFormPanel = document.getElementById('bookFormPanel');
  const bookForm = document.getElementById('bookForm');
  const openBookForm = document.getElementById('openBookForm');
  const closeBookForm = document.getElementById('closeBookForm');
  const cancelBookForm = document.getElementById('cancelBookForm');
  const saveBookButton = document.getElementById('saveBookButton');
  const bookFormFeedback = document.getElementById('bookFormFeedback');
  let toastTimer;
  let releaseTopLock = () => {};
  let activeProfile = null;
  let catalogCache = [];

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

  function showLogin(message = '') {
    activeProfile = null;
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
    authScreen.hidden = true;
    adminApp.hidden = false;
    document.body.classList.remove('auth-loading');
    setAuthMessage('');
    lockViewAtTop();
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
        .select('id,titulo,subtitulo,autor,isbn,editora,ano_publicacao,categoria,capa_url,total_exemplares,disponiveis,reservados,emprestados')
        .order('titulo', { ascending: true })
        .range(start, start + pageSize - 1);

      if (error) throw error;
      catalog.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    return catalog;
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
        book.editora
      ].filter(Boolean).join(' '));
      const matchesQuery = !query || searchable.includes(query);
      const availableCopies = Number(book.disponiveis) || 0;
      const matchesAvailability = availability === 'todos'
        || (availability === 'disponiveis' && availableCopies > 0)
        || (availability === 'indisponiveis' && availableCopies === 0);
      return matchesQuery && matchesAvailability;
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
      const metadata = [book.categoria, book.ano_publicacao, book.isbn ? `ISBN ${book.isbn}` : null]
        .filter(Boolean)
        .map((item) => `<span>${escapeHtml(item)}</span>`)
        .join('');

      return `<article class="catalog-card" data-book-id="${escapeHtml(book.id)}">
        <div class="book-cover">${cover}</div>
        <div class="catalog-card-content">
          <h2 title="${escapeHtml(book.titulo)}">${escapeHtml(book.titulo)}</h2>
          <p class="catalog-author">${escapeHtml(book.autor)}</p>
          <div class="catalog-meta">${metadata || '<span>Sem categoria</span>'}</div>
          <div class="availability-line"><strong class="${available ? '' : 'unavailable'}">${available ? `${available} disponível${available === 1 ? '' : 'is'}` : 'Indisponível'}</strong><span>${total} exemplar${total === 1 ? '' : 'es'}</span></div>
        </div>
      </article>`;
    }).join('');
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
      renderCatalog();
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
      renderCatalog();
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
    if (selectedName === 'Acervo' && window.bibliotecaSupabase) refreshCompleteCatalog();
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

  function openCatalogForm() {
    if (!bookFormPanel) return;
    bookFormPanel.hidden = false;
    writeStorage(NAVIGATION_KEY, {
      activeView: 'Acervo',
      activeActivity: 'cadastro-livro'
    });
    setBookFormFeedback();
    bookFormPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    bookForm?.elements.namedItem('titulo')?.focus({ preventScroll: true });
  }

  function hideCatalogForm({ clear = false } = {}) {
    if (clear) {
      clearActivity('cadastro-livro');
      bookForm?.reset();
      setBookFormFeedback();
    }
    if (bookFormPanel) bookFormPanel.hidden = true;
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

  async function saveBookAndCopies(event) {
    event.preventDefault();
    if (!bookForm || !activeProfile) return;

    const client = window.bibliotecaSupabase;
    if (!client) {
      setBookFormFeedback('Não foi possível conectar ao banco.');
      return;
    }

    const formData = new FormData(bookForm);
    const title = String(formData.get('titulo') || '').trim();
    const author = String(formData.get('autor') || '').trim();
    const isbn = String(formData.get('isbn') || '').replace(/[^0-9Xx]/g, '').toUpperCase();
    const quantity = Number(formData.get('quantidade'));
    const publicationYear = Number(formData.get('ano_publicacao')) || null;
    const coverFile = formData.get('capa');

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
        return {
          livro_id: book.id,
          codigo: `BIB-${codePrefix}-${String(copyNumber).padStart(3, '0')}`,
          numero_exemplar: copyNumber,
          conservacao: String(formData.get('conservacao') || 'bom'),
          localizacao: String(formData.get('localizacao') || '').trim() || null,
          origem: String(formData.get('origem') || '').trim() || null,
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
      const message = String(error?.message || '');
      setBookFormFeedback(message.includes('duplicate key')
        ? 'Este ISBN já está cadastrado. Atualize o acervo e tente novamente.'
        : (message || 'Não foi possível salvar o livro. Tente novamente.'));
    } finally {
      saveBookButton.disabled = false;
      saveBookButton.querySelector('span').textContent = 'Salvar no acervo';
    }
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
  if (savedNavigation.activeActivity === 'cadastro-livro' && bookFormPanel) {
    bookFormPanel.hidden = false;
  }
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

  openBookForm?.addEventListener('click', openCatalogForm);
  closeBookForm?.addEventListener('click', () => hideCatalogForm());
  cancelBookForm?.addEventListener('click', () => hideCatalogForm({ clear: true }));
  bookForm?.addEventListener('submit', saveBookAndCopies);
  catalogSearch?.addEventListener('input', renderCatalog);
  catalogAvailability?.addEventListener('change', renderCatalog);
  refreshCatalog?.addEventListener('click', () => refreshCompleteCatalog(true));

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
