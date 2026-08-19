import {
  VISUAL_LIBRARY,
  type EditorialVisualAsset,
  type VisualComposition,
  type VisualIntent,
  type VisualRole,
} from './visualLibrary';

export type VisualSelectionInput = {
  intent: VisualIntent;
  role: VisualRole;
  composition?: VisualComposition;
  /** Asset ids already used on the same page — prefer diversity. */
  usedIds?: readonly string[];
  queryTags?: readonly string[];
};

export type VisualSelection = {
  asset: EditorialVisualAsset;
  score: number;
  reason: string;
};

/**
 * Deterministic semantic selector. Same input → same asset.
 * Never uses rigid positional indexes (e.g. "item 0 = clock").
 * Pages receive the resolved asset; they do not know the provider.
 */
export function selectVisualAsset(input: VisualSelectionInput): VisualSelection {
  const used = new Set(input.usedIds ?? []);
  const tags = (input.queryTags ?? []).map((t) => t.toLowerCase());

  const ranked = VISUAL_LIBRARY.map((asset) => {
    let score = 0;
    const reasons: string[] = [];

    // Prefer intentTags; fall back to legacy `intents` if a stale bundle still ships it.
    const intentList = asset.intentTags ?? asset.intents ?? [];
    const compositionList = asset.compatibleCompositions ?? asset.compositions ?? [];
    const role = asset.visualRole ?? asset.role;
    const concepts = asset.concepts ?? [];
    const synonyms = asset.synonyms ?? [];

    if (intentList.includes(input.intent)) {
      score += 0.45;
      reasons.push('intent');
    }
    if (role === input.role) {
      score += 0.25;
      reasons.push('role');
    } else if (input.role === 'comparison' && role === 'metaphor') {
      score += 0.18;
      reasons.push('role-metaphor');
    } else if (input.role === 'sequence' && role === 'metaphor') {
      score += 0.18;
      reasons.push('role-sequence-part');
    }
    if (input.composition && compositionList.includes(input.composition)) {
      score += 0.15;
      reasons.push('composition');
    }

    const conceptHit = concepts.some(
      (c) => typeof c === 'string' && (tags.includes(c) || tags.some((t) => c.includes(t)))
    );
    const synonymHit = synonyms.some((s) => typeof s === 'string' && tags.includes(s));
    if (conceptHit || synonymHit) {
      score += 0.12;
      reasons.push('tags');
    }

    if (used.has(asset.id)) {
      score -= 0.35;
      reasons.push('diversity-penalty');
    }

    const tie = [...asset.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 1000;
    score += tie / 100_000;

    return { asset, score, reason: reasons.join('+') || 'fallback' };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 0.2) {
    const hero =
      VISUAL_LIBRARY.find((a) => a.visualRole === 'hero') ?? VISUAL_LIBRARY[0];
    return { asset: hero!, score: 0.2, reason: 'safe-fallback' };
  }
  return best;
}

export function selectVisualAssetsForIntents(
  intents: readonly VisualIntent[],
  role: VisualRole,
  composition?: VisualComposition
): VisualSelection[] {
  const used: string[] = [];
  return intents.map((intent) => {
    const sel = selectVisualAsset({ intent, role, composition, usedIds: used });
    used.push(sel.asset.id);
    return sel;
  });
}
