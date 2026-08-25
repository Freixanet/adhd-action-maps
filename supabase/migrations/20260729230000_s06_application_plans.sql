-- S06: application_plans + steps + reviews — RLS, immutability, idempotent RPC.

create table if not exists public.application_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null references public.maps (id) on delete cascade,
  source_id uuid references public.sources (id) on delete set null,
  source_version_id uuid references public.source_versions (id) on delete set null,
  plan_id text not null,
  status text not null,
  plan_digest text not null,
  schema_version text not null,
  prompt_version text not null,
  compiler_version text not null,
  policy_version text not null,
  model_route text not null,
  content_hash text,
  context_canonical_hash text not null,
  source_basis text not null default '',
  inference text not null default '',
  adaptation text not null default '',
  risk text not null default 'low',
  selected_candidate_id text,
  review_trigger text not null default '',
  review_questions jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  action_payload jsonb,
  artifact jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, map_id, plan_digest)
);

create table if not exists public.application_steps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null references public.maps (id) on delete cascade,
  plan_row_id uuid not null references public.application_plans (id) on delete cascade,
  step_key text not null,
  title text not null,
  body text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, map_id, plan_row_id, step_key)
);

create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null references public.maps (id) on delete cascade,
  plan_row_id uuid not null references public.application_plans (id) on delete cascade,
  review_id text not null,
  outcome text not null,
  private_note text,
  failed_assumption_id text,
  wants_adjust boolean not null default false,
  wants_repeat boolean not null default false,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_id, map_id, review_id)
);

