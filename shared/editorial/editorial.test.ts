import { describe, expect, it } from 'vitest';
import {
  ILLUSTRATION_SCORE_THRESHOLD,
  buildEditorialFixture,
  compileEditorialPlan,
  collectEditorialCopyLimitIssues,
  deriveMapIntentFromGoals,
  localCandidatesFromCatalog,
  normalizeIllustrationTags,
  scoreIllustrationCandidate,
  selectIllustration,
  validateEditorialPlan,
  EDITORIAL_COPY_LIMITS_CONTRACT,
  EDITORIAL_COPY_SOFT_MAX_CHARS,
  EDITORIAL_STYLE_ID,
  type EditorialPlan,
  type IllustrationSpec,
} from './index';

describe('editorial plan validation', () => {
  it('accepts procrastination fixture', () => {
    const plan = buildEditorialFixture('procrastination');
    const result = validateEditorialPlan(plan);
    expect(result.ok).toBe(true);
    expect(result.copyLimitIssues).toEqual([]);
    expect(result.plan?.pages.length).toBe(3);
    expect(result.plan?.pages.map((p) => p.archetype)).toEqual([
      'cover',
      'comparison',
      'experiment',
    ]);
    expect(result.plan?.derivedMapIntent).toBe('understand');
  });

  it('rejects unknown styleId', () => {
    const plan = buildEditorialFixture('conceptual');
    const broken = {
      ...plan,
      styleId: 'made-up-style',
    };
    const result = validateEditorialPlan(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'styleId')).toBe(true);
  });

  it('no-application fixture does not force apply intent', () => {
    const plan = buildEditorialFixture('no-application');
    expect(plan.derivedMapIntent).toBe('understand');
    expect(plan.pages.some((p) => p.archetype === 'application')).toBe(false);
  });
});

describe('editorial copy limits', () => {
  it('exposes a prompt contract with line budgets', () => {
    expect(EDITORIAL_COPY_LIMITS_CONTRACT).toContain('Título de portada');
    expect(EDITORIAL_COPY_LIMITS_CONTRACT).toContain('sintetiza');
    expect(EDITORIAL_COPY_LIMITS_CONTRACT).toContain('tipografía');
  });

  it('flags oversized cover title and sequence labels without failing structure', () => {
    const base = buildEditorialFixture('procrastination');
    const bloated: EditorialPlan = {
      ...base,
      pages: base.pages.map((page) => {
        if (page.archetype === 'cover') {
          return {
            ...page,
            title: 'A'.repeat(EDITORIAL_COPY_SOFT_MAX_CHARS.coverTitle + 8),
            titleEmphasis: undefined,
            titleLines: undefined,
          };
        }
        if (page.archetype === 'experiment') {
          return {
            ...page,
            items: [
              { id: 's1', title: 'una etiqueta demasiado larga', body: 'pie' },
              { id: 's2', title: 'ok', body: 'pie' },
              { id: 's3', title: 'ok', body: 'pie' },
            ],
          };
        }
        return page;
      }),
    };
    const structural = validateEditorialPlan(bloated);
    expect(structural.ok).toBe(true);
    expect(structural.copyLimitIssues.some((i) => i.path.endsWith('.title') && i.kind === 'chars')).toBe(
      true
    );
    expect(structural.copyLimitIssues.some((i) => i.kind === 'words')).toBe(true);
  });

  it('ships fixtures within soft copy budgets', () => {
    for (const id of [
      'procrastination',
      'attention',
      'conceptual',
      'practical',
      'comparison',
      'no-application',
      'evidence',
    ] as const) {
      const issues = collectEditorialCopyLimitIssues(buildEditorialFixture(id));
      expect(issues, id).toEqual([]);
    }
  });
});

describe('cognitive derivation', () => {
  it('maps practice/apply to apply intent', () => {
    expect(deriveMapIntentFromGoals(['comprehend', 'apply'])).toBe('apply');
    expect(deriveMapIntentFromGoals(['comprehend', 'reflect'])).toBe('understand');
  });
});

