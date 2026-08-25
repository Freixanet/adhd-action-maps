-- S02: private sources persistence (additive, idempotent).
-- Justifies tables needed for S03 pasted-text + file upload ownership:
--   sources          — identity + ownership of a source
--   source_versions  — immutable content snapshots (text and/or storage path)
--   source_segments  — prepared for S03 segmentation with FK integrity to owner sources
-- Does NOT create the full future Núcleo schema.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in (
      'pasted_text',
      'web_article',
      'pdf',
      'epub',
      'text_file',
      'docx',
      'youtube_transcript',
      'x_content',
      'image',
      'video'
    )
  ),
  title text,
  original_url text,
  mime_type text,
  content_hash text not null,
  status text not null default 'received' check (
    status in (
      'received',
      'validating',
      'needs_input',
      'extracting',
      'ready',
      'partially_ready',
      'failed',
      'deleting',
      'deleted'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sources_owner_updated_idx
  on public.sources (owner_id, updated_at desc);

alter table public.sources enable row level security;

drop policy if exists "sources_select_own" on public.sources;
drop policy if exists "sources_insert_own" on public.sources;
drop policy if exists "sources_update_own" on public.sources;
drop policy if exists "sources_delete_own" on public.sources;

create policy "sources_select_own"
  on public.sources for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "sources_insert_own"
  on public.sources for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "sources_update_own"
  on public.sources for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "sources_delete_own"
  on public.sources for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop trigger if exists set_sources_updated_at on public.sources;
create trigger set_sources_updated_at before update on public.sources
for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- source_versions
-- ---------------------------------------------------------------------------
create table if not exists public.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version >= 1),
  raw_text text,
  storage_bucket text,
  storage_path text,
  byte_size integer check (byte_size is null or byte_size >= 0),
  mime_type text,
  created_at timestamptz not null default now(),
  unique (source_id, version),
  constraint source_versions_owner_matches_source
    check (owner_id is not null)
);

create index if not exists source_versions_source_idx
  on public.source_versions (source_id, version desc);

create index if not exists source_versions_owner_idx
  on public.source_versions (owner_id);

alter table public.source_versions enable row level security;

drop policy if exists "source_versions_select_own" on public.source_versions;
drop policy if exists "source_versions_insert_own" on public.source_versions;
drop policy if exists "source_versions_update_own" on public.source_versions;
drop policy if exists "source_versions_delete_own" on public.source_versions;

create policy "source_versions_select_own"
  on public.source_versions for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "source_versions_insert_own"
  on public.source_versions for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.sources s
      where s.id = source_id and s.owner_id = auth.uid()
    )
  );

create policy "source_versions_update_own"
  on public.source_versions for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.sources s
      where s.id = source_id and s.owner_id = auth.uid()
    )
  );

create policy "source_versions_delete_own"
  on public.source_versions for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Prevent transferring a version to another owner's source via UPDATE.
create or replace function public.enforce_source_child_owner()
returns trigger
language plpgsql
security invoker
as $$
declare
  parent_owner uuid;
begin
  select owner_id into parent_owner from public.sources where id = new.source_id;
  if parent_owner is null then
    raise exception 'source_versions: parent source missing';
  end if;
  if new.owner_id is distinct from parent_owner then
    raise exception 'source_versions: owner_id must match parent source owner';
  end if;
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'source_versions: owner_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_source_versions_owner on public.source_versions;
create trigger enforce_source_versions_owner
before insert or update on public.source_versions
for each row execute procedure public.enforce_source_child_owner();

-- ---------------------------------------------------------------------------
-- source_segments (S03 prep — FK integrity only; no pipeline wiring here)
-- ---------------------------------------------------------------------------
create table if not exists public.source_segments (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  source_version_id uuid not null references public.source_versions (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  kind text not null check (
    kind in ('heading', 'paragraph', 'list', 'table', 'caption', 'note')
  ),
  raw_text text not null,
  normalized_text text not null,
  anchor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_version_id, ordinal)
);

create index if not exists source_segments_owner_idx
  on public.source_segments (owner_id);

create index if not exists source_segments_source_idx
  on public.source_segments (source_id);

alter table public.source_segments enable row level security;

drop policy if exists "source_segments_select_own" on public.source_segments;
drop policy if exists "source_segments_insert_own" on public.source_segments;
drop policy if exists "source_segments_update_own" on public.source_segments;
drop policy if exists "source_segments_delete_own" on public.source_segments;

create policy "source_segments_select_own"
  on public.source_segments for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "source_segments_insert_own"
  on public.source_segments for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.sources s
      where s.id = source_id and s.owner_id = auth.uid()
    )
    and exists (
      select 1 from public.source_versions v
      where v.id = source_version_id and v.owner_id = auth.uid() and v.source_id = source_id
    )
  );

create policy "source_segments_update_own"
  on public.source_segments for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.sources s
      where s.id = source_id and s.owner_id = auth.uid()
    )
  );

create policy "source_segments_delete_own"
  on public.source_segments for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.enforce_source_segment_owner()
returns trigger
language plpgsql
security invoker
as $$
declare
  parent_owner uuid;
  version_source uuid;
begin
  select owner_id into parent_owner from public.sources where id = new.source_id;
  if parent_owner is null then
    raise exception 'source_segments: parent source missing';
  end if;
  if new.owner_id is distinct from parent_owner then
    raise exception 'source_segments: owner_id must match parent source owner';
  end if;
  select source_id into version_source from public.source_versions where id = new.source_version_id;
  if version_source is distinct from new.source_id then
    raise exception 'source_segments: version must belong to source';
  end if;
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'source_segments: owner_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_source_segments_owner on public.source_segments;
create trigger enforce_source_segments_owner
before insert or update on public.source_segments
for each row execute procedure public.enforce_source_segment_owner();

-- Immutable owner_id on sources
create or replace function public.enforce_sources_owner_immutable()
returns trigger
language plpgsql
security invoker
as $$
begin
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'sources: owner_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_sources_owner_immutable on public.sources;
create trigger enforce_sources_owner_immutable
before update on public.sources
for each row execute procedure public.enforce_sources_owner_immutable();

-- Anon has no grants beyond defaults; RLS with no policies for anon = deny.
revoke all on public.sources from anon;
revoke all on public.source_versions from anon;
revoke all on public.source_segments from anon;
