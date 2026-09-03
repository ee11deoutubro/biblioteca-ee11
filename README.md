# Biblioteca EE 11 de Outubro

MVP online para gestão da biblioteca escolar da EE 11 de Outubro.

## Situação do desenvolvimento

- Etapa 1 — identidade visual, painel responsivo e estrutura para Vercel: concluída
- Etapa 2 — Supabase (banco, cliente e Storage): em andamento
- Etapa 3 — integração com alunos e turmas do Chamada Escolar
- Etapa 4 — acervo e controle interno de exemplares
- Etapa 5 — empréstimos, devoluções e renovações
- Etapa 6 — painel, cobranças e relatórios
- Etapa 7 — Google Drive e notificações

QR Code e código de barras ficam apenas preparados para uma evolução posterior ao MVP.

## Comportamento de navegação

- A primeira visualização sempre começa no topo da página.
- A seção atual e os campos marcados para persistência são preservados localmente.
- Ao trocar de seção ou iniciar uma atividade, a tela rola automaticamente para o início do conteúdo.
- O estado da atividade só é limpo quando ela for finalizada, cancelada ou quando o usuário sair.

## Arquitetura definida

- GitHub: versionamento
- Vercel: hospedagem e APIs
- Supabase: banco, autenticação e Storage
- Chamada Escolar: origem de alunos e turmas
- Google Drive: relatórios institucionais

## Publicação no GitHub

1. Crie um repositório vazio chamado `biblioteca-ee11` no GitHub.
2. Envie todo o conteúdo desta pasta para a branch `main`.
3. Não envie arquivos `.env`; eles já estão protegidos pelo `.gitignore`.

## Publicação na Vercel

1. Na Vercel, selecione **Add New → Project**.
2. Importe o repositório `biblioteca-ee11` do GitHub.
3. Mantenha **Framework Preset** como `Other` e o diretório raiz como `./`.
4. Publique sem comando de build. A Vercel servirá o `index.html` e a função `/api/health`.

O cliente web usa apenas a URL do projeto e a chave pública do Supabase em
`config.js`. Chaves secretas e administrativas nunca devem ser adicionadas ao
repositório ou enviadas ao navegador.

O painel consulta a view pública `acervo_publico` e apresenta títulos,
exemplares físicos, unidades disponíveis e unidades emprestadas. Indicadores
administrativos protegidos serão liberados depois do login do bibliotecário.

## Verificação local

Requer Node.js 20 ou superior.

```bash
npm run check
```

O comando valida os arquivos obrigatórios, o `vercel.json` e as referências essenciais da página inicial.
