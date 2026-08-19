-- S05 reopen: immutable parent FKs on UPDATE + transactional evidence graph RPC.

-- Freeze parental identities after insert (same-owner attacks included).
create or replace function public.content_nodes_enforce_parents()
returns trigger
language plpgsql
as $$
declare
  v_map_owner uuid;
  v_source_owner uuid;
  v_version_source uuid;
begin
  select owner_id into v_map_owner from public.maps where id = new.map_id;
  if v_map_owner is null then
    raise exception 'content_nodes: map_id not found';
  end if;
  if v_map_owner is distinct from new.owner_id then
    raise exception 'content_nodes: owner_id must match map owner';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'content_nodes: owner_id is immutable';
    end if;
    if new.map_id is distinct from old.map_id then
      raise exception 'content_nodes: map_id is immutable';
    end if;
    if new.source_id is distinct from old.source_id then
      raise exception 'content_nodes: source_id is immutable';
    end if;
    if new.source_version_id is distinct from old.source_version_id then
      raise exception 'content_nodes: source_version_id is immutable';
    end if;
    if new.claim_id is distinct from old.claim_id then
      raise exception 'content_nodes: claim_id is immutable';
    end if;
  end if;

  if new.source_id is not null then
    select owner_id into v_source_owner from public.sources where id = new.source_id;
    if v_source_owner is null or v_source_owner is distinct from new.owner_id then
      raise exception 'content_nodes: source must belong to owner';
    end if;
  end if;

  if new.source_version_id is not null then
    select source_id into v_version_source
    from public.source_versions where id = new.source_version_id;
    if v_version_source is null then
      raise exception 'content_nodes: source_version not found';
    end if;
    if new.source_id is not null and v_version_source is distinct from new.source_id then
      raise exception 'content_nodes: source_version must belong to source_id';
    end if;
    select s.owner_id into v_source_owner
    from public.sources s where s.id = v_version_source;
    if v_source_owner is distinct from new.owner_id then
      raise exception 'content_nodes: source_version owner mismatch';
    end if;
    if new.source_id is null then
      new.source_id := v_version_source;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.evidence_links_enforce_parents()
returns trigger
language plpgsql
as $$
declare
  v_map_owner uuid;
  v_node public.content_nodes%rowtype;
  v_seg public.source_segments%rowtype;
  v_source_owner uuid;
  v_version_source uuid;
begin
  select owner_id into v_map_owner from public.maps where id = new.map_id;
  if v_map_owner is null then
    raise exception 'evidence_links: map_id not found';
  end if;
  if v_map_owner is distinct from new.owner_id then
    raise exception 'evidence_links: owner_id must match map owner';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'evidence_links: owner_id is immutable';
    end if;
    if new.map_id is distinct from old.map_id then
      raise exception 'evidence_links: map_id is immutable';
    end if;
    if new.content_node_id is distinct from old.content_node_id then
      raise exception 'evidence_links: content_node_id is immutable';
    end if;
    if new.source_id is distinct from old.source_id then
      raise exception 'evidence_links: source_id is immutable';
    end if;
    if new.source_version_id is distinct from old.source_version_id then
      raise exception 'evidence_links: source_version_id is immutable';
    end if;
    if new.segment_id is distinct from old.segment_id then
      raise exception 'evidence_links: segment_id is immutable';
    end if;
    if new.chunk_id is distinct from old.chunk_id then
      raise exception 'evidence_links: chunk_id is immutable';
    end if;
    if new.link_key is distinct from old.link_key then
      raise exception 'evidence_links: link_key is immutable';
    end if;
  end if;

  select * into v_node from public.content_nodes where id = new.content_node_id;
  if v_node.id is null then
    raise exception 'evidence_links: content_node not found';
  end if;
  if v_node.owner_id is distinct from new.owner_id then
    raise exception 'evidence_links: content_node owner mismatch';
  end if;
  if v_node.map_id is distinct from new.map_id then
    raise exception 'evidence_links: content_node map mismatch';
  end if;

  if new.source_version_id is null then
    raise exception 'evidence_links: source_version_id required to bind segment';
  end if;

  select source_id into v_version_source
  from public.source_versions where id = new.source_version_id;
  if v_version_source is null then
    raise exception 'evidence_links: source_version not found';
  end if;
  if new.source_id is not null and new.source_id is distinct from v_version_source then
    raise exception 'evidence_links: source/version pair invalid';
  end if;
  new.source_id := v_version_source;

  select s.owner_id into v_source_owner from public.sources s where s.id = v_version_source;
  if v_source_owner is distinct from new.owner_id then
    raise exception 'evidence_links: source_version owner mismatch';
  end if;

  select * into v_seg from public.source_segments where id = new.segment_id;
  if v_seg.id is null then
    select * into v_seg
    from public.source_segments
    where source_version_id = new.source_version_id
      and chunk_id = new.chunk_id;
    if v_seg.id is null then
      raise exception 'evidence_links: chunk_id not found in source_segments for version';
    end if;
    new.segment_id := v_seg.id;
  end if;

  if v_seg.owner_id is distinct from new.owner_id then
    raise exception 'evidence_links: segment owner mismatch';
  end if;
  if v_seg.source_version_id is distinct from new.source_version_id then
    raise exception 'evidence_links: segment version mismatch';
  end if;
  if v_seg.source_id is distinct from new.source_id then
    raise exception 'evidence_links: segment source mismatch';
  end if;
  if v_seg.chunk_id is distinct from new.chunk_id then
    raise exception 'evidence_links: segment chunk_id mismatch';
  end if;

  return new;
