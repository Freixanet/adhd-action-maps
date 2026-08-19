/**
 * Adapter: S05 evidence engine for registerTransformRoutes.
 */

import type { ActionMapData, TransformRequest } from '../../../shared/contracts';
import type { IngestResult } from '../../../shared/types/chunk';
import {
  runEvidenceEngine,
  type EvidenceJsonGenerator,
} from '../../../shared/evidence';

export type EvidenceEngineHttpResult =
  | { ok: true; map: ActionMapData; cacheHit: boolean }
  | { ok: false; status: number; error: string; code: string };

export function createRunEvidenceEngineDep(args: {
  generateJson: EvidenceJsonGenerator;
}): (opts: {
  body: TransformRequest;
  map: ActionMapData;
  ingest: IngestResult | null;
  contentHash?: string;
  userId?: string;
  pastedComplete?: boolean;
  partialExtraction?: boolean;
  webFetchSucceeded?: boolean;
  isCancelled: () => boolean;
  onHeartbeat?: (info: { processed: number; total: number }) => void;
}) => Promise<EvidenceEngineHttpResult> {
  return async (opts) => {
    if (opts.isCancelled()) {
      return {
        ok: false,
        status: 499,
        error: 'Creación cancelada',
        code: 'EVIDENCE_CANCELLED',
      };
    }

    const understanding = opts.map.understanding;
    if (!understanding || understanding.status !== 'complete') {
      return { ok: true, map: opts.map, cacheHit: false };
    }

    const map: ActionMapData = {
      ...opts.map,
      chunkIdManifest:
        opts.map.chunkIdManifest ??
        opts.ingest?.chunks?.map((c) => c.id),
    };

    const result = await runEvidenceEngine({
      artifact: understanding,
      map,
      ingest: opts.ingest,
      contentHash: opts.contentHash || understanding.contentHash || 'local',
      ownerId: opts.userId,
      pastedComplete: opts.pastedComplete,
      partialExtraction: opts.partialExtraction,
      webFetchSucceeded: opts.webFetchSucceeded,
      generateJson: args.generateJson,
      isCancelled: opts.isCancelled,
      onHeartbeat: opts.onHeartbeat,
    });

    if (result.ok === false) {
      const status = result.code === 'EVIDENCE_CANCELLED' ? 499 : 422;
      return {
        ok: false,
        status,
        error: result.message,
        code: result.code,
      };
    }

    return { ok: true, map: result.map, cacheHit: result.cacheHit };
  };
}

export function logEvidenceTelemetry(event: {
  verifierVersion: string;
  claimCount: number;
  criticalTotal: number;
  verified: number;
  durationMs: number;
  cacheHit: boolean;
  errorCode?: string;
}): void {
  console.log('[s05-evidence]', {
    verifierVersion: event.verifierVersion,
    claimCount: event.claimCount,
    criticalTotal: event.criticalTotal,
    verified: event.verified,
    durationMs: event.durationMs,
    cacheHit: event.cacheHit,
    errorCode: event.errorCode,
  });
}
