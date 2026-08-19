/**
 * S05 exact graph idempotency, surfaces validation, relation dual-surface policy.
 */

import { describe, expect, it } from 'vitest';
import { applyEvidenceToMap, collectVisibleConclusionTexts } from './applyToMap';
import { digestForPersist, computeEvidenceGraphDigest } from './graphDigest';
import { validateClaimSurfaceBinding, validateClaimSurfaceBindings } from './validateSurfaces';
import { validateContentClaim } from './validate';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './versions';
import type { ContentClaim, EvidenceArtifact } from './types';
import type { ActionMapData } from '../contracts';

function baseClaim(partial: Partial<ContentClaim> & Pick<ContentClaim, 'id' | 'text' | 'slotKey'>): ContentClaim {
  return {
    claimType: 'causal',
    criticality: 'critical',
    epistemicStatus: 'inference',
    presentationStatus: 'pending',
    evidenceLinkIds: [],
    abstentionCodes: [],
    ...partial,
  };
}

function miniEvidence(claims: ContentClaim[]): EvidenceArtifact {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    promptVersion: EVIDENCE_PROMPT_VERSION,
    verifierVersion: EVIDENCE_VERIFIER_VERSION,
    compilerVersion: EVIDENCE_COMPILER_VERSION,
    modelVersion: 'test',
    modelRoute: EVIDENCE_MODEL_ROUTE,
    status: 'complete',
    claims,
    links: [],
    assessments: claims.map((c) => ({
      claimId: c.id,
      allowedChunkIdsUsed: [],
      entailment: null,
      contradiction: false,
      qualifierPreservation: null,
      negationPreservation: null,
      numericOk: null,
      nameOk: null,
      dateOk: null,
      unitOk: null,
      relation: null,
      verifierStatus: 'uncertain',
      epistemicStatus: c.epistemicStatus,
      abstentionCodes: c.abstentionCodes,
      checkCodes: [],
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      promptVersion: EVIDENCE_PROMPT_VERSION,
      verifierVersion: EVIDENCE_VERIFIER_VERSION,
      modelVersion: 'test',
      modelRoute: EVIDENCE_MODEL_ROUTE,
    })),
    evidenceCoverage: {
      criticalTotal: claims.filter((c) => c.criticality === 'critical').length,
      verified: 0,
      qualified: 0,
      contradicted: claims.filter((c) => c.presentationStatus === 'contradicted').length,
      degraded: claims.filter((c) => c.presentationStatus === 'degraded').length,
      uncertain: 0,
      unanchored: 0,
      inference: claims.filter((c) => c.presentationStatus === 'inference').length,
      summaryLines: ['test'],
    },
    sourceCoverage: {
      textual: null,
      extractionConfidence: null,
      isComplete: true,
      limitations: [],
    },
  };
}

function relationMap(): ActionMapData {
  const r0 = 'rel_test_0';
  return {
    title: 'Mapa',
    coreIdea: 'Nuclear',
    coreSupport: 'Support',
    tldr: [],
    steps: [
      {
        id: 'u1',
        shortNav: 'A',
        title: 'Unidad A',
        time: '~3 min',
        content: [
          {
            type: 'comparison',
            columns: ['Desde', 'Hacia'],
            rows: [
              {
                label: 'causa / contribuye a',
                values: ['Unidad A', 'Unidad B'],
                relationId: r0,
              },
            ],
          },
          {
            type: 'callout',
            label: 'Conexión',
            kind: 'info',
            text: '«Unidad A» causa / contribuye a «Unidad B».',
            relationId: r0,
          },
        ],
      },
    ],
  };
}

