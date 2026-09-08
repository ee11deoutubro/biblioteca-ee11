-- Biblioteca EE 11 de Outubro
-- Acrescenta a classificação bibliotecária e o tombamento por exemplar.
-- Execute uma única vez no SQL Editor do Supabase antes de publicar a versão 0.11.0.

begin;

alter table public.livros
  add column if not exists ordem_planilha integer,
  add column if not exists genero_codigo text,
  add column if not exists classificacao_numero text,
  add column if not exists classificacao_cor text,
  add column if not exists classificacao_cor_hex text;

alter table public.exemplares
  add column if not exists tombamento text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'livros_ordem_planilha_positiva'
      and conrelid = 'public.livros'::regclass
  ) then
    alter table public.livros
      add constraint livros_ordem_planilha_positiva
      check (ordem_planilha is null or ordem_planilha > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'livros_classificacao_cor_hex_valida'
      and conrelid = 'public.livros'::regclass
  ) then
    alter table public.livros
      add constraint livros_classificacao_cor_hex_valida
      check (
        classificacao_cor_hex is null
        or classificacao_cor_hex ~ '^#[0-9A-Fa-f]{6}$'
      );
  end if;
end;
$$;

create unique index if not exists exemplares_tombamento_unico
  on public.exemplares (lower(btrim(tombamento)))
  where tombamento is not null and btrim(tombamento) <> '';

create index if not exists livros_genero_codigo_idx
  on public.livros (genero_codigo)
  where genero_codigo is not null;

comment on column public.livros.ordem_planilha is
  'Número de ordem preservado da planilha original da biblioteca.';
comment on column public.livros.genero_codigo is
  'Código abreviado da classificação, como LJ, LBC, LE, HQ ou CONT.';
comment on column public.livros.classificacao_numero is
  'Número da classificação definido pela biblioteca.';
comment on column public.livros.classificacao_cor is
  'Nome da cor usada na identificação física do gênero.';
comment on column public.livros.classificacao_cor_hex is
  'Cor da classificação no formato hexadecimal para exibição no aplicativo.';
comment on column public.exemplares.tombamento is
  'Número patrimonial individual do exemplar físico.';

commit;

select 'Classificação e tombamento ativados com segurança.' as resultado;
