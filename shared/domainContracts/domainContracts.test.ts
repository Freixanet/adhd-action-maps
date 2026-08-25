import { describe, expect, it } from 'vitest';
import type { Citation, SourceChunk } from '../types/chunk';
import {
  citationDraftFromEvidenceLink,
  evidenceLinkFromCitation,
  mapCoverageFromSourceCoverage,
  nucleoSourceFromMapMetadata,
  nucleoSourceTypeFromKind,
  sourceAnchorFromChunkLoc,
  sourceChunkFromSegment,
  sourceCoverageFromMapCoverage,
  sourceSegmentFromChunk,
  validateEvidenceLink,
  validateNucleoSource,
  validateSourceAnchor,
  validateSourceChunkLoc,
  validateSourceCoverage,
  validateSourceSegment,
} from './index';
import {
  invalidEvidenceLink,
  invalidNucleoSource,
  invalidSourceAnchor,
  invalidSourceCoverage,
  invalidSourceSegment,
  validEvidenceLink,
  validEvidenceLinkVerified,
  validNucleoSource,
  validSourceAnchors,
  validSourceCoverage,
  validSourceCoverageUnknown,
  validSourceSegment,
} from './fixtures';
import { CHUNK_LOC_METADATA_KEY } from './types';

describe('domainContracts validation', () => {
  it('accepts measured and unknown SourceCoverage; rejects invalid', () => {
    const measured = validateSourceCoverage(validSourceCoverage);
    expect(measured.ok).toBe(true);
    if (measured.ok) {
      expect(measured.value.textual).toBe(0.9);
      expect(measured.value.isComplete).toBe(true);
    }

    const unknown = validateSourceCoverage(validSourceCoverageUnknown);
    expect(unknown.ok).toBe(true);
    if (unknown.ok) {
      expect(unknown.value.textual).toBeNull();
      expect(unknown.value.extractionConfidence).toBeNull();
      expect(unknown.value.isComplete).toBeNull();
    }

    const bad = validateSourceCoverage(invalidSourceCoverage);
    expect(bad.ok).toBe(false);
    if (bad.ok === false) expect(bad.errors.length).toBeGreaterThan(0);
  });

  it('accepts each valid SourceAnchor family and rejects invalid', () => {
    for (const anchor of validSourceAnchors) {
      expect(validateSourceAnchor(anchor).ok).toBe(true);
    }
    expect(validateSourceAnchor(invalidSourceAnchor).ok).toBe(false);
  });

  it('accepts segment with null extractionConfidence', () => {
    const result = validateSourceSegment(validSourceSegment);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.extractionConfidence).toBeNull();
    expect(validateSourceSegment(invalidSourceSegment).ok).toBe(false);
  });

  it('accepts valid NucleoSource and rejects invalid', () => {
    expect(validateNucleoSource(validNucleoSource).ok).toBe(true);
    expect(validateNucleoSource(invalidNucleoSource).ok).toBe(false);
  });

  it('preserves epistemicStatus on EvidenceLink and rejects invalid', () => {
    const pending = validateEvidenceLink(validEvidenceLink);
    expect(pending.ok).toBe(true);
    if (pending.ok) {
      expect(pending.value.epistemicStatus).toBe('direct_source');
      expect(pending.value.verifierStatus).toBe('pending');
      expect(pending.value.confidence).toBeNull();
    }

    const verified = validateEvidenceLink(validEvidenceLinkVerified);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value.epistemicStatus).toBe('faithful_paraphrase');
      expect(verified.value.confidence).toBe(0.8);
      expect(verified.value.verifierStatus).toBe('verified');
    }

    const withoutEpistemic = validateEvidenceLink({
      id: 'ev-3',
      contentNodeId: 'n',
      segmentId: 's',
      relation: 'supports',
      verifierStatus: 'pending',
      confidence: null,
    });
    expect(withoutEpistemic.ok).toBe(true);
    if (withoutEpistemic.ok) {
      expect(withoutEpistemic.value.epistemicStatus).toBeUndefined();
    }

    const bad = validateEvidenceLink(invalidEvidenceLink);
    expect(bad.ok).toBe(false);
    if (bad.ok === false) {
      expect(bad.errors.some((e) => e.includes('epistemicStatus'))).toBe(true);
    }
  });
});

