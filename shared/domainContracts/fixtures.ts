import type {
  EvidenceLink,
  NucleoSource,
  SourceAnchor,
  SourceCoverage,
  SourceSegment,
} from './types';

export const validSourceCoverage: SourceCoverage = {
  textual: 0.9,
  extractionConfidence: 0.85,
  visualDependency: 'low',
  visualsAnalyzed: false,
  isComplete: true,
  limitations: [],
};

export const validSourceCoverageUnknown: SourceCoverage = {
  textual: null,
  extractionConfidence: null,
  visualDependency: 'unknown',
  visualsAnalyzed: false,
  isComplete: null,
  limitations: [{ code: 'map_note', detail: 'Sin medición de cobertura' }],
};

export const invalidSourceCoverage = {
  textual: 2,
  extractionConfidence: 'high',
  visualDependency: 'extreme',
  visualsAnalyzed: 'yes',
  isComplete: 'yes',
  limitations: [{ code: 1 }],
};

export const validSourceAnchors: SourceAnchor[] = [
  { type: 'paragraph', paragraph: 3 },
  { type: 'page', page: 12, box: { x: 0, y: 0, w: 10, h: 10 } },
  { type: 'chapter', chapter: 'Introducción', paragraph: 1 },
  { type: 'timestamp', startSeconds: 12.5, endSeconds: 20 },
  { type: 'post', postId: '123', url: 'https://x.com/u/status/123' },
  { type: 'line', startLine: 4, endLine: 6 },
  { type: 'char_range', start: 0, end: 40 },
];

export const invalidSourceAnchor = { type: 'paragraph', paragraph: 0 };

export const validSourceSegment: SourceSegment = {
  id: 'seg-1',
  sourceId: 'src-1',
  ordinal: 0,
  kind: 'paragraph',
  rawText: 'La atención se agota con cada cambio de tarea.',
  normalizedText: 'La atención se agota con cada cambio de tarea.',
  hierarchy: ['Capítulo 1'],
  anchor: { type: 'chapter', chapter: 'Capítulo 1' },
  extractionConfidence: null,
  metadata: { hash: 'abc' },
};

export const invalidSourceSegment = {
  id: '',
  sourceId: 'src-1',
  ordinal: -1,
  kind: 'poem',
  rawText: '',
  normalizedText: '',
  hierarchy: 'Capítulo 1',
  anchor: { type: 'paragraph', paragraph: 0 },
  extractionConfidence: 2,
  metadata: null,
};

export const validNucleoSource: NucleoSource = {
  id: 'src-1',
  ownerId: 'user-1',
  type: 'pdf',
  title: 'Atención y carga',
  creator: 'Autora',
  originalUrl: null,
  language: 'es',
  mimeType: 'application/pdf',
  contentHash: 'hash-1',
  status: 'ready',
  coverage: validSourceCoverage,
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
};

export const invalidNucleoSource = {
  ...validNucleoSource,
  type: 'telegram',
  ownerId: '',
  contentHash: '',
  status: 'done',
};

export const validEvidenceLink: EvidenceLink = {
  id: 'ev-1',
  contentNodeId: 'node-1',
  segmentId: 'chunk-1',
  relation: 'supports',
  verifierStatus: 'pending',
  confidence: null,
  chunkId: 'chunk-1',
  epistemicStatus: 'direct_source',
};

export const validEvidenceLinkVerified: EvidenceLink = {
  id: 'ev-2',
  contentNodeId: 'node-2',
  segmentId: 'chunk-2',
  relation: 'qualifies',
  verifierStatus: 'verified',
  confidence: 0.8,
  chunkId: 'chunk-2',
  epistemicStatus: 'faithful_paraphrase',
};

export const invalidEvidenceLink = {
  id: '',
  contentNodeId: '',
  segmentId: '',
  relation: 'mentions',
  verifierStatus: 'ok',
  confidence: 5,
  epistemicStatus: 'made_up',
};
