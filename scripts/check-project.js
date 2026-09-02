import { access, readFile } from 'node:fs/promises';

const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'vercel.json',
  'api/health.js',
  'assets/logo-escola.png',
  'assets/cabecalho-escola.png'
];

await Promise.all(requiredFiles.map((file) => access(new URL(`../${file}`, import.meta.url))));

const vercelConfig = JSON.parse(
  await readFile(new URL('../vercel.json', import.meta.url), 'utf8')
);

if (vercelConfig.cleanUrls !== true) {
  throw new Error('vercel.json deve manter cleanUrls ativado.');
}

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
for (const reference of ['/styles.css', '/app.js', '/assets/logo-escola.png']) {
  if (!html.includes(reference)) {
    throw new Error(`Referência obrigatória ausente no index.html: ${reference}`);
  }
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
