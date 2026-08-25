export type {
  BoundingBox,
  CoverageLimitation,
  EpistemicStatus,
  EvidenceLink,
  EvidenceRelation,
  NucleoSource,
  NucleoSourceType,
  SegmentKind,
  SourceAnchor,
  SourceCoverage,
  SourceSegment,
  SourceStatus,
  ValidationFail,
  ValidationOk,
  ValidationResult,
  VerifierStatus,
  VisualDependency,
} from './types';
export { CHUNK_LOC_METADATA_KEY } from './types';

export {
  validateEvidenceLink,
  validateNucleoSource,
  validateSourceAnchor,
  validateSourceChunkLoc,
  validateSourceCoverage,
  validateSourceSegment,
} from './validate';

export type { AdapterResult } from './adapters';
export {
  chunkLocFromSourceAnchor,
  citationDraftFromEvidenceLink,
  evidenceLinkFromCitation,
  mapCoverageFromSourceCoverage,
  nucleoSourceFromMapMetadata,
  nucleoSourceTypeFromKind,
  sourceAnchorFromChunkLoc,
  sourceChunkFromSegment,
  sourceCoverageFromMapCoverage,
  sourceSegmentFromChunk,
} from './adapters';

export {
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
