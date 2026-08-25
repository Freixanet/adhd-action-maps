-- S02 reopen 3: enforce canonical storage_path on EXISTING rows (not only future writes).
-- Strategy: fail the migration visibly if any non-canonical row exists.
-- Do not leave legacy paths outside the invariant.
--
-- Canonical form (when path is non-null):
--   storage_bucket = 'sources'
--   storage_path = {owner_id}/{source_id}/{safeObjectName}
--   exactly 3 segments; no `\`, controls, empty/`.`/`..` object name

do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count
  from public.source_versions
  where storage_path is not null
    and not (
      storage_bucket = 'sources'
      and storage_path !~ '[\\]'
      and storage_path !~ '[[:cntrl:]]'
      and array_length(string_to_array(storage_path, '/'), 1) = 3
      and split_part(storage_path, '/', 1) = owner_id::text
      and split_part(storage_path, '/', 2) = source_id::text
      and split_part(storage_path, '/', 3) <> ''
      and split_part(storage_path, '/', 3) not in ('.', '..')
      and position('/' in split_part(storage_path, '/', 3)) = 0
      and position(E'\\' in split_part(storage_path, '/', 3)) = 0
    );

  if bad_count > 0 then
    raise exception
      'source_versions: % non-canonical storage_path row(s) block migration — refuse to leave legacy paths outside the invariant',
      bad_count;
  end if;
end $$;

alter table public.source_versions
  drop constraint if exists source_versions_storage_path_canonical;

alter table public.source_versions
  add constraint source_versions_storage_path_canonical
  check (
    storage_path is null
    or (
      storage_bucket = 'sources'
      and storage_path !~ '[\\]'
      and storage_path !~ '[[:cntrl:]]'
      and array_length(string_to_array(storage_path, '/'), 1) = 3
      and split_part(storage_path, '/', 1) = owner_id::text
      and split_part(storage_path, '/', 2) = source_id::text
      and split_part(storage_path, '/', 3) <> ''
      and split_part(storage_path, '/', 3) not in ('.', '..')
      and position('/' in split_part(storage_path, '/', 3)) = 0
      and position(E'\\' in split_part(storage_path, '/', 3)) = 0
    )
  );
