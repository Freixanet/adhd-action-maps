-- S03: citable chunk_id on source_segments + atomic pasted-text persist RPC.
-- source_segments.id remains the internal UUID.
-- Citations continue to address chunk_id text (e.g. chunk_a1b2c3d4).

alter table public.source_segments
  add column if not exists chunk_id text;

update public.source_segments
set chunk_id = 'legacy_' || ordinal::text
where chunk_id is null;

alter table public.source_segments
  alter column chunk_id set not null;

alter table public.source_segments
  drop constraint if exists source_segments_version_chunk_unique;

alter table public.source_segments
  add constraint source_segments_version_chunk_unique
  unique (source_version_id, chunk_id);

-- Fixed-size text windows use kind 'chunk' (additive).
alter table public.source_segments
  drop constraint if exists source_segments_kind_check;

do $$
begin
  -- Drop any CHECK that only lists the old kind set (name varies).
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.source_segments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%heading%paragraph%'
      and pg_get_constraintdef(oid) not ilike '%chunk%'
  ) then
    execute (
      select 'alter table public.source_segments drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'public.source_segments'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%heading%paragraph%'
        and pg_get_constraintdef(oid) not ilike '%chunk%'
      limit 1
    );
  end if;
end $$;

alter table public.source_segments
  drop constraint if exists source_segments_kind_check;

alter table public.source_segments
  add constraint source_segments_kind_check
  check (
    kind in ('heading', 'paragraph', 'list', 'table', 'caption', 'note', 'chunk')
  );

create index if not exists source_segments_chunk_id_idx
  on public.source_segments (chunk_id);

create or replace function public.persist_pasted_text_source(
  p_source_id uuid,
  p_source_version_id uuid,
  p_source_request_id text,
  p_content_hash text,
  p_raw_text text,
  p_title text,
  p_segments jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_owner uuid := auth.uid();
  v_existing_source public.sources%rowtype;
  v_existing_version public.source_versions%rowtype;
  v_seg jsonb;
  v_count integer := 0;
begin
  if v_owner is null then
    raise exception 'persist_pasted_text_source: auth required';
  end if;
  if p_source_id is null or p_source_version_id is null then
    raise exception 'persist_pasted_text_source: ids required';
  end if;
  if p_content_hash is null or length(trim(p_content_hash)) = 0 then
    raise exception 'persist_pasted_text_source: content_hash required';
  end if;
  if p_raw_text is null then
    raise exception 'persist_pasted_text_source: raw_text required';
  end if;
  if p_segments is null or jsonb_typeof(p_segments) <> 'array' then
    raise exception 'persist_pasted_text_source: segments array required';
  end if;

  select * into v_existing_source from public.sources where id = p_source_id;
  if found then
    if v_existing_source.owner_id is distinct from v_owner then
      raise exception 'persist_pasted_text_source: source owned by another user';
    end if;
    if v_existing_source.content_hash is distinct from p_content_hash then
      raise exception 'persist_pasted_text_source: content_hash mismatch on retry';
    end if;
  else
    insert into public.sources (
      id, owner_id, type, title, content_hash, status
    ) values (
      p_source_id,
      v_owner,
      'pasted_text',
      nullif(trim(coalesce(p_title, '')), ''),
      p_content_hash,
      'ready'
    );
  end if;

  select * into v_existing_version from public.source_versions where id = p_source_version_id;
  if found then
    if v_existing_version.owner_id is distinct from v_owner then
      raise exception 'persist_pasted_text_source: version owned by another user';
    end if;
    if v_existing_version.source_id is distinct from p_source_id then
      raise exception 'persist_pasted_text_source: version/source mismatch';
    end if;
  else
    insert into public.source_versions (
      id, source_id, owner_id, version, raw_text, storage_bucket, storage_path
    ) values (
      p_source_version_id,
      p_source_id,
      v_owner,
      1,
      p_raw_text,
      null,
      null
    );
  end if;

  delete from public.source_segments
  where source_version_id = p_source_version_id
    and owner_id = v_owner;

  for v_seg in select * from jsonb_array_elements(p_segments)
  loop
    insert into public.source_segments (
      source_id,
      source_version_id,
      owner_id,
      ordinal,
      kind,
      raw_text,
      normalized_text,
      anchor,
      chunk_id
    ) values (
      p_source_id,
      p_source_version_id,
      v_owner,
      (v_seg->>'ordinal')::integer,
      coalesce(v_seg->>'kind', 'chunk'),
      v_seg->>'raw_text',
      v_seg->>'normalized_text',
      coalesce(v_seg->'anchor', '{}'::jsonb),
      v_seg->>'chunk_id'
    );
    v_count := v_count + 1;
  end loop;

  update public.sources
  set status = 'ready', updated_at = now()
  where id = p_source_id and owner_id = v_owner;

  return jsonb_build_object(
    'sourceId', p_source_id,
    'sourceVersionId', p_source_version_id,
    'segmentCount', v_count,
    'contentHash', p_content_hash
  );
end;
$$;

revoke all on function public.persist_pasted_text_source(uuid, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.persist_pasted_text_source(uuid, uuid, text, text, text, text, jsonb) to authenticated;
