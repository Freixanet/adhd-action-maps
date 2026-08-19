-- S06 reopen harden: RPC-only mutations, immutable plan artifact, real cardinality,
-- child parent binding, version ownership, review idempotency without rewriting plan.

-- ---------------------------------------------------------------------------
-- 1. Immutable plan artifact + execution columns (review/start do not rewrite plan)
-- ---------------------------------------------------------------------------

alter table public.application_plans
  add column if not exists immutable_artifact jsonb;

update public.application_plans
set immutable_artifact = artifact
where immutable_artifact is null;

alter table public.application_plans
  alter column immutable_artifact set not null;

alter table public.application_plans
  add column if not exists started_at timestamptz;

alter table public.application_plans
  add column if not exists execution_status text;

-- ---------------------------------------------------------------------------
-- 2. SELECT-only for authenticated; mutations only via security definer RPCs
-- ---------------------------------------------------------------------------

drop policy if exists application_plans_owner_all on public.application_plans;
drop policy if exists application_steps_owner_all on public.application_steps;
drop policy if exists application_reviews_owner_all on public.application_reviews;
drop policy if exists application_persist_ops_owner_all on public.application_persist_ops;

drop policy if exists application_plans_select_own on public.application_plans;
create policy application_plans_select_own on public.application_plans
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists application_steps_select_own on public.application_steps;
create policy application_steps_select_own on public.application_steps
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists application_reviews_select_own on public.application_reviews;
create policy application_reviews_select_own on public.application_reviews
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists application_persist_ops_select_own on public.application_persist_ops;
create policy application_persist_ops_select_own on public.application_persist_ops
  for select to authenticated
  using (owner_id = auth.uid());

revoke all on public.application_plans from anon, public, authenticated;
revoke all on public.application_steps from anon, public, authenticated;
revoke all on public.application_reviews from anon, public, authenticated;
revoke all on public.application_persist_ops from anon, public, authenticated;

grant select on public.application_plans to authenticated;
grant select on public.application_steps to authenticated;
grant select on public.application_reviews to authenticated;
grant select on public.application_persist_ops to authenticated;

-- Service role keeps full access for admin/account-delete paths (bypasses RLS).
grant select, insert, update, delete on public.application_plans to service_role;
grant select, insert, update, delete on public.application_steps to service_role;
grant select, insert, update, delete on public.application_reviews to service_role;
grant select, insert, update, delete on public.application_persist_ops to service_role;

-- ---------------------------------------------------------------------------
-- 3. Parent / immutability triggers (defense in depth for security definer paths)
-- ---------------------------------------------------------------------------

create or replace function public.application_plans_enforce_parents()
returns trigger
language plpgsql
security definer
set search_path = public
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
    if new.immutable_artifact is distinct from old.immutable_artifact then
      raise exception 'application_plans: immutable_artifact is immutable';
    end if;
    if new.artifact is distinct from old.artifact then
      raise exception 'application_plans: artifact is immutable';
    end if;
    if new.content_hash is distinct from old.content_hash then
      raise exception 'application_plans: content_hash is immutable';
    end if;
    if new.schema_version is distinct from old.schema_version then
      raise exception 'application_plans: schema_version is immutable';
    end if;
    if new.prompt_version is distinct from old.prompt_version then
      raise exception 'application_plans: prompt_version is immutable';
    end if;
    if new.compiler_version is distinct from old.compiler_version then
      raise exception 'application_plans: compiler_version is immutable';
    end if;
    if new.policy_version is distinct from old.policy_version then
      raise exception 'application_plans: policy_version is immutable';
    end if;
    if new.model_route is distinct from old.model_route then
      raise exception 'application_plans: model_route is immutable';
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
    -- Owner binding even when source_id is null
    select s.owner_id into v_source_owner
    from public.sources s where s.id = v_version_source;
    if v_source_owner is null or v_source_owner is distinct from new.owner_id then
      raise exception 'application_plans: source_version owner mismatch';
    end if;
    if new.source_id is null then
      new.source_id := v_version_source;
    end if;
  end if;

  if tg_op = 'INSERT' and new.immutable_artifact is null then
    new.immutable_artifact := new.artifact;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists application_plans_enforce_parents_trg on public.application_plans;
