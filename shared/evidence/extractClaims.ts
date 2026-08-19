/**
 * Deterministic claim extraction from UnderstandingArtifact.
 * Titles/nav/UI strings are never claims.
 * Each claim carries structural surface bindings (slot/index/id).
 */

import type { UnderstandingArtifact, UnderstandingUnit } from '../understanding/types';
import { stableRelationId } from '../understanding/relationIds';
import { buildClaimIdentitySeed, stableClaimId } from './claimIds';
import type {
  ClaimCriticality,
  ClaimSurfaceBinding,
  ClaimType,
  ContentClaim,
  EpistemicStatus,
} from './types';

const CAUSAL_HINT = /\b(causa|causan|provoca|debido a|porque|causes?|leads? to)\b/i;
const NUMERIC_HINT = /\d/;
const COMPARE_HINT = /\b(más|menos|mayor|menor|mejor|peor|versus|frente a|compared)\b/i;
const RECOMMEND_HINT = /\b(debe|debería|recomienda|conviene|hay que|should|recommend)\b/i;
const MEDICAL_LEGAL =
  /\b(médic|medic|legal|financier|seguridad|diagnóst|tratamiento|inversión|legalmente)\b/i;

function classifyType(text: string, role?: string): ClaimType {
  if (role === 'thesis' || role === 'synthesis') return 'thesis';
  if (role === 'limitation' || role === 'caution') return 'limitation';
  if (role === 'example') return 'example';
  if (CAUSAL_HINT.test(text)) return 'causal';
  if (NUMERIC_HINT.test(text) && /\d/.test(text)) return 'numeric';
  if (COMPARE_HINT.test(text)) return 'comparative';
  if (RECOMMEND_HINT.test(text)) return 'recommendation';
  if (role === 'concept') return 'definition';
  return 'factual';
}

function criticalityFor(args: {
  text: string;
  claimType: ClaimType;
  fromNuclear?: boolean;
  fromThesis?: boolean;
  fromClosure?: boolean;
  fromCaution?: boolean;
}): ClaimCriticality {
  if (args.fromNuclear || args.fromThesis || args.fromClosure) return 'critical';
  if (
    args.claimType === 'causal' ||
    args.claimType === 'numeric' ||
    args.claimType === 'comparative' ||
    args.claimType === 'recommendation' ||
    args.fromCaution ||
    MEDICAL_LEGAL.test(args.text)
  ) {
    return 'critical';
  }
  if (args.claimType === 'limitation' || args.claimType === 'thesis') return 'important';
  return 'auxiliary';
}

function epistemicFor(claimType: ClaimType, fromCaution: boolean): EpistemicStatus {
  if (claimType === 'recommendation') return 'source_recommendation';
  if (claimType === 'interpretation') return 'inference';
  if (fromCaution || claimType === 'limitation') return 'faithful_paraphrase';
  return 'faithful_paraphrase';
}

function pushClaim(
  bag: ContentClaim[],
  seed: string,
  partial: Omit<ContentClaim, 'id' | 'evidenceLinkIds' | 'abstentionCodes' | 'presentationStatus'>
) {
  const id = stableClaimId(seed, partial.slotKey, bag.length);
  bag.push({
    ...partial,
    id,
    presentationStatus: 'pending',
    evidenceLinkIds: [],
    abstentionCodes: [],
  });
}

export function splitAtomicSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

/**
 * Extract atomic claims from a complete understanding artifact.
 */
