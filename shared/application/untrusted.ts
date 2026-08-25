/**
 * Explicit delimiters for untrusted model / source content in prompts.
 */

export const UNTRUSTED_BEGIN = '<<<UNTRUSTED_CONTENT_BEGIN>>>';
export const UNTRUSTED_END = '<<<UNTRUSTED_CONTENT_END>>>';

export function wrapUntrusted(label: string, body: string): string {
  return [
    `${UNTRUSTED_BEGIN} ${label}`,
    body,
    `${UNTRUSTED_END} ${label}`,
  ].join('\n');
}

/**
 * Coerce arbitrary model JSON into a limited draft — drops provenance/IDs/risk/status.
 */
export function coerceModelPlanDraft(raw: unknown): import('./modelDraft').ModelPlanDraftV1 {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const action =
    o.action && typeof o.action === 'object'
      ? (o.action as Record<string, unknown>)
      : o;

  const draft: import('./modelDraft').ModelPlanDraftV1 = {};
  if (typeof o.selectedCandidateId === 'string') {
    draft.selectedCandidateId = o.selectedCandidateId.trim();
  }
  if (typeof o.inference === 'string') draft.inference = o.inference;
  if (typeof o.adaptation === 'string') draft.adaptation = o.adaptation;
  if (typeof action.verbLedInstruction === 'string') {
    draft.verbLedInstruction = action.verbLedInstruction;
  }
  if (typeof action.whenOrTrigger === 'string') draft.whenOrTrigger = action.whenOrTrigger;
  if (typeof action.durationOrScope === 'string') draft.durationOrScope = action.durationOrScope;
  if (typeof action.obstacle === 'string') draft.obstacle = action.obstacle;
  if (typeof action.mitigation === 'string') draft.mitigation = action.mitigation;
  if (typeof action.successCriterion === 'string') {
    draft.successCriterion = action.successCriterion;
  }
  if (typeof action.stopOrChangeCriterion === 'string') {
    draft.stopOrChangeCriterion = action.stopOrChangeCriterion;
  }
  if (typeof o.reviewTrigger === 'string') draft.reviewTrigger = o.reviewTrigger;
  if (Array.isArray(o.reviewQuestions)) {
    draft.reviewQuestions = o.reviewQuestions.filter((q): q is string => typeof q === 'string');
  }
  if (o.editableAssumptionTexts && typeof o.editableAssumptionTexts === 'object') {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(o.editableAssumptionTexts as Record<string, unknown>)) {
      if (typeof v === 'string') map[k] = v;
    }
    draft.editableAssumptionTexts = map;
  }
  // Intentionally ignore: sourceBasis, sourceChunkIds, claimId, risk, status, ids, versions.
  return draft;
}
