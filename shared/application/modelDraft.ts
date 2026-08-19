/**
 * Limited model draft — never authoritative for provenance, IDs, risk, or status.
 */

export type ModelPlanDraftV1 = {
  /** Must be an existing allow-listed candidate id when present. */
  selectedCandidateId?: string;
  /** Núcleo transfer prose only — never becomes sourceBasis. */
  inference?: string;
  /** Personal adaptation prose. */
  adaptation?: string;
  /** Verb-led action instruction (content only; id rebuilt by compiler). */
  verbLedInstruction?: string;
  whenOrTrigger?: string;
  durationOrScope?: string;
  obstacle?: string;
  mitigation?: string;
  successCriterion?: string;
  stopOrChangeCriterion?: string;
  reviewTrigger?: string;
  reviewQuestions?: string[];
  /**
   * Optional text overrides for editable assumptions, keyed by stable assumption id
   * that already exists on the deterministic plan. New ids are rejected.
   */
  editableAssumptionTexts?: Record<string, string>;
};
