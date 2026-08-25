import { beforeEach, describe, expect, it } from 'vitest';
import { configureStorage } from './storage';
import {
  captureDurableSyncPending,
  hasAnyDurableSyncPending,
} from './durableSyncPending';
import { upsertPendingEvidenceSync } from './pendingEvidenceSync';
import { upsertPendingSourceSync } from './pendingSourceSync';
import { upsertPendingProgressSync } from './pendingProgressSync';
import { PersistRetryGate } from './persistRetryGate';
import { runOrderedPersistSync } from './persistSyncCoordinator';
import {
  resolveActiveSyncSaving,
  type PersistStepResult,
} from './persistStepResult';
import { deriveSyncNotice } from './syncNotice';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

function step(partial: PersistStepResult): PersistStepResult {
  return partial;
}

describe('captureDurableSyncPending — hydrate without React', () => {
  beforeEach(() => {
    configureStorage(memoryStorage());
  });

  it('reads source+evidence+progress from durable queues when React would be empty', () => {
    const owner = 'owner-hydrate';
    const mapId = '11111111-1111-4111-8111-111111111111';
    upsertPendingSourceSync(owner, {
      mapId,
      sourceId: '22222222-2222-4222-8222-222222222222',
      sourceVersionId: '33333333-3333-4333-8333-333333333333',
      sourceRequestId: '44444444-4444-4444-8444-444444444444',
      canonicalText: 'hello',
      contentHash: 'abc123',
    });
    upsertPendingEvidenceSync(owner, { mapId });
    upsertPendingProgressSync(owner, { id: mapId, updatedAt: 1 });

    // Simulate React not consolidated yet — we never read React here.
    const durable = captureDurableSyncPending(owner, mapId);
    expect(durable).toEqual({
      sourcePending: true,
      evidencePending: true,
      progressPending: true,
    });
    expect(hasAnyDurableSyncPending(durable)).toBe(true);
  });

  it('hydrate path: durable three-queue → exact source→evidence→progress; no early progress', async () => {
    const owner = 'owner-hydrate-2';
    const mapId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    upsertPendingSourceSync(owner, {
      mapId,
      sourceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      sourceVersionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      sourceRequestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      canonicalText: 'doc',
      contentHash: 'def456',
    });
    upsertPendingEvidenceSync(owner, { mapId });
    upsertPendingProgressSync(owner, { id: mapId, updatedAt: 2 });

    const durable = captureDurableSyncPending(owner, mapId);
    // React state "not ready" — coordinator still sees durable flags.
    const reactWouldSay = {
      sourcePending: false,
      evidencePending: false,
      progressPending: false,
    };
    expect(reactWouldSay.sourcePending).toBe(false);
    expect(durable.sourcePending && durable.evidencePending && durable.progressPending).toBe(
      true
    );

    const order: string[] = [];
    let progressDirectCalls = 0;
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });

    await runOrderedPersistSync({
      ownerId: owner,
      mapId,
      gate,
      mode: 'auto',
      ...durable,
      persistSource: async () => {
        order.push('source');
        return step({
          status: 'success',
          kind: 'source',
          ownerId: owner,
          mapId,
        });
      },
      persistEvidence: async () => {
        order.push('evidence');
        return step({
          status: 'success',
          kind: 'evidence',
          ownerId: owner,
          mapId,
        });
      },
      persistProgress: async () => {
        order.push('progress');
        progressDirectCalls += 1;
        return step({
          status: 'success',
          kind: 'progress',
          ownerId: owner,
          mapId,
        });
      },
    });

    expect(order).toEqual(['source', 'evidence', 'progress']);
    expect(progressDirectCalls).toBe(1);
    // Progress only via coordinator step — never a parallel/early call.
    expect(order.indexOf('progress')).toBeGreaterThan(order.indexOf('evidence'));
  });
});

describe('contextual saving — map A must not paint map B', () => {
  it('active map B never shows Guardando… while A is saving', () => {
    const savingA = { ownerId: 'u', mapId: 'mapA' };
    const sourceSavingOnB = resolveActiveSyncSaving({
      saving: savingA,
      ownerId: 'u',
      mapId: 'mapB',
    });
    const evidenceSavingOnB = resolveActiveSyncSaving({
      saving: { ownerId: 'u', mapId: 'mapA' },
      ownerId: 'u',
      mapId: 'mapB',
    });
    expect(sourceSavingOnB).toBe(false);
    expect(evidenceSavingOnB).toBe(false);

    const notice = deriveSyncNotice({
      sourcePending: false,
      evidencePending: false,
      progressPending: false,
      applicationPending: false,
      sourceSaving: sourceSavingOnB,
      evidenceSaving: evidenceSavingOnB,
      // Global retryingKind must not resurrect saving on B.
      retryingKind: 'source',
      lastFailureCode: null,
    });
    expect(notice).toBeNull();

    const noticeA = deriveSyncNotice({
      sourcePending: true,
      evidencePending: false,
      progressPending: false,
      applicationPending: false,
      sourceSaving: resolveActiveSyncSaving({
        saving: savingA,
        ownerId: 'u',
        mapId: 'mapA',
      }),
      evidenceSaving: false,
      retryingKind: 'source',
      lastFailureCode: null,
    });
    expect(noticeA?.message).toBe('Guardando documento…');
  });

  it('retryingKind alone no longer forces Guardando on unrelated map', () => {
    const notice = deriveSyncNotice({
      sourcePending: true,
      evidencePending: true,
      progressPending: false,
      applicationPending: false,
      sourceSaving: false,
      evidenceSaving: false,
      retryingKind: 'evidence',
      lastFailureCode: null,
    });
    expect(notice?.message).toBe('Falta guardar el documento y sus referencias.');
    expect(notice?.message).not.toBe('Guardando referencias…');
  });
});
