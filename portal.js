(() => {
  'use strict';

  const portal = document.getElementById('publicPortal');
  const search = document.getElementById('publicCatalogSearch');
  const availability = document.getElementById('publicAvailability');
  const refreshButton = document.getElementById('publicRefreshCatalog');
  const categories = document.getElementById('publicCategories');
  const grid = document.getElementById('publicCatalogGrid');
  const empty = document.getElementById('publicCatalogEmpty');
  const status = document.getElementById('publicCatalogStatus');
  const titleCount = document.getElementById('publicTitleCount');
  const availableCount = document.getElementById('publicAvailableCount');
  const modal = document.getElementById('reservationModal');
  const bookSummary = document.getElementById('reservationBook');
  const formStep = document.getElementById('reservationFormStep');
  const successStep = document.getElementById('reservationSuccess');
  const lookupForm = document.getElementById('studentLookupForm');
  const codeInput = document.getElementById('studentCode');
  const lookupButton = document.getElementById('lookupStudentButton');
  const studentResult = document.getElementById('studentResult');
  const message = document.getElementById('reservationMessage');
  const confirmButton = document.getElementById('confirmReservation');
  const successText = document.getElementById('reservationSuccessText');
  const deadline = document.getElementById('reservationDeadline');

  let catalog = [];
  let selectedCategory = 'todos';
  let selectedBook = null;
  let locatedStudent = null;
  let previouslyFocused = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function categoryKey(value) {
    return value ? normalize(value) : '__sem_categoria__';
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
  }

  function formatDeadline(value) {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  function friendlyReservationError(error) {
    const original = String(error?.message || '');
    const text = original.toLowerCase();
    if (text.includes('não localizado')) return 'Código do Aluno não localizado. Confira o número informado.';
    if (text.includes('não há exemplar')) return 'Este título acabou de ficar indisponível. Escolha outro livro.';
    if (text.includes('já existe')) return 'Você já possui uma reserva pendente para este título.';
    if (text.includes('limite')) return 'Seu limite de empréstimos e reservas foi atingido.';
    if (text.includes('atraso')) return 'Há uma devolução em atraso. Procure a biblioteca para regularizar.';
    if (text.includes('function') || text.includes('schema cache')) return 'O serviço de reservas ainda precisa ser ativado pela Gestão Escolar.';
    return original || 'Não foi possível concluir a reserva. Tente novamente.';
  }

  async function fetchCatalog() {
    const client = window.bibliotecaSupabase;
    if (!client) throw new Error(window.bibliotecaSupabaseError || 'Conexão indisponível.');

    const { data: current, error: rpcError } = await client.rpc('consultar_acervo_publico_atualizado');
    if (!rpcError) return current || [];

    const { data, error } = await client
      .from('acervo_publico')
      .select('id,titulo,subtitulo,autor,isbn,editora,ano_publicacao,categoria,capa_url,total_exemplares,disponiveis,reservados,emprestados')
      .order('titulo', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  function renderCategories() {
    const categoryMap = new Map();
    catalog.forEach((book) => {
      const key = categoryKey(book.categoria);
      const entry = categoryMap.get(key) || { label: book.categoria?.trim() || 'Sem categoria', count: 0 };
      entry.count += 1;
      categoryMap.set(key, entry);
    });
    if (selectedCategory !== 'todos' && !categoryMap.has(selectedCategory)) selectedCategory = 'todos';
    const items = [
      { key: 'todos', label: 'Todos', count: catalog.length },
      ...[...categoryMap.entries()]
        .map(([key, item]) => ({ key, ...item }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    ];
    categories.replaceChildren(...items.map((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.publicCategory = item.key;
      button.className = `public-category${item.key === selectedCategory ? ' active' : ''}`;
      button.textContent = `${item.label} (${formatNumber(item.count)})`;
      button.setAttribute('aria-pressed', String(item.key === selectedCategory));
      return button;
    }));
  }

  function renderCatalog() {
    const query = normalize(search?.value);
    const showAvailableOnly = (availability?.value || 'disponiveis') === 'disponiveis';
    const filtered = catalog.filter((book) => {
      const searchable = normalize([book.titulo, book.autor, book.categoria, book.isbn].filter(Boolean).join(' '));
      return (!query || searchable.includes(query))
        && (selectedCategory === 'todos' || categoryKey(book.categoria) === selectedCategory)
        && (!showAvailableOnly || Number(book.disponiveis) > 0);
    });
    const totalAvailable = filtered.reduce((sum, book) => sum + (Number(book.disponiveis) || 0), 0);
    titleCount.textContent = formatNumber(filtered.length);
    availableCount.textContent = formatNumber(totalAvailable);
    empty.hidden = filtered.length > 0;
    grid.hidden = filtered.length === 0;
    grid.innerHTML = filtered.map((book) => {
      const available = Number(book.disponiveis) || 0;
      const cover = book.capa_url
        ? `<img src="${escapeHtml(book.capa_url)}" alt="Capa de ${escapeHtml(book.titulo)}" loading="lazy" />`
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zm2 0v16m3-12h6m-6 4h6"/></svg>';
      return `<article class="public-book-card">
        <div class="public-cover">${cover}</div>
        <div class="public-book-info"><span class="public-genre">${escapeHtml(book.categoria || 'Sem categoria')}</span><h3>${escapeHtml(book.titulo)}</h3><p>${escapeHtml(book.autor)}</p><div class="public-book-footer"><strong class="${available ? '' : 'unavailable'}">${available ? `${available} disponível${available === 1 ? '' : 'is'}` : 'Indisponível'}</strong><button type="button" data-reserve-book="${escapeHtml(book.id)}" ${available ? '' : 'disabled'}>${available ? 'Reservar' : 'Sem exemplares'}</button></div></div>
      </article>`;
    }).join('');
  }

  async function loadCatalog(showLoading = true) {
    if (showLoading) {
      status.textContent = 'Atualizando o acervo...';
      refreshButton.disabled = true;
    }
    try {
      catalog = await fetchCatalog();
      renderCategories();
      renderCatalog();
      status.textContent = 'Acervo atualizado agora';
    } catch (error) {
      console.error('Falha ao carregar catálogo público:', error);
      status.textContent = 'Não foi possível carregar o acervo agora.';
      catalog = [];
      renderCategories();
      renderCatalog();
    } finally {
      refreshButton.disabled = false;
    }
  }

  function resetReservation() {
    locatedStudent = null;
    lookupForm.reset();
    studentResult.hidden = true;
    studentResult.replaceChildren();
    confirmButton.hidden = true;
    confirmButton.disabled = false;
    confirmButton.textContent = 'Confirmar reserva';
    message.textContent = '';
    formStep.hidden = false;
    successStep.hidden = true;
  }

  function openReservation(bookId) {
    selectedBook = catalog.find((book) => book.id === bookId);
    if (!selectedBook || Number(selectedBook.disponiveis) < 1) return;
    resetReservation();
    bookSummary.innerHTML = `<div class="reservation-book-cover">${selectedBook.capa_url ? `<img src="${escapeHtml(selectedBook.capa_url)}" alt="" />` : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zm2 0v16"/></svg>'}</div><div><strong>${escapeHtml(selectedBook.titulo)}</strong><span>${escapeHtml(selectedBook.autor)}</span></div>`;
    previouslyFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => codeInput.focus({ preventScroll: true }));
  }

  function closeReservation() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    selectedBook = null;
    previouslyFocused?.focus?.({ preventScroll: true });
  }

  async function lookupStudent(event) {
    event.preventDefault();
    const studentCode = codeInput.value.trim();
    if (!studentCode) {
      message.textContent = 'Informe o Código do Aluno.';
      codeInput.focus();
      return;
    }
    const client = window.bibliotecaSupabase;
    lookupButton.disabled = true;
    lookupButton.textContent = 'Localizando...';
    message.textContent = '';
    studentResult.hidden = true;
    confirmButton.hidden = true;
    locatedStudent = null;
    try {
      const { data, error } = await client.rpc('localizar_aluno_por_codigo', { p_codigo: studentCode });
      if (error) throw error;
      const student = data?.[0];
      if (!student) throw new Error('Aluno não localizado.');
      locatedStudent = student;
      studentResult.innerHTML = `<span>Cadastro localizado</span><strong>${escapeHtml(student.nome)}</strong><small>${student.turma ? escapeHtml(student.turma) : 'Aluno da EE 11 de Outubro'} • Código ${escapeHtml(student.codigo)}</small>`;
      studentResult.hidden = false;
      confirmButton.hidden = false;
      confirmButton.focus({ preventScroll: true });
    } catch (error) {
      message.textContent = friendlyReservationError(error);
    } finally {
      lookupButton.disabled = false;
      lookupButton.textContent = 'Localizar meu cadastro';
    }
  }

  async function reserveBook() {
    if (!selectedBook || !locatedStudent) return;
    const client = window.bibliotecaSupabase;
    confirmButton.disabled = true;
    confirmButton.textContent = 'Reservando...';
    message.textContent = '';
    try {
      const { data, error } = await client.rpc('reservar_livro_por_codigo', {
        p_codigo: codeInput.value.trim(),
        p_livro_id: selectedBook.id
      });
      if (error) throw error;
      const reservation = data?.[0];
      if (!reservation) throw new Error('A reserva não foi registrada.');
      successText.textContent = `${reservation.aluno_nome}, reservamos “${reservation.titulo}” para você.`;
      deadline.textContent = `Retire até ${formatDeadline(reservation.reservado_ate)}.`;
      formStep.hidden = true;
      successStep.hidden = false;
      await loadCatalog(false);
    } catch (error) {
      message.textContent = friendlyReservationError(error);
      confirmButton.disabled = false;
      confirmButton.textContent = 'Confirmar reserva';
    }
  }

  search?.addEventListener('input', renderCatalog);
  availability?.addEventListener('change', renderCatalog);
  refreshButton?.addEventListener('click', () => loadCatalog());
  categories?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-public-category]');
    if (!button) return;
    selectedCategory = button.dataset.publicCategory;
    renderCategories();
    renderCatalog();
  });
  grid?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-reserve-book]');
    if (button && !button.disabled) openReservation(button.dataset.reserveBook);
  });
  lookupForm?.addEventListener('submit', lookupStudent);
  confirmButton?.addEventListener('click', reserveBook);
  modal?.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-reservation]')) closeReservation();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeReservation();
  });

  window.BibliotecaPortal = Object.freeze({
    show: (notice = '') => {
      if (notice) status.textContent = notice;
      if (!catalog.length) loadCatalog();
      else renderCatalog();
    },
    refresh: () => loadCatalog(false)
  });

  if (portal && !portal.hidden) loadCatalog();
})();
