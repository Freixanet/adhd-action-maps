-- S03 reopen residual: exact segment match on idempotent retry + UTF-16 length bound.
-- Additive; does not rewrite prior migrations.
--
-- Trust boundary: UTF-16 code-unit length is computed by the Node server
-- (JavaScript String.length) and stored on source_versions.utf16_length.
-- PostgreSQL char_length() is NOT used for offset bounds (emoji diverge).
-- Anchor start/end are validated against the stored utf16_length.

alter table public.source_versions
  add column if not exists utf16_length integer;

create or replace function public.persist_pasted_text_source(
  p_source_id uuid,
  p_source_version_id uuid,
  p_source_request_id uuid,
  p_content_hash text,
  p_raw_text text,
  p_title text,
  p_segments jsonb,
  p_utf16_length integer default null
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
  v_utf16 integer;
  v_existing_seg record;
  v_payload_seg jsonb;
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

  v_utf16 := coalesce(p_utf16_length, char_length(p_raw_text));
  -- Prefer explicit server UTF-16 length; fall back only when omitted by older clients.
  if p_utf16_length is not null then
    if p_utf16_length < 1 then
      raise exception 'persist_pasted_text_source: utf16_length invalid';
    end if;
    v_utf16 := p_utf16_length;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_owner::text), hashtext(p_source_request_id::text));

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
      if v_end > v_utf16 then
        raise exception 'persist_pasted_text_source: anchor end exceeds utf16_length';
      end if;
    end if;
  end loop;

  v_count := jsonb_array_length(p_segments);

  select * into v_existing_by_request
  from public.sources
  where owner_id = v_owner and source_request_id = p_source_request_id;

  if found then
    -- Immutable binding: owner+request → sourceId + versionId + contentHash
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
    if v_existing_version.utf16_length is not null
       and v_existing_version.utf16_length is distinct from v_utf16 then
      raise exception 'persist_pasted_text_source: utf16_length mismatch';
    end if;

    -- Exact segment set comparison (count + fields). Divergence fails closed.
    if (
      select count(*)::integer from public.source_segments
      where source_version_id = p_source_version_id and owner_id = v_owner
    ) is distinct from v_count then
      raise exception 'persist_pasted_text_source: segment count mismatch on retry';
    end if;

    for v_existing_seg in
      select ordinal, kind, raw_text, normalized_text, chunk_id, anchor
      from public.source_segments
      where source_version_id = p_source_version_id and owner_id = v_owner
      order by ordinal
    loop
      v_payload_seg := p_segments -> v_existing_seg.ordinal;
      if v_payload_seg is null then
        raise exception 'persist_pasted_text_source: missing payload segment %', v_existing_seg.ordinal;
      end if;
      if coalesce(v_payload_seg->>'chunk_id', '') is distinct from v_existing_seg.chunk_id then
        raise exception 'persist_pasted_text_source: chunk_id mismatch at %', v_existing_seg.ordinal;
      end if;
      if coalesce(v_payload_seg->>'kind', 'chunk') is distinct from v_existing_seg.kind then
        raise exception 'persist_pasted_text_source: kind mismatch at %', v_existing_seg.ordinal;
      end if;
      if (v_payload_seg->>'raw_text') is distinct from v_existing_seg.raw_text then
        raise exception 'persist_pasted_text_source: raw_text mismatch at %', v_existing_seg.ordinal;
      end if;
      if (v_payload_seg->>'normalized_text') is distinct from v_existing_seg.normalized_text then
        raise exception 'persist_pasted_text_source: normalized_text mismatch at %', v_existing_seg.ordinal;
      end if;
      if coalesce(v_payload_seg->'anchor', '{}'::jsonb) is distinct from coalesce(v_existing_seg.anchor, '{}'::jsonb) then
        raise exception 'persist_pasted_text_source: anchor mismatch at %', v_existing_seg.ordinal;
      end if;
    end loop;

    return jsonb_build_object(
      'sourceId', p_source_id,
      'sourceVersionId', p_source_version_id,
      'segmentCount', v_count,
      'contentHash', p_content_hash,
      'idempotent', true
    );
  end if;

  -- First write path (same as prior migration, plus utf16_length).
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
    if exists (
      select 1 from public.source_segments
      where source_version_id = p_source_version_id and owner_id = v_owner
    ) then
      -- Existing segments: require exact match via the request-id path above.
      -- Reaching here without request binding means incomplete first write — fail closed.
      raise exception 'persist_pasted_text_source: version already has segments without matching request';
    end if;
    update public.source_versions
      set utf16_length = v_utf16
      where id = p_source_version_id and owner_id = v_owner and utf16_length is null;
  else
    insert into public.source_versions (
      id, source_id, owner_id, version, raw_text, storage_bucket, storage_path, utf16_length
    ) values (
      p_source_version_id,
      p_source_id,
      v_owner,
      1,
      p_raw_text,
      null,
      null,
      v_utf16
    );
  end if;

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

-- Drop prior 7-arg signature so PostgREST has a single candidate.
drop function if exists public.persist_pasted_text_source(uuid, uuid, uuid, text, text, text, jsonb);

revoke all on function public.persist_pasted_text_source(uuid, uuid, uuid, text, text, text, jsonb, integer) from public;
grant execute on function public.persist_pasted_text_source(uuid, uuid, uuid, text, text, text, jsonb, integer) to authenticated;
