/**
 * File-backed generation result store (durable across process restarts).
 * Path: <cwd>/.data/generation-results/<mapId>/<generationRunId>.json
 */

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import type { ActionMapData } from '../../../shared/contracts';
import type {
  GenerationResultRecord,
  GenerationRunStatus,
} from '../../../shared/generationResult';
import { streamTrace } from '../../../shared/streamTrace';

const ROOT = join(process.cwd(), '.data', 'generation-results');

function recordPath(mapId: string, generationRunId: string): string {
  const safeMap = mapId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const safeRun = generationRunId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return join(ROOT, safeMap, `${safeRun}.json`);
}

function writeAtomic(path: string, record: GenerationResultRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(record), 'utf8');
  renameSync(tmp, path);
}

function readRecord(path: string): GenerationResultRecord | null {
  try {
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, 'utf8')) as GenerationResultRecord;
    if (!raw?.mapId || !raw?.generationRunId || !raw?.status) return null;
    return raw;
  } catch {
    return null;
  }
}

export type GenerationResultStore = {
  ensureRunning: (args: { mapId: string; generationRunId: string }) => GenerationResultRecord;
  markComplete: (args: {
    mapId: string;
    generationRunId: string;
    map: ActionMapData;
    model?: string;
  }) => GenerationResultRecord;
  markFailed: (args: {
    mapId: string;
    generationRunId: string;
    error: string;
    code?: string;
  }) => GenerationResultRecord;
  markCancelled: (args: { mapId: string; generationRunId: string }) => GenerationResultRecord;
  get: (mapId: string, generationRunId: string) => GenerationResultRecord | null;
};

export function createGenerationResultStore(): GenerationResultStore {
  const ensureRunning = (args: {
    mapId: string;
    generationRunId: string;
  }): GenerationResultRecord => {
    const path = recordPath(args.mapId, args.generationRunId);
    const existing = readRecord(path);
    if (existing?.status === 'complete') return existing;
    if (existing?.status === 'failed' || existing?.status === 'cancelled') return existing;
    const now = Date.now();
    const record: GenerationResultRecord = {
      mapId: args.mapId,
      generationRunId: args.generationRunId,
      status: 'running',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    writeAtomic(path, record);
    streamTrace('result_persisted', {
      mapId: args.mapId,
      runId: args.generationRunId,
      status: 'running',
    });
    return record;
  };

  const markComplete = (args: {
    mapId: string;
    generationRunId: string;
    map: ActionMapData;
    model?: string;
  }): GenerationResultRecord => {
    const path = recordPath(args.mapId, args.generationRunId);
    const existing = readRecord(path);
    // Idempotent: never overwrite a completed map with another.
    if (existing?.status === 'complete' && existing.map) {
      streamTrace('result_persisted', {
        mapId: args.mapId,
        runId: args.generationRunId,
        status: 'complete_idempotent',
      });
      return existing;
    }
    const now = Date.now();
    const record: GenerationResultRecord = {
      mapId: args.mapId,
      generationRunId: args.generationRunId,
      status: 'complete',
      map: args.map,
      model: args.model,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    writeAtomic(path, record);
    streamTrace('result_persisted', {
      mapId: args.mapId,
      runId: args.generationRunId,
      status: 'complete',
      bytes: JSON.stringify(args.map).length,
    });
    return record;
  };

  const markTerminal = (
    status: Extract<GenerationRunStatus, 'failed' | 'cancelled'>,
    args: { mapId: string; generationRunId: string; error?: string; code?: string }
  ): GenerationResultRecord => {
    const path = recordPath(args.mapId, args.generationRunId);
    const existing = readRecord(path);
    if (existing?.status === 'complete') return existing;
    const now = Date.now();
    const record: GenerationResultRecord = {
      mapId: args.mapId,
      generationRunId: args.generationRunId,
      status,
      error: args.error,
      code: args.code,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    writeAtomic(path, record);
    streamTrace('result_persisted', {
      mapId: args.mapId,
      runId: args.generationRunId,
      status,
      detail: args.code || args.error,
    });
    return record;
  };

  return {
    ensureRunning,
    markComplete,
    markFailed: (args) =>
      markTerminal('failed', {
        mapId: args.mapId,
        generationRunId: args.generationRunId,
        error: args.error,
        code: args.code,
      }),
    markCancelled: (args) =>
      markTerminal('cancelled', {
        mapId: args.mapId,
        generationRunId: args.generationRunId,
        error: 'Creación cancelada',
        code: 'CANCELLED',
      }),
    get: (mapId, generationRunId) => readRecord(recordPath(mapId, generationRunId)),
  };
}

/** Test helper — wipe one record. */
export function deleteGenerationResultForTests(mapId: string, generationRunId: string): void {
  const path = recordPath(mapId, generationRunId);
  try {
    unlinkSync(path);
  } catch {
    // ignore
  }
}
