import { describe, expect, it } from 'vitest';
import { selectVisualAsset, selectVisualAssetsForIntents } from './selectVisualAsset';
import {
  EDITORIAL_ASSET_CATALOG,
  PROVISIONAL_ILLUSTRATION_FAMILY,
  PROVISIONAL_ILLUSTRATION_PROVIDER,
} from './visualLibrary';
import { buildEditorialFixture } from './fixtures';
import { validateEditorialPlan } from './validateEditorialPlan';

describe('visual library selector', () => {
  it('is deterministic for the same input', () => {
    const a = selectVisualAsset({
      intent: 'progress-toward-goal',
      role: 'hero',
      composition: 'path-progress',
    });
    const b = selectVisualAsset({
      intent: 'progress-toward-goal',
      role: 'hero',
      composition: 'path-progress',
    });
    expect(a.asset.id).toBe(b.asset.id);
    expect(a.asset.localModule).toBe('hiking');
    expect(a.asset.provider).toBe(PROVISIONAL_ILLUSTRATION_PROVIDER);
    expect(a.asset.family).toBe(PROVISIONAL_ILLUSTRATION_FAMILY);
  });

  it('does not use rigid indexes — intents pick distinct metaphors', () => {
    const picks = selectVisualAssetsForIntents(
      ['procrastination', 'perfectionism', 'overplanning'],
      'metaphor',
      'vertical-blocks'
    );
    const ids = picks.map((p) => p.asset.id);
    expect(new Set(ids).size).toBe(3);
    expect(picks.map((p) => p.asset.localModule).sort()).toEqual(
      ['procrastination', 'schedule', 'target'].sort()
    );
  });

  it('self-handicap strip resolves choice → exams → anxiety by intent', () => {
    const picks = selectVisualAssetsForIntents(
      ['choice', 'hard-test', 'ego-protection'],
      'metaphor',
      'causal-strip'
    );
    expect(picks.map((p) => p.asset.localModule)).toEqual(['choice', 'exams', 'anxiety']);
  });

  it('catalog assets are local modules only (no remote paint path)', () => {
    for (const asset of EDITORIAL_ASSET_CATALOG) {
      expect(asset.localModule.length).toBeGreaterThan(0);
      expect(asset.attributionRequired).toBe(true);
    }
  });
});

describe('editorial fixtures v2', () => {
  it('procrastination has 3 pages and no meta lede', () => {
    const plan = buildEditorialFixture('procrastination');
    expect(validateEditorialPlan(plan).ok).toBe(true);
    expect(plan.pages).toHaveLength(3);
    expect(plan.pages[1]?.body ?? '').not.toMatch(/sin leer todo el texto/i);
    expect(plan.attribution?.required).toBe(true);
  });

  it('attention fixture validates and differs visually via planner id', () => {
    const plan = buildEditorialFixture('attention');
    expect(validateEditorialPlan(plan).ok).toBe(true);
    expect(plan.pages).toHaveLength(3);
    expect(plan.providerVersions.planner).toContain('attention');
    expect(plan.title).not.toBe(buildEditorialFixture('procrastination').title);
  });
});
