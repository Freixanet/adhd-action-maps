-- S05: content_nodes + evidence_links
-- maps.id is text — map_id must be text (not uuid).
-- verified = source supports representation; NOT world-truth.

create table if not exists public.content_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null references public.maps (id) on delete cascade,
  source_id uuid references public.sources (id) on delete set null,
  source_version_id uuid references public.source_versions (id) on delete set null,
  claim_id text not null,
  unit_id text,
  claim_text text not null,
  claim_type text not null,
  criticality text not null check (criticality in ('critical', 'important', 'auxiliary')),
  epistemic_status text not null,
  presentation_status text not null,
  abstention_codes jsonb not null default '[]'::jsonb,
  schema_version text not null,
  content_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, map_id, claim_id)
);

create table if not exists public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null references public.maps (id) on delete cascade,
  content_node_id uuid not null references public.content_nodes (id) on delete cascade,
  source_id uuid references public.sources (id) on delete set null,
  source_version_id uuid references public.source_versions (id) on delete set null,
  -- Real source_segments.id (UUID). May arrive null; trigger resolves from chunk_id.
  -- Never accept a free-form invented segment string.
  segment_id uuid references public.source_segments (id) on delete cascade,
  chunk_id text not null,
  relation text not null check (relation in ('supports', 'contradicts', 'qualifies', 'illustrates')),
  verifier_status text not null check (verifier_status in ('pending', 'verified', 'rejected', 'uncertain')),
  epistemic_status text not null,
  confidence numeric null,
  verifier_version text not null,
  check_codes jsonb not null default '[]'::jsonb,
  abstention_codes jsonb not null default '[]'::jsonb,
  link_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, map_id, link_key)
);

-- Fail-closed integrity for content_nodes (INSERT + UPDATE).
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
    -- Normalize source_id from version when omitted.
    if new.source_id is null then
      new.source_id := v_version_source;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists content_nodes_parent_guard on public.content_nodes;
create trigger content_nodes_parent_guard
  before insert or update on public.content_nodes
  for each row execute function public.content_nodes_enforce_parents();

-- Fail-closed integrity for evidence_links (INSERT + UPDATE).
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

  -- Require source version to resolve an exact segment by chunk_id.
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

  select * into v_seg
  from public.source_segments
  where id = new.segment_id;

  if v_seg.id is null then
    -- Resolve by chunk_id within the version (unambiguous).
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

drop trigger if exists evidence_links_owner_guard on public.evidence_links;
drop trigger if exists evidence_links_parent_guard on public.evidence_links;
create trigger evidence_links_parent_guard
  before insert or update on public.evidence_links
  for each row execute function public.evidence_links_enforce_parents();

alter table public.content_nodes enable row level security;
alter table public.evidence_links enable row level security;

drop policy if exists content_nodes_select_own on public.content_nodes;
create policy content_nodes_select_own on public.content_nodes
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists content_nodes_insert_own on public.content_nodes;
create policy content_nodes_insert_own on public.content_nodes
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists content_nodes_update_own on public.content_nodes;
create policy content_nodes_update_own on public.content_nodes
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists content_nodes_delete_own on public.content_nodes;
create policy content_nodes_delete_own on public.content_nodes
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists evidence_links_select_own on public.evidence_links;
create policy evidence_links_select_own on public.evidence_links
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists evidence_links_insert_own on public.evidence_links;
create policy evidence_links_insert_own on public.evidence_links
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists evidence_links_update_own on public.evidence_links;
create policy evidence_links_update_own on public.evidence_links
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists evidence_links_delete_own on public.evidence_links;
create policy evidence_links_delete_own on public.evidence_links
  for delete to authenticated
  using (owner_id = auth.uid());

-- Explicit anon denial (no grants + revoke).
revoke all on public.content_nodes from anon, public;
revoke all on public.evidence_links from anon, public;
grant select, insert, update, delete on public.content_nodes to authenticated;
grant select, insert, update, delete on public.evidence_links to authenticated;

create index if not exists content_nodes_owner_map_idx on public.content_nodes (owner_id, map_id);
create index if not exists evidence_links_owner_map_idx on public.evidence_links (owner_id, map_id);
create index if not exists evidence_links_chunk_idx on public.evidence_links (chunk_id);
create index if not exists evidence_links_segment_idx on public.evidence_links (segment_id);
