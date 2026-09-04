-- APP Biblioteca EE 11 de Outubro
-- Ativa catálogo público e reservas por Código do Aluno (SGDE)
-- Execute uma única vez no SQL Editor do Supabase.

begin;

insert into public.configuracoes (chave, valor, descricao)
values (
  'prazo_retirada',
  '{"dias": 3}'::jsonb,
  'Prazo para retirada de uma reserva online'
)
on conflict (chave) do update
set valor = excluded.valor,
    descricao = excluded.descricao,
    atualizado_em = now();

create or replace function public.localizar_aluno_por_codigo(p_codigo text)
returns table (
  codigo text,
  nome text,
  turma text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.matricula as codigo,
    p.nome,
    t.nome as turma
  from public.pessoas p
  left join public.turmas t on t.id = p.turma_id
  where p.tipo = 'aluno'
    and p.ativo = true
    and p.matricula is not null
    and regexp_replace(p.matricula, '\s+', '', 'g') =
        regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g')
  limit 1;
$$;

create or replace function public.reservar_livro_por_codigo(
  p_codigo text,
  p_livro_id uuid
)
returns table (
  solicitacao_id uuid,
  aluno_nome text,
  titulo text,
  reservado_ate timestamptz,
  prazo_dias integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa public.pessoas%rowtype;
  v_livro public.livros%rowtype;
  v_exemplar_id uuid;
  v_solicitacao_id uuid;
  v_reservado_ate timestamptz;
  v_prazo integer;
  v_limite integer;
  v_total_aberto integer;
begin
  if p_livro_id is null or length(trim(coalesce(p_codigo, ''))) < 2 then
    raise exception 'Informe um Código do Aluno válido.';
  end if;

  perform public.liberar_solicitacoes_expiradas();

  select p.* into v_pessoa
  from public.pessoas p
  where p.tipo = 'aluno'
    and p.ativo = true
    and p.matricula is not null
    and regexp_replace(p.matricula, '\s+', '', 'g') =
        regexp_replace(trim(p_codigo), '\s+', '', 'g')
  limit 1;

  if not found then
    raise exception 'Aluno não localizado. Confira o Código do Aluno cadastrado no SGDE.';
  end if;

  select l.* into v_livro
  from public.livros l
  where l.id = p_livro_id and l.ativo = true;

  if not found then
    raise exception 'Título não localizado.';
  end if;

  if exists (
    select 1
    from public.emprestimos em
    where em.pessoa_id = v_pessoa.id
      and em.status = 'ativo'
      and em.devolucao_prevista < current_date
  ) then
    raise exception 'Há devolução em atraso. Regularize-a antes de fazer uma reserva.';
  end if;

  if exists (
    select 1
    from public.solicitacoes s
    where s.pessoa_id = v_pessoa.id
      and s.livro_id = p_livro_id
      and s.status = 'aguardando_retirada'
  ) then
    raise exception 'Já existe uma reserva aguardando retirada para este título.';
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

  select e.id into v_exemplar_id
  from public.exemplares e
  where e.livro_id = p_livro_id
    and e.status = 'disponivel'
    and e.ativo = true
  order by e.numero_exemplar
  for update skip locked
  limit 1;

  if v_exemplar_id is null then
    raise exception 'Não há exemplar disponível para este título.';
  end if;

  v_prazo := public.configuracao_inteira('prazo_retirada', 'dias', 3);
  v_reservado_ate := now() + make_interval(days => v_prazo);

  insert into public.solicitacoes (
    pessoa_id,
    livro_id,
    exemplar_id,
    status,
    reservado_ate
  ) values (
    v_pessoa.id,
    p_livro_id,
    v_exemplar_id,
    'aguardando_retirada',
    v_reservado_ate
  )
  returning id into v_solicitacao_id;

  update public.exemplares
  set status = 'reservado'
  where id = v_exemplar_id;

  insert into public.historico_movimentacoes (
    tipo,
    pessoa_id,
    livro_id,
    exemplar_id,
    solicitacao_id,
    detalhes
  ) values (
    'reserva_online_criada',
    v_pessoa.id,
    p_livro_id,
    v_exemplar_id,
    v_solicitacao_id,
    jsonb_build_object(
      'codigo_aluno', v_pessoa.matricula,
      'reservado_ate', v_reservado_ate,
      'prazo_dias', v_prazo
    )
  );

  return query
  select
    v_solicitacao_id,
    v_pessoa.nome,
    v_livro.titulo,
    v_reservado_ate,
    v_prazo;
end;
$$;

create or replace function public.consultar_acervo_publico_atualizado()
returns setof public.acervo_publico
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.liberar_solicitacoes_expiradas();
  return query
  select a.*
  from public.acervo_publico a
  order by a.titulo;
end;
$$;

create or replace function public.listar_solicitacoes_administracao()
returns table (
  id uuid,
  status public.status_solicitacao,
  solicitado_em timestamptz,
  reservado_ate timestamptz,
  confirmado_em timestamptz,
  aluno_nome text,
  aluno_codigo text,
  turma text,
  livro_id uuid,
  titulo text,
  autor text,
  capa_url text,
  exemplar_id uuid,
  exemplar_codigo text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_bibliotecario() then
    raise exception 'Acesso restrito à Gestão Escolar e à biblioteca.';
  end if;

  perform public.liberar_solicitacoes_expiradas();

  return query
  select
    s.id,
    s.status,
    s.solicitado_em,
    s.reservado_ate,
    s.confirmado_em,
    p.nome as aluno_nome,
    p.matricula as aluno_codigo,
    t.nome as turma,
    l.id as livro_id,
    l.titulo,
    l.autor,
    l.capa_url,
    e.id as exemplar_id,
    e.codigo as exemplar_codigo
  from public.solicitacoes s
  join public.pessoas p on p.id = s.pessoa_id
  left join public.turmas t on t.id = p.turma_id
  join public.livros l on l.id = s.livro_id
  left join public.exemplares e on e.id = s.exemplar_id
  order by
    case when s.status = 'aguardando_retirada' then 0 else 1 end,
    s.solicitado_em desc;
end;
$$;

create or replace function public.consultar_emprestimos_por_codigo(p_codigo text)
returns table (
  aluno_nome text,
  aluno_codigo text,
  turma text,
  emprestimo_id uuid,
  titulo text,
  autor text,
  capa_url text,
  exemplar_codigo text,
  emprestado_em timestamptz,
  devolucao_prevista date,
  situacao text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if length(trim(coalesce(p_codigo, ''))) < 2 then
    raise exception 'Informe um Código do Aluno válido.';
  end if;

  if not exists (
    select 1
    from public.pessoas p
    where p.tipo = 'aluno'
      and p.ativo = true
      and p.matricula is not null
      and regexp_replace(p.matricula, '\s+', '', 'g') =
          regexp_replace(trim(p_codigo), '\s+', '', 'g')
  ) then
    raise exception 'Aluno não localizado. Confira o Código do Aluno cadastrado no SGDE.';
  end if;

  return query
  select
    p.nome as aluno_nome,
    p.matricula as aluno_codigo,
    t.nome as turma,
    em.id as emprestimo_id,
    l.titulo,
    l.autor,
    l.capa_url,
    ex.codigo as exemplar_codigo,
    em.emprestado_em,
    em.devolucao_prevista,
    case
      when em.id is null then 'sem_emprestimo'
      when em.devolucao_prevista < current_date then 'em_atraso'
      when em.devolucao_prevista = current_date then 'devolver_hoje'
      else 'ativo'
    end as situacao
  from public.pessoas p
  left join public.turmas t on t.id = p.turma_id
  left join public.emprestimos em
    on em.pessoa_id = p.id
   and em.status = 'ativo'
  left join public.exemplares ex on ex.id = em.exemplar_id
  left join public.livros l on l.id = ex.livro_id
  where p.tipo = 'aluno'
    and p.ativo = true
    and p.matricula is not null
    and regexp_replace(p.matricula, '\s+', '', 'g') =
        regexp_replace(trim(p_codigo), '\s+', '', 'g')
  order by em.devolucao_prevista nulls last;
end;
$$;

revoke all on function public.localizar_aluno_por_codigo(text) from public;
revoke all on function public.reservar_livro_por_codigo(text, uuid) from public;
revoke all on function public.consultar_acervo_publico_atualizado() from public;
revoke all on function public.listar_solicitacoes_administracao() from public;
revoke all on function public.consultar_emprestimos_por_codigo(text) from public;

grant execute on function public.localizar_aluno_por_codigo(text) to anon, authenticated;
grant execute on function public.reservar_livro_por_codigo(text, uuid) to anon, authenticated;
grant execute on function public.consultar_acervo_publico_atualizado() to anon, authenticated;
grant execute on function public.listar_solicitacoes_administracao() to authenticated;
grant execute on function public.consultar_emprestimos_por_codigo(text) to anon, authenticated;

commit;

select
  'Reservas online ativadas com prazo de 3 dias' as resultado,
  (select valor ->> 'dias' from public.configuracoes where chave = 'prazo_retirada') as prazo_retirada_dias;
