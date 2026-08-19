-- S03 reopen: durable sourceRequestId + immutable pasted-text persist RPC.
-- Additive: does not rewrite prior migrations.

alter table public.sources
  add column if not exists source_request_id uuid;

-- Unique per owner when set
create unique index if not exists sources_owner_request_uidx
  on public.sources (owner_id, source_request_id)
  where source_request_id is not null;

create or replace function public.persist_pasted_text_source(
  p_source_id uuid,
  p_source_version_id uuid,
  p_source_request_id uuid,
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
  v_existing_by_request public.sources%rowtype;
  v_existing_source public.sources%rowtype;
  v_existing_version public.source_versions%rowtype;
  v_seg jsonb;
  v_count integer := 0;
  v_ordinals integer[] := array[]::integer[];
  v_chunk_ids text[] := array[]::text[];
  v_ord integer;
  v_chunk text;
  v_kind text;
  v_raw text;
  v_norm text;
  v_anchor jsonb;
  v_start integer;
  v_end integer;
  v_i integer;
begin
  if v_owner is null then
    raise exception 'persist_pasted_text_source: auth required';
  end if;
  if p_source_id is null or p_source_version_id is null or p_source_request_id is null then
    raise exception 'persist_pasted_text_source: ids required';
  end if;
  if p_content_hash is null or length(trim(p_content_hash)) = 0 then
    raise exception 'persist_pasted_text_source: content_hash required';
  end if;
  if p_raw_text is null or length(p_raw_text) = 0 then
    raise exception 'persist_pasted_text_source: raw_text required';
  end if;
  if p_segments is null or jsonb_typeof(p_segments) <> 'array' then
    raise exception 'persist_pasted_text_source: segments array required';
  end if;
  if jsonb_array_length(p_segments) < 1 then
    raise exception 'persist_pasted_text_source: segments must be non-empty';
  end if;

  -- Serialize concurrent calls for the same owner+request.
  perform pg_advisory_xact_lock(hashtext(v_owner::text), hashtext(p_source_request_id::text));

  -- Validate segment payload before any write.
  for v_i in 0 .. jsonb_array_length(p_segments) - 1 loop
    v_seg := p_segments -> v_i;
    if v_seg is null or jsonb_typeof(v_seg) <> 'object' then
      raise exception 'persist_pasted_text_source: segment % invalid', v_i;
    end if;
    begin
      v_ord := (v_seg->>'ordinal')::integer;
    exception when others then
      raise exception 'persist_pasted_text_source: segment % ordinal invalid', v_i;
    end;
    if v_ord is null or v_ord <> v_i then
      raise exception 'persist_pasted_text_source: ordinals must be contiguous from 0';
    end if;
    if v_ord = any (v_ordinals) then
      raise exception 'persist_pasted_text_source: duplicate ordinal';
    end if;
    v_ordinals := array_append(v_ordinals, v_ord);

    v_chunk := nullif(trim(coalesce(v_seg->>'chunk_id', '')), '');
    if v_chunk is null then
      raise exception 'persist_pasted_text_source: chunk_id required';
    end if;
    if v_chunk = any (v_chunk_ids) then
      raise exception 'persist_pasted_text_source: duplicate chunk_id';
    end if;
    v_chunk_ids := array_append(v_chunk_ids, v_chunk);

    v_kind := coalesce(v_seg->>'kind', 'chunk');
    if v_kind not in ('heading', 'paragraph', 'list', 'table', 'caption', 'note', 'chunk') then
      raise exception 'persist_pasted_text_source: kind not allowed';
    end if;

    v_raw := v_seg->>'raw_text';
    v_norm := v_seg->>'normalized_text';
    if v_raw is null or v_norm is null then
      raise exception 'persist_pasted_text_source: segment text required';
    end if;

    v_anchor := coalesce(v_seg->'anchor', '{}'::jsonb);
    if (v_anchor->>'type') = 'char_range' then
      begin
        v_start := (v_anchor->>'start')::integer;
        v_end := (v_anchor->>'end')::integer;
      exception when others then
        raise exception 'persist_pasted_text_source: anchor offsets invalid';
      end;
      if v_start is null or v_end is null or v_start < 0 or v_end < v_start then
        raise exception 'persist_pasted_text_source: anchor range invalid';
      end if;
      -- Offsets are JS UTF-16 indices; exact slice equality is enforced in TS
      -- before calling the RPC (PostgreSQL char indexing differs for emoji).
    end if;
  end loop;

  v_count := jsonb_array_length(p_segments);

  -- Lookup by source_request_id (idempotency key).
  select * into v_existing_by_request
  from public.sources
  where owner_id = v_owner and source_request_id = p_source_request_id;

  if found then
    if v_existing_by_request.id is distinct from p_source_id then
      raise exception 'persist_pasted_text_source: sourceRequestId bound to different sourceId';
    end if;
    if v_existing_by_request.content_hash is distinct from p_content_hash then
      raise exception 'persist_pasted_text_source: content_hash mismatch for sourceRequestId';
    end if;

    select * into v_existing_version
    from public.source_versions
    where id = p_source_version_id and owner_id = v_owner;

    if not found then
      raise exception 'persist_pasted_text_source: version missing for existing request';
    end if;
    if v_existing_version.source_id is distinct from p_source_id then
      raise exception 'persist_pasted_text_source: version/source mismatch';
    end if;
    if v_existing_version.raw_text is distinct from p_raw_text then
      raise exception 'persist_pasted_text_source: version raw_text immutable mismatch';
    end if;

    -- Exact match: success without rewriting segments.
    return jsonb_build_object(
      'sourceId', p_source_id,
      'sourceVersionId', p_source_version_id,
      'segmentCount', (
        select count(*)::integer from public.source_segments
        where source_version_id = p_source_version_id and owner_id = v_owner
      ),
      'contentHash', p_content_hash,
      'idempotent', true
    );
  end if;

  select * into v_existing_source from public.sources where id = p_source_id;
  if found then
    if v_existing_source.owner_id is distinct from v_owner then
      raise exception 'persist_pasted_text_source: source owned by another user';
    end if;
    if v_existing_source.source_request_id is not null
       and v_existing_source.source_request_id is distinct from p_source_request_id then
      raise exception 'persist_pasted_text_source: sourceId already bound to another request';
    end if;
    if v_existing_source.content_hash is distinct from p_content_hash then
      raise exception 'persist_pasted_text_source: content_hash mismatch on sourceId';
    end if;
    update public.sources
      set source_request_id = p_source_request_id,
          status = 'ready',
          updated_at = now()
      where id = p_source_id and owner_id = v_owner;
  else
    insert into public.sources (
      id, owner_id, type, title, content_hash, status, source_request_id
    ) values (
      p_source_id,
      v_owner,
      'pasted_text',
      nullif(trim(coalesce(p_title, '')), ''),
      p_content_hash,
      'ready',
      p_source_request_id
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
    if v_existing_version.raw_text is distinct from p_raw_text then
      raise exception 'persist_pasted_text_source: cannot replace version content';
    end if;
    -- Version exists with same text: ensure segments exist once.
    if exists (
      select 1 from public.source_segments
      where source_version_id = p_source_version_id and owner_id = v_owner
    ) then
      return jsonb_build_object(
        'sourceId', p_source_id,
        'sourceVersionId', p_source_version_id,
        'segmentCount', (
          select count(*)::integer from public.source_segments
          where source_version_id = p_source_version_id and owner_id = v_owner
        ),
        'contentHash', p_content_hash,
        'idempotent', true
      );
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

  -- First write of segments only (never delete+replace on matching retry).
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
  end loop;

  return jsonb_build_object(
    'sourceId', p_source_id,
    'sourceVersionId', p_source_version_id,
    'segmentCount', v_count,
    'contentHash', p_content_hash,
    'idempotent', false
  );
end;
$$;

-- Prefer UUID signature only (PostgREST cannot resolve uuid vs text overloads).
revoke all on function public.persist_pasted_text_source(uuid, uuid, uuid, text, text, text, jsonb) from public;
grant execute on function public.persist_pasted_text_source(uuid, uuid, uuid, text, text, text, jsonb) to authenticated;
