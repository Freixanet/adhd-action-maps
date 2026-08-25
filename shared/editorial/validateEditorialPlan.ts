import {
  collectEditorialCopyLimitIssues,
  type EditorialCopyLimitIssue,
} from './copyLimits';
import {
  EDITORIAL_STYLE_ID,
  type CognitiveGoal,
  type EditorialPlan,
  type EditorialPage,
  type IllustrationSpec,
  type PageArchetype,
  type ResolvedIllustration,
} from './types';

const COGNITIVE_GOALS: readonly CognitiveGoal[] = [
  'comprehend',
  'relate',
  'compare',
  'remember',
  'evaluate',
  'practice',
  'reflect',
  'apply',
] as const;

const ARCHETYPES: readonly PageArchetype[] = [
  'cover',
  'nucleus',
  'explanation',
  'comparison',
  'cause-effect',
  'process',
  'experiment',
  'evidence',
  'tools',
  'application',
  'reflection',
  'recap',
] as const;

export type EditorialValidationIssue = {
  path: string;
  message: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateIllustration(
  spec: IllustrationSpec | undefined,
  path: string,
  issues: EditorialValidationIssue[]
): void {
  if (!spec) return;
  if (spec.styleId !== EDITORIAL_STYLE_ID) {
    issues.push({ path: `${path}.styleId`, message: 'styleId must be nucleo-editorial-v1' });
  }
  if (!Array.isArray(spec.searchTags) || spec.searchTags.length < 3 || spec.searchTags.length > 6) {
    issues.push({
      path: `${path}.searchTags`,
      message: 'searchTags must contain 3–6 concrete tags',
    });
  }
  if (!isNonEmptyString(spec.fallbackAssetId)) {
    issues.push({ path: `${path}.fallbackAssetId`, message: 'fallbackAssetId required' });
  }
  if (!isNonEmptyString(spec.accessibilityLabel)) {
    issues.push({ path: `${path}.accessibilityLabel`, message: 'accessibilityLabel required' });
  }
  if (spec.optional !== true && spec.optional !== false) {
    issues.push({ path: `${path}.optional`, message: 'optional must be boolean' });
  }
}

function validateResolved(
  resolved: ResolvedIllustration | null | undefined,
  path: string,
  issues: EditorialValidationIssue[]
): void {
  if (resolved == null) return;
  if (resolved.styleId !== EDITORIAL_STYLE_ID) {
    issues.push({ path: `${path}.styleId`, message: 'resolved styleId must be nucleo-editorial-v1' });
  }
  if (resolved.provider === 'none' && resolved.score > 0) {
    issues.push({ path: `${path}.score`, message: 'provider none must have score 0' });
  }
}

function validatePage(page: EditorialPage, index: number, issues: EditorialValidationIssue[]): void {
  const path = `pages[${index}]`;
  if (!isNonEmptyString(page.id)) issues.push({ path: `${path}.id`, message: 'id required' });
  if (page.index !== index) {
    issues.push({ path: `${path}.index`, message: `index must equal ${index}` });
  }
  if (!ARCHETYPES.includes(page.archetype)) {
    issues.push({ path: `${path}.archetype`, message: 'unknown archetype' });
  }
  if (!COGNITIVE_GOALS.includes(page.cognitiveGoal)) {
    issues.push({ path: `${path}.cognitiveGoal`, message: 'unknown cognitive goal' });
  }
  if (!isNonEmptyString(page.title)) {
    issues.push({ path: `${path}.title`, message: 'title required' });
  }
  if (page.titleEmphasis != null && page.titleEmphasis !== '') {
    if (!isNonEmptyString(page.titleEmphasis)) {
      issues.push({ path: `${path}.titleEmphasis`, message: 'titleEmphasis must be non-empty when set' });
    } else if (
      isNonEmptyString(page.title) &&
      !page.title.toLowerCase().includes(page.titleEmphasis.toLowerCase())
    ) {
      issues.push({
        path: `${path}.titleEmphasis`,
        message: 'titleEmphasis must be a substring of title',
      });
    }
  }
  if (page.titleLines != null) {
    if (!Array.isArray(page.titleLines) || page.titleLines.length === 0) {
      issues.push({ path: `${path}.titleLines`, message: 'titleLines must be a non-empty string array when set' });
    } else {
      const joined = page.titleLines.join(' ').replace(/\s+/g, ' ').trim();
      const titleNorm = page.title.replace(/\s+/g, ' ').trim();
      if (joined !== titleNorm) {
        issues.push({
          path: `${path}.titleLines`,
          message: 'titleLines joined must equal title',
        });
      }
    }
  }
  validateIllustration(page.illustration, `${path}.illustration`, issues);
  validateResolved(page.resolvedIllustration, `${path}.resolvedIllustration`, issues);
}

/**
 * Strict structural validation. Rejects unknown styles and empty plans.
 * Copy line budgets are soft (`copyLimitIssues`) — planner must synthesize;
 * they do not fail `ok` so fixtures and progressive drafts still validate.
 */
export function validateEditorialPlan(input: unknown): {
  ok: boolean;
  plan: EditorialPlan | null;
  issues: EditorialValidationIssue[];
  copyLimitIssues: EditorialCopyLimitIssue[];
} {
  const issues: EditorialValidationIssue[] = [];
  if (!input || typeof input !== 'object') {
    return {
      ok: false,
      plan: null,
      issues: [{ path: '', message: 'plan must be an object' }],
      copyLimitIssues: [],
    };
  }
  const plan = input as EditorialPlan;
  if (plan.schemaVersion !== 1) {
    issues.push({ path: 'schemaVersion', message: 'schemaVersion must be 1' });
  }
  if (plan.styleId !== EDITORIAL_STYLE_ID) {
    issues.push({ path: 'styleId', message: 'styleId must be nucleo-editorial-v1' });
  }
  if (!isNonEmptyString(plan.title)) issues.push({ path: 'title', message: 'title required' });
  if (!isNonEmptyString(plan.nucleusClaim)) {
    issues.push({ path: 'nucleusClaim', message: 'nucleusClaim required' });
  }
  if (!Array.isArray(plan.pages) || plan.pages.length < 2) {
    issues.push({ path: 'pages', message: 'pages must contain at least 2 entries' });
  } else {
    plan.pages.forEach((page, i) => validatePage(page, i, issues));
  }
  if (plan.derivedMapIntent !== 'understand' && plan.derivedMapIntent !== 'apply') {
    issues.push({ path: 'derivedMapIntent', message: 'must be understand or apply' });
  }
  if (!plan.providerVersions?.planner || !plan.providerVersions?.illustration) {
    issues.push({ path: 'providerVersions', message: 'planner and illustration versions required' });
  }

  const copyLimitIssues =
    issues.length === 0 ? collectEditorialCopyLimitIssues(plan) : [];

  const ok = issues.length === 0;
  return { ok, plan: ok ? plan : null, issues, copyLimitIssues };
}

/** Map per-idea cognitive goals → legacy MapIntent for engines that still need it. */
export function deriveMapIntentFromGoals(goals: readonly CognitiveGoal[]): 'understand' | 'apply' {
  if (goals.some((g) => g === 'apply' || g === 'practice')) return 'apply';
  return 'understand';
}