end;
$$;

-- Operation ledger: graph is not "complete" until status = complete.
create table if not exists public.evidence_persist_ops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null references public.maps (id) on delete cascade,
  op_key text not null,
  status text not null check (status in ('pending', 'complete', 'failed')),
  content_hash text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, map_id, op_key)
);

alter table public.evidence_persist_ops enable row level security;

drop policy if exists evidence_persist_ops_select_own on public.evidence_persist_ops;
create policy evidence_persist_ops_select_own on public.evidence_persist_ops
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists evidence_persist_ops_insert_own on public.evidence_persist_ops;
create policy evidence_persist_ops_insert_own on public.evidence_persist_ops
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists evidence_persist_ops_update_own on public.evidence_persist_ops;
create policy evidence_persist_ops_update_own on public.evidence_persist_ops
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

revoke all on public.evidence_persist_ops from anon, public;
grant select, insert, update on public.evidence_persist_ops to authenticated;

/**
 * Idempotent transactional persist of the full evidence graph.
 * p_nodes / p_links are jsonb arrays. Fails closed — no partial complete status.
 */
create or replace function public.persist_evidence_graph(
  p_map_id text,
  p_op_key text,
  p_source_id uuid,
  p_source_version_id uuid,
  p_content_hash text,
  p_schema_version text,
  p_nodes jsonb,
  p_links jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_owner uuid := auth.uid();
  v_map_owner uuid;
  v_op public.evidence_persist_ops%rowtype;
  v_node jsonb;
  v_link jsonb;
  v_claim_id text;
  v_node_id uuid;
  v_seg_id uuid;
  v_chunk text;
  v_existing_text text;
  v_existing_status text;
  v_existing_chunk text;
  v_existing_rel text;
  v_existing_ver text;
  v_claim_to_node jsonb := '{}'::jsonb;
begin
  if v_owner is null then
    raise exception 'persist_evidence_graph: auth required';
  end if;

  select owner_id into v_map_owner from public.maps where id = p_map_id;
  if v_map_owner is null or v_map_owner is distinct from v_owner then
    raise exception 'persist_evidence_graph: map not owned by caller';
  end if;

  if p_links is not null and jsonb_typeof(p_links) = 'array' and jsonb_array_length(p_links) > 0 then
    if p_source_version_id is null then
      raise exception 'persist_evidence_graph: source_version_id required when links present';
    end if;
  end if;

  select * into v_op
  from public.evidence_persist_ops
  where owner_id = v_owner and map_id = p_map_id and op_key = p_op_key;

  if v_op.id is not null and v_op.status = 'complete' then
    return jsonb_build_object('ok', true, 'status', 'complete', 'idempotent', true);
  end if;

  if v_op.id is null then
    insert into public.evidence_persist_ops (owner_id, map_id, op_key, status, content_hash)
    values (v_owner, p_map_id, p_op_key, 'pending', p_content_hash)
    returning * into v_op;
  else
    update public.evidence_persist_ops
    set status = 'pending', error_code = null, updated_at = now()
    where id = v_op.id;
  end if;

  for v_node in select * from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb))
  loop
    v_claim_id := v_node->>'claim_id';
    select claim_text, presentation_status into v_existing_text, v_existing_status
    from public.content_nodes
    where owner_id = v_owner and map_id = p_map_id and claim_id = v_claim_id;

    if found then
      if v_existing_text is distinct from (v_node->>'claim_text')
         or v_existing_status is distinct from (v_node->>'presentation_status') then
        update public.evidence_persist_ops
        set status = 'failed', error_code = 'EVIDENCE_IDEMPOTENCY_CONFLICT', updated_at = now()
        where id = v_op.id;
        raise exception 'persist_evidence_graph: claim conflict';
      end if;
      select id into v_node_id from public.content_nodes
      where owner_id = v_owner and map_id = p_map_id and claim_id = v_claim_id;
    else
      insert into public.content_nodes (
        owner_id, map_id, source_id, source_version_id, claim_id, unit_id,
        claim_text, claim_type, criticality, epistemic_status, presentation_status,
        abstention_codes, schema_version, content_hash
      ) values (
        v_owner, p_map_id, p_source_id, p_source_version_id, v_claim_id,
        nullif(v_node->>'unit_id', ''),
        v_node->>'claim_text',
        v_node->>'claim_type',
        v_node->>'criticality',
        v_node->>'epistemic_status',
        v_node->>'presentation_status',
        coalesce(v_node->'abstention_codes', '[]'::jsonb),
        p_schema_version,
        p_content_hash
      ) returning id into v_node_id;
    end if;
    v_claim_to_node := v_claim_to_node || jsonb_build_object(v_claim_id, v_node_id);
  end loop;

  for v_link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    v_claim_id := v_link->>'content_node_claim_id';
    v_node_id := nullif(v_claim_to_node->>v_claim_id, '')::uuid;
    if v_node_id is null then
      update public.evidence_persist_ops
      set status = 'failed', error_code = 'EVIDENCE_NODE_MISSING', updated_at = now()
      where id = v_op.id;
      raise exception 'persist_evidence_graph: content node missing for link';
    end if;

    v_chunk := v_link->>'chunk_id';
    select id into v_seg_id
    from public.source_segments
    where source_version_id = p_source_version_id and chunk_id = v_chunk;
    if v_seg_id is null then
      update public.evidence_persist_ops
      set status = 'failed', error_code = 'EVIDENCE_CHUNK_UNBOUND', updated_at = now()
      where id = v_op.id;
      raise exception 'persist_evidence_graph: chunk unbound';
    end if;

    select chunk_id, relation, verifier_status
      into v_existing_chunk, v_existing_rel, v_existing_ver
    from public.evidence_links
    where owner_id = v_owner and map_id = p_map_id and link_key = (v_link->>'link_key');

    if found then
      if v_existing_chunk is distinct from v_chunk
         or v_existing_rel is distinct from (v_link->>'relation')
         or v_existing_ver is distinct from (v_link->>'verifier_status') then
        update public.evidence_persist_ops
        set status = 'failed', error_code = 'EVIDENCE_IDEMPOTENCY_CONFLICT', updated_at = now()
        where id = v_op.id;
        raise exception 'persist_evidence_graph: link conflict';
      end if;
    else
      insert into public.evidence_links (
        owner_id, map_id, content_node_id, source_id, source_version_id,
        segment_id, chunk_id, relation, verifier_status, epistemic_status,
        confidence, verifier_version, check_codes, abstention_codes, link_key
      ) values (
        v_owner, p_map_id, v_node_id, p_source_id, p_source_version_id,
        v_seg_id, v_chunk,
        v_link->>'relation',
        v_link->>'verifier_status',
        v_link->>'epistemic_status',
        null,
        v_link->>'verifier_version',
        coalesce(v_link->'check_codes', '[]'::jsonb),
        coalesce(v_link->'abstention_codes', '[]'::jsonb),
        v_link->>'link_key'
      );
    end if;
  end loop;

  update public.evidence_persist_ops
  set status = 'complete', error_code = null, updated_at = now()
  where id = v_op.id;

  return jsonb_build_object('ok', true, 'status', 'complete', 'idempotent', false);
exception
  when others then
    update public.evidence_persist_ops
    set status = 'failed',
        error_code = coalesce(error_code, 'EVIDENCE_PERSIST_FAILED'),
        updated_at = now()
    where owner_id = v_owner and map_id = p_map_id and op_key = p_op_key;
    raise;
end;
$$;

revoke all on function public.persist_evidence_graph(text, text, uuid, uuid, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.persist_evidence_graph(text, text, uuid, uuid, text, text, jsonb, jsonb) to authenticated;
