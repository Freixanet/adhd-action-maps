-- S08 reopen: authoritative payload_digest for PDF persist idempotency.
-- Replaces persist_pdf_source to require and verify canonical digest.

alter table public.pdf_ingest_ops
  add column if not exists payload_digest text;

alter table public.pdf_ingest_ops
  add column if not exists byte_size integer;

alter table public.pdf_ingest_ops
  add column if not exists mime_type text;

alter table public.pdf_ingest_ops
  add column if not exists page_count integer;

alter table public.pdf_ingest_ops
  add column if not exists coverage jsonb;

create or replace function public.persist_pdf_source(
  p_source_id uuid,
  p_source_version_id uuid,
  p_source_request_id uuid,
  p_content_hash text,
  p_extraction_digest text,
  p_title text,
  p_storage_bucket text,
  p_storage_path text,
  p_byte_size integer,
  p_mime_type text,
  p_page_count integer,
  p_segments jsonb,
  p_coverage jsonb default null,
  p_payload_digest text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_owner uuid := auth.uid();
  v_op public.pdf_ingest_ops%rowtype;
  v_existing_source public.sources%rowtype;
  v_existing_version public.source_versions%rowtype;
  v_seg jsonb;
  v_count integer := 0;
  v_chunk_ids text[] := array[]::text[];
  v_ord integer;
  v_chunk text;
  v_kind text;
  v_raw text;
  v_norm text;
  v_anchor jsonb;
  v_page integer;
  v_start integer;
  v_end integer;
  v_i integer;
  v_next_version integer;
  v_existing_seg record;
  v_payload_seg jsonb;
  v_mime text := coalesce(nullif(trim(coalesce(p_mime_type, '')), ''), 'application/pdf');
begin
  if v_owner is null then
    raise exception 'persist_pdf_source: auth required';
  end if;
  if p_source_id is null or p_source_version_id is null or p_source_request_id is null then
    raise exception 'persist_pdf_source: ids required';
  end if;
  if p_content_hash is null or length(trim(p_content_hash)) = 0 then
    raise exception 'persist_pdf_source: content_hash required';
  end if;
  if p_extraction_digest is null or length(trim(p_extraction_digest)) = 0 then
    raise exception 'persist_pdf_source: extraction_digest required';
  end if;
  if p_payload_digest is null or length(trim(p_payload_digest)) = 0 then
    raise exception 'persist_pdf_source: payload_digest required';
  end if;
  if p_storage_bucket is distinct from 'sources' then
    raise exception 'persist_pdf_source: storage_bucket must be sources';
  end if;
  if p_storage_path is null or length(trim(p_storage_path)) = 0 then
    raise exception 'persist_pdf_source: storage_path required';
  end if;
  if position('/' in p_storage_path) = 0
     or p_storage_path not like (v_owner::text || '/%') then
    raise exception 'persist_pdf_source: storage_path must be owned';
  end if;
  if p_byte_size is null or p_byte_size < 1 then
    raise exception 'persist_pdf_source: byte_size invalid';
  end if;
  if p_page_count is null or p_page_count < 1 then
    raise exception 'persist_pdf_source: page_count invalid';
  end if;
  if p_coverage is null or jsonb_typeof(p_coverage) <> 'object' then
    raise exception 'persist_pdf_source: coverage object required';
  end if;
  if p_segments is null or jsonb_typeof(p_segments) <> 'array' then
    raise exception 'persist_pdf_source: segments array required';
  end if;
  if jsonb_array_length(p_segments) < 1 then
    raise exception 'persist_pdf_source: segments must be non-empty';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_owner::text), hashtext(p_source_request_id::text));

  for v_i in 0 .. jsonb_array_length(p_segments) - 1 loop
    v_seg := p_segments -> v_i;
    if v_seg is null or jsonb_typeof(v_seg) <> 'object' then
      raise exception 'persist_pdf_source: segment % invalid', v_i;
    end if;
    begin
      v_ord := (v_seg->>'ordinal')::integer;
    exception when others then
      raise exception 'persist_pdf_source: segment % ordinal invalid', v_i;
    end;
    if v_ord is null or v_ord <> v_i then
      raise exception 'persist_pdf_source: ordinals must be contiguous from 0';
    end if;

    v_chunk := nullif(trim(coalesce(v_seg->>'chunk_id', '')), '');
    if v_chunk is null then
      raise exception 'persist_pdf_source: chunk_id required';
    end if;
    if v_chunk = any (v_chunk_ids) then
      raise exception 'persist_pdf_source: duplicate chunk_id';
    end if;
    v_chunk_ids := array_append(v_chunk_ids, v_chunk);

    v_kind := coalesce(v_seg->>'kind', 'chunk');
    if v_kind not in ('heading', 'paragraph', 'list', 'table', 'caption', 'note', 'chunk') then
      raise exception 'persist_pdf_source: kind not allowed';
    end if;

    v_raw := v_seg->>'raw_text';
    v_norm := v_seg->>'normalized_text';
    if v_raw is null or v_norm is null or length(v_raw) = 0 then
      raise exception 'persist_pdf_source: segment text required';
    end if;

    v_anchor := coalesce(v_seg->'anchor', '{}'::jsonb);
    if (v_anchor->>'type') is distinct from 'page_char_range' then
      raise exception 'persist_pdf_source: anchor type must be page_char_range';
    end if;
    begin
      v_page := (v_anchor->>'page')::integer;
      v_start := (v_anchor->>'start')::integer;
      v_end := (v_anchor->>'end')::integer;
    exception when others then
      raise exception 'persist_pdf_source: anchor offsets invalid';
    end;
    if v_page is null or v_page < 1 or v_page > p_page_count then
      raise exception 'persist_pdf_source: page out of range';
    end if;
    if v_start is null or v_end is null or v_start < 0 or v_end < v_start then
      raise exception 'persist_pdf_source: anchor range invalid';
    end if;
  end loop;

  v_count := jsonb_array_length(p_segments);

  select * into v_op
  from public.pdf_ingest_ops
  where owner_id = v_owner and source_request_id = p_source_request_id;

  if found then
    -- Any difference vs stored authoritative payload → conflict (not idempotent).
    if v_op.payload_digest is distinct from p_payload_digest
       or v_op.source_id is distinct from p_source_id
       or v_op.source_version_id is distinct from p_source_version_id
       or v_op.content_hash is distinct from p_content_hash
       or v_op.extraction_digest is distinct from p_extraction_digest
       or v_op.byte_size is distinct from p_byte_size
       or coalesce(v_op.mime_type, '') is distinct from v_mime
       or v_op.page_count is distinct from p_page_count
       or coalesce(v_op.coverage, '{}'::jsonb) is distinct from coalesce(p_coverage, '{}'::jsonb)
    then
      raise exception 'persist_pdf_source: payload conflict on retry';
    end if;

    select * into v_existing_version
    from public.source_versions
    where id = v_op.source_version_id and owner_id = v_owner;

    if not found then
      raise exception 'persist_pdf_source: version missing for existing request';
    end if;
    if v_existing_version.storage_path is distinct from p_storage_path then
      raise exception 'persist_pdf_source: storage_path mismatch on retry';
    end if;

    if (
      select count(*)::integer from public.source_segments
      where source_version_id = v_op.source_version_id and owner_id = v_owner
    ) is distinct from v_count then
      raise exception 'persist_pdf_source: segment count mismatch on retry';
    end if;

    for v_existing_seg in
      select ordinal, kind, raw_text, normalized_text, chunk_id, anchor
      from public.source_segments
      where source_version_id = v_op.source_version_id and owner_id = v_owner
      order by ordinal
    loop
      v_payload_seg := p_segments -> v_existing_seg.ordinal;
      if v_payload_seg is null then
        raise exception 'persist_pdf_source: missing payload segment %', v_existing_seg.ordinal;
      end if;
      if coalesce(v_payload_seg->>'chunk_id', '') is distinct from v_existing_seg.chunk_id then
        raise exception 'persist_pdf_source: chunk_id mismatch at %', v_existing_seg.ordinal;
      end if;
      if (v_payload_seg->>'raw_text') is distinct from v_existing_seg.raw_text then
        raise exception 'persist_pdf_source: raw_text mismatch at %', v_existing_seg.ordinal;
      end if;
      if coalesce(v_payload_seg->>'normalized_text', '') is distinct from coalesce(v_existing_seg.normalized_text, '') then
        raise exception 'persist_pdf_source: normalized_text mismatch at %', v_existing_seg.ordinal;
      end if;
      if coalesce(v_payload_seg->>'kind', 'chunk') is distinct from coalesce(v_existing_seg.kind, 'chunk') then
        raise exception 'persist_pdf_source: kind mismatch at %', v_existing_seg.ordinal;
      end if;
      if coalesce(v_payload_seg->'anchor', '{}'::jsonb) is distinct from coalesce(v_existing_seg.anchor, '{}'::jsonb) then
        raise exception 'persist_pdf_source: anchor mismatch at %', v_existing_seg.ordinal;
      end if;
    end loop;

    return jsonb_build_object(
      'sourceId', v_op.source_id,
      'sourceVersionId', v_op.source_version_id,
      'segmentCount', v_count,
      'contentHash', v_op.content_hash,
      'extractionDigest', v_op.extraction_digest,
      'payloadDigest', v_op.payload_digest,
      'idempotent', true
    );
  end if;

  select * into v_existing_source from public.sources where id = p_source_id;
  if found then
    if v_existing_source.owner_id is distinct from v_owner then
      raise exception 'persist_pdf_source: source owned by another user';
    end if;
    update public.sources
      set source_request_id = p_source_request_id,
          content_hash = p_content_hash,
          type = 'pdf',
          status = 'ready',
          title = coalesce(nullif(trim(coalesce(p_title, '')), ''), title),
          updated_at = now()
      where id = p_source_id and owner_id = v_owner;
  else
    insert into public.sources (
      id, owner_id, type, title, content_hash, status, source_request_id, mime_type
    ) values (
      p_source_id,
      v_owner,
      'pdf',
      nullif(trim(coalesce(p_title, '')), ''),
      p_content_hash,
      'ready',
      p_source_request_id,
      v_mime
    );
  end if;

  select * into v_existing_version from public.source_versions where id = p_source_version_id;
  if found then
    if v_existing_version.owner_id is distinct from v_owner then
      raise exception 'persist_pdf_source: version owned by another user';
    end if;
    if v_existing_version.source_id is distinct from p_source_id then
      raise exception 'persist_pdf_source: version bound to different source';
    end if;
    if exists (
      select 1 from public.source_segments
      where source_version_id = p_source_version_id and owner_id = v_owner
    ) then
      raise exception 'persist_pdf_source: version already has segments';
    end if;
    update public.source_versions
      set storage_bucket = 'sources',
          storage_path = p_storage_path,
          byte_size = p_byte_size,
          mime_type = v_mime,
          extraction_digest = p_extraction_digest
      where id = p_source_version_id and owner_id = v_owner;
  else
    select coalesce(max(version), 0) + 1 into v_next_version
    from public.source_versions
    where source_id = p_source_id and owner_id = v_owner;

    insert into public.source_versions (
      id, owner_id, source_id, version, storage_bucket, storage_path,
      byte_size, mime_type, extraction_digest
    ) values (
      p_source_version_id,
      v_owner,
      p_source_id,
      v_next_version,
      'sources',
      p_storage_path,
      p_byte_size,
      v_mime,
      p_extraction_digest
    );
  end if;

  for v_i in 0 .. v_count - 1 loop
    v_seg := p_segments -> v_i;
    insert into public.source_segments (
      source_id, source_version_id, owner_id, ordinal, kind,
      raw_text, normalized_text, anchor, chunk_id
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

  insert into public.pdf_ingest_ops (
    owner_id, source_request_id, source_id, source_version_id,
    content_hash, extraction_digest, payload_digest, byte_size, mime_type, page_count, coverage
  ) values (
    v_owner, p_source_request_id, p_source_id, p_source_version_id,
    p_content_hash, p_extraction_digest, p_payload_digest, p_byte_size, v_mime, p_page_count, p_coverage
  );

  return jsonb_build_object(
    'sourceId', p_source_id,
    'sourceVersionId', p_source_version_id,
    'segmentCount', v_count,
    'contentHash', p_content_hash,
    'extractionDigest', p_extraction_digest,
    'payloadDigest', p_payload_digest,
    'idempotent', false
  );
end;
$$;

revoke all on function public.persist_pdf_source(
  uuid, uuid, uuid, text, text, text, text, text, integer, text, integer, jsonb, jsonb, text
) from public;
grant execute on function public.persist_pdf_source(
  uuid, uuid, uuid, text, text, text, text, text, integer, text, integer, jsonb, jsonb, text
) to authenticated;