create trigger application_plans_enforce_parents_trg
  before insert or update on public.application_plans
  for each row execute function public.application_plans_enforce_parents();

create or replace function public.application_steps_enforce_parents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.application_plans%rowtype;
  v_map_owner uuid;
begin
  select owner_id into v_map_owner from public.maps where id = new.map_id;
  if v_map_owner is null then
    raise exception 'application_steps: map_id not found';
  end if;
  if v_map_owner is distinct from new.owner_id then
    raise exception 'application_steps: owner_id must match map owner';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'application_steps: owner_id is immutable';
    end if;
    if new.map_id is distinct from old.map_id then
      raise exception 'application_steps: map_id is immutable';
    end if;
    if new.plan_row_id is distinct from old.plan_row_id then
      raise exception 'application_steps: plan_row_id is immutable';
    end if;
    if new.step_key is distinct from old.step_key then
      raise exception 'application_steps: step_key is immutable';
    end if;
  end if;

  select * into v_plan from public.application_plans where id = new.plan_row_id;
  if v_plan.id is null then
    raise exception 'application_steps: plan not found';
  end if;
  if v_plan.owner_id is distinct from new.owner_id then
    raise exception 'application_steps: plan owner mismatch';
  end if;
  if v_plan.map_id is distinct from new.map_id then
    raise exception 'application_steps: plan map mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists application_steps_enforce_parents_trg on public.application_steps;
create trigger application_steps_enforce_parents_trg
  before insert or update on public.application_steps
  for each row execute function public.application_steps_enforce_parents();

create or replace function public.application_reviews_enforce_parents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.application_plans%rowtype;
  v_map_owner uuid;
begin
  select owner_id into v_map_owner from public.maps where id = new.map_id;
  if v_map_owner is null then
    raise exception 'application_reviews: map_id not found';
  end if;
  if v_map_owner is distinct from new.owner_id then
    raise exception 'application_reviews: owner_id must match map owner';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'application_reviews: owner_id is immutable';
    end if;
    if new.map_id is distinct from old.map_id then
      raise exception 'application_reviews: map_id is immutable';
    end if;
    if new.plan_row_id is distinct from old.plan_row_id then
      raise exception 'application_reviews: plan_row_id is immutable';
    end if;
    if new.review_id is distinct from old.review_id then
      raise exception 'application_reviews: review_id is immutable';
    end if;
  end if;

  select * into v_plan from public.application_plans where id = new.plan_row_id;
  if v_plan.id is null then
    raise exception 'application_reviews: plan not found';
  end if;
  if v_plan.owner_id is distinct from new.owner_id then
    raise exception 'application_reviews: plan owner mismatch';
  end if;
  if v_plan.map_id is distinct from new.map_id then
    raise exception 'application_reviews: plan map mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists application_reviews_enforce_parents_trg on public.application_reviews;
create trigger application_reviews_enforce_parents_trg
  before insert or update on public.application_reviews
  for each row execute function public.application_reviews_enforce_parents();

create or replace function public.application_persist_ops_enforce_parents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_map_owner uuid;
begin
  select owner_id into v_map_owner from public.maps where id = new.map_id;
  if v_map_owner is null then
    raise exception 'application_persist_ops: map_id not found';
  end if;
  if v_map_owner is distinct from new.owner_id then
    raise exception 'application_persist_ops: owner_id must match map owner';
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'application_persist_ops: owner_id is immutable';
    end if;
    if new.map_id is distinct from old.map_id then
      raise exception 'application_persist_ops: map_id is immutable';
    end if;
    if new.plan_digest is distinct from old.plan_digest then
      raise exception 'application_persist_ops: plan_digest is immutable';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists application_persist_ops_enforce_parents_trg on public.application_persist_ops;
create trigger application_persist_ops_enforce_parents_trg
  before insert or update on public.application_persist_ops
  for each row execute function public.application_persist_ops_enforce_parents();

-- ---------------------------------------------------------------------------
-- 4. Expected steps from artifact + bidirectional DB↔ payload assert
-- ---------------------------------------------------------------------------

