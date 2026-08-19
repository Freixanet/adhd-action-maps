-- S08: drop legacy 13-arg persist_pdf_source overload left by CREATE OR REPLACE
-- when the 14-arg digest signature was introduced. Exactly one signature must remain.

drop function if exists public.persist_pdf_source(
  uuid, uuid, uuid, text, text, text, text, text, integer, text, integer, jsonb, jsonb
);

-- Harden the canonical 14-arg signature (incl. optional p_payload_digest).
revoke all on function public.persist_pdf_source(
  uuid, uuid, uuid, text, text, text, text, text, integer, text, integer, jsonb, jsonb, text
) from public;
revoke all on function public.persist_pdf_source(
  uuid, uuid, uuid, text, text, text, text, text, integer, text, integer, jsonb, jsonb, text
) from anon;
grant execute on function public.persist_pdf_source(
  uuid, uuid, uuid, text, text, text, text, text, integer, text, integer, jsonb, jsonb, text
) to authenticated;

-- Assert exactly one persist_pdf_source remains (migration-time guard).
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'persist_pdf_source';
  if v_count <> 1 then
    raise exception 'persist_pdf_source overload count=% (expected 1)', v_count;
  end if;
end;
$$;

-- Introspection helpers for productive tests.
create or replace function public.s08_persist_pdf_source_overload_count()
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'persist_pdf_source';
$$;

create or replace function public.s08_persist_pdf_source_public_execute()
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'persist_pdf_source'
  loop
    if has_function_privilege('public', r.sig, 'EXECUTE') then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

revoke all on function public.s08_persist_pdf_source_overload_count() from public;
revoke all on function public.s08_persist_pdf_source_public_execute() from public;
grant execute on function public.s08_persist_pdf_source_overload_count() to authenticated;
grant execute on function public.s08_persist_pdf_source_public_execute() to authenticated;