export function extractClaimsFromUnderstanding(
  artifact: UnderstandingArtifact,
  opts: { contentHash: string; sourceVersionId?: string }
): ContentClaim[] {
  const seed = buildClaimIdentitySeed({
    contentHash: opts.contentHash || artifact.contentHash || 'local',
    sourceVersionId: opts.sourceVersionId || artifact.sourceVersionId,
    depth: artifact.depth,
  });
  const claims: ContentClaim[] = [];
  const bp = artifact.blueprint;
  const nuclear = bp.essential.nuclearIdea.trim();
  const synthesis = bp.essential.layer0Synthesis.trim();

  const nuclearSurfaces: ClaimSurfaceBinding[] = [{ kind: 'coreIdea' }];
  if (synthesis === nuclear) {
    nuclearSurfaces.push({ kind: 'coreSupport' }, { kind: 'layer0.what' });
  }

  pushClaim(claims, seed, {
    text: nuclear,
    claimType: 'thesis',
    criticality: 'critical',
    epistemicStatus: 'faithful_paraphrase',
    slotKey: 'nuclear',
    surfaces: nuclearSurfaces,
  });

  if (synthesis && synthesis !== nuclear) {
    pushClaim(claims, seed, {
      text: synthesis,
      claimType: 'thesis',
      criticality: 'critical',
      epistemicStatus: 'faithful_paraphrase',
      slotKey: 'layer0:synthesis',
      surfaces: [{ kind: 'coreSupport' }, { kind: 'layer0.what' }],
    });
  }

  pushClaim(claims, seed, {
    text: bp.essential.layer0Why.trim(),
    claimType: 'interpretation',
    criticality: 'important',
    epistemicStatus: 'inference',
    slotKey: 'layer0:why',
    surfaces: [{ kind: 'layer0.why' }],
  });

  bp.essential.layer0Actions.forEach((action, i) => {
    pushClaim(claims, seed, {
      text: action.trim(),
      claimType: 'recommendation',
      criticality: 'important',
      epistemicStatus: 'nucleo_adaptation',
      slotKey: `layer0:action:${i}`,
      surfaces: [{ kind: 'layer0.action', index: i }],
    });
  });

  bp.essential.essentialIdeas.forEach((idea, i) => {
    const text = idea.desc.trim() || idea.title.trim();
    if (!text) return;
    pushClaim(claims, seed, {
      text,
      claimType: classifyType(text),
      criticality: criticalityFor({
        text,
        claimType: classifyType(text),
        fromThesis: true,
      }),
      epistemicStatus: 'faithful_paraphrase',
      slotKey: `essential:${i}`,
      surfaces: [{ kind: 'tldr', index: i }],
    });
  });

  bp.essential.limitsOrConditions.forEach((lim, i) => {
    pushClaim(claims, seed, {
      text: lim.trim(),
      claimType: 'limitation',
      criticality: 'critical',
      epistemicStatus: 'faithful_paraphrase',
      slotKey: `limit:${i}`,
      surfaces: [{ kind: 'coverage.limit', index: i }],
    });
  });

  bp.essential.doesNotClaim.forEach((d, i) => {
    pushClaim(claims, seed, {
      text: d.trim(),
      claimType: 'limitation',
      criticality: 'important',
      epistemicStatus: 'faithful_paraphrase',
      slotKey: `does_not:${i}`,
    });
  });

  const addUnitClaims = (unit: UnderstandingUnit, unitIndex: number) => {
    const sentences = splitAtomicSentences(unit.explanation);
    sentences.forEach((sent, si) => {
      const claimType = classifyType(sent, unit.role);
      const surfaces: ClaimSurfaceBinding[] = [
        { kind: 'step.prose', unitId: unit.id, sentenceIndex: si },
        { kind: 'knowledge', unitId: unit.id, sentenceIndex: si },
      ];
      pushClaim(claims, seed, {
        unitId: unit.id,
        text: sent,
        claimType,
        criticality: criticalityFor({
          text: sent,
          claimType,
          fromThesis: unit.role === 'thesis',
        }),
        epistemicStatus: epistemicFor(claimType, false),
        slotKey: `unit:${unitIndex}:exp:${si}`,
        surfaces,
      });
    });
    unit.cautions.forEach((c, ci) => {
      pushClaim(claims, seed, {
        unitId: unit.id,
        text: c.trim(),
        claimType: 'limitation',
        criticality: 'critical',
        epistemicStatus: 'faithful_paraphrase',
        slotKey: `unit:${unitIndex}:caution:${ci}`,
        surfaces: [{ kind: 'step.caution', unitId: unit.id, index: ci }],
      });
    });
    unit.examples.forEach((ex, ei) => {
      pushClaim(claims, seed, {
        unitId: unit.id,
        text: ex.trim(),
        claimType: 'example',
        criticality: 'auxiliary',
        epistemicStatus: 'faithful_paraphrase',
        slotKey: `unit:${unitIndex}:example:${ei}`,
        surfaces: [{ kind: 'step.example', unitId: unit.id, index: ei }],
      });
    });
    // relationId matches compile emit identity (valid targets only).
    let emitOrdinal = 0;
    for (const rel of unit.relations) {
      const target = artifact.units.find((u) => u.id === rel.toUnitId);
      if (!target) continue;
      const relationId =
        rel.id && rel.id.trim().length > 0
          ? rel.id.trim()
          : stableRelationId(unit.id, rel.toUnitId, rel.kind, emitOrdinal);
      emitOrdinal += 1;
      if (/caus|contrib/i.test(rel.kind)) {
        const text = `«${unit.title}» ${rel.kind} «${target.title}».`;
        pushClaim(claims, seed, {
          unitId: unit.id,
          text,
          claimType: 'causal',
          criticality: 'critical',
          epistemicStatus: 'inference',
          slotKey: `unit:${unitIndex}:rel:${rel.toUnitId}:${rel.kind}`,
          surfaces: [
            {
              kind: 'step.relation.callout',
              unitId: unit.id,
              relationId,
            },
            {
              kind: 'step.relation.comparison',
              unitId: unit.id,
              relationId,
            },
          ],
        });
      }
    }
  };

  artifact.units.forEach((u, i) => addUnitClaims(u, i));

  if (artifact.closure) {
    splitAtomicSentences(artifact.closure.finalSynthesis).forEach((s, i) => {
      pushClaim(claims, seed, {
        text: s,
        claimType: 'thesis',
        criticality: 'critical',
        epistemicStatus: 'faithful_paraphrase',
        slotKey: `closure:synth:${i}`,
        surfaces: [{ kind: 'closure.summary', sentenceIndex: i }],
      });
    });
    artifact.closure.mainLearnings.forEach((l, i) => {
      pushClaim(claims, seed, {
        text: l.trim(),
        claimType: classifyType(l),
        criticality: 'critical',
        epistemicStatus: 'faithful_paraphrase',
        slotKey: `closure:learn:${i}`,
        surfaces: [{ kind: 'closure.takeaway', index: i }],
      });
    });
  }

  return claims;
}
