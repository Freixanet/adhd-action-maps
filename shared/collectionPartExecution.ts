/**
 * Collection-part execution helpers (S03). Shared for mobile + root vitest.
 */

import type { TransformRequest } from './contracts';
import {
  createPastedTextOperationIds,
  parsePastedTextSourceMeta,
  type PastedTextOperationIds,
  type PastedTextSourceMeta,
} from './pastedText';
import { parsePdfSourceMeta } from './pdf/applyCoverageToMap';

export type CollectionPartIdentity = PastedTextOperationIds & { textMode: 'source' };

export function mintStableCollectionPartIdentities(
  partCount: number
): CollectionPartIdentity[] {
  return Array.from({ length: Math.max(0, partCount) }, () => {
    const ids = createPastedTextOperationIds();
    return { ...ids, textMode: 'source' as const };
  });
}

export function buildStableCollectionPartBody(
  base: TransformRequest,
  part: { title: string; text?: string },
  ids: CollectionPartIdentity
): TransformRequest {
  if (part.text?.trim()) {
    return {
      text: part.text,
      type: 'text',
      preferredModel: base.preferredModel,
      intent: base.intent,
      depth: base.depth,
      generationMode: base.generationMode,
      userDisplayName: base.userDisplayName,
      outputLanguage: base.outputLanguage,
      sourceLabel: part.title,
      segmentTitle: part.title,
      sourceContentKind: base.sourceContentKind,
      mapId: ids.mapId,
      sourceId: ids.sourceId,
      sourceVersionId: ids.sourceVersionId,
      sourceRequestId: ids.sourceRequestId,
      textMode: 'source',
    };
  }

  return {
    ...base,
    sourceLabel: part.title,
    segmentTitle: part.title,
    mapId: ids.mapId,
    sourceId: ids.sourceId,
    sourceVersionId: ids.sourceVersionId,
    sourceRequestId: ids.sourceRequestId,
    textMode: 'source',
    singleNucleoMode: undefined,
  };
}

export function splitTransformJsonPayload(raw: unknown): {
  mapPayload: unknown;
  sourceMeta: PastedTextSourceMeta | import('./pdf/types').PdfSourceMeta | null;
  pdfPersistRetry: import('./pdf/types').PdfPersistRetryPayload | null;
} {
  if (!raw || typeof raw !== 'object') {
    return { mapPayload: raw, sourceMeta: null, pdfPersistRetry: null };
  }
  const obj = raw as Record<string, unknown>;
  const pasted = parsePastedTextSourceMeta(obj.sourceMeta);
  const pdf = pasted ? null : parsePdfSourceMeta(obj.sourceMeta);
  const sourceMeta = pasted ?? pdf;
  const pdfPersistRetry =
    obj.pdfPersistRetry && typeof obj.pdfPersistRetry === 'object'
      ? (obj.pdfPersistRetry as import('./pdf/types').PdfPersistRetryPayload)
      : null;
  if (!('sourceMeta' in obj) && !('pdfPersistRetry' in obj)) {
    return { mapPayload: raw, sourceMeta, pdfPersistRetry };
  }
  const { sourceMeta: _drop, pdfPersistRetry: _dropRetry, ...rest } = obj;
  void _drop;
  void _dropRetry;
  return { mapPayload: rest, sourceMeta, pdfPersistRetry };
}