create table if not exists public.application_persist_ops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  map_id text not null references public.maps (id) on delete cascade,
  plan_digest text not null,
  status text not null check (status in ('complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, map_id, plan_digest)
);

create index if not exists application_plans_owner_map_idx
  on public.application_plans (owner_id, map_id);
create index if not exists application_steps_owner_map_idx
  on public.application_steps (owner_id, map_id);
create index if not exists application_reviews_owner_map_idx
  on public.application_reviews (owner_id, map_id);

alter table public.application_plans enable row level security;
alter table public.application_steps enable row level security;
alter table public.application_reviews enable row level security;
alter table public.application_persist_ops enable row level security;

create policy application_plans_owner_all on public.application_plans
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy application_steps_owner_all on public.application_steps
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy application_reviews_owner_all on public.application_reviews
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy application_persist_ops_owner_all on public.application_persist_ops
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

revoke all on public.application_plans from anon, public;
revoke all on public.application_steps from anon, public;
revoke all on public.application_reviews from anon, public;
revoke all on public.application_persist_ops from anon, public;
grant select, insert, update, delete on public.application_plans to authenticated;
grant select, insert, update, delete on public.application_steps to authenticated;
grant select, insert, update, delete on public.application_reviews to authenticated;
grant select, insert, update, delete on public.application_persist_ops to authenticated;

create or replace function public.application_plans_enforce_parents()
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
    raise exception 'application_plans: map_id not found';
  end if;
  if v_map_owner is distinct from new.owner_id then
    raise exception 'application_plans: owner_id must match map owner';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'application_plans: owner_id is immutable';
    end if;
    if new.map_id is distinct from old.map_id then
      raise exception 'application_plans: map_id is immutable';
    end if;
    if new.plan_id is distinct from old.plan_id then
      raise exception 'application_plans: plan_id is immutable';
    end if;
    if new.plan_digest is distinct from old.plan_digest then
      raise exception 'application_plans: plan_digest is immutable';
    end if;
    if new.source_id is distinct from old.source_id then
      raise exception 'application_plans: source_id is immutable';
    end if;
    if new.source_version_id is distinct from old.source_version_id then
      raise exception 'application_plans: source_version_id is immutable';
    end if;
    if new.context_canonical_hash is distinct from old.context_canonical_hash then
      raise exception 'application_plans: context_canonical_hash is immutable';
    end if;
  end if;

  if new.source_id is not null then
    select owner_id into v_source_owner from public.sources where id = new.source_id;
    if v_source_owner is null or v_source_owner is distinct from new.owner_id then
      raise exception 'application_plans: source must belong to owner';
    end if;
  end if;

  if new.source_version_id is not null then
    select source_id into v_version_source
    from public.source_versions where id = new.source_version_id;
    if v_version_source is null then
      raise exception 'application_plans: source_version not found';
    end if;
    if new.source_id is not null and v_version_source is distinct from new.source_id then
      raise exception 'application_plans: source_version must belong to source_id';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists application_plans_enforce_parents_trg on public.application_plans;
create trigger application_plans_enforce_parents_trg
  before insert or update on public.application_plans
  for each row execute function public.application_plans_enforce_parents();

create or replace function public.application_assert_plan_matches(
  p_owner uuid,
  p_map_id text,
  p_plan_digest text,
  p_artifact jsonb
)
returns void
language plpgsql
as $$
declare
  v_row public.application_plans%rowtype;
  v_step_count int;
  v_expected_steps int;
begin
  select * into v_row
  from public.application_plans
  where owner_id = p_owner and map_id = p_map_id and plan_digest = p_plan_digest
  limit 1;
  if v_row.id is null then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  if v_row.artifact is distinct from p_artifact then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  select count(*) into v_step_count
  from public.application_steps
  where owner_id = p_owner and map_id = p_map_id and plan_row_id = v_row.id;

  v_expected_steps := coalesce(jsonb_array_length(p_artifact->'plan'->'assumptions'), 0);
  -- Cardinality check: steps table may hold action sections; at least no foreign plan rows.
  if exists (
    select 1 from public.application_plans
    where owner_id = p_owner and map_id = p_map_id
      and plan_digest is distinct from p_plan_digest
  ) then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.persist_application_plan(
  p_map_id text,
  p_source_id uuid,
  p_source_version_id uuid,
  p_plan_digest text,
  p_content_hash text,
  p_context_canonical_hash text,
  p_schema_version text,
  p_prompt_version text,
  p_compiler_version text,
  p_policy_version text,
  p_model_route text,
  p_artifact jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_map_owner uuid;
  v_op public.application_persist_ops%rowtype;
  v_existing public.application_plans%rowtype;
  v_plan jsonb := p_artifact->'plan';
  v_plan_id text;
  v_row_id uuid;
begin
  if v_owner is null then
    raise exception 'persist_application_plan: not authenticated' using errcode = '42501';
  end if;
  if p_map_id is null or length(p_map_id) = 0 then
    raise exception 'persist_application_plan: map_id required' using errcode = 'P0001';
  end if;
  if p_plan_digest is null or length(p_plan_digest) < 8 then
    raise exception 'persist_application_plan: plan_digest required' using errcode = 'P0001';
  end if;
  if p_artifact is null or v_plan is null then
    raise exception 'persist_application_plan: artifact required' using errcode = 'P0001';
  end if;

  select owner_id into v_map_owner from public.maps where id = p_map_id for update;
  if v_map_owner is null then
    raise exception 'persist_application_plan: map not found' using errcode = 'P0001';
  end if;
  if v_map_owner is distinct from v_owner then
    raise exception 'persist_application_plan: map owner mismatch' using errcode = '42501';
  end if;

  select * into v_op
  from public.application_persist_ops
  where owner_id = v_owner and map_id = p_map_id and plan_digest = p_plan_digest
  limit 1;

  if v_op.id is not null and v_op.status = 'complete' then
    perform public.application_assert_plan_matches(v_owner, p_map_id, p_plan_digest, p_artifact);
    return jsonb_build_object('ok', true, 'status', 'complete', 'idempotent', true, 'plan_digest', p_plan_digest);
  end if;

  if exists (
    select 1 from public.application_persist_ops
    where owner_id = v_owner and map_id = p_map_id and status = 'complete'
      and plan_digest is distinct from p_plan_digest
  ) then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.application_plans
  where owner_id = v_owner and map_id = p_map_id
  limit 1;

  if v_existing.id is not null then
    if v_existing.plan_digest = p_plan_digest and v_existing.artifact = p_artifact then
      insert into public.application_persist_ops (owner_id, map_id, plan_digest, status)
      values (v_owner, p_map_id, p_plan_digest, 'complete')
      on conflict (owner_id, map_id, plan_digest) do update set status = 'complete', updated_at = now();
      return jsonb_build_object('ok', true, 'status', 'complete', 'idempotent', true, 'adopted', true, 'plan_digest', p_plan_digest);
    end if;
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  v_plan_id := coalesce(v_plan->>'id', p_plan_digest);

  insert into public.application_plans (
    owner_id, map_id, source_id, source_version_id, plan_id, status, plan_digest,
    schema_version, prompt_version, compiler_version, policy_version, model_route,
    content_hash, context_canonical_hash, source_basis, inference, adaptation, risk,
    selected_candidate_id, review_trigger, review_questions, assumptions, action_payload, artifact
  ) values (
    v_owner, p_map_id, p_source_id, p_source_version_id, v_plan_id, coalesce(v_plan->>'status', 'ready'), p_plan_digest,
    p_schema_version, p_prompt_version, p_compiler_version, p_policy_version, p_model_route,
    p_content_hash, p_context_canonical_hash,
    coalesce(v_plan->>'sourceBasis', ''),
    coalesce(v_plan->>'inference', ''),
    coalesce(v_plan->>'adaptation', ''),
    coalesce(v_plan->>'risk', 'low'),
    v_plan->>'selectedCandidateId',
    coalesce(v_plan->>'reviewTrigger', ''),
    coalesce(v_plan->'reviewQuestions', '[]'::jsonb),
    coalesce(v_plan->'assumptions', '[]'::jsonb),
    v_plan->'action',
    p_artifact
  )
  returning id into v_row_id;

  insert into public.application_steps (owner_id, map_id, plan_row_id, step_key, title, body, sort_order)
  values
    (v_owner, p_map_id, v_row_id, 'source_basis', 'De la fuente', coalesce(v_plan->>'sourceBasis', ''), 0),
    (v_owner, p_map_id, v_row_id, 'inference', 'Inferencia de Núcleo', coalesce(v_plan->>'inference', ''), 1),
    (v_owner, p_map_id, v_row_id, 'adaptation', 'Adaptación para ti', coalesce(v_plan->>'adaptation', ''), 2);

  if v_plan->'action' is not null then
    insert into public.application_steps (owner_id, map_id, plan_row_id, step_key, title, body, sort_order)
    values (
      v_owner, p_map_id, v_row_id, 'action', 'Próxima acción',
      coalesce(v_plan->'action'->>'verbLedInstruction', ''), 3
    );
  end if;

  insert into public.application_persist_ops (owner_id, map_id, plan_digest, status)
  values (v_owner, p_map_id, p_plan_digest, 'complete');

  perform public.application_assert_plan_matches(v_owner, p_map_id, p_plan_digest, p_artifact);

  return jsonb_build_object('ok', true, 'status', 'complete', 'idempotent', false, 'plan_digest', p_plan_digest);
end;
$$;

revoke all on function public.persist_application_plan(
  text, uuid, uuid, text, text, text, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.persist_application_plan(
  text, uuid, uuid, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

create or replace function public.persist_application_review(
  p_map_id text,
  p_plan_digest text,
  p_review jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_plan public.application_plans%rowtype;
begin
  if v_owner is null then
    raise exception 'persist_application_review: not authenticated' using errcode = '42501';
  end if;

  select * into v_plan
  from public.application_plans
  where owner_id = v_owner and map_id = p_map_id and plan_digest = p_plan_digest
  for update;
  if v_plan.id is null then
    raise exception 'persist_application_review: plan not found' using errcode = 'P0001';
  end if;

  insert into public.application_reviews (
    owner_id, map_id, plan_row_id, review_id, outcome, private_note,
    failed_assumption_id, wants_adjust, wants_repeat, reviewed_at
  ) values (
    v_owner, p_map_id, v_plan.id,
    coalesce(p_review->>'id', gen_random_uuid()::text),
    p_review->>'outcome',
    p_review->>'privateNote',
    p_review->>'failedAssumptionId',
    coalesce((p_review->>'wantsAdjust')::boolean, false),
    coalesce((p_review->>'wantsRepeat')::boolean, false),
    coalesce((p_review->>'reviewedAt')::timestamptz, now())
  )
  on conflict (owner_id, map_id, review_id) do update
    set outcome = excluded.outcome,
        private_note = excluded.private_note,
        failed_assumption_id = excluded.failed_assumption_id,
        wants_adjust = excluded.wants_adjust,
        wants_repeat = excluded.wants_repeat,
        reviewed_at = excluded.reviewed_at;

  update public.application_plans
  set status = case
      when p_review->>'outcome' = 'abandoned' then 'abandoned'
      when p_review->>'outcome' in ('worked', 'partial', 'did_not_work') then 'completed'
      else status
    end,
    artifact = jsonb_set(artifact, '{review}', p_review, true),
    updated_at = now()
  where id = v_plan.id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.persist_application_review(text, text, jsonb) from public, anon;
grant execute on function public.persist_application_review(text, text, jsonb) to authenticated;
