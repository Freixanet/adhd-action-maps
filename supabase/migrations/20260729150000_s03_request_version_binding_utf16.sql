-- S03 integrity residual: durable owner+request → source+version+hash binding,
-- and server-side UTF-16 code-unit length (JS String.length parity).
-- Additive; does not rewrite prior migrations.

-- ---------------------------------------------------------------------------
-- UTF-16 length matching JavaScript String.length (UTF-16 code units).
-- BMP code point = 1 unit; astral (emoji, > U+FFFF) = 2 units.
-- Never trust client-declared length without verifying against this.
-- ---------------------------------------------------------------------------
create or replace function public.js_utf16_length(p_text text)
returns integer
language plpgsql
immutable
parallel safe
as $$
declare
  v_i integer := 0;
  v_len integer := 0;
  v_cp integer;
begin
  if p_text is null then
    return null;
  end if;
  while v_i < char_length(p_text) loop
    v_i := v_i + 1;
    v_cp := ascii(substr(p_text, v_i, 1));
    if v_cp > 65535 then
      v_len := v_len + 2;
    else
      v_len := v_len + 1;
    end if;
  end loop;
  return v_len;
end;
$$;

revoke all on function public.js_utf16_length(text) from public;
grant execute on function public.js_utf16_length(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Immutable ingest operation ledger:
--   owner_id + source_request_id → source_id + source_version_id + content_hash
-- ---------------------------------------------------------------------------
create table if not exists public.pasted_text_ingest_ops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_request_id uuid not null,
  source_id uuid not null references public.sources (id) on delete cascade,
  source_version_id uuid not null references public.source_versions (id) on delete cascade,
  content_hash text not null,
  created_at timestamptz not null default now(),
  constraint pasted_text_ingest_ops_owner_request_unique
    unique (owner_id, source_request_id)
);

create index if not exists pasted_text_ingest_ops_owner_source_idx
  on public.pasted_text_ingest_ops (owner_id, source_id);

alter table public.pasted_text_ingest_ops enable row level security;

drop policy if exists "pasted_text_ingest_ops_select_own" on public.pasted_text_ingest_ops;
drop policy if exists "pasted_text_ingest_ops_insert_own" on public.pasted_text_ingest_ops;
drop policy if exists "pasted_text_ingest_ops_update_own" on public.pasted_text_ingest_ops;
drop policy if exists "pasted_text_ingest_ops_delete_own" on public.pasted_text_ingest_ops;

create policy "pasted_text_ingest_ops_select_own"
  on public.pasted_text_ingest_ops for select to authenticated
  using ((select auth.uid()) = owner_id);

-- Inserts only via RPC (security invoker under owner). No direct client insert/update.
create policy "pasted_text_ingest_ops_insert_own"
  on public.pasted_text_ingest_ops for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- Immutable: no update/delete policies for authenticated.

grant select, insert on public.pasted_text_ingest_ops to authenticated;

-- Backfill from existing sources bound by source_request_id (first version only).
insert into public.pasted_text_ingest_ops (
  owner_id, source_request_id, source_id, source_version_id, content_hash
)
select
  s.owner_id,
  s.source_request_id,
  s.id,
  sv.id,
  s.content_hash
from public.sources s
join lateral (
  select id
  from public.source_versions
  where source_id = s.id and owner_id = s.owner_id
  order by version asc, created_at asc
  limit 1
) sv on true
where s.source_request_id is not null
on conflict (owner_id, source_request_id) do nothing;

-- Also stamp source_versions.source_request_id for physical verification.
alter table public.source_versions
  add column if not exists source_request_id uuid;

create unique index if not exists source_versions_owner_request_uidx
  on public.source_versions (owner_id, source_request_id)
  where source_request_id is not null;

