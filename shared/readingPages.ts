import type { ActionMapData } from './contracts';

/** True when the reading flow inserts the concept-map hub after TLDR. */
export function hasConceptMapHub(data: ActionMapData | null | undefined): boolean {
  return Boolean(data?.conceptMap && data.conceptMap.nodes.length >= 4);
}

/**
 * Max `currentStep` index in step mode.
 * Pages: 0 intro, 1 TLDR, [2 hub if present], then content steps.
 * Without hub: last index = steps.length + 1
 * With hub: last index = steps.length + 2
 */
export function maxReadingStepIndex(
  stepCount: number,
  data?: ActionMapData | null
): number {
  return stepCount + 1 + (hasConceptMapHub(data) ? 1 : 0);
}

/** Number of fixed reading pages (intro + tldr + optional hub + steps). */
export function readingPageCount(stepCount: number, data?: ActionMapData | null): number {
  return maxReadingStepIndex(stepCount, data) + 1;
}

export type ReadingPageKind = 'intro' | 'tldr' | 'conceptMap' | 'step';

export function resolveReadingPage(
  currentStep: number,
  data: ActionMapData | null | undefined
): { kind: ReadingPageKind; stepIndex?: number } {
  if (currentStep <= 0) return { kind: 'intro' };
  if (currentStep === 1) return { kind: 'tldr' };
  const hub = hasConceptMapHub(data);
  if (hub && currentStep === 2) return { kind: 'conceptMap' };
  const stepIndex = hub ? currentStep - 2 : currentStep - 1;
  return { kind: 'step', stepIndex };
}
