-- S05: exact graph digest idempotency + atomic failure (no durable failed row).
-- Contract: on any error the whole transaction rolls back — no partial nodes/links,
-- and no evidence_persist_ops row is left (including no 'failed' ledger entry).
-- Idempotent only when server-recomputed graph_digest matches a complete op.

create extension if not exists pgcrypto;

alter table public.evidence_persist_ops
  add column if not exists graph_digest text;

alter table public.evidence_persist_ops
  add column if not exists prompt_version text;

alter table public.evidence_persist_ops
  add column if not exists verifier_version text;

alter table public.evidence_persist_ops
  add column if not exists compiler_version text;

alter table public.evidence_persist_ops
  add column if not exists model_route text;

alter table public.evidence_persist_ops
  add column if not exists source_id uuid;

alter table public.evidence_persist_ops
  add column if not exists source_version_id uuid;

create unique index if not exists evidence_persist_ops_owner_map_digest_uidx
  on public.evidence_persist_ops (owner_id, map_id, graph_digest);

create or replace function public.evidence_escape_canon(p text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(coalesce(p, ''), E'\\', E'\\\\'), E'\n', E'\\n'), '|', E'\\|');
$$;

create or replace function public.evidence_sorted_codes(p jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    (select string_agg(value, ',' order by value)
     from jsonb_array_elements_text(coalesce(p, '[]'::jsonb))),
    ''
  );
$$;

create or replace function public.evidence_graph_canonical(
  p_map_id text,
  p_source_id uuid,
  p_source_version_id uuid,
  p_content_hash text,
  p_schema_version text,
  p_prompt_version text,
  p_verifier_version text,
  p_compiler_version text,
  p_model_route text,
  p_nodes jsonb,
  p_links jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  v text := '';
  v_node jsonb;
  v_link jsonb;
begin
  v := v || 'mapId=' || public.evidence_escape_canon(p_map_id) || E'\n';
  v := v || 'sourceId=' || public.evidence_escape_canon(p_source_id::text) || E'\n';
  v := v || 'sourceVersionId=' || public.evidence_escape_canon(p_source_version_id::text) || E'\n';
  v := v || 'contentHash=' || public.evidence_escape_canon(p_content_hash) || E'\n';
  v := v || 'schemaVersion=' || public.evidence_escape_canon(p_schema_version) || E'\n';
  v := v || 'promptVersion=' || public.evidence_escape_canon(p_prompt_version) || E'\n';
  v := v || 'verifierVersion=' || public.evidence_escape_canon(p_verifier_version) || E'\n';
  v := v || 'compilerVersion=' || public.evidence_escape_canon(p_compiler_version) || E'\n';
  v := v || 'modelRoute=' || public.evidence_escape_canon(p_model_route) || E'\n';

  for v_node in
    select value
    from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb))
    order by value->>'claim_id'
  loop
    v := v || 'NODE|'
      || public.evidence_escape_canon(v_node->>'claim_id') || '|'
      || public.evidence_escape_canon(nullif(v_node->>'unit_id', '')) || '|'
      || public.evidence_escape_canon(v_node->>'claim_text') || '|'
      || public.evidence_escape_canon(v_node->>'claim_type') || '|'
      || public.evidence_escape_canon(v_node->>'criticality') || '|'
      || public.evidence_escape_canon(v_node->>'epistemic_status') || '|'
      || public.evidence_escape_canon(v_node->>'presentation_status') || '|'
      || public.evidence_escape_canon(public.evidence_sorted_codes(v_node->'abstention_codes'))
      || E'\n';
  end loop;

  for v_link in
    select value
    from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
    order by value->>'link_key'
  loop
    v := v || 'LINK|'
      || public.evidence_escape_canon(v_link->>'link_key') || '|'
      || public.evidence_escape_canon(v_link->>'content_node_claim_id') || '|'
      || public.evidence_escape_canon(v_link->>'chunk_id') || '|'
      || public.evidence_escape_canon(v_link->>'relation') || '|'
      || public.evidence_escape_canon(v_link->>'verifier_status') || '|'
      || public.evidence_escape_canon(v_link->>'epistemic_status') || '|'
      || public.evidence_escape_canon(v_link->>'verifier_version') || '|'
      || public.evidence_escape_canon(public.evidence_sorted_codes(v_link->'check_codes')) || '|'
      || public.evidence_escape_canon(public.evidence_sorted_codes(v_link->'abstention_codes'))
      || E'\n';
  end loop;

  return v;
end;
$$;