update public.source_versions sv
set source_request_id = op.source_request_id
from public.pasted_text_ingest_ops op
where sv.id = op.source_version_id
  and sv.owner_id = op.owner_id
  and sv.source_request_id is null;

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
  v_op public.pasted_text_ingest_ops%rowtype;
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
  v_next_version integer;
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

  -- Authoritative UTF-16 length (JS String.length). Reject mismatched client claim.
  v_utf16 := public.js_utf16_length(p_raw_text);
  if v_utf16 is null or v_utf16 < 1 then
    raise exception 'persist_pasted_text_source: utf16_length invalid';
  end if;
  if p_utf16_length is not null and p_utf16_length is distinct from v_utf16 then
    raise exception 'persist_pasted_text_source: utf16_length mismatch';
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

  -- Primary lookup: durable request → version binding.
  select * into v_op
  from public.pasted_text_ingest_ops
  where owner_id = v_owner and source_request_id = p_source_request_id;

  if found then
    if v_op.source_id is distinct from p_source_id then
      raise exception 'persist_pasted_text_source: sourceRequestId bound to different sourceId';
    end if;
    if v_op.source_version_id is distinct from p_source_version_id then
      raise exception 'persist_pasted_text_source: sourceRequestId bound to different sourceVersionId';
    end if;
    if v_op.content_hash is distinct from p_content_hash then
      raise exception 'persist_pasted_text_source: content_hash mismatch for sourceRequestId';
    end if;

    select * into v_existing_version
    from public.source_versions
    where id = v_op.source_version_id and owner_id = v_owner;

    if not found then
      raise exception 'persist_pasted_text_source: version missing for existing request';
    end if;
    if v_existing_version.source_id is distinct from v_op.source_id then
      raise exception 'persist_pasted_text_source: version/source mismatch';
    end if;
    if v_existing_version.raw_text is distinct from p_raw_text then
      raise exception 'persist_pasted_text_source: version raw_text immutable mismatch';
    end if;
    if v_existing_version.utf16_length is not null
       and v_existing_version.utf16_length is distinct from v_utf16 then
      raise exception 'persist_pasted_text_source: utf16_length mismatch';
    end if;

    if (
      select count(*)::integer from public.source_segments
      where source_version_id = v_op.source_version_id and owner_id = v_owner
    ) is distinct from v_count then
      raise exception 'persist_pasted_text_source: segment count mismatch on retry';
    end if;

    for v_existing_seg in
      select ordinal, kind, raw_text, normalized_text, chunk_id, anchor
      from public.source_segments
      where source_version_id = v_op.source_version_id and owner_id = v_owner
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
      'sourceId', v_op.source_id,
      'sourceVersionId', v_op.source_version_id,
      'segmentCount', v_count,
      'contentHash', v_op.content_hash,
      'idempotent', true
    );
  end if;

  -- First write for this request.
  select * into v_existing_source from public.sources where id = p_source_id;
  if found then
    if v_existing_source.owner_id is distinct from v_owner then
      raise exception 'persist_pasted_text_source: source owned by another user';
    end if;
    -- Same source may receive additional versions under a *new* request id.
    -- content_hash on sources tracks the latest write for pasted_text convenience.
    update public.sources
      set source_request_id = p_source_request_id,
          content_hash = p_content_hash,
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
    if v_existing_version.source_request_id is not null
       and v_existing_version.source_request_id is distinct from p_source_request_id then
      raise exception 'persist_pasted_text_source: version already bound to another request';
    end if;
    if exists (
      select 1 from public.source_segments
      where source_version_id = p_source_version_id and owner_id = v_owner
    ) then
      raise exception 'persist_pasted_text_source: version already has segments without matching request';
    end if;
    update public.source_versions
      set utf16_length = v_utf16,
          source_request_id = p_source_request_id
      where id = p_source_version_id and owner_id = v_owner;
  else
    select coalesce(max(version), 0) + 1 into v_next_version
    from public.source_versions
    where source_id = p_source_id and owner_id = v_owner;

    insert into public.source_versions (
      id, source_id, owner_id, version, raw_text, storage_bucket, storage_path,
      utf16_length, source_request_id
    ) values (
      p_source_version_id,
      p_source_id,
      v_owner,
      v_next_version,
      p_raw_text,
      null,
      null,
      v_utf16,
      p_source_request_id
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

  insert into public.pasted_text_ingest_ops (
    owner_id, source_request_id, source_id, source_version_id, content_hash
  ) values (
    v_owner, p_source_request_id, p_source_id, p_source_version_id, p_content_hash
  );

  return jsonb_build_object(
    'sourceId', p_source_id,
    'sourceVersionId', p_source_version_id,
    'segmentCount', v_count,
    'contentHash', p_content_hash,
    'idempotent', false
  );
end;
$$;

revoke all on function public.persist_pasted_text_source(uuid, uuid, uuid, text, text, text, jsonb, integer) from public;
grant execute on function public.persist_pasted_text_source(uuid, uuid, uuid, text, text, text, jsonb, integer) to authenticated;
