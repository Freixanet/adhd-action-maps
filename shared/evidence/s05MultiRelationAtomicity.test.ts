/**
 * Multi-relation atomicity — relationId identity, no index shift residues.
 */

import { describe, expect, it } from 'vitest';
import { applyEvidenceToMap, collectVisibleConclusionTexts } from './applyToMap';
import { stableRelationId } from '../understanding/relationIds';
import {
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './versions';
import type { ContentClaim, EvidenceArtifact } from './types';
import type { ActionMapData } from '../contracts';

const UNIT = 'uA';
const RID = [
  stableRelationId(UNIT, 'uB', 'causes', 0),
  stableRelationId(UNIT, 'uC', 'causes', 1),
  stableRelationId(UNIT, 'uD', 'causes', 2),
] as const;

const BARE = [
  '«A» causes «B».',
  '«A» causes «C».',
  '«A» causes «D».',
] as const;

function threeRelationMap(): ActionMapData {
  return {
    title: 'Mapa',
    coreIdea: 'Nuclear',
    coreSupport: 'Support',
    tldr: [],
    steps: [
      {
        id: UNIT,
        shortNav: 'A',
        title: 'A',
        time: '~3 min',
        content: [
          {
            type: 'comparison',
            columns: ['Desde', 'Hacia'],
            rows: [
              { label: 'causa', values: ['A', 'B'], relationId: RID[0] },
              { label: 'causa', values: ['A', 'C'], relationId: RID[1] },
              { label: 'causa', values: ['A', 'D'], relationId: RID[2] },
            ],
          },
          {
            type: 'callout',
            label: 'Conexión',
            kind: 'info',
            text: BARE[0],
            relationId: RID[0],
          },
          {
            type: 'callout',
            label: 'Conexión',
            kind: 'info',
            text: BARE[1],
            relationId: RID[1],
          },
          {
            type: 'callout',
            label: 'Conexión',
            kind: 'info',
            text: BARE[2],
            relationId: RID[2],
          },
        ],
      },
    ],
  };
}

function relClaim(
  index: 0 | 1 | 2,
  status: ContentClaim['presentationStatus'],
  text = BARE[index]
): ContentClaim {
  return {
    id: `cl_rel_${index}`,
    unitId: UNIT,
    text,
    claimType: 'causal',
    criticality: 'critical',
    epistemicStatus:
      status === 'inference' ? 'inference' : 'insufficient_information',
    presentationStatus: status,
    presentationText:
      status === 'inference'
        ? text
        : `La fuente no permite determinarlo: ${text}`,
    evidenceLinkIds: [],
    abstentionCodes:
      status === 'inference' ? ['INFERENCE_NOT_SOURCE'] : ['NO_ENTAILMENT'],
    slotKey: `unit:0:rel:u${['B', 'C', 'D'][index]}:causes`,
    surfaces: [
      { kind: 'step.relation.callout', unitId: UNIT, relationId: RID[index] },
      { kind: 'step.relation.comparison', unitId: UNIT, relationId: RID[index] },
    ],
  };
}

function evidenceFor(claims: ContentClaim[]): EvidenceArtifact {
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
      contradiction: c.presentationStatus === 'contradicted',
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
      criticalTotal: claims.length,
      verified: 0,
      qualified: 0,
      contradicted: claims.filter((c) => c.presentationStatus === 'contradicted').length,
      degraded: claims.filter((c) => c.presentationStatus === 'degraded').length,
      uncertain: 0,
      unanchored: 0,
      inference: claims.filter((c) => c.presentationStatus === 'inference').length,
      summaryLines: ['multi-rel'],
    },
    sourceCoverage: {
      textual: null,
      extractionConfidence: null,
      isComplete: true,
      limitations: [],
    },
  };
}

function stepSurfaces(map: ActionMapData) {
  const step = map.steps![0]!;
  const callouts = (step.content ?? []).filter(
    (b) => b.type === 'callout' && 'label' in b && b.label === 'Conexión'
  );
  const comparison = (step.content ?? []).find((b) => b.type === 'comparison');
  const rows = comparison && 'rows' in comparison ? comparison.rows : [];
  return { callouts, rows };
}

describe('S05 multi-relation atomicity (relationId)', () => {
  it('three insufficient → zero rows and zero callouts', () => {
    const applied = applyEvidenceToMap(
      threeRelationMap(),
      evidenceFor([
        relClaim(0, 'insufficient'),
        relClaim(1, 'insufficient'),
        relClaim(2, 'insufficient'),
      ])
    );
    const { callouts, rows } = stepSurfaces(applied);
    expect(callouts).toHaveLength(0);
    expect(rows).toHaveLength(0);
    const texts = collectVisibleConclusionTexts(applied);
    for (const bare of BARE) {
      expect(texts.some((t) => t === bare || t.includes(bare))).toBe(false);
    }
  });

  it('first stripped + second inference → second correct and labeled (no A causes C residue)', () => {
    const applied = applyEvidenceToMap(
      threeRelationMap(),
      evidenceFor([
        relClaim(0, 'insufficient'),
        relClaim(1, 'inference'),
        // third left pending / verified — no rewrite
      ])
    );
    const { callouts, rows } = stepSurfaces(applied);
    expect(callouts).toHaveLength(2); // inference + untouched third
    expect(rows).toHaveLength(2);
    const texts = collectVisibleConclusionTexts(applied);
    expect(texts.some((t) => t === BARE[0])).toBe(false);
    expect(texts.some((t) => /inferencia de Núcleo/i.test(t) && t.includes('C'))).toBe(true);
    // The classic failure: after deleting index 0, index 1 rewrite hit the wrong surface.
    expect(texts.some((t) => t === BARE[1])).toBe(false);
    const thirdCallout = callouts.find((c) => 'relationId' in c && c.relationId === RID[2]);
    expect(thirdCallout && 'text' in thirdCallout && thirdCallout.text === BARE[2]).toBe(true);
  });

  it('second stripped; first and third conserved at correct positions', () => {
    const applied = applyEvidenceToMap(
      threeRelationMap(),
      evidenceFor([relClaim(1, 'contradicted')])
    );
    const { callouts, rows } = stepSurfaces(applied);
    expect(callouts).toHaveLength(2);
    expect(rows).toHaveLength(2);
    expect(callouts.map((c) => ('relationId' in c ? c.relationId : ''))).toEqual([
      RID[0],
      RID[2],
    ]);
    expect(rows.map((r) => r.relationId)).toEqual([RID[0], RID[2]]);
    const texts = collectVisibleConclusionTexts(applied);
    expect(texts.some((t) => t === BARE[1])).toBe(false);
    expect(texts.some((t) => t === BARE[0])).toBe(true);
    expect(texts.some((t) => t === BARE[2])).toBe(true);
  });

  it('mixed contradicted/degraded/insufficient/inference leaves no bare causal residue', () => {
    const applied = applyEvidenceToMap(
      threeRelationMap(),
      evidenceFor([
        relClaim(0, 'contradicted'),
        relClaim(1, 'degraded'),
        relClaim(2, 'inference'),
      ])
    );
    const { callouts, rows } = stepSurfaces(applied);
    expect(callouts).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(callouts[0] && 'relationId' in callouts[0] && callouts[0].relationId).toBe(RID[2]);
    const texts = collectVisibleConclusionTexts(applied);
    expect(texts.some((t) => t === BARE[0] || t === BARE[1] || t === BARE[2])).toBe(false);
    expect(texts.some((t) => /inferencia de Núcleo/i.test(t))).toBe(true);
  });
});
