import { getLocalAssetById, LOCAL_ILLUSTRATION_CATALOG } from './localCatalog';
import { normalizeIllustrationTags } from './tagNormalize';
import {
  EDITORIAL_STYLE_ID,
  type IllustrationSpec,
  type ResolvedIllustration,
} from './types';

/** Minimum score to accept a non-fallback match. Below → use fallback or none. */
export const ILLUSTRATION_SCORE_THRESHOLD = 0.42;

export type IllustrationCandidate = {
  assetId: string;
  provider: 'local' | 'streamline';
  providerAssetKey: string;
  tags: readonly string[];
  roles: readonly string[];
  compositions: readonly string[];
  accessibilityLabel: string;
  license: ResolvedIllustration['license'];
  attributionRequired: boolean;
  attributionText?: string;
  localCatalogId?: string;
  /** Exact Streamline familySlug when provider is streamline. */
  familySlug?: string;
};

function jaccard(a: readonly string[], b: readonly string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const x of a) if (setB.has(x)) inter += 1;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

export function scoreIllustrationCandidate(
  spec: IllustrationSpec,
  candidate: IllustrationCandidate
): number {
  const tags = normalizeIllustrationTags(spec.searchTags ?? []);
  const tagScore = jaccard(tags, candidate.tags ?? []);
  const roleHit = (candidate.roles ?? []).includes(spec.visualRole) ? 1 : 0;
  const compositionHit = (candidate.compositions ?? []).includes(spec.composition) ? 1 : 0;
  // Weighted: meaning first, then role, then composition.
  return tagScore * 0.55 + roleHit * 0.3 + compositionHit * 0.15;
}

export function localCandidatesFromCatalog(): IllustrationCandidate[] {
  return LOCAL_ILLUSTRATION_CATALOG.map((asset) => ({
    assetId: asset.id,
    provider: 'local' as const,
    providerAssetKey: asset.id,
    tags: asset.tags,
    roles: asset.roles,
    compositions: asset.compositions,
    accessibilityLabel: asset.accessibilityLabel,
    license: 'nucleo-local' as const,
    attributionRequired: false,
    localCatalogId: asset.id,
  }));
}

/**
 * Pick best illustration. Never returns a low-confidence decorative match.
 * Optional specs may resolve to provider `none`.
 */
export function selectIllustration(
  spec: IllustrationSpec,
  extraCandidates: readonly IllustrationCandidate[] = []
): ResolvedIllustration {
  if (spec.styleId !== EDITORIAL_STYLE_ID) {
    return noneResolution(spec, 0);
  }

  const pool = [...localCandidatesFromCatalog(), ...extraCandidates].filter(
    (c) => c.provider === 'local' || c.license !== 'streamline-unknown'
  );

  const ranked = pool
    .map((c) => ({ c, score: scoreIllustrationCandidate(spec, c) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (best && best.score >= ILLUSTRATION_SCORE_THRESHOLD) {
    return toResolved(best.c, best.score, spec);
  }

  const fallback = getLocalAssetById(spec.fallbackAssetId);
  if (fallback) {
    const fb = localCandidatesFromCatalog().find((c) => c.assetId === fallback.id);
    if (fb) {
      const score = Math.max(scoreIllustrationCandidate(spec, fb), 0.35);
      // Explicit fallback is allowed even slightly under threshold.
      return toResolved(fb, score, spec);
    }
  }

  if (spec.optional || spec.priority === 'optional') {
    return noneResolution(spec, 0);
  }

  // Required but nothing good: still avoid wrong art — use neutral spacer.
  const neutral = localCandidatesFromCatalog().find((c) => c.assetId === 'local-neutral-spacer');
  if (neutral) return toResolved(neutral, 0.2, spec);
  return noneResolution(spec, 0);
}

function toResolved(
  c: IllustrationCandidate,
  score: number,
  spec: IllustrationSpec
): ResolvedIllustration {
  return {
    assetId: c.assetId,
    provider: c.provider,
    styleId: EDITORIAL_STYLE_ID,
    providerAssetKey: c.providerAssetKey,
    license: c.license,
    attributionRequired: c.attributionRequired,
    attributionText: c.attributionText,
    accessibilityLabel: spec.accessibilityLabel || c.accessibilityLabel,
    localCatalogId: c.localCatalogId,
    familySlug: c.familySlug,
    score,
  };
}

function noneResolution(spec: IllustrationSpec, score: number): ResolvedIllustration {
  return {
    assetId: 'none',
    provider: 'none',
    styleId: EDITORIAL_STYLE_ID,
    providerAssetKey: '',
    license: 'nucleo-local',
    attributionRequired: false,
    accessibilityLabel: spec.accessibilityLabel,
    score,
  };
}

/** Resolve every page illustration in a plan (mutates copies). */
export function resolvePlanIllustrations<T extends { pages: { illustration?: IllustrationSpec; resolvedIllustration?: ResolvedIllustration | null }[] }>(
  plan: T,
  extraCandidates: readonly IllustrationCandidate[] = []
): T {
  return {
    ...plan,
    pages: plan.pages.map((page) => {
      if (!page.illustration) return { ...page, resolvedIllustration: null };
      return {
        ...page,
        resolvedIllustration: selectIllustration(page.illustration, extraCandidates),
      };
    }),
  };
}