create or replace function public.persist_evidence_graph(
  p_map_id text,
  p_op_key text,
  p_source_id uuid,
  p_source_version_id uuid,
  p_content_hash text,
  p_schema_version text,
  p_prompt_version text,
  p_verifier_version text,
  p_compiler_version text,
  p_model_route text,
  p_nodes jsonb,
  p_links jsonb,
  p_client_digest text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_owner uuid := auth.uid();
  v_map_owner uuid;
  v_op public.evidence_persist_ops%rowtype;
  v_other public.evidence_persist_ops%rowtype;
  v_node jsonb;
  v_link jsonb;
  v_claim_id text;
  v_node_id uuid;
  v_seg_id uuid;
  v_chunk text;
  v_claim_to_node jsonb := '{}'::jsonb;
  v_digest text;
  v_canon text;
  v_existing record;
begin
  if v_owner is null then
    raise exception 'persist_evidence_graph: auth required' using errcode = 'P0001';
  end if;

  select owner_id into v_map_owner from public.maps where id = p_map_id;
  if v_map_owner is null or v_map_owner is distinct from v_owner then
    raise exception 'persist_evidence_graph: map not owned by caller' using errcode = 'P0001';
  end if;

  if p_links is not null and jsonb_typeof(p_links) = 'array' and jsonb_array_length(p_links) > 0 then
    if p_source_version_id is null then
      raise exception 'persist_evidence_graph: source_version_id required when links present'
        using errcode = 'P0001';
    end if;
  end if;

  v_canon := public.evidence_graph_canonical(
    p_map_id, p_source_id, p_source_version_id, p_content_hash,
    p_schema_version, p_prompt_version, p_verifier_version,
    p_compiler_version, p_model_route, p_nodes, p_links
  );
  v_digest := encode(digest(convert_to(v_canon, 'UTF8'), 'sha256'), 'hex');

  -- Optional client digest: advisory only; mismatch rejects (do not trust client alone).
  if p_client_digest is not null
     and length(p_client_digest) > 0
     and p_client_digest is distinct from v_digest then
    raise exception 'persist_evidence_graph: EVIDENCE_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  select * into v_op
  from public.evidence_persist_ops
  where owner_id = v_owner and map_id = p_map_id and graph_digest = v_digest
  limit 1;

  if v_op.id is not null and v_op.status = 'complete' then
    -- Exact match: re-verify every immutable node/link field against payload.
    for v_node in select * from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb))
    loop
      v_claim_id := v_node->>'claim_id';
      select * into v_existing
      from public.content_nodes
      where owner_id = v_owner and map_id = p_map_id and claim_id = v_claim_id;
      if not found
         or v_existing.claim_text is distinct from (v_node->>'claim_text')
         or v_existing.presentation_status is distinct from (v_node->>'presentation_status')
         or v_existing.claim_type is distinct from (v_node->>'claim_type')
         or v_existing.criticality is distinct from (v_node->>'criticality')
         or v_existing.epistemic_status is distinct from (v_node->>'epistemic_status')
         or coalesce(v_existing.unit_id, '') is distinct from coalesce(nullif(v_node->>'unit_id', ''), '')
         or v_existing.schema_version is distinct from p_schema_version
         or v_existing.content_hash is distinct from p_content_hash
         or v_existing.source_id is distinct from p_source_id
         or v_existing.source_version_id is distinct from p_source_version_id
         or v_existing.abstention_codes is distinct from coalesce(v_node->'abstention_codes', '[]'::jsonb)
      then
        raise exception 'persist_evidence_graph: EVIDENCE_IDEMPOTENCY_CONFLICT'
          using errcode = 'P0001';
      end if;
    end loop;
    for v_link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
    loop
      select * into v_existing
      from public.evidence_links
      where owner_id = v_owner and map_id = p_map_id and link_key = (v_link->>'link_key');
      v_chunk := v_link->>'chunk_id';
      select id into v_seg_id
      from public.source_segments
      where source_version_id = p_source_version_id and chunk_id = v_chunk;
      if not found
         or v_existing.chunk_id is distinct from v_chunk
         or v_existing.relation is distinct from (v_link->>'relation')
         or v_existing.verifier_status is distinct from (v_link->>'verifier_status')
         or v_existing.epistemic_status is distinct from (v_link->>'epistemic_status')
         or v_existing.verifier_version is distinct from (v_link->>'verifier_version')
         or v_existing.source_id is distinct from p_source_id
         or v_existing.source_version_id is distinct from p_source_version_id
         or v_existing.segment_id is distinct from v_seg_id
         or v_existing.check_codes is distinct from coalesce(v_link->'check_codes', '[]'::jsonb)
         or v_existing.abstention_codes is distinct from coalesce(v_link->'abstention_codes', '[]'::jsonb)
      then
        raise exception 'persist_evidence_graph: EVIDENCE_IDEMPOTENCY_CONFLICT'
          using errcode = 'P0001';
      end if;
    end loop;
    return jsonb_build_object(
      'ok', true,
      'status', 'complete',
      'idempotent', true,
      'graph_digest', v_digest
    );
  end if;

  select * into v_other
  from public.evidence_persist_ops
  where owner_id = v_owner and map_id = p_map_id and status = 'complete'
    and (graph_digest is distinct from v_digest)
  limit 1;
  if v_other.id is not null then
    raise exception 'persist_evidence_graph: EVIDENCE_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  insert into public.evidence_persist_ops (
    owner_id, map_id, op_key, status, content_hash, graph_digest,
    prompt_version, verifier_version, compiler_version, model_route,
    source_id, source_version_id
  ) values (
    v_owner, p_map_id, coalesce(nullif(p_op_key, ''), v_digest), 'pending', p_content_hash, v_digest,
    p_prompt_version, p_verifier_version, p_compiler_version, p_model_route,
    p_source_id, p_source_version_id
  )
  on conflict (owner_id, map_id, graph_digest) do update
    set status = 'pending', updated_at = now()
  returning * into v_op;

  for v_node in select * from jsonb_array_elements(coalesce(p_nodes, '[]'::jsonb))
  loop
    v_claim_id := v_node->>'claim_id';
    select * into v_existing
    from public.content_nodes
    where owner_id = v_owner and map_id = p_map_id and claim_id = v_claim_id;

    if found then
      if v_existing.claim_text is distinct from (v_node->>'claim_text')
         or v_existing.presentation_status is distinct from (v_node->>'presentation_status')
         or v_existing.claim_type is distinct from (v_node->>'claim_type')
         or v_existing.criticality is distinct from (v_node->>'criticality')
         or v_existing.epistemic_status is distinct from (v_node->>'epistemic_status')
         or coalesce(v_existing.unit_id, '') is distinct from coalesce(nullif(v_node->>'unit_id', ''), '')
         or v_existing.schema_version is distinct from p_schema_version
         or v_existing.content_hash is distinct from p_content_hash
         or v_existing.source_id is distinct from p_source_id
         or v_existing.source_version_id is distinct from p_source_version_id
         or v_existing.abstention_codes is distinct from coalesce(v_node->'abstention_codes', '[]'::jsonb)
      then
        raise exception 'persist_evidence_graph: EVIDENCE_IDEMPOTENCY_CONFLICT'
          using errcode = 'P0001';
      end if;
      v_node_id := v_existing.id;
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
      raise exception 'persist_evidence_graph: content node missing for link'
        using errcode = 'P0001';
    end if;

    v_chunk := v_link->>'chunk_id';
    select id into v_seg_id
    from public.source_segments
    where source_version_id = p_source_version_id and chunk_id = v_chunk;
    if v_seg_id is null then
      raise exception 'persist_evidence_graph: chunk unbound' using errcode = 'P0001';
    end if;

    select * into v_existing
    from public.evidence_links
    where owner_id = v_owner and map_id = p_map_id and link_key = (v_link->>'link_key');

    if found then
      if v_existing.chunk_id is distinct from v_chunk
         or v_existing.relation is distinct from (v_link->>'relation')
         or v_existing.verifier_status is distinct from (v_link->>'verifier_status')
         or v_existing.epistemic_status is distinct from (v_link->>'epistemic_status')
         or v_existing.verifier_version is distinct from (v_link->>'verifier_version')
         or v_existing.content_node_id is distinct from v_node_id
         or v_existing.source_id is distinct from p_source_id
         or v_existing.source_version_id is distinct from p_source_version_id
         or v_existing.segment_id is distinct from v_seg_id
         or v_existing.check_codes is distinct from coalesce(v_link->'check_codes', '[]'::jsonb)
         or v_existing.abstention_codes is distinct from coalesce(v_link->'abstention_codes', '[]'::jsonb)
      then
        raise exception 'persist_evidence_graph: EVIDENCE_IDEMPOTENCY_CONFLICT'
          using errcode = 'P0001';
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

  return jsonb_build_object(
    'ok', true,
    'status', 'complete',
    'idempotent', false,
    'graph_digest', v_digest
  );
end;
$$;

-- Old overloads (count-based / fewer pin args)
drop function if exists public.persist_evidence_graph(text, text, uuid, uuid, text, text, jsonb, jsonb);
drop function if exists public.persist_evidence_graph(
  text, text, uuid, uuid, text, text, text, text, text, text, jsonb, jsonb
);

revoke all on function public.persist_evidence_graph(
  text, text, uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.persist_evidence_graph(
  text, text, uuid, uuid, text, text, text, text, text, text, jsonb, jsonb, text
) to authenticated;

comment on function public.persist_evidence_graph is
  'Atomic evidence graph persist. Failures roll back entirely (no durable failed ledger row). Idempotent only on exact server graph_digest match.';
