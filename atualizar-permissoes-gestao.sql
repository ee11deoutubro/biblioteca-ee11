begin;

create or replace function public.eh_bibliotecario()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and tipo in ('bibliotecario', 'gestao_escolar')
      and ativo = true
  );
$$;

commit;

select 'Gestão Escolar e Bibliotecário autorizados a administrar o acervo.' as resultado;
