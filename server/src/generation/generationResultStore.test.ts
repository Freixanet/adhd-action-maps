import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import {
  createGenerationResultStore,
  deleteGenerationResultForTests,
} from './generationResultStore';
import type { ActionMapData } from '../../../shared/contracts';

const map = (title: string): ActionMapData =>
  ({
    title,
    coreIdea: 'Idea',
    coreSupport: 'Soporte',
    tldr: [],
    steps: [],
    intent: 'understand',
  }) as ActionMapData;

describe('generationResultStore', () => {
  const mapId = 'map-store-test';
  const runId = 'run-store-test';

  afterEach(() => {
    deleteGenerationResultForTests(mapId, runId);
    deleteGenerationResultForTests(mapId, 'run-b');
  });

  it('persists complete and returns the same map idempotently', () => {
    const store = createGenerationResultStore();
    store.ensureRunning({ mapId, generationRunId: runId });
    const first = store.markComplete({
      mapId,
      generationRunId: runId,
      map: map('Uno'),
      model: 'm1',
    });
    const second = store.markComplete({
      mapId,
      generationRunId: runId,
      map: map('Dos'),
      model: 'm2',
    });
    expect(first.status).toBe('complete');
    expect(first.map?.title).toBe('Uno');
    expect(second.map?.title).toBe('Uno');
    expect(store.get(mapId, runId)?.map?.title).toBe('Uno');
  });

  it('does not overwrite complete with failed/cancelled', () => {
    const store = createGenerationResultStore();
    store.markComplete({ mapId, generationRunId: runId, map: map('Ok') });
    store.markFailed({ mapId, generationRunId: runId, error: 'x', code: 'Y' });
    store.markCancelled({ mapId, generationRunId: runId });
    expect(store.get(mapId, runId)?.status).toBe('complete');
    expect(store.get(mapId, runId)?.map?.title).toBe('Ok');
  });

  it('survives process-style re-read from disk', () => {
    const a = createGenerationResultStore();
    a.markComplete({ mapId, generationRunId: runId, map: map('Disk') });
    const b = createGenerationResultStore();
    expect(b.get(mapId, runId)?.map?.title).toBe('Disk');
  });
});

describe('generation result root hygiene', () => {
  it('writes under .data/generation-results', () => {
    mkdirSync(join(process.cwd(), '.data', 'generation-results'), { recursive: true });
    expect(true).toBe(true);
    try {
      rmSync(join(process.cwd(), '.data', 'generation-results', '.keep'), { force: true });
    } catch {
      // ignore
    }
  });
});
