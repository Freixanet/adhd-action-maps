-- S07 — server-owned semantic progress projection.
--
-- maps.session remains the complete resume source. This table is an atomic,
-- owner-scoped projection for library queries and integrity checks.

create table if not exists public.nucleus_progress (
  map_id text primary key references public.maps (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  schema_version text not null,
  state text not null check (
    state in (
      'to_start',
      'in_progress',
      'action_pending',
      'action_active',
      'completed',
      'blocked'
    )
  ),
  surface text not null check (
    surface in ('overview', 'reading_step', 'full_view', 'application')
  ),
  current_step integer not null check (current_step >= 0),
  total_steps integer not null check (total_steps >= 0),
  current_step_id text,
  application_state text not null check (
    application_state in ('none', 'pending', 'active', 'reviewed', 'blocked')
  ),
  plan_id text,
  action_id text,
  review_id text,
  started_at timestamptz,
  saved_at_ms bigint not null check (saved_at_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_step <= total_steps),
  check ((current_step = 0 and current_step_id is null) or current_step > 0)
);

create index if not exists nucleus_progress_owner_state_updated_idx
  on public.nucleus_progress (owner_id, state, updated_at desc);

alter table public.nucleus_progress enable row level security;

drop policy if exists "nucleus progress readable by owner" on public.nucleus_progress;
create policy "nucleus progress readable by owner"
  on public.nucleus_progress
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.nucleus_progress from anon, authenticated;
grant select on table public.nucleus_progress to authenticated;

create or replace function public.s07_project_nucleus_progress(p_map public.maps)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session jsonb := p_map.session;
  v_data jsonb;
  v_steps jsonb;
  v_progress jsonb;
  v_application jsonb;
  v_plan jsonb;
  v_review jsonb;
  v_total integer := 0;
  v_step integer := 0;
  v_step_id text := null;
  v_is_complete boolean := false;
  v_view_all boolean := false;
  v_layer0_passed boolean := false;
  v_application_state text := 'none';
  v_state text := 'to_start';
  v_surface text := 'overview';
  v_plan_id text := null;
  v_action_id text := null;
  v_review_id text := null;
  v_started_at timestamptz := null;
  v_saved_at_ms bigint;
begin
  if jsonb_typeof(v_session) <> 'object' then
    raise exception 'S07_SESSION_INVALID';
  end if;

  v_data := v_session -> 'data';
  if jsonb_typeof(v_data) <> 'object' then
    raise exception 'S07_SESSION_DATA_INVALID';
  end if;

  v_steps := v_data -> 'steps';
  if jsonb_typeof(v_steps) = 'array' then
    v_total := jsonb_array_length(v_steps);
  end if;

  if jsonb_typeof(v_session -> 'currentStep') = 'number'
    and (v_session ->> 'currentStep') ~ '^[0-9]+$'
  then
    v_step := least((v_session ->> 'currentStep')::integer, v_total);
  end if;

  if jsonb_typeof(v_session -> 'isComplete') = 'boolean' then
    v_is_complete := (v_session ->> 'isComplete')::boolean;
  end if;
  if jsonb_typeof(v_session -> 'viewAll') = 'boolean' then
    v_view_all := (v_session ->> 'viewAll')::boolean;
  end if;
  if jsonb_typeof(v_session -> 'layer0Passed') = 'boolean' then
    v_layer0_passed := (v_session ->> 'layer0Passed')::boolean;
  end if;
  v_layer0_passed := v_layer0_passed or v_step > 0 or v_is_complete;

  if v_step > 0 then
    v_step_id := nullif(btrim(v_steps -> (v_step - 1) ->> 'id'), '');
  end if;

  v_application := v_data -> 'application';
  if jsonb_typeof(v_application) = 'object' then
    v_plan := v_application -> 'plan';
    v_review := v_application -> 'review';
    if jsonb_typeof(v_plan) = 'object' then
      v_plan_id := nullif(btrim(v_plan ->> 'id'), '');
      v_action_id := nullif(btrim(v_plan -> 'action' ->> 'id'), '');
      if nullif(btrim(v_plan ->> 'startedAt'), '') is not null then
        begin
          v_started_at := (v_plan ->> 'startedAt')::timestamptz;
        exception when others then
          raise exception 'S07_APPLICATION_STARTED_AT_INVALID';
        end;
      end if;
    end if;
    if jsonb_typeof(v_review) = 'object' then
      v_review_id := nullif(btrim(v_review ->> 'id'), '');
    end if;

    if v_review_id is not null then
      v_application_state := 'reviewed';
    elsif (v_application ->> 'status') in ('needs_context', 'abstained', 'invalid')
      or (v_plan ->> 'status') in ('needs_context', 'abstained', 'abandoned')
    then
      v_application_state := 'blocked';
    elsif v_started_at is not null or (v_plan ->> 'status') = 'in_progress' then
      v_application_state := 'active';
    elsif v_action_id is not null then
      v_application_state := 'pending';
    end if;
  end if;

  if v_is_complete or v_application_state = 'reviewed' then
    v_state := 'completed';
  elsif v_application_state = 'active' then
    v_state := 'action_active';
  elsif v_application_state = 'pending' then
    v_state := 'action_pending';
  elsif v_application_state = 'blocked' then
    v_state := 'blocked';
  elsif v_step > 0 or v_view_all or v_layer0_passed then
    v_state := 'in_progress';
  end if;

  if v_application_state <> 'none' then
    v_surface := 'application';
  elsif v_view_all then
    v_surface := 'full_view';
  elsif v_step > 0 then
    v_surface := 'reading_step';
  end if;

  v_progress := v_session -> 'progress';
  if jsonb_typeof(v_progress) = 'object' then
    if v_progress ->> 'schemaVersion' <> 's07.progress.v1'
      or v_progress ->> 'state' <> v_state
      or v_progress ->> 'surface' <> v_surface
      or jsonb_typeof(v_progress -> 'currentStep') <> 'number'
      or (v_progress ->> 'currentStep') !~ '^[0-9]+$'
      or (v_progress ->> 'currentStep')::integer <> v_step
      or jsonb_typeof(v_progress -> 'totalSteps') <> 'number'
      or (v_progress ->> 'totalSteps') !~ '^[0-9]+$'
      or (v_progress ->> 'totalSteps')::integer <> v_total
      or nullif(btrim(v_progress ->> 'currentStepId'), '') is distinct from v_step_id
      or jsonb_typeof(v_progress -> 'layer0Passed') <> 'boolean'
      or (v_progress ->> 'layer0Passed')::boolean <> v_layer0_passed
      or jsonb_typeof(v_progress -> 'viewAll') <> 'boolean'
      or (v_progress ->> 'viewAll')::boolean <> v_view_all
      or v_progress -> 'application' ->> 'state' <> v_application_state
    then
      raise exception 'S07_PROGRESS_SESSION_MISMATCH';
    end if;
    if jsonb_typeof(v_progress -> 'savedAt') <> 'number'
      or (v_progress ->> 'savedAt') !~ '^[0-9]+$'
    then
      raise exception 'S07_PROGRESS_SAVED_AT_INVALID';
    end if;
    v_saved_at_ms := (v_progress ->> 'savedAt')::bigint;
  else
    -- Legacy maps remain readable. The server projection is authoritative until
    -- the next S07 client write adds the versioned snapshot.
    v_saved_at_ms := floor(extract(epoch from p_map.updated_at) * 1000)::bigint;
  end if;

  insert into public.nucleus_progress (
    map_id,
    owner_id,
    schema_version,
    state,
    surface,
    current_step,
    total_steps,
    current_step_id,
    application_state,
    plan_id,
    action_id,
    review_id,
    started_at,
    saved_at_ms,
    updated_at
  )
  values (
    p_map.id,
    p_map.owner_id,
    's07.progress.v1',
    v_state,
    v_surface,
    v_step,
    v_total,
    v_step_id,
    v_application_state,
    v_plan_id,
    v_action_id,
    v_review_id,
    v_started_at,
    v_saved_at_ms,
    p_map.updated_at
  )
  on conflict (map_id) do update set
    owner_id = excluded.owner_id,
    schema_version = excluded.schema_version,
    state = excluded.state,
    surface = excluded.surface,
    current_step = excluded.current_step,
    total_steps = excluded.total_steps,
    current_step_id = excluded.current_step_id,
    application_state = excluded.application_state,
    plan_id = excluded.plan_id,
    action_id = excluded.action_id,
    review_id = excluded.review_id,
    started_at = excluded.started_at,
    saved_at_ms = excluded.saved_at_ms,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.s07_project_nucleus_progress(public.maps) from public;

create or replace function public.s07_sync_nucleus_progress()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.s07_project_nucleus_progress(new);
  return new;
end;
$$;

revoke all on function public.s07_sync_nucleus_progress() from public;

drop trigger if exists sync_nucleus_progress_from_map on public.maps;
create trigger sync_nucleus_progress_from_map
after insert or update of session on public.maps
for each row execute procedure public.s07_sync_nucleus_progress();

do $$
declare
  v_map public.maps;
begin
  for v_map in select * from public.maps loop
    perform public.s07_project_nucleus_progress(v_map);
  end loop;
end;
$$;