describe('domainContracts adapters — semantic honesty', () => {
  const sampleChunk: SourceChunk = {
    id: 'chunk_abc',
    text: 'Texto citable del capítulo.',
    hash: 'h1',
    loc: {
      start: 10,
      end: 40,
      chapterTitle: 'Capítulo 2',
      chapterIndex: 1,
      page: 8,
      timestamp: 42.5,
      imageId: 'img-9',
      bbox: { x: 1, y: 2, w: 3, h: 4 },
    },
  };

  it('round-trips SourceChunk loc exactly (deep equality)', () => {
    const segment = sourceSegmentFromChunk(sampleChunk, 'src-1', 2);
    expect(segment.ok).toBe(true);
    if (!segment.ok) return;

    expect(segment.value.extractionConfidence).toBeNull();
    expect(segment.value.metadata[CHUNK_LOC_METADATA_KEY]).toEqual(sampleChunk.loc);

    const back = sourceChunkFromSegment(segment.value);
    expect(back.ok).toBe(true);
    if (!back.ok) return;

    expect(back.value.loc).toEqual(sampleChunk.loc);
    expect(back.value.loc.start).toBe(10);
    expect(back.value.loc.end).toBe(40);
    expect(back.value.loc.page).toBe(8);
    expect(back.value.loc.timestamp).toBe(42.5);
    expect(back.value.loc.chapterTitle).toBe('Capítulo 2');
    expect(back.value.loc.chapterIndex).toBe(1);
    expect(back.value.loc.imageId).toBe('img-9');
    expect(back.value.loc.bbox).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    expect(back.value.hash).toBe('h1');
    expect(back.value.id).toBe('chunk_abc');
  });

  it('refuses chunk rebuild without stored chunkLoc (no fabricated offsets)', () => {
    const segment = sourceSegmentFromChunk(sampleChunk, 'src-1', 0);
    expect(segment.ok).toBe(true);
    if (!segment.ok) return;

    const { [CHUNK_LOC_METADATA_KEY]: _removed, ...restMeta } = segment.value.metadata;
    const stripped = { ...segment.value, metadata: restMeta };
    const back = sourceChunkFromSegment(stripped);
    expect(back.ok).toBe(false);
    if (back.ok === false) {
      expect(back.errors.some((e) => e.includes(CHUNK_LOC_METADATA_KEY))).toBe(true);
    }
  });

  it('maps Citation to EvidenceLink as pending with unknown confidence', () => {
    const citation: Citation = {
      id: 'c1',
      chunkId: 'chunk_abc',
      label: 'p.8',
      loc: sampleChunk.loc,
    };
    const evidence = evidenceLinkFromCitation(citation, 'node-42');
    expect(evidence.ok).toBe(true);
    if (!evidence.ok) return;

    expect(evidence.value.verifierStatus).toBe('pending');
    expect(evidence.value.confidence).toBeNull();
    expect(evidence.value.epistemicStatus).toBeUndefined();
    expect(evidence.value.segmentId).toBe('chunk_abc');
    expect(evidence.value.chunkId).toBe('chunk_abc');

    const draft = citationDraftFromEvidenceLink(evidence.value, {
      loc: sampleChunk.loc,
      label: 'p.8',
    });
    expect(draft.ok).toBe(true);
    if (draft.ok) expect(draft.value.chunkId).toBe('chunk_abc');
  });

  it('does not invent coverage ratios or completeness from map notes', () => {
    const mapCoverage = {
      summary: 'Lectura parcial del PDF.',
      notes: [{ label: 'OCR', detail: 'Páginas 3-4 borrosas', tone: 'warning' as const }],
    };
    const domain = sourceCoverageFromMapCoverage(mapCoverage);
    expect(domain.textual).toBeNull();
    expect(domain.extractionConfidence).toBeNull();
    expect(domain.isComplete).toBeNull();
    expect(domain.visualDependency).toBe('unknown');
    expect(domain.limitations.some((item) => item.code === 'map_summary')).toBe(true);

    const empty = sourceCoverageFromMapCoverage(undefined);
    expect(empty.isComplete).toBeNull();
    expect(empty.textual).toBeNull();

    const back = mapCoverageFromSourceCoverage(domain);
    expect(back.summary).toBe('Lectura parcial del PDF.');
    expect(back.notes.some((note) => note.tone === 'warning')).toBe(true);

    const unknownBack = mapCoverageFromSourceCoverage(validSourceCoverageUnknown);
    expect(unknownBack.summary).toBe('Completitud de cobertura desconocida.');
  });

  it('builds NucleoSource without inventing coverage numbers', () => {
    const result = nucleoSourceFromMapMetadata(
      {
        kind: 'pdf',
        label: 'Informe',
        title: 'Informe anual',
        author: 'Equipo',
        language: 'es',
        detected: ['pdf'],
        limitations: ['Sin OCR en anexos'],
      },
      {
        id: 'src-pdf',
        ownerId: 'user-1',
        contentHash: 'hash-pdf',
        mapCoverage: {
          summary: 'Resumen',
          notes: [{ label: 'Anexo', detail: 'Falta tabla', tone: 'warning' }],
        },
      }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('pdf');
    expect(result.value.coverage.textual).toBeNull();
    expect(result.value.coverage.extractionConfidence).toBeNull();
    expect(result.value.coverage.isComplete).toBeNull();
    expect(result.value.coverage.visualDependency).toBe('unknown');
  });

  it('maps known source kinds honestly and fails unknown / does not disguise image as text', () => {
    expect(nucleoSourceTypeFromKind('youtube')).toEqual({ ok: true, value: 'youtube_transcript' });
    expect(nucleoSourceTypeFromKind('link')).toEqual({ ok: true, value: 'web_article' });
    expect(nucleoSourceTypeFromKind('text')).toEqual({ ok: true, value: 'pasted_text' });
    expect(nucleoSourceTypeFromKind('image')).toEqual({ ok: true, value: 'image' });
    expect(nucleoSourceTypeFromKind('video')).toEqual({ ok: true, value: 'video' });

    const unknown = nucleoSourceTypeFromKind('telegram');
    expect(unknown.ok).toBe(false);

    const fromMeta = nucleoSourceFromMapMetadata(
      { kind: 'image', label: 'Foto', detected: [] },
      { id: 'src-img', ownerId: 'u', contentHash: 'h' }
    );
    expect(fromMeta.ok).toBe(true);
    if (fromMeta.ok) expect(fromMeta.value.type).toBe('image');
  });

  it('derives anchors without dropping loc for display, while round-trip uses stored loc', () => {
    expect(sourceAnchorFromChunkLoc(sampleChunk.loc).type).toBe('timestamp');
    const chapterOnly = sourceAnchorFromChunkLoc({
      start: 0,
      end: 5,
      chapterTitle: 'Solo capítulo',
    });
    expect(chapterOnly).toEqual({ type: 'chapter', chapter: 'Solo capítulo' });
  });
});

describe('domainContracts SourceChunkLoc runtime validation', () => {
  const baseSegment = {
    id: 'seg-hostile',
    sourceId: 'src-1',
    ordinal: 0,
    kind: 'paragraph' as const,
    rawText: 'Texto',
    normalizedText: 'Texto',
    hierarchy: [] as string[],
    anchor: { type: 'char_range' as const, start: 0, end: 5 },
    extractionConfidence: null as number | null,
    metadata: { hash: 'h' },
  };

  function rebuildWithLoc(loc: unknown) {
    return sourceChunkFromSegment({
      ...baseSegment,
      metadata: { hash: 'h', [CHUNK_LOC_METADATA_KEY]: loc },
    });
  }

  it('rejects end < start', () => {
    const result = validateSourceChunkLoc({ start: 10, end: 5 });
    expect(result.ok).toBe(false);
    const viaAdapter = rebuildWithLoc({ start: 10, end: 5 });
    expect(viaAdapter.ok).toBe(false);
  });

  it('rejects negative and fractional offsets', () => {
    expect(validateSourceChunkLoc({ start: -1, end: 2 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: -1 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 1.5, end: 3 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 2.2 }).ok).toBe(false);
  });

  it('rejects each optional field when mistyped', () => {
    expect(validateSourceChunkLoc({ start: 0, end: 1, page: 1.5 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, page: 0 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, chapterIndex: -1 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, chapterIndex: 1.2 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, timestamp: -0.1 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, timestamp: Number.NaN }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, chapterTitle: '' }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, chapterTitle: 3 }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, imageId: '' }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, imageId: null }).ok).toBe(false);
  });

  it('rejects null, partial, or non-finite bbox', () => {
    expect(validateSourceChunkLoc({ start: 0, end: 1, bbox: null }).ok).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, bbox: { x: 0, y: 0, w: 1 } }).ok).toBe(false);
    expect(
      validateSourceChunkLoc({ start: 0, end: 1, bbox: { x: 0, y: 0, w: 1, h: Number.NaN } }).ok
    ).toBe(false);
    expect(
      validateSourceChunkLoc({ start: 0, end: 1, bbox: { x: 0, y: 0, w: -1, h: 1 } }).ok
    ).toBe(false);
    expect(validateSourceChunkLoc({ start: 0, end: 1, bbox: [0, 0, 1, 1] }).ok).toBe(false);
  });

  it('rejects fractional index anchors and ordinals', () => {
    expect(validateSourceAnchor({ type: 'page', page: 1.5 }).ok).toBe(false);
    expect(validateSourceAnchor({ type: 'paragraph', paragraph: 2.2 }).ok).toBe(false);
    expect(validateSourceAnchor({ type: 'line', startLine: 1.1 }).ok).toBe(false);
    expect(validateSourceAnchor({ type: 'char_range', start: 0.5, end: 2 }).ok).toBe(false);
    expect(
      validateSourceSegment({
        ...validSourceSegment,
        ordinal: 1.5,
      }).ok
    ).toBe(false);
  });

  it('allows fractional timestamps on anchors and chunkLoc', () => {
    expect(
      validateSourceAnchor({ type: 'timestamp', startSeconds: 12.5, endSeconds: 20 }).ok
    ).toBe(true);
    expect(validateSourceChunkLoc({ start: 0, end: 10, timestamp: 12.5 }).ok).toBe(true);
  });

  it('sourceChunkFromSegment never throws on hostile metadata', () => {
    const hostiles = [
      null,
      undefined,
      [],
      'x',
      3,
      { start: 0 },
      { start: 0, end: 1, bbox: null },
      { start: 5, end: 1 },
      { start: -1, end: 2 },
      { start: 0, end: 1, page: '2' },
    ];
    for (const loc of hostiles) {
      expect(() => rebuildWithLoc(loc)).not.toThrow();
      expect(rebuildWithLoc(loc).ok).toBe(false);
    }
  });
});
