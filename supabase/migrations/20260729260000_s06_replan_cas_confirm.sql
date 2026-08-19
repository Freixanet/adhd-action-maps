-- S06 final residuals: CAS — replace requires previous_digest matching active plan.

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
    raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  select * into v_op
  from public.application_persist_ops
  where owner_id = v_owner and map_id = p_map_id and plan_digest = p_plan_digest
  limit 1;
  if v_op.id is not null and v_op.status = 'complete' and v_existing.id is not null then
    raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  -- No existing plan → first persist (insert). Previous must be null.
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

  -- Existing plan with DIFFERENT digest → replace REQUIRES previous_digest = active
  if v_prev is null then
    raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;
  if v_prev is distinct from v_existing.plan_digest then
    -- Concurrent loser / stale CAS (e.g. P1→P2 after P1→P3 on another device)
    raise exception 'replan_application_plan: APPLICATION_IDEMPOTENCY_CONFLICT'
      using errcode = 'P0001';
  end if;

  v_started := v_existing.started_at is not null;
  select exists (
    select 1 from public.application_reviews
    where owner_id = v_owner and map_id = p_map_id and plan_row_id = v_existing.id
  ) into v_has_review;

  if (v_started or v_has_review) and coalesce(p_confirm_replace, false) is not true then
    return jsonb_build_object(
      'ok', false,
      'code', 'APPLICATION_REPLAN_REQUIRES_CONFIRMATION',
      'started', v_started,
      'has_review', v_has_review,
      'active_plan_digest', v_existing.plan_digest
    );
  end if;

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
    'previous_plan_digest', v_prev
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
