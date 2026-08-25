export type VisualStrategy =
  | 'causal-chain'
  | 'branching-causality'
  | 'side-by-side-comparison'
  | 'process-flow'
  | 'guided-reading';

/** Strategies implemented in the first vertical slice. */
export const SLICE_STRATEGIES: readonly VisualStrategy[] = [
  'causal-chain',
  'guided-reading',
] as const;

/** Full first-library set (slice 1 implements only causal-chain + guided-reading). */
export const FIRST_LIBRARY_STRATEGIES: readonly VisualStrategy[] = [
  'causal-chain',
  'branching-causality',
  'side-by-side-comparison',
  'process-flow',
  'guided-reading',
] as const;

export type SelectionReason =
  | 'best-candidate'
  | 'no-eligible-visual-strategy'
  | 'verification-fallback'
  | 'runtime-v1-fallback';

export type StrategySelection = {
  strategy: VisualStrategy;
  reason: SelectionReason;
  eligible: VisualStrategy[];
  rejected: Record<string, string[]>;
};
