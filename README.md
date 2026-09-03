# Biblioteca EE 11 de Outubro

MVP online para gestão da biblioteca escolar da EE 11 de Outubro.

## Situação do desenvolvimento

- Etapa 1 — identidade visual, painel responsivo e estrutura para Vercel: concluída
- Etapa 2 — Supabase (banco, cliente, Storage e autenticação administrativa): concluída
- Etapa 3 — integração com alunos e turmas do Chamada Escolar/SGDE: em andamento
- Etapa 4 — acervo e controle interno de exemplares: concluída
- Etapa 5 — reservas online e confirmação de retirada: em andamento
- Etapa 6 — painel, cobranças e relatórios
- Etapa 7 — Google Drive e notificações

QR Code e código de barras ficam apenas preparados para uma evolução posterior ao MVP.

## Comportamento de navegação

- A primeira visualização sempre começa no topo da página.
- A seção atual e os campos preenchidos são preservados enquanto a sessão do APP estiver aberta.
- Ao trocar de seção ou iniciar uma atividade, a tela rola automaticamente para o início do conteúdo.
- Ao sair ou abrir uma nova sessão do APP, a navegação começa novamente em **Início**.
- O login administrativo permanece somente enquanto a sessão do navegador estiver aberta;
  ao fechar e abrir novamente, o aplicativo volta ao catálogo público.

## Arquitetura definida

- GitHub: versionamento
- Vercel: hospedagem e APIs
- Supabase: banco, autenticação e Storage
- Chamada Escolar: origem de alunos e turmas
- SGDE: o **Código do aluno** é o identificador oficial para solicitações e empréstimos
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
exemplares físicos, unidades disponíveis e unidades emprestadas. O acesso
administrativo exige autenticação e um perfil ativo do tipo `gestao_escolar`
ou `bibliotecario`; as permissões de dados continuam protegidas pelo RLS do
Supabase mesmo que alguém tente acessar as APIs fora da interface.

A página inicial é pública e reúne a consulta do catálogo, os filtros por gênero
e a reserva de títulos. O login fica separado e é exclusivo para Gestão Escolar
e Bibliotecário.

Na tela **Acervo**, livro e quantidade de exemplares são cadastrados juntos.
Quando um ISBN já existe, o sistema adiciona os novos exemplares ao título
existente, evitando cadastros redundantes. As capas são armazenadas no bucket
`capas-livros` e cada exemplar recebe um código interno único.

Os títulos podem ser pesquisados, filtrados por disponibilidade e separados
pelas abas de gênero/categoria geradas automaticamente. A ação **Editar** permite
alterar os dados do título e enviar ou substituir sua capa sem modificar os
exemplares já cadastrados.

Depois desta atualização, execute uma única vez no SQL Editor do Supabase o
arquivo `atualizar-permissoes-gestao.sql`. Ele autoriza tanto **Gestão Escolar**
quanto **Bibliotecário** a administrar o acervo.

Execute também uma única vez o arquivo `ativar-reservas-online.sql`. Ele define
o prazo de retirada em **3 dias**, habilita a localização exata pelo Código do
Aluno, registra a reserva, marca reservas vencidas como **Reserva expirada** e
devolve o exemplar à disponibilidade quando o catálogo ou as solicitações são
atualizados.

Nos fluxos de empréstimo, o aluno deverá ser localizado pelo **Código do aluno
no SGDE**. O nome será exibido apenas para conferência, nunca usado como
identificador principal. Na estrutura atual, esse código oficial é armazenado
no campo `matricula` da tabela `pessoas` para manter compatibilidade com a base.
Para o aluno ser localizado, sua turma e seu cadastro precisam estar previamente
sincronizados nessa tabela a partir da base oficial.

## Verificação local

Requer Node.js 20 ou superior.

```bash
npm run check
```

O comando valida os arquivos obrigatórios, o `vercel.json` e as referências essenciais da página inicial.
