/**
 * S05 focal residuals — bindings, contradicts, provider, pending retry, persist fail-closed.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type { ActionMapData } from '../contracts';
import type { SourceChunk } from '../types/chunk';
import {
  applyEvidenceToMap,
  clearEvidenceCache,
  collectVisibleConclusionTexts,
  createFakeEvidenceGenerateJson,
  extractClaimsFromUnderstanding,
  persistEvidenceWithUserJwt,
  runEvidenceEngine,
  EVIDENCE_COMPILER_VERSION,
  EVIDENCE_MODEL_ROUTE,
  EVIDENCE_PROMPT_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  EVIDENCE_VERIFIER_VERSION,
} from './index';
import type { ContentClaim, EvidenceArtifact } from './types';
import { stableRelationId } from '../understanding/relationIds';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
} from '../understanding';
import type { UnderstandingArtifact } from '../understanding/types';
import {
  clearPendingEvidenceSyncForUser,
  flushPendingEvidenceSync,
  loadPendingEvidenceSync,
  reconcilePendingEvidenceSyncWithHistory,
  removePendingEvidenceSync,
  upsertPendingEvidenceSync,
  EVIDENCE_SYNC_PENDING_MESSAGE,
} from '../pendingEvidenceSync';
import { configureStorage, type SyncKeyValueStorage } from '../storage';

function memoryKv(): SyncKeyValueStorage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

function chunk(id: string, text: string): SourceChunk {
  return { id, text, hash: `h-${id}`, loc: { start: 0, end: text.length } };
}

function longExplanation(): string {
  const a =
    'La memoria de trabajo sostiene pocas piezas activas a la vez en tareas exigentes.';
  const b =
    'Cuando la carga supera ese límite, aparecen olvidos y errores de seguimiento en la ejecución cotidiana.';
  // > 220 chars combined for knowledge truncation coverage
  return `${a} ${b} Además el entorno ruidoso agrava la pérdida de hilos de atención mantenidos.`;
}

function artifactWithSurfaces(): UnderstandingArtifact {
  const explanation = longExplanation();
  return {
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelVersion: 'fake',
    intent: 'understand',
    depth: 'estandar',
    status: 'complete',
    contentHash: 'bind-hash',
    blueprint: {
      plan: {
        centralQuestion: '¿Cómo falla la memoria de trabajo?',
        thesisOrPurpose: 'La memoria de trabajo tiene un límite estrecho.',
        unitOrder: ['u1', 'u2'],
        relationsToPreserve: [{ from: 'u1', to: 'u2', kind: 'causes' }],
        mustKeep: [],
        excludedNoise: [],
      },
      classification: {
        language: 'es',
        genre: 'explanatory',
        discourseStructure: 'causal',
        scopeKnown: 'complete',
        uncertainties: [],
      },
      essential: {
        nuclearIdea: 'La memoria de trabajo tiene un límite estrecho.',
        essentialIdeas: [
          {
            title: 'Límite bajo carga',
            desc: 'El límite aparece bajo carga concurrente.',
          },
        ],
        limitsOrConditions: ['No describe memoria a largo plazo.'],
        doesNotClaim: [],
        layer0Synthesis: 'Síntesis distinta de la nuclear para coreSupport.',
        layer0Why: 'Para no sobrestimar la capacidad atencional.',
        layer0Actions: ['Anotar el límite', 'Reducir carga', 'Releer el matiz'],
      },
    },
    units: [
      {
        id: 'u1',
        title: 'Límite',
        role: 'thesis',
        explanation,
        examples: ['Tres números a la vez bastan para saturar.'],
        cautions: ['No confundir con olvido general.'],
        relations: [{ toUnitId: 'u2', kind: 'causes' }],
        incomplete: false,
        segmentRefs: [{ chunkId: 'c1', status: 'pending' }],
      },
      {
        id: 'u2',
        title: 'Errores',
        role: 'mechanism',
        explanation: 'Los errores de seguimiento aparecen cuando se supera el límite.',
        examples: [],
        cautions: [],
        relations: [],
        incomplete: false,
        segmentRefs: [{ chunkId: 'c1', status: 'pending' }],
      },
    ],
    closure: {
      finalSynthesis: 'La memoria de trabajo tiene un límite estrecho. Eso condiciona la ejecución.',
      mainLearnings: ['El límite es estrecho bajo carga.'],
      openQuestions: [],
      reviewPrompt: '¿Qué limita la memoria de trabajo?',
      comprehensionLimits: [],
    },
  };
}

function mapFromArtifact(artifact: UnderstandingArtifact): ActionMapData {
  const e = artifact.blueprint.essential;
  const u1 = artifact.units[0]!;
  const u2 = artifact.units[1]!;
  const relId = stableRelationId(u1.id, u2.id, 'causes', 0);
  return {
    title: 'Título distinto de la nuclear',
    coreIdea: e.nuclearIdea,
    coreSupport: e.layer0Synthesis,
    intent: 'understand',
    layer0: {
      what: e.layer0Synthesis,
      why: e.layer0Why,
      actions: e.layer0Actions.map((label, i) => ({ id: `a${i}`, label })),
    },
    tldr: e.essentialIdeas.map((idea) => ({
      title: idea.title,
      desc: idea.desc,
    })),
    knowledgeSections: [
      { title: u1.title, summary: u1.explanation.slice(0, 220) },
      { title: u2.title, summary: u2.explanation.slice(0, 220) },
    ],
    steps: [
      {
        id: u1.id,
        shortNav: u1.title,
        title: u1.title,
        time: '~3 min',
        content: [
          { type: 'prose', text: u1.explanation },
          { type: 'callout', text: u1.examples[0]!, kind: 'info', label: 'Ejemplo' },
          { type: 'callout', text: u1.cautions[0]!, kind: 'alert', label: 'Precaución' },
          {
            type: 'comparison',
            columns: ['Desde', 'Hacia'],
            rows: [
              {
                label: 'causa / contribuye a',
                values: [u1.title, u2.title],
                relationId: relId,
              },
            ],
          },
          {
            type: 'callout',
            text: `«${u1.title}» causa / contribuye a «${u2.title}».`,
            kind: 'info',
            label: 'Conexión',
            relationId: relId,
          },
        ],
        selfCheck: '?',
      },
      {
        id: u2.id,
        shortNav: u2.title,
        title: u2.title,
        time: '~3 min',
        content: [{ type: 'prose', text: u2.explanation }],
        selfCheck: '?',
      },
    ],
    completionCard: {
      title: 'Lo que debes recordar',
      summary: artifact.closure!.finalSynthesis,
      takeaways: [...artifact.closure!.mainLearnings],
      promptQuestion: '?',
    },
    understanding: artifact,
    citedChunks: [chunk('c1', 'fuente')],
    chunkIdManifest: ['c1'],
  };
}

describe('S05 structural bindings', () => {
  it('rewrites distinct surfaces by slot; fails if rejected affirmative remains', () => {
    const artifact = artifactWithSurfaces();
    const claims = extractClaimsFromUnderstanding(artifact, { contentHash: 'bind-hash' });
    const nuclear = claims.find((c) => c.slotKey === 'nuclear')!;
    const synthesis = claims.find((c) => c.slotKey === 'layer0:synthesis')!;
    const action0 = claims.find((c) => c.slotKey === 'layer0:action:0')!;
    const exp0 = claims.find((c) => c.slotKey.endsWith(':exp:0'))!;
    const rel = claims.find((c) => c.slotKey.includes(':rel:'))!;

    expect(nuclear.surfaces?.some((s) => s.kind === 'coreIdea')).toBe(true);
    expect(synthesis.surfaces?.some((s) => s.kind === 'coreSupport')).toBe(true);
    expect(action0.epistemicStatus).toBe('nucleo_adaptation');
    expect(exp0.surfaces?.some((s) => s.kind === 'knowledge')).toBe(true);
    expect(rel.surfaces?.some((s) => s.kind === 'step.relation.callout')).toBe(true);
    expect(rel.surfaces?.some((s) => s.kind === 'step.relation.comparison')).toBe(true);
    expect(
      rel.surfaces?.every(
        (s) =>
          s.kind !== 'step.relation.callout' && s.kind !== 'step.relation.comparison'
            ? true
            : 'relationId' in s && typeof s.relationId === 'string' && s.relationId.length > 0
      )
    ).toBe(true);

    const rejected = nuclear.text;
    const claim: ContentClaim = {
      ...nuclear,
      presentationStatus: 'insufficient',
      epistemicStatus: 'insufficient_information',
      presentationText: `La fuente no permite determinarlo: ${rejected}`,
      abstentionCodes: ['NO_ENTAILMENT'],
    };
    const evidence: EvidenceArtifact = {
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      promptVersion: EVIDENCE_PROMPT_VERSION,
      verifierVersion: EVIDENCE_VERIFIER_VERSION,
      compilerVersion: EVIDENCE_COMPILER_VERSION,
      modelVersion: 'n/a',
      modelRoute: EVIDENCE_MODEL_ROUTE,
      status: 'complete',
      claims: [
        claim,
        {
          ...synthesis,
          presentationStatus: 'insufficient',
          epistemicStatus: 'insufficient_information',
          presentationText: `La fuente no permite determinarlo: ${synthesis.text}`,
          abstentionCodes: ['NO_ENTAILMENT'],
        },
        {
          ...action0,
          presentationStatus: 'inference',
          presentationText: action0.text,
          abstentionCodes: ['INFERENCE_NOT_SOURCE'],
        },
        {
          ...exp0,
          presentationStatus: 'contradicted',
          epistemicStatus: 'insufficient_information',
          presentationText: `La fuente contiene posiciones incompatibles sobre: ${exp0.text}`,
          abstentionCodes: ['CONTRADICTORY_CHUNKS'],
          evidenceLinkIds: ['lnk_x'],
        },
        {
          ...rel,
          presentationStatus: 'inference',
          presentationText: rel.text,
          abstentionCodes: ['INFERENCE_NOT_SOURCE'],
        },
      ],
      links: [
        {
          id: 'lnk_x',
          contentNodeId: exp0.id,
          segmentId: 'c1',
          chunkId: 'c1',
          relation: 'contradicts',
          verifierStatus: 'rejected',
          epistemicStatus: 'insufficient_information',
          confidence: null,
          verifierVersion: EVIDENCE_VERIFIER_VERSION,
          checkCodes: ['ENTAILMENT_CONTRADICTS'],
          abstentionCodes: ['CONTRADICTORY_CHUNKS'],
        },
      ],
      assessments: [],
      evidenceCoverage: {
        criticalTotal: 4,
        verified: 0,
        qualified: 0,
        contradicted: 1,
        degraded: 0,
        uncertain: 2,
        unanchored: 0,
        inference: 1,
        summaryLines: ['x'],
      },
      sourceCoverage: { textual: null, extractionConfidence: null, isComplete: true, limitations: [] },
    };

    // assessments required by validate — applyToMap does not require them
    const map = mapFromArtifact(artifact);
    const applied = applyEvidenceToMap(map, {
      ...evidence,
      assessments: evidence.claims.map((c) => ({
        claimId: c.id,
        allowedChunkIdsUsed: c.evidenceLinkIds.length ? ['c1'] : [],
        entailment: c.presentationStatus === 'contradicted' ? ('contradicts' as const) : null,
        contradiction: c.presentationStatus === 'contradicted',
        qualifierPreservation: null,
        negationPreservation: null,
        numericOk: null,
        nameOk: null,
        dateOk: null,
        unitOk: null,
        relation: c.presentationStatus === 'contradicted' ? ('contradicts' as const) : null,
        verifierStatus: 'uncertain' as const,
        epistemicStatus: c.epistemicStatus,
        abstentionCodes: c.abstentionCodes,
        checkCodes: [],
        schemaVersion: EVIDENCE_SCHEMA_VERSION,
        promptVersion: EVIDENCE_PROMPT_VERSION,
        verifierVersion: EVIDENCE_VERIFIER_VERSION,
        modelVersion: 'n/a',
        modelRoute: EVIDENCE_MODEL_ROUTE,
      })),
    });

    expect(applied.coreIdea).not.toBe(rejected);
    expect(applied.coreIdea).toContain('no permite determinarlo');
    expect(applied.coreSupport).not.toBe(synthesis.text);
    expect(applied.layer0?.actions[0]?.label).toMatch(/adaptación de Núcleo|inferencia de Núcleo/);
    expect(applied.knowledgeSections?.[0]?.summary.length).toBeLessThanOrEqual(220);
    const visible = collectVisibleConclusionTexts(applied);
    // Rejected nuclear affirmative must not remain as bare conclusion on bound surfaces
    expect(applied.coreIdea).not.toBe(rejected);
    expect(visible.some((v) => v === rejected)).toBe(false);
    // Relation callout rewritten as inference
    const relCallout = applied.steps?.[0]?.content?.find(
      (b) => b.type === 'callout' && 'label' in b && b.label === 'Conexión'
    ) as { text?: string } | undefined;
    expect(relCallout?.text).toMatch(/inferencia de Núcleo/);
  });
});

describe('S05 contradicts + provider', () => {
  it('contradicts by negation keeps rejected EvidenceLink to exact chunk', async () => {
    clearEvidenceCache();
    const claimText = 'El fármaco cura la enfermedad en adultos.';
    const artifact = artifactWithSurfaces();
    artifact.blueprint.essential.nuclearIdea = claimText;
    artifact.blueprint.essential.layer0Synthesis = 'Otra síntesis.';
    for (const u of artifact.units) {
      u.segmentRefs = [{ chunkId: 'c_neg', status: 'pending' }];
    }
    const chunks = [
      chunk('c_neg', 'El fármaco no cura la enfermedad en adultos.'),
    ];
    const result = await runEvidenceEngine({
      artifact,
      map: mapFromArtifact(artifact),
      ingest: { chunks, metadata: { type: 'text' }, rawHash: 'neg' },
      contentHash: 'neg',
      generateJson: async () => ({
        text: JSON.stringify({ decision: 'contradicts', chunkIds: ['c_neg'] }),
        model: 'fake',
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const nuclear = result.evidence.claims.find((c) => c.slotKey === 'nuclear');
    expect(nuclear?.presentationStatus).toBe('contradicted');
    expect(result.evidence.links.some((l) => l.relation === 'contradicts' && l.verifierStatus === 'rejected')).toBe(
      true
    );
    expect(result.evidence.links[0]?.chunkId).toBe('c_neg');
    expect(nuclear?.presentationText).not.toMatch(/^Afirmación degradada/);
  });

  it('provider error with candidates is PROVIDER_ERROR not NO_ANCHOR', async () => {
    clearEvidenceCache();
    const artifact = artifactWithSurfaces();
    const chunks = [chunk('c1', longExplanation())];
    const result = await runEvidenceEngine({
      artifact,
      map: mapFromArtifact(artifact),
      ingest: { chunks, metadata: { type: 'text' }, rawHash: 'prov' },
      contentHash: 'prov',
      generateJson: createFakeEvidenceGenerateJson({ forceError: true }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const withProvider = result.evidence.claims.filter((c) =>
      c.abstentionCodes.includes('PROVIDER_ERROR')
    );
    expect(withProvider.length).toBeGreaterThan(0);
    expect(
      withProvider.every((c) => !c.abstentionCodes.includes('NO_ANCHOR'))
    ).toBe(true);
  });
});

describe('S05 pending evidence retry', () => {
  beforeEach(() => {
    configureStorage(memoryKv());
  });

  it('reconcile drops orphans; flush removes pending only after complete', async () => {
    upsertPendingEvidenceSync('user-a', { mapId: 'map-1', contentHash: 'h1' });
    upsertPendingEvidenceSync('user-a', { mapId: 'map-orphan', contentHash: 'h2' });
    const evidence: EvidenceArtifact = {
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      promptVersion: EVIDENCE_PROMPT_VERSION,
      verifierVersion: EVIDENCE_VERIFIER_VERSION,
      compilerVersion: EVIDENCE_COMPILER_VERSION,
      modelVersion: 'n/a',
      modelRoute: EVIDENCE_MODEL_ROUTE,
      status: 'complete',
      claims: [],
      links: [],
      assessments: [],
      evidenceCoverage: {
        criticalTotal: 0,
        verified: 0,
        qualified: 0,
        contradicted: 0,
        degraded: 0,
        uncertain: 0,
        unanchored: 0,
        inference: 0,
        summaryLines: ['none'],
      },
      sourceCoverage: { textual: null, extractionConfidence: null, isComplete: true, limitations: [] },
    };
    const reconciled = reconcilePendingEvidenceSyncWithHistory({
      userId: 'user-a',
      entries: [{ id: 'map-1', session: { data: { evidence } } }],
    });
    expect(reconciled.pendingByMapId['map-1']).toBeTruthy();
    expect(reconciled.pendingByMapId['map-orphan']).toBeUndefined();
    expect(EVIDENCE_SYNC_PENDING_MESSAGE).toMatch(/evidencia pendiente/i);

    // A→B: B must not see A's queue
    expect(loadPendingEvidenceSync('user-b')).toEqual([]);

    const result = await flushPendingEvidenceSync({
      userId: 'user-a',
      mapId: 'map-1',
      evidence,
      accessToken: 'tok',
      supabaseUrl: 'http://127.0.0.1:9',
      supabaseAnonKey: 'anon',
      isCurrent: () => true,
    });
    // Network fail keeps pending
    expect(result.ok).toBe(false);
    expect(loadPendingEvidenceSync('user-a').some((p) => p.mapId === 'map-1')).toBe(true);

    removePendingEvidenceSync('user-a', 'map-1');
    clearPendingEvidenceSyncForUser('user-a');
    expect(loadPendingEvidenceSync('user-a')).toEqual([]);
  });

  it('source_unbound when links present without sourceVersionId', async () => {
    const evidence: EvidenceArtifact = {
      schemaVersion: EVIDENCE_SCHEMA_VERSION,
      promptVersion: EVIDENCE_PROMPT_VERSION,
      verifierVersion: EVIDENCE_VERIFIER_VERSION,
      compilerVersion: EVIDENCE_COMPILER_VERSION,
      modelVersion: 'n/a',
      modelRoute: EVIDENCE_MODEL_ROUTE,
      status: 'complete',
      claims: [
        {
          id: 'cl1',
          text: 'x',
          claimType: 'factual',
          criticality: 'critical',
          epistemicStatus: 'faithful_paraphrase',
          presentationStatus: 'verified',
          evidenceLinkIds: ['l1'],
          abstentionCodes: [],
          slotKey: 'nuclear',
        },
      ],
      links: [
        {
          id: 'l1',
          contentNodeId: 'cl1',
          segmentId: 'c1',
          chunkId: 'c1',
          relation: 'supports',
          verifierStatus: 'verified',
          epistemicStatus: 'faithful_paraphrase',
          confidence: null,
          verifierVersion: EVIDENCE_VERIFIER_VERSION,
          checkCodes: [],
          abstentionCodes: [],
        },
      ],
      assessments: [],
      evidenceCoverage: {
        criticalTotal: 1,
        verified: 1,
        qualified: 0,
        contradicted: 0,
        degraded: 0,
        uncertain: 0,
        unanchored: 0,
        inference: 0,
        summaryLines: ['1'],
      },
      sourceCoverage: { textual: null, extractionConfidence: null, isComplete: true, limitations: [] },
    };
    const result = await persistEvidenceWithUserJwt({
      accessToken: 't',
      supabaseUrl: 'http://127.0.0.1:9',
      supabaseAnonKey: 'a',
      ownerId: 'u',
      mapId: 'm',
      evidence,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.code).toBe('EVIDENCE_SOURCE_UNBOUND');
    }
  });
});
