/**
 * NDJSON stream helpers: global heartbeat + durable result emit.
 */

import type { Response } from 'express';
import type { ActionMapData } from '../../../shared/contracts';
import type { GenerationResultStore } from './generationResultStore';
import { streamTrace } from '../../../shared/streamTrace';

export const GLOBAL_STREAM_HEARTBEAT_MS = 7_000;

export function startGlobalStreamHeartbeat(
  res: Response,
  meta: { mapId?: string; generationRunId?: string }
): () => void {
  const tick = () => {
    if (res.writableEnded || res.destroyed) return;
    try {
      res.write(`${JSON.stringify({ type: 'heartbeat', heartbeatAt: Date.now() })}\n`);
      streamTrace('heartbeat_written', {
        mapId: meta.mapId,
        generationRunId: meta.generationRunId,
      });
    } catch {
      // ignore write failures on closed sockets
    }
  };
  const timer = setInterval(tick, GLOBAL_STREAM_HEARTBEAT_MS);
  // Immediate first beat so clients don't wait a full interval after headers.
  tick();
  return () => clearInterval(timer);
}

export function emitRunEvent(
  res: Response,
  args: { mapId: string; generationRunId: string }
): void {
  if (res.writableEnded) return;
  res.write(
    `${JSON.stringify({
      type: 'run',
      mapId: args.mapId,
      generationRunId: args.generationRunId,
    })}\n`
  );
}

export function persistAndWriteDone(
  res: Response,
  store: GenerationResultStore,
  args: {
    mapId: string;
    generationRunId: string;
    map: ActionMapData;
    model?: string;
    sourceMeta?: unknown;
    pdfPersistRetry?: unknown;
  }
): void {
  store.markComplete({
    mapId: args.mapId,
    generationRunId: args.generationRunId,
    map: args.map,
    model: args.model,
  });

  const payload: Record<string, unknown> = {
    type: 'done',
    map: args.map,
  };
  if (args.model) payload.model = args.model;
  if (args.sourceMeta) payload.sourceMeta = args.sourceMeta;
  if (args.pdfPersistRetry) payload.pdfPersistRetry = args.pdfPersistRetry;

  const serialized = `${JSON.stringify(payload)}\n`;
  streamTrace('done_serialized', {
    mapId: args.mapId,
    generationRunId: args.generationRunId,
    bytes: serialized.length,
  });

  if (res.writableEnded) {
    streamTrace(
      'done_write_failed',
      {
        mapId: args.mapId,
        generationRunId: args.generationRunId,
        detail: 'writableEnded',
      },
      'error'
    );
    return;
  }

  try {
    const ok = res.write(serialized);
    streamTrace(ok ? 'done_write_ok' : 'done_write_ok', {
      mapId: args.mapId,
      generationRunId: args.generationRunId,
      bytes: serialized.length,
      detail: ok ? 'drained' : 'buffered',
    });
  } catch (err) {
    streamTrace(
      'done_write_failed',
      {
        mapId: args.mapId,
        generationRunId: args.generationRunId,
        detail: err instanceof Error ? err.message : 'write_throw',
      },
      'error'
    );
  }
}
