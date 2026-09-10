-- Biblioteca EE 11 de Outubro — gestão segura dos exemplares
-- Execute uma única vez no SQL Editor do Supabase após publicar a versão 0.11.5.

begin;

create or replace function public.validar_tombamento_novo_exemplar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.tombamento := nullif(btrim(new.tombamento), '');

  if new.tombamento is null then
    raise exception 'tombamento_obrigatorio';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_tombamento_novo_exemplar on public.exemplares;
create trigger validar_tombamento_novo_exemplar
before insert on public.exemplares
for each row
execute function public.validar_tombamento_novo_exemplar();

comment on function public.validar_tombamento_novo_exemplar() is
  'Exige tombamento em novos exemplares sem bloquear registros antigos pendentes.';

commit;

select 'Gestão de exemplares ativada: novos tombamentos são obrigatórios.' as resultado;
