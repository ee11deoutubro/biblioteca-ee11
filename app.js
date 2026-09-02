(() => {
  const toast = document.getElementById('toast');
  const apiStatus = document.getElementById('apiStatus');
  let toastTimer;

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  document.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const label = button.dataset.action === 'emprestimo' ? 'Novo empréstimo' : 'Registrar devolução';
      showToast(`${label} será ativado na etapa de banco e operações.`);
    });
  });

  document.querySelectorAll('.quick-action, .nav-item, .text-btn, #menuButton').forEach((button) => {
    button.addEventListener('click', () => showToast('Módulo preparado para a próxima etapa.'));
  });

  fetch('/api/health')
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then(() => {
      apiStatus.textContent = 'Online';
      apiStatus.classList.add('online');
    })
    .catch(() => {
      apiStatus.textContent = 'Interface pronta';
    });
})();