describe('illustration tags and selection', () => {
  it('normalizes synonyms and caps at 6', () => {
    expect(normalizeIllustrationTags(['Procrastinar', 'montaña', 'meta', 'meta', 'x'])).toEqual([
      'procrastinate',
      'peak',
      'goal',
      'x',
    ]);
  });

  it('blocks wrong style and uses threshold', () => {
    const spec: IllustrationSpec = {
      concept: 'test',
      visualRole: 'hero-scene',
      metaphor: 'm',
      subjects: ['peak'],
      mood: 'clear',
      composition: 'centered',
      emphasis: 'e',
      searchTags: ['peak', 'sunrise', 'path', 'goal'],
      styleId: EDITORIAL_STYLE_ID,
      fallbackAssetId: 'local-peak-sunrise',
      accessibilityLabel: 'cima',
      priority: 'required',
      optional: false,
    };
    const resolved = selectIllustration(spec);
    expect(resolved.provider).toBe('local');
    expect(resolved.score).toBeGreaterThanOrEqual(ILLUSTRATION_SCORE_THRESHOLD);

    const badStyle = selectIllustration({ ...spec, styleId: 'other' as typeof EDITORIAL_STYLE_ID });
    expect(badStyle.provider).toBe('none');
  });

  it('scores role matches higher', () => {
    const spec: IllustrationSpec = {
      concept: 'c',
      visualRole: 'comparison',
      metaphor: 'm',
      subjects: ['compare'],
      mood: 'm',
      composition: 'left-right',
      emphasis: 'e',
      searchTags: ['compare', 'balance', 'evaluate'],
      styleId: EDITORIAL_STYLE_ID,
      fallbackAssetId: 'local-compare-scales',
      accessibilityLabel: 'cmp',
      priority: 'required',
      optional: false,
    };
    const candidates = localCandidatesFromCatalog();
    const compare = candidates.find((c) => c.assetId === 'local-compare-scales')!;
    const neutral = candidates.find((c) => c.assetId === 'local-neutral-spacer')!;
    expect(scoreIllustrationCandidate(spec, compare)).toBeGreaterThan(
      scoreIllustrationCandidate(spec, neutral)
    );
  });

  it('optional miss can resolve to none when fallback missing', () => {
    const spec: IllustrationSpec = {
      concept: 'c',
      visualRole: 'evidence-visual',
      metaphor: 'm',
      subjects: ['zzzz'],
      mood: 'm',
      composition: 'centered',
      emphasis: 'e',
      searchTags: ['zzzz', 'yyyy', 'xxxx'],
      styleId: EDITORIAL_STYLE_ID,
      fallbackAssetId: 'does-not-exist',
      accessibilityLabel: 'a',
      priority: 'optional',
      optional: true,
    };
    const resolved = selectIllustration(spec, []);
    expect(['none', 'local']).toContain(resolved.provider);
  });
});

describe('compileEditorialPlan', () => {
  it('picks practical fixture from actionable text', () => {
    const { plan, usedFixture, issues } = compileEditorialPlan({
      sourceText: 'Silencia avisos 25 minutos y haz el checklist hoy',
    });
    expect(issues).toEqual([]);
    expect(usedFixture).toBe('practical');
    expect(plan?.derivedMapIntent).toBe('apply');
  });

  it('all fixtures validate', () => {
    for (const id of [
      'procrastination',
      'conceptual',
      'practical',
      'comparison',
      'no-application',
      'evidence',
    ] as const) {
      const plan = buildEditorialFixture(id);
      expect(validateEditorialPlan(plan).ok).toBe(true);
    }
  });
});

describe('client secret hygiene', () => {
  it('shared editorial module has no API key literals', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(__dirname);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const file of files) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(src.includes('STREAMLINE_API_KEY=')).toBe(false);
      expect(src).not.toMatch(/sk_live_[A-Za-z0-9]+/);
    }
  });
});
