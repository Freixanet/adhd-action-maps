-- S06 reopen: atomic replan RPC + review assumption/id length harden.
-- Does NOT change persist_application_plan first-persist "one digest per map" rule.
-- Digest change is only allowed via replan_application_plan.

-- ---------------------------------------------------------------------------
-- 1. replan_application_plan — atomic replace of the active plan for a map
-- ---------------------------------------------------------------------------

create or replace function public.replan_application_plan(
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
  p_artifact jsonb,
  p_previous_digest text default null,
  p_confirm_replace boolean default false
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
  v_started boolean := false;
  v_has_review boolean := false;
  v_prev text := nullif(trim(coalesce(p_previous_digest, '')), '');
begin
  if v_owner is null then
    raise exception 'replan_application_plan: not authenticated' using errcode = '42501';
  end if;
  if p_map_id is null or length(p_map_id) = 0 then
    raise exception 'replan_application_plan: map_id required' using errcode = 'P0001';
  end if;
  if p_plan_digest is null or length(p_plan_digest) < 8 then
    raise exception 'replan_application_plan: plan_digest required' using errcode = 'P0001';
  end if;
  if p_artifact is null or v_plan is null then
    raise exception 'replan_application_plan: artifact required' using errcode = 'P0001';
  end if;

  -- Serialize concurrent replan/persist for this map (loser sees winner's digest)
  select owner_id into v_map_owner from public.maps where id = p_map_id for update;
  if v_map_owner is null then
    raise exception 'replan_application_plan: map not found' using errcode = 'P0001';
  end if;
  if v_map_owner is distinct from v_owner then
    raise exception 'replan_application_plan: map owner mismatch' using errcode = '42501';
  end if;

  select * into v_existing
  from public.application_plans
  where owner_id = v_owner and map_id = p_map_id
  limit 1
  for update;

  -- Exact retry: same digest + same immutable artifact → idempotent success
  if v_existing.id is not null
     and v_existing.plan_digest = p_plan_digest then
    if v_existing.immutable_artifact is not distinct from p_artifact then
      perform public.application_assert_plan_matches(v_owner, p_map_id, p_plan_digest, p_artifact);
      insert into public.application_persist_ops (owner_id, map_id, plan_digest, status)
      values (v_owner, p_map_id, p_plan_digest, 'complete')
      on conflict (owner_id, map_id, plan_digest) do update
        set status = 'complete', updated_at = now();
      return jsonb_build_object(
        'ok', true,
        'status', 'complete',
        'idempotent', true,
        'plan_digest', p_plan_digest
      );
    end if;
    -- Same digest + different artifact → conflict (never silent overwrite)
    raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- Completed ledger for this digest without matching plan row → conflict
  select * into v_op
  from public.application_persist_ops
  where owner_id = v_owner and map_id = p_map_id and plan_digest = p_plan_digest
  limit 1;
  if v_op.id is not null and v_op.status = 'complete' and v_existing.id is not null then
    raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- No existing plan → first persist (insert). If caller supplied previous, require empty.
  if v_existing.id is null then
    if v_prev is not null then
      raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1 from public.application_steps
      where owner_id = v_owner and map_id = p_map_id
    ) then
      raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
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
    values (v_owner, p_map_id, p_plan_digest, 'complete')
    on conflict (owner_id, map_id, plan_digest) do update
      set status = 'complete', updated_at = now();

    perform public.application_assert_plan_matches(v_owner, p_map_id, p_plan_digest, p_artifact);

    return jsonb_build_object(
      'ok', true,
      'status', 'complete',
      'idempotent', false,
      'plan_digest', p_plan_digest
    );
  end if;

  -- Existing plan with DIFFERENT digest → replan replace path
  if v_prev is not null and v_prev is distinct from v_existing.plan_digest then
    -- Concurrent loser: active digest already changed (or wrong previous)
    raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  v_started := v_existing.started_at is not null;
  select exists (
    select 1 from public.application_reviews
    where owner_id = v_owner and map_id = p_map_id and plan_row_id = v_existing.id
  ) into v_has_review;

  if (v_started or v_has_review) and coalesce(p_confirm_replace, false) is not true then
    -- Typed state (HTTP 200 via jsonb ok:false) — do not raise
    return jsonb_build_object(
      'ok', false,
      'code', 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION',
      'started', v_started,
      'has_review', v_has_review,
      'active_plan_digest', v_existing.plan_digest
    );
  end if;

  -- Confirmed or no start/review: atomically replace children + plan + ops
  delete from public.application_reviews
  where owner_id = v_owner and map_id = p_map_id;

  delete from public.application_steps
  where owner_id = v_owner and map_id = p_map_id;

  delete from public.application_persist_ops
  where owner_id = v_owner and map_id = p_map_id;

  delete from public.application_plans
  where owner_id = v_owner and map_id = p_map_id;

  v_plan_id := coalesce(v_plan->>'id', p_plan_digest);
  v_sort := 0;

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

  return jsonb_build_object(
    'ok', true,
    'status', 'complete',
    'idempotent', false,
    'replaced', true,
    'plan_digest', p_plan_digest,
    'previous_plan_digest', v_existing.plan_digest
  );
exception
  when others then
    raise;
end;
$$;

revoke all on function public.replan_application_plan(
  text, uuid, uuid, text, text, text, text, text, text, text, text, jsonb, text, boolean
) from public, anon;
grant execute on function public.replan_application_plan(
  text, uuid, uuid, text, text, text, text, text, text, text, text, jsonb, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. application_assert_plan_matches — keep immutable_artifact as source of truth
--    (artifact must still equal the frozen plan for exact retries)
-- ---------------------------------------------------------------------------

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
    raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- Frozen plan is the authority — never compare against review-mutated overlays
  if v_row.immutable_artifact is distinct from p_artifact then
    raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;
  -- artifact column must remain identical to immutable_artifact for plan rows
  if v_row.artifact is distinct from v_row.immutable_artifact then
    raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;
  if v_row.artifact is distinct from p_artifact then
    raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- One complete plan per map (no foreign digest rows)
  if exists (
    select 1 from public.application_plans
    where owner_id = p_owner and map_id = p_map_id
      and plan_digest is distinct from p_plan_digest
  ) then
    raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  v_expected := public.application_expected_steps(p_artifact);
  v_payload_count := coalesce(jsonb_array_length(v_expected), 0);

  select count(*) into v_db_count
  from public.application_steps
  where owner_id = p_owner and map_id = p_map_id and plan_row_id = v_row.id;

  if v_db_count is distinct from v_payload_count then
    raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

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
      raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0001';
    end if;
  end loop;

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
          raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
            using errcode = 'P0001';
        end if;
        v_found := true;
        exit;
      end if;
    end loop;
    if not v_found then
      raise exception 'application_assert_plan_matches: APPLICATION_IDEMPOTENCY_CONFLICT'
        using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. persist_application_review — assumption id + length limits
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
  v_assumption jsonb;
  v_assumption_ok boolean := false;
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
  if char_length(v_review_id) > 80 then
    raise exception 'persist_application_review: review.id too long' using errcode = 'P0001';
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

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'persist_application_review: review.privateNote too long' using errcode = 'P0001';
  end if;
  if v_failed is not null then
    if char_length(v_failed) > 80 then
      raise exception 'persist_application_review: review.failedAssumptionId too long' using errcode = 'P0001';
    end if;
    -- Must exist in frozen plan assumptions (immutable_artifact)
    for v_assumption in
      select * from jsonb_array_elements(
        coalesce(v_plan.immutable_artifact->'plan'->'assumptions', '[]'::jsonb)
      )
    loop
      if jsonb_typeof(v_assumption) = 'object'
         and (v_assumption->>'id') is not distinct from v_failed then
        v_assumption_ok := true;
        exit;
      end if;
    end loop;
    if not v_assumption_ok then
      raise exception 'persist_application_review: failedAssumptionId not in plan assumptions'
        using errcode = 'P0001';
    end if;
  end if;

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
