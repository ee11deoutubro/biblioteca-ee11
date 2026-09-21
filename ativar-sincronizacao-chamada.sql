-- Biblioteca EE 11 de Outubro — sincronização de turmas e alunos do Chamada Escolar
-- Execute uma única vez no SQL Editor do Supabase da Biblioteca.

begin;

alter table public.turmas
  add column if not exists chamada_class_id uuid,
  add column if not exists chamada_academic_year_id uuid,
  add column if not exists sincronizado_chamada boolean not null default false,
  add column if not exists sincronizado_em timestamptz;

alter table public.pessoas
  add column if not exists chamada_student_id uuid,
  add column if not exists chamada_enrollment_id uuid,
  add column if not exists sincronizado_chamada boolean not null default false,
  add column if not exists sincronizado_em timestamptz;

create unique index if not exists turmas_chamada_class_id_unico
  on public.turmas (chamada_class_id)
  where chamada_class_id is not null;

create unique index if not exists pessoas_chamada_student_id_unico
  on public.pessoas (chamada_student_id)
  where chamada_student_id is not null;

create or replace function public.sincronizar_cadastros_chamada(
  p_turmas jsonb,
  p_alunos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_turma_id uuid;
  v_pessoa_id uuid;
  v_class_id uuid;
  v_student_id uuid;
  v_enrollment_id uuid;
  v_academic_year_id uuid;
  v_nome text;
  v_codigo text;
  v_turno text;
  v_turmas_origem uuid[] := array[]::uuid[];
  v_alunos_origem uuid[] := array[]::uuid[];
  v_turmas_inseridas integer := 0;
  v_turmas_atualizadas integer := 0;
  v_alunos_inseridos integer := 0;
  v_alunos_atualizados integer := 0;
  v_alunos_desativados integer := 0;
  v_turmas_desativadas integer := 0;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Sincronização permitida somente pelo serviço protegido da Biblioteca.';
  end if;

  if jsonb_typeof(p_turmas) <> 'array' or jsonb_array_length(p_turmas) = 0 then
    raise exception 'O Chamada Escolar não retornou turmas ativas. Nenhum cadastro foi alterado.';
  end if;

  if jsonb_typeof(p_alunos) <> 'array' or jsonb_array_length(p_alunos) = 0 then
    raise exception 'O Chamada Escolar não retornou alunos ativos. Nenhum cadastro foi alterado.';
  end if;

  for v_item in select value from jsonb_array_elements(p_turmas)
  loop
    v_class_id := nullif(v_item ->> 'chamada_class_id', '')::uuid;
    v_academic_year_id := nullif(v_item ->> 'academic_year_id', '')::uuid;
    v_nome := btrim(coalesce(v_item ->> 'nome', ''));
    v_turno := case lower(coalesce(v_item ->> 'turno', ''))
      when 'morning' then 'Matutino'
      when 'afternoon' then 'Vespertino'
      when 'evening' then 'Noturno'
      when 'matutino' then 'Matutino'
      when 'vespertino' then 'Vespertino'
      when 'noturno' then 'Noturno'
      else coalesce(nullif(btrim(v_item ->> 'turno'), ''), 'Não informado')
    end;

    if v_class_id is null or v_nome = '' then
      continue;
    end if;

    v_turmas_origem := array_append(v_turmas_origem, v_class_id);

    select t.id into v_turma_id
    from public.turmas t
    where t.chamada_class_id = v_class_id
       or (t.chamada_class_id is null and lower(btrim(t.nome)) = lower(v_nome))
    order by (t.chamada_class_id = v_class_id) desc
    limit 1;

    if v_turma_id is null then
      insert into public.turmas (
        nome, turno, ativo, chamada_class_id, chamada_academic_year_id,
        sincronizado_chamada, sincronizado_em
      ) values (
        v_nome, v_turno, true, v_class_id, v_academic_year_id, true, now()
      ) returning id into v_turma_id;
      v_turmas_inseridas := v_turmas_inseridas + 1;
    else
      update public.turmas
      set nome = v_nome,
          turno = v_turno,
          ativo = true,
          chamada_class_id = v_class_id,
          chamada_academic_year_id = v_academic_year_id,
          sincronizado_chamada = true,
          sincronizado_em = now()
      where id = v_turma_id;
      v_turmas_atualizadas := v_turmas_atualizadas + 1;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_alunos)
  loop
    v_student_id := nullif(v_item ->> 'chamada_student_id', '')::uuid;
    v_enrollment_id := nullif(v_item ->> 'chamada_enrollment_id', '')::uuid;
    v_class_id := nullif(v_item ->> 'chamada_class_id', '')::uuid;
    v_nome := btrim(coalesce(v_item ->> 'nome', ''));
    v_codigo := regexp_replace(btrim(coalesce(v_item ->> 'codigo_sgde', '')), '\s+', '', 'g');

    if v_student_id is null or v_class_id is null or v_nome = '' or v_codigo = '' then
      continue;
    end if;

    select t.id into v_turma_id
    from public.turmas t
    where t.chamada_class_id = v_class_id
    limit 1;

    if v_turma_id is null then
      continue;
    end if;

    v_alunos_origem := array_append(v_alunos_origem, v_student_id);

    select p.id into v_pessoa_id
    from public.pessoas p
    where p.tipo = 'aluno'
      and (
        p.chamada_student_id = v_student_id
        or (p.chamada_student_id is null
          and regexp_replace(coalesce(p.matricula, ''), '\s+', '', 'g') = v_codigo)
      )
    order by (p.chamada_student_id = v_student_id) desc
    limit 1;

    if v_pessoa_id is null then
      insert into public.pessoas (
        nome, matricula, tipo, turma_id, ativo, chamada_student_id,
        chamada_enrollment_id, sincronizado_chamada, sincronizado_em
      ) values (
        v_nome, v_codigo, 'aluno', v_turma_id, true, v_student_id,
        v_enrollment_id, true, now()
      ) returning id into v_pessoa_id;
      v_alunos_inseridos := v_alunos_inseridos + 1;
    else
      update public.pessoas
      set nome = v_nome,
          matricula = v_codigo,
          turma_id = v_turma_id,
          ativo = true,
          chamada_student_id = v_student_id,
          chamada_enrollment_id = v_enrollment_id,
          sincronizado_chamada = true,
          sincronizado_em = now()
      where id = v_pessoa_id;
      v_alunos_atualizados := v_alunos_atualizados + 1;
    end if;
  end loop;

  update public.pessoas
  set ativo = false,
      sincronizado_em = now()
  where tipo = 'aluno'
    and sincronizado_chamada = true
    and chamada_student_id is not null
    and not (chamada_student_id = any(v_alunos_origem));
  get diagnostics v_alunos_desativados = row_count;

  update public.turmas
  set ativo = false,
      sincronizado_em = now()
  where sincronizado_chamada = true
    and chamada_class_id is not null
    and not (chamada_class_id = any(v_turmas_origem));
  get diagnostics v_turmas_desativadas = row_count;

  return jsonb_build_object(
    'turmas_recebidas', cardinality(v_turmas_origem),
    'turmas_inseridas', v_turmas_inseridas,
    'turmas_atualizadas', v_turmas_atualizadas,
    'turmas_desativadas', v_turmas_desativadas,
    'alunos_recebidos', cardinality(v_alunos_origem),
    'alunos_inseridos', v_alunos_inseridos,
    'alunos_atualizados', v_alunos_atualizados,
    'alunos_desativados', v_alunos_desativados,
    'sincronizado_em', now()
  );
end;
$$;

revoke all on function public.sincronizar_cadastros_chamada(jsonb, jsonb) from public;
grant execute on function public.sincronizar_cadastros_chamada(jsonb, jsonb) to service_role;

commit;

select 'Sincronização do Chamada Escolar preparada.' as resultado;