create or replace function public.application_expected_steps(p_artifact jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_plan jsonb := p_artifact->'plan';
  v_steps jsonb := '[]'::jsonb;
begin
  v_steps := v_steps || jsonb_build_array(jsonb_build_object(
    'step_key', 'source_basis',
    'title', 'De la fuente',
    'body', coalesce(v_plan->>'sourceBasis', '')
  ));
  v_steps := v_steps || jsonb_build_array(jsonb_build_object(
    'step_key', 'inference',
    'title', 'Inferencia de Núcleo',
    'body', coalesce(v_plan->>'inference', '')
  ));
  v_steps := v_steps || jsonb_build_array(jsonb_build_object(
    'step_key', 'adaptation',
    'title', 'Adaptación para ti',
    'body', coalesce(v_plan->>'adaptation', '')
  ));
  if v_plan->'action' is not null and jsonb_typeof(v_plan->'action') = 'object' then
    v_steps := v_steps || jsonb_build_array(jsonb_build_object(
      'step_key', 'action',
      'title', 'Próxima acción',
      'body', coalesce(v_plan->'action'->>'verbLedInstruction', '')
    ));
  end if;
  return v_steps;
end;
$$;

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
  v_expected jsonb;
  v_step jsonb;
  v_existing record;
  v_db_count int;
  v_payload_count int;
  v_found boolean;
begin
  select * into v_row
  from public.application_plans
  where owner_id = p_owner and map_id = p_map_id and plan_digest = p_plan_digest
  limit 1;
  if v_row.id is null then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- Compare against frozen plan artifact — never the review-mutated path
  if v_row.immutable_artifact is distinct from p_artifact then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;
  if v_row.artifact is distinct from p_artifact then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- One complete plan per map (no foreign digest rows)
  if exists (
    select 1 from public.application_plans
    where owner_id = p_owner and map_id = p_map_id
      and plan_digest is distinct from p_plan_digest
  ) then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  v_expected := public.application_expected_steps(p_artifact);
  v_payload_count := coalesce(jsonb_array_length(v_expected), 0);

  select count(*) into v_db_count
  from public.application_steps
  where owner_id = p_owner and map_id = p_map_id and plan_row_id = v_row.id;

  if v_db_count is distinct from v_payload_count then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- Payload → DB
  for v_step in select * from jsonb_array_elements(v_expected)
  loop
    select * into v_existing
    from public.application_steps
    where owner_id = p_owner
      and map_id = p_map_id
      and plan_row_id = v_row.id
      and step_key = (v_step->>'step_key');
    if not found
       or v_existing.title is distinct from (v_step->>'title')
       or v_existing.body is distinct from (v_step->>'body')
    then
      raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0001';
    end if;
  end loop;

  -- DB → payload (no extra / modified keys)
  for v_existing in
    select * from public.application_steps
    where owner_id = p_owner and map_id = p_map_id and plan_row_id = v_row.id
  loop
    v_found := false;
    for v_step in select * from jsonb_array_elements(v_expected)
    loop
      if (v_step->>'step_key') = v_existing.step_key then
        if (v_step->>'title') is distinct from v_existing.title
           or (v_step->>'body') is distinct from v_existing.body then
          raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
            using errcode = 'P0001';
        end if;
        v_found := true;
        exit;
      end if;
    end loop;
    if not v_found then
      raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. persist_application_plan — first-persist equality, concurrency lock
-- ---------------------------------------------------------------------------

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
  v_step jsonb;
  v_sort int := 0;
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

  -- Serialize concurrent persists for this map
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
    -- First-persist / adopt: preexisting rows must exactly match (no silent overwrite)
    if v_existing.plan_digest = p_plan_digest
       and v_existing.immutable_artifact = p_artifact then
      perform public.application_assert_plan_matches(v_owner, p_map_id, p_plan_digest, p_artifact);
      insert into public.application_persist_ops (owner_id, map_id, plan_digest, status)
      values (v_owner, p_map_id, p_plan_digest, 'complete')
      on conflict (owner_id, map_id, plan_digest) do update set status = 'complete', updated_at = now();
      return jsonb_build_object('ok', true, 'status', 'complete', 'idempotent', true, 'adopted', true, 'plan_digest', p_plan_digest);
    end if;
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- Intruder steps without a plan row for this map (should not happen via FK, but fail closed)
  if exists (
    select 1 from public.application_steps
    where owner_id = v_owner and map_id = p_map_id
  ) then
    raise exception 'persist_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  v_plan_id := coalesce(v_plan->>'id', p_plan_digest);

  insert into public.application_plans (
    owner_id, map_id, source_id, source_version_id, plan_id, status, plan_digest,
    schema_version, prompt_version, compiler_version, policy_version, model_route,
    content_hash, context_canonical_hash, source_basis, inference, adaptation, risk,
    selected_candidate_id, review_trigger, review_questions, assumptions, action_payload,
    artifact, immutable_artifact
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
    p_artifact,
    p_artifact
  )
  returning id into v_row_id;

  for v_step in select * from jsonb_array_elements(public.application_expected_steps(p_artifact))
  loop
    insert into public.application_steps (owner_id, map_id, plan_row_id, step_key, title, body, sort_order)
    values (
      v_owner, p_map_id, v_row_id,
      v_step->>'step_key',
      v_step->>'title',
      coalesce(v_step->>'body', ''),
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  insert into public.application_persist_ops (owner_id, map_id, plan_digest, status)
  values (v_owner, p_map_id, p_plan_digest, 'complete');

  perform public.application_assert_plan_matches(v_owner, p_map_id, p_plan_digest, p_artifact);

  return jsonb_build_object('ok', true, 'status', 'complete', 'idempotent', false, 'plan_digest', p_plan_digest);
exception
  when others then
    -- Fail closed: no partial complete ledger on conflict/error
    raise;
end;
$$;

revoke all on function public.persist_application_plan(
  text, uuid, uuid, text, text, text, text, text, text, text, text, jsonb
) from public, anon;
grant execute on function public.persist_application_plan(
  text, uuid, uuid, text, text, text, text, text, text, text, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. persist_application_review — validated, idempotent, no artifact rewrite
-- ---------------------------------------------------------------------------

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
  v_map_owner uuid;
  v_plan public.application_plans%rowtype;
  v_review_id text;
  v_outcome text;
  v_existing public.application_reviews%rowtype;
  v_note text;
  v_failed text;
  v_wants_adjust boolean;
  v_wants_repeat boolean;
  v_reviewed_at timestamptz;
  v_new_status text;
begin
  if v_owner is null then
    raise exception 'persist_application_review: not authenticated' using errcode = '42501';
  end if;
  if p_map_id is null or length(p_map_id) = 0 then
    raise exception 'persist_application_review: map_id required' using errcode = 'P0001';
  end if;
  if p_plan_digest is null or length(p_plan_digest) < 8 then
    raise exception 'persist_application_review: plan_digest required' using errcode = 'P0001';
  end if;
  if p_review is null or jsonb_typeof(p_review) <> 'object' then
    raise exception 'persist_application_review: review required' using errcode = 'P0001';
  end if;

  v_review_id := nullif(trim(coalesce(p_review->>'id', '')), '');
  v_outcome := nullif(trim(coalesce(p_review->>'outcome', '')), '');
  if v_review_id is null then
    raise exception 'persist_application_review: review.id required' using errcode = 'P0001';
  end if;
  if v_outcome is null or v_outcome not in ('worked', 'partial', 'did_not_work', 'abandoned') then
    raise exception 'persist_application_review: review.outcome invalid' using errcode = 'P0001';
  end if;

  select owner_id into v_map_owner from public.maps where id = p_map_id for update;
  if v_map_owner is null then
    raise exception 'persist_application_review: map not found' using errcode = 'P0001';
  end if;
  if v_map_owner is distinct from v_owner then
    raise exception 'persist_application_review: map owner mismatch' using errcode = '42501';
  end if;

  select * into v_plan
  from public.application_plans
  where owner_id = v_owner and map_id = p_map_id and plan_digest = p_plan_digest
  for update;
  if v_plan.id is null then
    raise exception 'persist_application_review: plan not found' using errcode = 'P0001';
  end if;

  v_note := nullif(p_review->>'privateNote', '');
  v_failed := nullif(p_review->>'failedAssumptionId', '');
  v_wants_adjust := coalesce((p_review->>'wantsAdjust')::boolean, false);
  v_wants_repeat := coalesce((p_review->>'wantsRepeat')::boolean, false);
  begin
    v_reviewed_at := coalesce((p_review->>'reviewedAt')::timestamptz, now());
  exception
    when others then
      raise exception 'persist_application_review: review.reviewedAt invalid' using errcode = 'P0001';
  end;

  select * into v_existing
  from public.application_reviews
  where owner_id = v_owner and map_id = p_map_id and review_id = v_review_id
  for update;

  if v_existing.id is not null then
    if v_existing.plan_row_id is distinct from v_plan.id
       or v_existing.outcome is distinct from v_outcome
       or coalesce(v_existing.private_note, '') is distinct from coalesce(v_note, '')
       or coalesce(v_existing.failed_assumption_id, '') is distinct from coalesce(v_failed, '')
       or v_existing.wants_adjust is distinct from v_wants_adjust
       or v_existing.wants_repeat is distinct from v_wants_repeat
       or v_existing.reviewed_at is distinct from v_reviewed_at
    then
      raise exception 'persist_application_review: APPLICATION_REVIEW_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0001';
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'review_id', v_review_id);
  end if;

  insert into public.application_reviews (
    owner_id, map_id, plan_row_id, review_id, outcome, private_note,
    failed_assumption_id, wants_adjust, wants_repeat, reviewed_at
  ) values (
    v_owner, p_map_id, v_plan.id,
    v_review_id, v_outcome, v_note,
    v_failed, v_wants_adjust, v_wants_repeat, v_reviewed_at
  );

  v_new_status := case
    when v_outcome = 'abandoned' then 'abandoned'
    when v_outcome in ('worked', 'partial', 'did_not_work') then 'completed'
    else v_plan.status
  end;

  -- Mutable review/execution state only — never rewrite immutable_artifact / artifact
  update public.application_plans
  set status = v_new_status,
      updated_at = now()
  where id = v_plan.id;

  return jsonb_build_object('ok', true, 'idempotent', false, 'review_id', v_review_id);
end;
$$;

revoke all on function public.persist_application_review(text, text, jsonb) from public, anon;
grant execute on function public.persist_application_review(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. persist_application_execution — S06 start-action without S07
-- ---------------------------------------------------------------------------

create or replace function public.persist_application_execution(
  p_map_id text,
  p_plan_digest text,
  p_started_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_map_owner uuid;
  v_plan public.application_plans%rowtype;
  v_started timestamptz := coalesce(p_started_at, now());
begin
  if v_owner is null then
    raise exception 'persist_application_execution: not authenticated' using errcode = '42501';
  end if;
  if p_map_id is null or length(p_map_id) = 0 then
    raise exception 'persist_application_execution: map_id required' using errcode = 'P0001';
  end if;
  if p_plan_digest is null or length(p_plan_digest) < 8 then
    raise exception 'persist_application_execution: plan_digest required' using errcode = 'P0001';
  end if;

  select owner_id into v_map_owner from public.maps where id = p_map_id for update;
  if v_map_owner is null then
    raise exception 'persist_application_execution: map not found' using errcode = 'P0001';
  end if;
  if v_map_owner is distinct from v_owner then
    raise exception 'persist_application_execution: map owner mismatch' using errcode = '42501';
  end if;

  select * into v_plan
  from public.application_plans
  where owner_id = v_owner and map_id = p_map_id and plan_digest = p_plan_digest
  for update;
  if v_plan.id is null then
    raise exception 'persist_application_execution: plan not found' using errcode = 'P0001';
  end if;

  if v_plan.started_at is not null then
    if v_plan.started_at is distinct from v_started
       or coalesce(v_plan.execution_status, '') is distinct from 'in_progress' then
      raise exception 'persist_application_execution: APPLICATION_EXECUTION_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0001';
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'started_at', v_plan.started_at);
  end if;

  update public.application_plans
  set started_at = v_started,
      execution_status = 'in_progress',
      status = case
        when status in ('ready', 'provisional') then 'in_progress'
        else status
      end,
      updated_at = now()
  where id = v_plan.id;

  return jsonb_build_object('ok', true, 'idempotent', false, 'started_at', v_started);
end;
$$;

revoke all on function public.persist_application_execution(text, text, timestamptz) from public, anon;
grant execute on function public.persist_application_execution(text, text, timestamptz) to authenticated;
