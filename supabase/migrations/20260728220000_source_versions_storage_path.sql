-- S02 reopen: prevent cross-tenant storage_path on source_versions.
-- source_versions are content snapshots: storage fields + source_id/owner_id/version/raw_text
-- are immutable after insert (enforced by trigger).

alter table public.source_versions
  drop constraint if exists source_versions_storage_pair;

alter table public.source_versions
  add constraint source_versions_storage_pair
  check (
    (storage_bucket is null and storage_path is null)
    or (storage_bucket is not null and storage_path is not null)
  );

alter table public.source_versions
  drop constraint if exists source_versions_storage_bucket_allowed;

alter table public.source_versions
  add constraint source_versions_storage_bucket_allowed
  check (
    storage_bucket is null
    or storage_bucket = 'sources'
  );

create or replace function public.enforce_source_version_storage_path()
returns trigger
language plpgsql
security invoker
as $$
declare
  object_name text;
begin
  -- Immutability of snapshot identity/content fields on UPDATE
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id
      or new.source_id is distinct from old.source_id
      or new.version is distinct from old.version
      or new.raw_text is distinct from old.raw_text
      or new.storage_bucket is distinct from old.storage_bucket
      or new.storage_path is distinct from old.storage_path
      or new.byte_size is distinct from old.byte_size
      or new.mime_type is distinct from old.mime_type
    then
      raise exception 'source_versions: snapshot fields are immutable';
    end if;
    return new;
  end if;

  -- INSERT validation for storage pair
  if new.storage_bucket is null and new.storage_path is null then
    return new;
  end if;

  if new.storage_bucket is distinct from 'sources' then
    raise exception 'source_versions: storage_bucket must be sources';
  end if;

  if new.storage_path is null or new.storage_path = '' then
    raise exception 'source_versions: storage_path required when bucket set';
  end if;

  if new.storage_path ~ '[\\]' then
    raise exception 'source_versions: storage_path must not contain backslash';
  end if;

  if new.storage_path ~ '[[:cntrl:]]' then
    raise exception 'source_versions: storage_path must not contain control characters';
  end if;

  if array_length(string_to_array(new.storage_path, '/'), 1) is distinct from 3 then
    raise exception 'source_versions: storage_path must have exactly three segments';
  end if;

  object_name := split_part(new.storage_path, '/', 3);

  if split_part(new.storage_path, '/', 1) is distinct from new.owner_id::text then
    raise exception 'source_versions: storage_path owner segment must equal owner_id';
  end if;

  if split_part(new.storage_path, '/', 2) is distinct from new.source_id::text then
    raise exception 'source_versions: storage_path source segment must equal source_id';
  end if;

  if object_name is null or object_name = '' or object_name in ('.', '..')
    or position('/' in object_name) > 0
    or position(E'\\' in object_name) > 0
  then
    raise exception 'source_versions: storage_path object name invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_source_version_storage_path on public.source_versions;
create trigger enforce_source_version_storage_path
before insert or update on public.source_versions
for each row execute procedure public.enforce_source_version_storage_path();
