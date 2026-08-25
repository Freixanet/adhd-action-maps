/**
 * S08 vertical: PDF → native ingest → understand gate → evidence anchors → viewer shape.
 * No Gemini calls.
 */

import { describe, expect, it } from 'vitest';
import { fixtureMultipagePdf, fixtureTextualPdf } from './fixtures';
import { extractPdfNative } from '../../server/src/ingestors/pdfExtractNative';
import { pdfIngestor } from '../../server/src/ingestors/pdfIngestor';
import { prepareTransformIngest } from '../../server/src/routes/transformIngest';
import { canRunUnderstandingEngine } from '../understanding/canRunUnderstandingEngine';
import { citationHeaderFromLoc, citationLabelFromLoc } from '../citationLabels';
import { excerptExistsOnPage, segmentPdfPages } from './segmentPdf';
import {
  clearEvidenceCache,
  createFakeEvidenceGenerateJson,
  runEvidenceEngine,
} from '../evidence';
import type { ActionMapData, TransformRequest } from '../contracts';
import type { UnderstandingArtifact } from '../understanding/types';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
} from '../understanding';

describe('S08 vertical PDF → Entender → Evidencia → viewer', () => {
  it('textual PDF produces page-anchored chunks and understand gate opens', async () => {
    const buf = await fixtureTextualPdf();
    const prepared = await prepareTransformIngest({
      type: 'pdf',
      fileData: buf.toString('base64'),
      mimeType: 'application/pdf',
      sourceLabel: 'vertical.pdf',
      intent: 'understand',
    } as TransformRequest);
    expect(prepared.kind).toBe('source');
    if (prepared.kind !== 'source') return;

    const gate = canRunUnderstandingEngine({
      intent: 'understand',
      body: prepared.body,
      ingestKind: 'source',
      ingest: prepared.ingest,
    });
    expect(gate.run).toBe(true);

    const chunk = prepared.ingest.chunks[0]!;
    expect(chunk.loc.page).toBe(1);
    expect(citationLabelFromLoc(chunk.loc)).toMatch(/^p\.\d+$/);
    expect(citationHeaderFromLoc(chunk.loc)).toMatch(/^p\.\d+$/);
    expect(excerptExistsOnPage(chunk.text, chunk.text.slice(0, 24))).toBe(true);
  });

  it('multipage evidence opens the correct page fragment', async () => {
    const buf = await fixtureMultipagePdf();
    const extracted = await extractPdfNative({
      buffer: buf,
      declaredMime: 'application/pdf',
    });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    const artifact = segmentPdfPages({
      pages: extracted.pages,
      rawHash: extracted.rawHash,
      coverage: extracted.coverage,
      title: 'multi',
      extractionDigest: extracted.extractionDigest,
    });
    const page2 = artifact.segments.find((s) => s.loc.page === 2);
    expect(page2).toBeTruthy();
    const page2Text = extracted.pages.find((p) => p.page === 2)!.text;
    expect(excerptExistsOnPage(page2Text, page2!.text.slice(0, 30))).toBe(true);
    const page1Seg = artifact.segments.find((s) => s.loc.page === 1)!;
    expect(citationLabelFromLoc(page2!.loc)).toBe('p.2');
    expect(citationLabelFromLoc(page1Seg.loc)).toBe('p.1');
  });

  it('invented foreign page/chunk is detectable (wrong page for excerpt)', async () => {
    const buf = await fixtureMultipagePdf();
    const ingest = await pdfIngestor.ingest({
      buffer: buf,
      mime: 'application/pdf',
      ext: 'pdf',
      fileName: 'm.pdf',
    });
    const page3 = ingest.chunks.find((c) => c.loc.page === 3);
    const page1 = ingest.chunks.find((c) => c.loc.page === 1);
    expect(page3 && page1).toBeTruthy();
    if (!page3 || !page1) return;
    expect(excerptExistsOnPage(page1.text, page3.text.slice(0, 40))).toBe(false);
  });

  it('evidence engine cites PDF chunk with page loc; foreign chunk rejected', async () => {
    clearEvidenceCache();
    const buf = await fixtureTextualPdf();
    const ingest = await pdfIngestor.ingest({
      buffer: buf,
      mime: 'application/pdf',
      ext: 'pdf',
      fileName: 'ev.pdf',
    });
    const chunk = ingest.chunks[0]!;
    const nuclear = chunk.text.slice(0, Math.min(80, chunk.text.length));
    const understanding: UnderstandingArtifact = {
      schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
      promptVersion: UNDERSTANDING_PROMPT_VERSION,
      compilerVersion: UNDERSTANDING_COMPILER_VERSION,
      modelVersion: 'fake',
      intent: 'understand',
      depth: 'estandar',
      status: 'complete',
      contentHash: ingest.rawHash || 'pdf-h',
      blueprint: {
        plan: {
          centralQuestion: nuclear,
          thesisOrPurpose: nuclear,
          unitOrder: ['u1'],
          relationsToPreserve: [],
          mustKeep: [],
          excludedNoise: [],
        },
        classification: {
          language: 'es',
          genre: 'explanatory',
          discourseStructure: 'conceptual',
          scopeKnown: 'complete',
          uncertainties: [],
        },
        essential: {
          nuclearIdea: nuclear,
          essentialIdeas: [],
          limitsOrConditions: [],
          doesNotClaim: [],
          layer0Synthesis: nuclear,
          layer0Why: 'Para anclar la página.',
          layer0Actions: ['Abrir página', 'Leer fragmento', 'Comprobar cita'],
        },
      },
      units: [
        {
          id: 'u1',
          title: 'Página',
          role: 'thesis',
          explanation: nuclear,
          examples: [],
          cautions: [],
          relations: [],
          segmentRefs: [{ chunkId: chunk.id, status: 'pending' }],
          incomplete: false,
        },
      ],
      closure: {
        finalSynthesis: nuclear,
        mainLearnings: [nuclear],
        openQuestions: [],
        reviewPrompt: '¿Qué página respalda la idea?',
        comprehensionLimits: [],
      },
    };

    const map: ActionMapData = {
      title: nuclear.slice(0, 40),
      coreIdea: nuclear,
      coreSupport: nuclear,
      intent: 'understand',
      layer0: {
        what: nuclear,
        why: 'Para anclar la página.',
        actions: [
          { id: 'a1', label: 'Abrir página' },
          { id: 'a2', label: 'Leer fragmento' },
          { id: 'a3', label: 'Comprobar cita' },
        ],
      },
      tldr: [
        { title: 'Idea', desc: nuclear },
        { title: 'B', desc: 'b' },
        { title: 'C', desc: 'c' },
      ],
      steps: [
        {
          id: 'u1',
          shortNav: 'Página',
          title: 'Página',
          time: '~3 min',
          content: [{ type: 'prose', text: nuclear }],
          selfCheck: '?',
          references: [{ label: 'Seg', locator: chunk.id, chunkId: chunk.id }],
        },
      ],
      completionCard: {
        title: 'Lo que debes recordar',
        summary: nuclear,
        takeaways: [nuclear],
        promptQuestion: '?',
      },
      understanding,
      citedChunks: ingest.chunks,
      chunkIdManifest: ingest.chunks.map((c) => c.id),
    };

    const result = await runEvidenceEngine({
      artifact: understanding,
      map,
      ingest,
      contentHash: ingest.rawHash || 'pdf-h',
      pastedComplete: true,
      generateJson: createFakeEvidenceGenerateJson(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const linkedIds = result.evidence.links.map((l) => l.chunkId);
    expect(linkedIds.every((id) => ingest.chunks.some((c) => c.id === id))).toBe(true);
    for (const id of linkedIds) {
      const cited = ingest.chunks.find((c) => c.id === id)!;
      expect(cited.loc.page).toBe(1);
      expect(excerptExistsOnPage(cited.text, nuclear.slice(0, 20))).toBe(true);
    }

    clearEvidenceCache();
    const foreign = await runEvidenceEngine({
      artifact: {
        ...understanding,
        units: [
          {
            ...understanding.units[0]!,
            segmentRefs: [{ chunkId: 'chunk_foreign_other_version', status: 'pending' }],
          },
        ],
      },
      map: {
        ...map,
        steps: [
          {
            ...map.steps[0]!,
            references: [
              {
                label: 'Seg',
                locator: 'chunk_foreign_other_version',
                chunkId: 'chunk_foreign_other_version',
              },
            ],
          },
        ],
      },
      ingest,
      contentHash: `${ingest.rawHash || 'pdf-h'}-foreign`,
      generateJson: createFakeEvidenceGenerateJson(),
    });
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) return;
    expect(foreign.evidence.links.map((l) => l.chunkId)).not.toContain(
      'chunk_foreign_other_version'
    );
  });
});

describe('S08 cancel via resolveTransformIngest', () => {
  it('maps pre-aborted PDF extract to cancelled', async () => {
    const { resolveTransformIngest } = await import(
      '../../server/src/routes/resolveTransformIngest'
    );
    const buf = await fixtureTextualPdf();
    const outcome = await resolveTransformIngest({
      body: {
        type: 'pdf',
        fileData: buf.toString('base64'),
        mimeType: 'application/pdf',
        sourceLabel: 'c.pdf',
        intent: 'understand',
      } as TransformRequest,
      isCancelled: () => true,
    });
    expect(outcome.kind).toBe('cancelled');
    expect(outcome.kind).not.toBe('ok');
  });

  it('mid-page barrier abort → cancelled only (no persist, no success)', async () => {
    const { setPdfExtractPageBarrier } = await import(
      '../../server/src/ingestors/pdfExtractNative'
    );
    const { orchestratePdfTransform } = await import(
      '../../server/src/ingestors/pdfOrchestration'
    );
    const { fixtureMultipagePdf } = await import('./fixtures');
    const buf = await fixtureMultipagePdf();
    const ac = new AbortController();
    let persistCalls = 0;
    setPdfExtractPageBarrier(async (pageNum) => {
      if (pageNum >= 2) ac.abort();
    });
    try {
      const outcome = await orchestratePdfTransform({
        body: {
          type: 'pdf',
          fileData: buf.toString('base64'),
          mimeType: 'application/pdf',
          sourceLabel: 'mid.pdf',
          intent: 'understand',
        } as TransformRequest,
        signal: ac.signal,
        persistFn: async () => {
          persistCalls += 1;
          return { ok: true, storagePath: 'should-not/run.pdf' };
        },
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok === false) {
        expect(outcome.code).toBe('PDF_CANCELLED');
        expect(outcome.status).toBe(499);
      } else {
        throw new Error('unexpected success after mid-page cancel');
      }
      expect(persistCalls).toBe(0);
      expect('sourceMeta' in outcome && outcome.sourceMeta).toBeFalsy();
      expect('persistRetry' in outcome && outcome.persistRetry).toBeFalsy();
    } finally {
      setPdfExtractPageBarrier(null);
    }
  });
});

describe('S08 × S07 progress resume with PDF-sourced map', () => {
  it('exact step restore still works when citedChunks carry page locs', async () => {
    const { deriveSemanticProgress, restoreResumeUiState } = await import('../progress');
    const buf = await fixtureTextualPdf();
    const ingest = await pdfIngestor.ingest({
      buffer: buf,
      mime: 'application/pdf',
      ext: 'pdf',
      fileName: 'p.pdf',
    });
    const data: ActionMapData = {
      title: 'PDF',
      coreIdea: 'idea',
      coreSupport: 's',
      intent: 'understand',
      tldr: [
        { title: 'A', desc: 'a' },
        { title: 'B', desc: 'b' },
        { title: 'C', desc: 'c' },
      ],
      steps: [
        { id: 'step-a', title: 'A', shortNav: 'A', time: '1 min', content: [{ type: 'prose', text: 'a' }] },
        { id: 'step-b', title: 'B', shortNav: 'B', time: '1 min', content: [{ type: 'prose', text: 'b' }] },
        { id: 'step-c', title: 'C', shortNav: 'C', time: '1 min', content: [{ type: 'prose', text: 'c' }] },
      ],
      citedChunks: ingest.chunks,
    };
    const saved = {
      data,
      currentStep: 2,
      isComplete: false,
      viewAll: false,
      layer0Passed: true,
    };
    const progress = deriveSemanticProgress(saved, data, 42);
    expect(progress.currentStepId).toBe('step-b');
    const restored = restoreResumeUiState(data, {
      ...saved,
      progress,
    });
    expect(restored.currentStep).toBe(2);
    expect(ingest.chunks[0]!.loc.page).toBe(1);
  });
});
