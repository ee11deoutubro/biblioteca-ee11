import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'styles.css',
  'auth.css',
  'portal.css',
  'portal-interactions.css',
  'portal-layout-v2.css',
  'portal-layout-exact.css',
  'favicon.ico',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'assets/og-biblioteca.png',
  'app.js',
  'portal.js',
  'config.js',
  'supabase-client.js',
  'atualizar-permissoes-gestao.sql',
  'ativar-reservas-online.sql',
  'ativar-emprestimos-diretos.sql',
  'atualizar-catalogo-classificacao-tombamento.sql',
  'importar-metadados-planilha-original.sql',
  'vercel.json',
  'api/health.js',
  'assets/logo-escola.png',
  'assets/cabecalho-escola.png',
  'assets/fundo-inicio-desktop.png',
  'assets/fundo-inicio-mobile.png',
  'catalogo-metadata-original.js'
];

await Promise.all(requiredFiles.map((file) => access(new URL(`../${file}`, import.meta.url))));

const vercelConfig = JSON.parse(
  await readFile(new URL('../vercel.json', import.meta.url), 'utf8')
);

if (vercelConfig.cleanUrls !== true) {
  throw new Error('vercel.json deve manter cleanUrls ativado.');
}

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
for (const reference of [
  '/styles.css',
  '/auth.css',
  '/portal.css',
  '/portal-interactions.css',
  '/portal-layout-v2.css',
  '/portal-layout-exact.css',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/assets/og-biblioteca.png',
  '/app.js',
  '/portal.js',
  '/config.js',
  '/supabase-client.js',
  '/assets/logo-escola.png',
  '/assets/fundo-inicio-desktop.png',
  '/assets/fundo-inicio-mobile.png',
  '/catalogo-metadata-original.js'
]) {
  if (!html.includes(reference)) {
    throw new Error(`Referência obrigatória ausente no index.html: ${reference}`);
  }
}

if (!html.includes('Cadastrar novo título')) {
  throw new Error('O acesso ao cadastro de título não está identificado corretamente.');
}
if (!html.includes('property="og:image"') || !html.includes('twitter:card')) {
  throw new Error('A prévia de compartilhamento não está configurada.');
}
if (!html.includes('id="catalogCategories"') || !html.includes('id="editCoverPreview"')) {
  throw new Error('Os filtros por gênero ou a edição de capa estão incompletos.');
}
for (const catalogField of ['ordem_planilha', 'genero_codigo', 'classificacao_numero', 'classificacao_cor', 'copyFieldsList', 'catalogViewSwitch', 'catalogClassification']) {
  if (!html.includes(catalogField)) {
    throw new Error(`Campo do novo cadastro ausente: ${catalogField}`);
  }
}
for (const loanField of ['loanOperationPanel', 'loanStudentCode', 'loanCopySearch', 'loanDueDate', 'saveLoanButton']) {
  if (!html.includes(`id="${loanField}"`)) {
    throw new Error(`Campo do empréstimo administrativo ausente: ${loanField}`);
  }
}
if (!html.includes('id="publicPortal"') || !html.includes('id="reservationModal"')) {
  throw new Error('O catálogo público ou o fluxo de reserva está incompleto.');
}
for (const publicView of ['publicHomeView', 'publicCatalogView', 'publicLoansView']) {
  if (!html.includes(`id="${publicView}"`)) {
    throw new Error(`Tela pública ausente: ${publicView}`);
  }
}
if (html.includes('/assets/app-icon.png')) {
  throw new Error('O ícone do livro deve permanecer apenas na prévia de compartilhamento.');
}

