/**
 * Durable generation-result recovery — stream is progress, not sole source of truth.
 * Keyed by mapId + generationRunId (client-minted UUIDs, reused on retry).
 */

import type { ActionMapData } from './contracts';

export type GenerationRunStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type GenerationResultRecord = {
  mapId: string;
  generationRunId: string;
  status: GenerationRunStatus;
  /** Present when status === 'complete'. */
  map?: ActionMapData;
  model?: string;
  error?: string;
  code?: string;
  updatedAt: number;
  createdAt: number;
};

export type GenerationResultResponse = {
  mapId: string;
  generationRunId: string;
  status: GenerationRunStatus;
  map?: ActionMapData;
  model?: string;
  error?: string;
  code?: string;
  updatedAt: number;
};

export function mintGenerationRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isGenerationResultComplete(
  record: GenerationResultResponse | null | undefined
): record is GenerationResultResponse & { status: 'complete'; map: ActionMapData } {
  return Boolean(record && record.status === 'complete' && record.map);
}

export function generationResultPath(mapId: string, generationRunId: string): string {
  const q = new URLSearchParams({ mapId, generationRunId });
  return `/api/transform/result?${q.toString()}`;
}

/** Poll interval while stream is open / after close without done (ms). */
export const GENERATION_RESULT_POLL_MS = 1_500;
/** Max time spent polling for a durable result after stream trouble (ms). */
export const GENERATION_RESULT_POLL_MAX_MS = 45_000;
/** Hard wall-clock for an entire transform attempt (ms). */
export const GENERATION_WALL_CLOCK_MS = 10 * 60_000;

/** Build absolute result URL from the stream endpoint the client already uses. */
export function buildGenerationResultUrl(
  streamUrl: string,
  mapId: string,
  generationRunId: string
): string {
  try {
    const u = new URL(streamUrl);
    u.pathname = u.pathname.replace(/\/stream\/?$/, '/result');
    u.search = new URLSearchParams({ mapId, generationRunId }).toString();
    return u.toString();
  } catch {
    const trimmed = streamUrl.replace(/\/stream\/?$/, '');
    return `${trimmed}/result?${new URLSearchParams({ mapId, generationRunId }).toString()}`;
  }
}
