import { describe, expect, it } from 'vitest';
import { createTransformRunController } from './transformRunController';
import {
  buildStableCollectionPartBody,
  mintStableCollectionPartIdentities,
  splitTransformJsonPayload,
} from './collectionPartExecution';
import { isAskLaneInput } from '../server/src/ingestors/askLane';
import { configureStorage, type SyncKeyValueStorage } from './storage';
import {
  getPendingSourceSyncForMap,
  loadPendingSourceSync,
  reconcilePendingSourceSyncWithHistory,
  upsertPendingSourceSync,
} from './pendingSourceSync';
import { createEntry, loadHistory, saveHistory, updateEntrySourceMeta } from './history';
import { createPastedTextOperationIds } from './pastedText';
import type { ActionMapData } from './contracts';

function memoryKv(): SyncKeyValueStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const miniMap = {
  title: 'T',
  coreIdea: 'Idea central breve',
  coreSupport: 'Apoyo',
  intent: 'understand',
  tldr: [
    { title: 'Uno', desc: 'Primero' },
    { title: 'Dos', desc: 'Segundo' },
    { title: 'Tres', desc: 'Tercero' },
  ],
  steps: [
    {
      id: 's1',
      shortNav: '1',
      title: 'Paso 1',
      time: '~1 min',
      content: [{ type: 'prose', text: 'Texto' }],
      selfCheck: '¿Ok?',
    },
  ],
  readingSections: [{ title: 'A', fromStep: 1, toStep: 1 }],
  sourceMetadata: { kind: 'text', label: 'F', detected: [], limitations: [] },
  coverage: { summary: 'c', notes: [] },
  completionCard: { title: 'C', summary: 'S', takeaways: ['x'] },
} as unknown as ActionMapData;

describe('S03 collection part identities', () => {
  it('retries reuse the same four IDs; interrogative stays source', () => {
    const identities = mintStableCollectionPartIdentities(2);
    const base = {
      type: 'text' as const,
      text: 'base',
      textMode: 'source' as const,
      ...identities[0],
    };
    const part = { title: 'Q', text: '¿Qué es la memoria de trabajo?' };
    const first = buildStableCollectionPartBody(base, part, identities[0]!);
    const retry = buildStableCollectionPartBody(base, part, identities[0]!);
    expect(retry.mapId).toBe(first.mapId);
    expect(retry.sourceId).toBe(first.sourceId);
    expect(retry.sourceVersionId).toBe(first.sourceVersionId);
    expect(retry.sourceRequestId).toBe(first.sourceRequestId);
    expect(retry.textMode).toBe('source');
    expect(isAskLaneInput(retry)).toBe(false);
  });

  it('splits sourceMeta before normalize payload', () => {
    const ids = createPastedTextOperationIds();
    const { mapPayload, sourceMeta } = splitTransformJsonPayload({
      ...miniMap,
      sourceMeta: {
        sourceId: ids.sourceId,
        sourceVersionId: ids.sourceVersionId,
        sourceRequestId: ids.sourceRequestId,
        sourceStatus: 'ready',
        persistStatus: 'sync_failed',
        contentHash: 'abc',
        segmentCount: 1,
      },
    });
    expect(sourceMeta?.persistStatus).toBe('sync_failed');
    expect((mapPayload as { sourceMeta?: unknown }).sourceMeta).toBeUndefined();
  });
});

describe('S03 run identity vs token refresh', () => {
  it('same user token refresh does not stale the run; A→B does', () => {
    const ctrl = createTransformRunController();
    const { snapshot } = ctrl.begin({
      mapId: 'm1',
      auth: { epoch: 1, userId: 'user-a', accessToken: 't1' },
    });
    expect(ctrl.isCurrentForAuth(snapshot.runId, { userId: 'user-a', epoch: 99 })).toBe(true);
    expect(ctrl.isCurrentForAuth(snapshot.runId, { userId: 'user-b', epoch: 2 })).toBe(false);
    expect(ctrl.isCurrentForAuth(snapshot.runId, null)).toBe(false);
  });

  it('double begin during offline await leaves only latest', async () => {
    const ctrl = createTransformRunController();
    const first = ctrl.begin({
      mapId: 'm1',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    await Promise.resolve();
    const second = ctrl.begin({
      mapId: 'm2',
      auth: { epoch: 1, userId: 'a', accessToken: 't' },
    });
    expect(first.signal.aborted).toBe(true);
    expect(ctrl.isCurrent(second.snapshot.runId)).toBe(true);
  });
});

describe('S03 pending hydrate after restart', () => {
  it('restores A pending after new session; B never sees it; retry without inline ref', () => {
    configureStorage(memoryKv());
    const ids = createPastedTextOperationIds();
    let store = createEntry(
      loadHistory(),
      {
        data: miniMap,
        currentStep: 0,
        isComplete: false,
        viewAll: false,
      },
      'text',
      ids.mapId
    );
    store = updateEntrySourceMeta(store, ids.mapId, {
      sourceId: ids.sourceId,
      sourceVersionId: ids.sourceVersionId,
      sourceRequestId: ids.sourceRequestId,
      sourceStatus: 'ready',
      persistStatus: 'sync_failed',
      contentHash: 'hash-a',
      segmentCount: 1,
    });
    saveHistory(store);
    upsertPendingSourceSync('user-a', {
      mapId: ids.mapId,
      sourceId: ids.sourceId,
      sourceVersionId: ids.sourceVersionId,
      sourceRequestId: ids.sourceRequestId,
      canonicalText: 'texto de A',
      contentHash: 'hash-a',
      title: 'Fuente A',
    });

    // Destroy in-memory controllers — new hydrate path
    const reloaded = loadHistory();
    const forA = reconcilePendingSourceSyncWithHistory({
      userId: 'user-a',
      entries: reloaded.entries,
    });
    expect(forA.pendingByMapId[ids.mapId]?.canonicalText).toBe('texto de A');
    expect(forA.entriesNeedingSyncBanner).toContain(ids.mapId);
    expect(getPendingSourceSyncForMap('user-a', ids.mapId)?.sourceRequestId).toBe(
      ids.sourceRequestId
    );

    const forB = reconcilePendingSourceSyncWithHistory({
      userId: 'user-b',
      entries: reloaded.entries,
    });
    expect(Object.keys(forB.pendingByMapId)).toHaveLength(0);
    expect(loadPendingSourceSync('user-b')).toHaveLength(0);

    // Retry lookup without inlineRetryPayloadRef — pending alone is enough
    const pending = getPendingSourceSyncForMap('user-a', ids.mapId);
    expect(pending?.canonicalText).toBe('texto de A');
    expect(pending?.sourceRequestId).toBe(ids.sourceRequestId);
  });
});
