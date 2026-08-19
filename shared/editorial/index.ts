import type { EditorialPlan, EditorialPlannerInput } from './types';
import { buildEditorialFixture, type EditorialFixtureId } from './fixtures';
import { validateEditorialPlan } from './validateEditorialPlan';
import { resolvePlanIllustrations } from './selectIllustration';

const FIXTURE_IDS: readonly EditorialFixtureId[] = [
  'procrastination',
  'attention',
  'conceptual',
  'practical',
  'comparison',
  'no-application',
  'evidence',
] as const;

/**
 * Deterministic planner for the first vertical.
 * Gemini-backed planning can plug in later behind the same return type.
 */
export function compileEditorialPlan(input: EditorialPlannerInput): {
  plan: EditorialPlan | null;
  issues: { path: string; message: string }[];
  copyLimitIssues: { path: string; message: string; kind: 'chars' | 'words' }[];
  usedFixture: EditorialFixtureId;
} {
  const requested = input.fixtureId as EditorialFixtureId | undefined;
  const usedFixture: EditorialFixtureId =
    requested && FIXTURE_IDS.includes(requested) ? requested : pickFixtureFromText(input.sourceText);

  let plan = buildEditorialFixture(usedFixture);
  if (input.sourceTitle?.trim()) {
    plan = { ...plan, title: input.sourceTitle.trim() };
  }
  if (input.sourceLabel?.trim()) {
    plan = { ...plan, sourceLabel: input.sourceLabel.trim() };
  }
  if (input.sourceUrl?.trim()) {
    plan = { ...plan, sourceUrl: input.sourceUrl.trim() };
  }

  plan = resolvePlanIllustrations(plan);
  const validated = validateEditorialPlan(plan);
  return {
    plan: validated.plan,
    issues: validated.issues,
    copyLimitIssues: validated.copyLimitIssues,
    usedFixture,
  };
}

function pickFixtureFromText(text: string): EditorialFixtureId {
  const t = text.toLowerCase();
  if (/procrastin|aplaz|actuar|motivaci/.test(t)) return 'procrastination';
  if (/experimento|evidencia|berglas|estudio/.test(t)) return 'evidence';
  if (/compara|frente a|versus|vs\b/.test(t)) return 'comparison';
  if (/paso|hazlo|minutos|silencia|checklist|aplica/.test(t)) return 'practical';
  if (/sin método|solo describe|narrativ/.test(t)) return 'no-application';
  if (/atenci[oó]n|foco|interrup/.test(t)) return 'conceptual';
  return 'procrastination';
}

export * from './types';
export * from './validateEditorialPlan';
export * from './copyLimits';
export * from './tagNormalize';
export * from './localCatalog';
export * from './selectIllustration';
export * from './fixtures';
export * from './streamlineFamily';
export * from './visualLibrary';
export * from './selectVisualAsset';
export * from './sceneMarkup';