const appScript = await readFile(new URL('../app.js', import.meta.url), 'utf8');
if (!appScript.includes('sessionStorage.getItem') || !appScript.includes('sessionStorage.setItem')) {
  throw new Error('A navegação deve permanecer somente durante a sessão aberta do APP.');
}
if (/localStorage\.(getItem|setItem)\(key/.test(appScript)) {
  throw new Error('A navegação não pode permanecer salva após o APP ser fechado.');
}
for (const feature of ['renderCategoryTabs', 'openEditBookForm', 'saveEditedBook', 'renderCopyFields', 'tombamento']) {
  if (!appScript.includes(feature)) {
    throw new Error(`Recurso do acervo ausente: ${feature}`);
  }
}
for (const feature of ['findLoanStudent', 'searchAvailableLoanCopies', 'saveDirectLoan', 'registrar_emprestimo_por_codigo']) {
  if (!appScript.includes(feature)) {
    throw new Error(`Recurso de empréstimo administrativo ausente: ${feature}`);
  }
}
if (!appScript.includes("book?.classificacao_cor || 'Cor não informada'")) {
  throw new Error('Títulos sem cor devem ser identificados sem classificação presumida.');
}

const catalogMetadata = await readFile(new URL('../catalogo-metadata-original.js', import.meta.url), 'utf8');
for (const title of ['6 vezes lucas', 'a botija', '25 contos de machado de assis']) {
  if (!catalogMetadata.includes(`\"${title}\"`)) {
    throw new Error(`Metadado original ausente para: ${title}`);
  }
}
if (catalogMetadata.includes('"classificacao_cor":"Roxo"')) {
  throw new Error('A planilha original não possui classificação roxa.');
}
for (const expectedColor of ['Verde', 'Amarela', 'Rosa', 'Laranja']) {
  if (!catalogMetadata.includes(`"classificacao_cor":"${expectedColor}"`)) {
    throw new Error(`Cor original ausente no catálogo: ${expectedColor}`);
  }
}
if (!catalogMetadata.includes('"classificacao_cor":null,"classificacao_cor_hex":"#94a3b8"')) {
  throw new Error('Livros sem cor precisam usar o indicador cinza.');
}

const catalogSql = await readFile(
  new URL('../atualizar-catalogo-classificacao-tombamento.sql', import.meta.url),
  'utf8'
);
for (const feature of ['ordem_planilha', 'genero_codigo', 'classificacao_numero', 'classificacao_cor_hex', 'exemplares_tombamento_unico']) {
  if (!catalogSql.includes(feature)) {
    throw new Error(`Atualização do catálogo incompleta: ${feature}`);
  }
}

const catalogImportSql = await readFile(
  new URL('../importar-metadados-planilha-original.sql', import.meta.url),
  'utf8'
);
for (const feature of ['catalogo_planilha_original', '398 títulos', 'update public.livros', 'update public.exemplares']) {
  if (!catalogImportSql.includes(feature)) {
    throw new Error(`Importação definitiva da planilha incompleta: ${feature}`);
  }
}
if (/delete\s+from\s+public\.(livros|exemplares)/i.test(catalogImportSql)) {
  throw new Error('A importação da planilha não pode excluir títulos ou exemplares.');
}

const portalScript = await readFile(new URL('../portal.js', import.meta.url), 'utf8');
for (const feature of ['localizar_aluno_por_codigo', 'reservar_livro_por_codigo', 'consultar_emprestimos_por_codigo', 'activatePublicView']) {
  if (!portalScript.includes(feature)) {
    throw new Error(`Recurso de reserva pública ausente: ${feature}`);
  }
}
if (!html.includes('Você tem 3 dias para retirar')) {
  throw new Error('O prazo de retirada não está informado ao aluno.');
}

const reservationsSql = await readFile(
  new URL('../ativar-reservas-online.sql', import.meta.url),
  'utf8'
);
for (const feature of ["'{\"dias\": 3}'", 'reservar_livro_por_codigo', 'liberar_solicitacoes_expiradas', 'consultar_emprestimos_por_codigo']) {
  if (!reservationsSql.includes(feature)) {
    throw new Error(`Regra de reserva ausente no Supabase: ${feature}`);
  }
}

const directLoansSql = await readFile(
  new URL('../ativar-emprestimos-diretos.sql', import.meta.url),
  'utf8'
);
for (const feature of ['buscar_exemplares_disponiveis', 'registrar_emprestimo_por_codigo', 'tombamento', "set status = 'emprestado'"]) {
  if (!directLoansSql.includes(feature)) {
    throw new Error(`Regra do empréstimo administrativo ausente: ${feature}`);
  }
}

const permissionsSql = await readFile(
  new URL('../atualizar-permissoes-gestao.sql', import.meta.url),
  'utf8'
);
if (!permissionsSql.includes("tipo in ('bibliotecario', 'gestao_escolar')")) {
  throw new Error('A Gestão Escolar precisa ter permissão para editar o acervo.');
}

const publicConfig = await readFile(new URL('../config.js', import.meta.url), 'utf8');
if (!publicConfig.includes('sb_publishable_') || !publicConfig.includes('.supabase.co')) {
  throw new Error('A configuração pública do Supabase está incompleta.');
}
if (/sb_secret_|service_role/i.test(publicConfig)) {
  throw new Error('Uma chave secreta foi adicionada indevidamente ao cliente web.');
}

const { default: healthHandler } = await import('../api/health.js');
let healthStatus;
let healthPayload;
healthHandler(
  {},
  {
    status(code) {
      healthStatus = code;
      return this;
    },
    json(payload) {
      healthPayload = payload;
    }
  }
);

if (healthStatus !== 200 || healthPayload?.ok !== true) {
  throw new Error('A função /api/health não retornou o resultado esperado.');
}

console.log('Projeto verificado: estrutura e configuração válidas.');
