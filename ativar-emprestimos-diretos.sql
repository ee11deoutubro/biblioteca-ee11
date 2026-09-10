-- Biblioteca EE 11 de Outubro — empréstimo administrativo por Código SGDE
-- Execute uma única vez no SQL Editor do Supabase após publicar a versão 0.12.0.

begin;

create or replace function public.buscar_exemplares_disponiveis(p_busca text)
returns table (
  exemplar_id uuid,
  exemplar_codigo text,
  tombamento text,
  numero_exemplar integer,
  localizacao text,
  conservacao text,
  livro_id uuid,
  titulo text,
  autor text,
  capa_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
begin
  if not public.eh_bibliotecario() then
    raise exception 'Acesso restrito à Gestão Escolar e à biblioteca.';
  end if;

  if length(v_busca) < 1 then
    raise exception 'Digite o título, autor, código ou tombamento do exemplar.';
  end if;

  return query
  select
    e.id,
    e.codigo,
    e.tombamento,
    e.numero_exemplar,
    e.localizacao,
    e.conservacao::text,
    l.id,
    l.titulo,
    l.autor,
    l.capa_url
  from public.exemplares e
  join public.livros l on l.id = e.livro_id
  where e.ativo = true
    and l.ativo = true
    and e.status = 'disponivel'
    and (
      l.titulo ilike '%' || v_busca || '%'
      or l.autor ilike '%' || v_busca || '%'
      or e.codigo ilike '%' || v_busca || '%'
      or coalesce(e.tombamento, '') ilike '%' || v_busca || '%'
    )
  order by l.titulo, e.numero_exemplar
  limit 30;
end;
$$;

create or replace function public.registrar_emprestimo_por_codigo(
  p_codigo text,
  p_exemplar_id uuid,
  p_devolucao_prevista date
)
returns table (
  emprestimo_id uuid,
  aluno_nome text,
  aluno_codigo text,
  turma text,
  titulo text,
  exemplar_codigo text,
  tombamento text,
  devolucao_prevista date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa public.pessoas%rowtype;
  v_exemplar public.exemplares%rowtype;
  v_livro public.livros%rowtype;
  v_turma text;
  v_emprestimo_id uuid;
  v_limite integer;
  v_total_aberto integer;
begin
  if not public.eh_bibliotecario() then
    raise exception 'Acesso restrito à Gestão Escolar e à biblioteca.';
  end if;

  if length(btrim(coalesce(p_codigo, ''))) < 2 then
    raise exception 'Informe um Código do Aluno válido.';
  end if;

  if p_exemplar_id is null then
    raise exception 'Selecione um exemplar disponível.';
  end if;

  if p_devolucao_prevista is null or p_devolucao_prevista < current_date then
    raise exception 'Informe uma data de devolução válida.';
  end if;

  perform public.liberar_solicitacoes_expiradas();

  select p.* into v_pessoa
  from public.pessoas p
  where p.tipo = 'aluno'
    and p.ativo = true
    and p.matricula is not null
    and regexp_replace(p.matricula, '\s+', '', 'g') =
        regexp_replace(btrim(p_codigo), '\s+', '', 'g')
  limit 1;

  if not found then
    raise exception 'Aluno não localizado. Confira o Código do Aluno cadastrado no SGDE.';
  end if;

  select t.nome into v_turma
  from public.turmas t
  where t.id = v_pessoa.turma_id;

  if exists (
    select 1
    from public.emprestimos em
    where em.pessoa_id = v_pessoa.id
      and em.status = 'ativo'
      and em.devolucao_prevista < current_date
  ) then
    raise exception 'Há devolução em atraso. Regularize-a antes de registrar outro empréstimo.';
  end if;

  select e.* into v_exemplar
  from public.exemplares e
  where e.id = p_exemplar_id
    and e.ativo = true
    and e.status = 'disponivel'
  for update;

  if not found then
    raise exception 'Este exemplar não está mais disponível. Atualize a busca.';
  end if;

  select l.* into v_livro
  from public.livros l
  where l.id = v_exemplar.livro_id
    and l.ativo = true;

  if not found then
    raise exception 'Título não localizado ou desativado.';
  end if;

  if exists (
    select 1
    from public.solicitacoes s
    where s.pessoa_id = v_pessoa.id
      and s.livro_id = v_livro.id
      and s.status = 'aguardando_retirada'
  ) then
    raise exception 'Este aluno já possui reserva para o título. Confirme a retirada da reserva.';
  end if;

  v_limite := public.configuracao_inteira('limite_emprestimos_aluno', 'quantidade', 2);
  select
    (select count(*) from public.emprestimos em
      where em.pessoa_id = v_pessoa.id and em.status = 'ativo')
    +
    (select count(*) from public.solicitacoes s
      where s.pessoa_id = v_pessoa.id and s.status = 'aguardando_retirada')
  into v_total_aberto;

  if v_total_aberto >= v_limite then
    raise exception 'Limite de empréstimos e reservas atingido.';
  end if;

  insert into public.emprestimos (
    pessoa_id,
    exemplar_id,
    status,
    emprestado_em,
    devolucao_prevista
  ) values (
    v_pessoa.id,
    v_exemplar.id,
    'ativo',
    now(),
    p_devolucao_prevista
  )
  returning id into v_emprestimo_id;

  update public.exemplares
  set status = 'emprestado'
  where id = v_exemplar.id;

  insert into public.historico_movimentacoes (
    tipo,
    pessoa_id,
    livro_id,
    exemplar_id,
    detalhes
  ) values (
    'emprestimo_registrado',
    v_pessoa.id,
    v_livro.id,
    v_exemplar.id,
    jsonb_build_object(
      'emprestimo_id', v_emprestimo_id,
      'codigo_aluno', v_pessoa.matricula,
      'tombamento', v_exemplar.tombamento,
      'devolucao_prevista', p_devolucao_prevista,
      'registrado_por', auth.uid()
    )
  );

  return query
  select
    v_emprestimo_id,
    v_pessoa.nome,
    v_pessoa.matricula,
    v_turma,
    v_livro.titulo,
    v_exemplar.codigo,
    v_exemplar.tombamento,
    p_devolucao_prevista;
end;
$$;

revoke all on function public.buscar_exemplares_disponiveis(text) from public;
revoke all on function public.registrar_emprestimo_por_codigo(text, uuid, date) from public;
grant execute on function public.buscar_exemplares_disponiveis(text) to authenticated;
grant execute on function public.registrar_emprestimo_por_codigo(text, uuid, date) to authenticated;

commit;

select 'Empréstimo por Código SGDE ativado.' as resultado;