describe('graph digest exactness', () => {
  it('changes digest when claim text changes with same counts', () => {
    const a = miniEvidence([
      baseClaim({
        id: 'c1',
        text: 'Texto A',
        presentationStatus: 'verified',
        slotKey: 'nuclear',
      }),
    ]);
    const b = miniEvidence([
      baseClaim({
        id: 'c1',
        text: 'Texto B',
        presentationStatus: 'verified',
        slotKey: 'nuclear',
      }),
    ]);
    const da = digestForPersist({ mapId: 'm1', contentHash: 'h', evidence: a });
    const db = digestForPersist({ mapId: 'm1', contentHash: 'h', evidence: b });
    expect(da.digest).not.toBe(db.digest);
  });

  it('changes digest when presentationStatus / pins / route change', () => {
    const base = miniEvidence([
      baseClaim({
        id: 'c1',
        text: 'Mismo',
        presentationStatus: 'verified',
        slotKey: 'nuclear',
      }),
    ]);
    const d0 = digestForPersist({ mapId: 'm1', contentHash: 'h', evidence: base }).digest;
    const dStatus = digestForPersist({
      mapId: 'm1',
      contentHash: 'h',
      evidence: miniEvidence([
        baseClaim({
          id: 'c1',
          text: 'Mismo',
          presentationStatus: 'qualified',
          slotKey: 'nuclear',
        }),
      ]),
    }).digest;
    const dRoute = digestForPersist({
      mapId: 'm1',
      contentHash: 'h',
      evidence: { ...base, modelRoute: 'other-route' },
    }).digest;
    const dPrompt = digestForPersist({
      mapId: 'm1',
      contentHash: 'h',
      evidence: { ...base, promptVersion: 'other-prompt' },
    }).digest;
    const dVersion = digestForPersist({
      mapId: 'm1',
      contentHash: 'h',
      sourceVersionId: 'sv-1',
      evidence: base,
    }).digest;
    expect(dStatus).not.toBe(d0);
    expect(dRoute).not.toBe(d0);
    expect(dPrompt).not.toBe(d0);
    expect(dVersion).not.toBe(d0);
  });

  it('is stable for identical payloads', () => {
    const e = miniEvidence([
      baseClaim({ id: 'c1', text: 'X', presentationStatus: 'verified', slotKey: 'nuclear' }),
    ]);
    const a = digestForPersist({ mapId: 'm1', contentHash: 'h', evidence: e });
    const b = digestForPersist({ mapId: 'm1', contentHash: 'h', evidence: e });
    expect(a.digest).toBe(b.digest);
    expect(a.digest).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('claim.surfaces fail-closed', () => {
  it('rejects unknown kind, bad indices, and step.relation without relKind', () => {
    expect(validateClaimSurfaceBinding({ kind: 'nope' }).ok).toBe(false);
    expect(validateClaimSurfaceBinding({ kind: 'tldr', index: 1.5 }).ok).toBe(false);
    expect(validateClaimSurfaceBinding({ kind: 'tldr', index: -1 }).ok).toBe(false);
    expect(validateClaimSurfaceBinding({ kind: 'tldr', index: '0' }).ok).toBe(false);
    expect(
      validateClaimSurfaceBinding({
        kind: 'step.relation',
        unitId: 'u1',
        toUnitId: 'u2',
      }).ok
    ).toBe(false);
      expect(
      validateClaimSurfaceBindings([
        { kind: 'step.relation.callout', unitId: 'u1', relationId: 'rel_abc' },
      ]).ok
    ).toBe(true);
  });

  it('validateContentClaim rejects hostile surfaces', () => {
    const r = validateContentClaim({
      id: 'c1',
      text: 'x',
      claimType: 'factual',
      criticality: 'critical',
      epistemicStatus: 'faithful_paraphrase',
      presentationStatus: 'verified',
      evidenceLinkIds: [],
      abstentionCodes: [],
      slotKey: 'nuclear',
      surfaces: [{ kind: 'ghost.surface' }],
    });
    expect(r.ok).toBe(false);
  });

  it('applyEvidenceToMap never throws on hostile surfaces', () => {
    const map = relationMap();
    const hostile = miniEvidence([
      baseClaim({
        id: 'c1',
        text: 'rel',
        unitId: 'u1',
        presentationStatus: 'inference',
        slotKey: 'unit:0:rel:u2:causes',
        surfaces: [
          { kind: 'unknown' } as never,
          { kind: 'tldr', index: -3 } as never,
          { kind: 'step.relation', unitId: 'u1', toUnitId: 'u2' } as never,
        ],
      }),
    ]);
    expect(() => applyEvidenceToMap(map, hostile)).not.toThrow();
  });
});

describe('relation dual surfaces epistemic policy', () => {
  it('inference labels both comparison and Conexión callout', () => {
    const map = relationMap();
    const claim = baseClaim({
      id: 'rel1',
      text: '«Unidad A» causes «Unidad B».',
      unitId: 'u1',
      presentationStatus: 'inference',
      presentationText: '«Unidad A» causes «Unidad B».',
      slotKey: 'unit:0:rel:u2:causes',
      surfaces: [
        { kind: 'step.relation.callout', unitId: 'u1', relationId: 'rel_test_0' },
        { kind: 'step.relation.comparison', unitId: 'u1', relationId: 'rel_test_0' },
      ],
    });
    const applied = applyEvidenceToMap(map, miniEvidence([claim]));
    const texts = collectVisibleConclusionTexts(applied);
    expect(texts.some((t) => /inferencia de Núcleo/i.test(t))).toBe(true);
    const step = applied.steps![0]!;
    const callout = step.content?.find(
      (b) => b.type === 'callout' && 'label' in b && b.label === 'Conexión'
    );
    expect(callout && 'text' in callout && /inferencia de Núcleo/i.test(String(callout.text))).toBe(
      true
    );
    const comparison = step.content?.find((b) => b.type === 'comparison');
    expect(
      comparison &&
        'rows' in comparison &&
        comparison.rows.some((r) => r.values.some((v) => /inferencia de Núcleo/i.test(String(v))))
    ).toBe(true);
  });

  it('contradicted/insufficient remove affirmative comparison and callout', () => {
    for (const status of ['contradicted', 'insufficient', 'degraded'] as const) {
      const map = relationMap();
      const bare = '«Unidad A» causa / contribuye a «Unidad B».';
      const claim = baseClaim({
        id: `rel_${status}`,
        text: bare,
        unitId: 'u1',
        presentationStatus: status,
        presentationText: `La fuente no permite determinarlo: ${bare}`,
        epistemicStatus: 'insufficient_information',
        abstentionCodes: ['NO_ENTAILMENT'],
        slotKey: 'unit:0:rel:u2:causes',
        surfaces: [
          { kind: 'step.relation.callout', unitId: 'u1', relationId: 'rel_test_0' },
          { kind: 'step.relation.comparison', unitId: 'u1', relationId: 'rel_test_0' },
        ],
      });
      const applied = applyEvidenceToMap(map, miniEvidence([claim]));
      const texts = collectVisibleConclusionTexts(applied);
      expect(texts.some((t) => t === bare)).toBe(false);
      const step = applied.steps![0]!;
      expect(
        step.content?.some((b) => b.type === 'callout' && 'label' in b && b.label === 'Conexión')
      ).toBe(false);
      expect(step.content?.some((b) => b.type === 'comparison')).toBe(false);
    }
  });
});

describe('digest pin coverage', () => {
  it('includes schema/prompt/verifier/compiler/model in identity', () => {
    const nodes = [
      {
        claim_id: 'c1',
        unit_id: null,
        claim_text: 't',
        claim_type: 'factual',
        criticality: 'critical',
        epistemic_status: 'faithful_paraphrase',
        presentation_status: 'verified',
        abstention_codes: [] as string[],
      },
    ];
    const base = {
      mapId: 'm',
      sourceId: null as string | null,
      sourceVersionId: null as string | null,
      contentHash: 'h',
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      promptVersion: EVIDENCE_PROMPT_VERSION,
      verifierVersion: EVIDENCE_VERIFIER_VERSION,
      compilerVersion: EVIDENCE_COMPILER_VERSION,
      modelRoute: EVIDENCE_MODEL_ROUTE,
      nodes,
      links: [] as [],
    };
    const d1 = computeEvidenceGraphDigest(base);
    const d2 = computeEvidenceGraphDigest({ ...base, compilerVersion: 'other' });
    expect(d1).not.toBe(d2);
  });
});
