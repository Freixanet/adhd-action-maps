import { describe, expect, it, vi } from 'vitest';
import { PersistRetryGate } from './persistRetryGate';
import { runOrderedPersistSync } from './persistSyncCoordinator';
import {
  resolveActiveSyncFailureCode,
  resolveActiveSyncSaving,
  type PersistStepResult,
  type SyncFailureRecord,
} from './persistStepResult';

function step(
  partial: PersistStepResult
): PersistStepResult {
  return partial;
}

describe('runOrderedPersistSync — real orchestration', () => {
  it('PDF pending + evidence pending → cloud + durable remove → evidence once', async () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    let durablePending = true;
    let evidenceCalls = 0;
    const order: string[] = [];

    const outcome = await runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'mapA',
      gate,
      mode: 'manual',
      sourcePending: true,
      evidencePending: true,
      progressPending: false,
      persistSource: async () => {
        order.push('source_start');
        // Simulate await removePendingPdfSourceSync before success.
        await Promise.resolve();
        durablePending = false;
        order.push('source_removed');
        return step({
          status: 'success',
          kind: 'source',
          ownerId: 'u',
          mapId: 'mapA',
        });
      },
      persistEvidence: async () => {
        evidenceCalls += 1;
        order.push('evidence');
        expect(durablePending).toBe(false);
        return step({
          status: 'success',
          kind: 'evidence',
          ownerId: 'u',
          mapId: 'mapA',
        });
      },
      persistProgress: async () => {
        order.push('progress');
        return step({
          status: 'not_pending',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'mapA',
        });
      },
    });

    expect(order).toEqual(['source_start', 'source_removed', 'evidence']);
    expect(evidenceCalls).toBe(1);
    expect(outcome.firstActionableFailure).toBeNull();
    expect(outcome.steps.map((s) => s.kind)).toEqual(['source', 'evidence']);
  });

  it('slow durable remove → evidence waits then saves', async () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    let durablePending = true;
    const timeline: string[] = [];

    await runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'm',
      gate,
      mode: 'manual',
      sourcePending: true,
      evidencePending: true,
      progressPending: false,
      persistSource: async () => {
        timeline.push('source');
        await new Promise((r) => setTimeout(r, 40));
        durablePending = false;
        timeline.push('removed');
        return step({
          status: 'success',
          kind: 'source',
          ownerId: 'u',
          mapId: 'm',
        });
      },
      persistEvidence: async () => {
        timeline.push(durablePending ? 'evidence_too_early' : 'evidence_ok');
        return step({
          status: 'success',
          kind: 'evidence',
          ownerId: 'u',
          mapId: 'm',
        });
      },
      persistProgress: async () =>
        step({
          status: 'not_pending',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'm',
        }),
    });

    expect(timeline).toEqual(['source', 'removed', 'evidence_ok']);
  });

  it('durable remove failure → evidence not run; PDF stays pending conceptually', async () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    let evidenceCalls = 0;

    const outcome = await runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'm',
      gate,
      mode: 'manual',
      sourcePending: true,
      evidencePending: true,
      progressPending: false,
      persistSource: async () =>
        step({
          status: 'failed',
          kind: 'source',
          ownerId: 'u',
          mapId: 'm',
          code: 'PDF_PENDING_REMOVE_FAILED',
        }),
      persistEvidence: async () => {
        evidenceCalls += 1;
        return step({
          status: 'success',
          kind: 'evidence',
          ownerId: 'u',
          mapId: 'm',
        });
      },
      persistProgress: async () =>
        step({
          status: 'success',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'm',
        }),
    });

    expect(evidenceCalls).toBe(0);
    expect(outcome.firstActionableFailure?.code).toBe('PDF_PENDING_REMOVE_FAILED');
    expect(outcome.steps.some((s) => s.kind === 'evidence')).toBe(false);
    expect(outcome.steps.some((s) => s.code === 'EVIDENCE_WAITING_SOURCE')).toBe(
      false
    );
  });

  it('PDF network failure → evidence not run; keeps PDF_PERSIST_NETWORK', async () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    let evidenceCalls = 0;

    const outcome = await runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'm',
      gate,
      mode: 'manual',
      sourcePending: true,
      evidencePending: true,
      progressPending: true,
      persistSource: async () =>
        step({
          status: 'failed',
          kind: 'source',
          ownerId: 'u',
          mapId: 'm',
          code: 'PDF_PERSIST_NETWORK',
        }),
      persistEvidence: async () => {
        evidenceCalls += 1;
        return step({
          status: 'blocked',
          kind: 'evidence',
          ownerId: 'u',
          mapId: 'm',
          code: 'EVIDENCE_WAITING_SOURCE',
        });
      },
      persistProgress: async () =>
        step({
          status: 'success',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'm',
        }),
    });

    expect(evidenceCalls).toBe(0);
    expect(outcome.firstActionableFailure?.code).toBe('PDF_PERSIST_NETWORK');
    expect(outcome.steps.some((s) => s.code === 'EVIDENCE_WAITING_SOURCE')).toBe(
      false
    );
    expect(outcome.steps.some((s) => s.kind === 'progress')).toBe(false);
  });

  it('source already saved → only evidence', async () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    const order: string[] = [];

    await runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'm',
      gate,
      mode: 'manual',
      sourcePending: false,
      evidencePending: true,
      progressPending: false,
      persistSource: async () => {
        order.push('source');
        return step({
          status: 'not_pending',
          kind: 'source',
          ownerId: 'u',
          mapId: 'm',
        });
      },
      persistEvidence: async () => {
        order.push('evidence');
        return step({
          status: 'success',
          kind: 'evidence',
          ownerId: 'u',
          mapId: 'm',
        });
      },
      persistProgress: async () => {
        order.push('progress');
        return step({
          status: 'not_pending',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'm',
        });
      },
    });

    expect(order).toEqual(['evidence']);
  });

  it('double reconnect/AppState → one execution per owner+map', async () => {
    let t = 0;
    const gate = new PersistRetryGate({ minIntervalMs: 5_000, now: () => t });
    let runs = 0;
    const deps = {
      ownerId: 'u',
      mapId: 'm',
      gate,
      mode: 'auto' as const,
      sourcePending: true,
      evidencePending: false,
      progressPending: false,
      persistSource: async () => {
        runs += 1;
        await new Promise((r) => setTimeout(r, 30));
        return step({
          status: 'success',
          kind: 'source',
          ownerId: 'u',
          mapId: 'm',
        });
      },
      persistEvidence: async () =>
        step({
          status: 'not_pending',
          kind: 'evidence',
          ownerId: 'u',
          mapId: 'm',
        }),
      persistProgress: async () =>
        step({
          status: 'not_pending',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'm',
        }),
    };

    const a = runOrderedPersistSync(deps);
    const b = runOrderedPersistSync(deps);
    const [ra, rb] = await Promise.all([a, b]);
    expect(runs).toBe(1);
    expect(ra.ran || rb.ran).toBe(true);
    expect(ra.ran && rb.ran).toBe(false);

    t = 6_000;
    const c = await runOrderedPersistSync(deps);
    expect(c.ran).toBe(true);
    expect(runs).toBe(2);
  });

  it('A→B mid-flight: A source suspended then stale; evidence/progress of A never run; B stays clean', async () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    let releaseA!: () => void;
    const holdA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    let activeMapId = 'mapA';
    let epoch = 1;
    const startedEpoch = 1;
    const evidenceA = vi.fn(async () =>
      step({
        status: 'success',
        kind: 'evidence',
        ownerId: 'u',
        mapId: 'mapA',
      })
    );
    const progressA = vi.fn(async () =>
      step({
        status: 'success',
        kind: 'progress',
        ownerId: 'u',
        mapId: 'mapA',
      })
    );

    let sourceSaving: { ownerId: string; mapId: string } | null = {
      ownerId: 'u',
      mapId: 'mapA',
    };
    let failure: SyncFailureRecord | null = null;

    const runA = runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'mapA',
      gate,
      mode: 'manual',
      sourcePending: true,
      evidencePending: true,
      progressPending: true,
      persistSource: async () => {
        await holdA;
        if (activeMapId !== 'mapA' || epoch !== startedEpoch) {
          const stale = step({
            status: 'stale',
            kind: 'source',
            ownerId: 'u',
            mapId: 'mapA',
            code: 'SOURCE_AUTH_STALE',
          });
          failure = {
            ownerId: 'u',
            mapId: 'mapA',
            kind: 'source',
            code: 'SOURCE_AUTH_STALE',
          };
          sourceSaving = null;
          return stale;
        }
        sourceSaving = null;
        return step({
          status: 'success',
          kind: 'source',
          ownerId: 'u',
          mapId: 'mapA',
        });
      },
      persistEvidence: evidenceA,
      persistProgress: progressA,
    });

    // Switch active identity to B while A is suspended.
    activeMapId = 'mapB';
    epoch = 2;
    sourceSaving = { ownerId: 'u', mapId: 'mapA' }; // A still "saving" until resolve

    expect(
      resolveActiveSyncSaving({
        saving: sourceSaving,
        ownerId: 'u',
        mapId: 'mapB',
      })
    ).toBe(false);

    const { deriveSyncNotice } = await import('./syncNotice');
    const noticeB = deriveSyncNotice({
      sourcePending: false,
      evidencePending: false,
      progressPending: false,
      applicationPending: false,
      sourceSaving: resolveActiveSyncSaving({
        saving: sourceSaving,
        ownerId: 'u',
        mapId: 'mapB',
      }),
      evidenceSaving: false,
      retryingKind: null,
      lastFailureCode: resolveActiveSyncFailureCode({
        failure,
        ownerId: 'u',
        mapId: 'mapB',
      }),
    });
    expect(noticeB).toBeNull();

    releaseA();
    const outcome = await runA;
    expect(outcome.steps[0]?.status).toBe('stale');
    expect(outcome.steps[0]?.mapId).toBe('mapA');
    expect(evidenceA).not.toHaveBeenCalled();
    expect(progressA).not.toHaveBeenCalled();
    expect(
      resolveActiveSyncFailureCode({
        failure,
        ownerId: 'u',
        mapId: 'mapB',
      })
    ).toBeNull();
    expect(
      resolveActiveSyncSaving({
        saving: sourceSaving,
        ownerId: 'u',
        mapId: 'mapB',
      })
    ).toBe(false);
  });

  it('progress does not run before source/evidence close', async () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    const order: string[] = [];

    await runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'm',
      gate,
      mode: 'manual',
      sourcePending: true,
      evidencePending: true,
      progressPending: true,
      persistSource: async () => {
        order.push('source');
        return step({
          status: 'success',
          kind: 'source',
          ownerId: 'u',
          mapId: 'm',
        });
      },
      persistEvidence: async () => {
        order.push('evidence');
        return step({
          status: 'failed',
          kind: 'evidence',
          ownerId: 'u',
          mapId: 'm',
          code: 'EVIDENCE_PERSIST_FAILED',
        });
      },
      persistProgress: async () => {
        order.push('progress');
        return step({
          status: 'success',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'm',
        });
      },
    });

    expect(order).toEqual(['source', 'evidence']);
  });

  it('pending of another map is not processed when retrying active map', async () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    const seen: string[] = [];

    await runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'active',
      gate,
      mode: 'manual',
      sourcePending: true,
      evidencePending: false,
      progressPending: false,
      persistSource: async () => {
        seen.push('active');
        return step({
          status: 'success',
          kind: 'source',
          ownerId: 'u',
          mapId: 'active',
        });
      },
      persistEvidence: async () => {
        seen.push('other');
        return step({
          status: 'success',
          kind: 'evidence',
          ownerId: 'u',
          mapId: 'other',
        });
      },
      persistProgress: async () => {
        seen.push('other-progress');
        return step({
          status: 'success',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'other',
        });
      },
    });

    expect(seen).toEqual(['active']);
  });

  it('EVIDENCE_WAITING_SOURCE from runner does not replace PDF failure', async () => {
    // Guard: if a buggy runner still returns WAITING after source fail, actionable stays PDF.
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    const persistEvidence = vi.fn(async () =>
      step({
        status: 'blocked',
        kind: 'evidence',
        ownerId: 'u',
        mapId: 'm',
        code: 'EVIDENCE_WAITING_SOURCE',
      })
    );

    const outcome = await runOrderedPersistSync({
      ownerId: 'u',
      mapId: 'm',
      gate,
      mode: 'manual',
      sourcePending: true,
      evidencePending: true,
      progressPending: false,
      persistSource: async () =>
        step({
          status: 'failed',
          kind: 'source',
          ownerId: 'u',
          mapId: 'm',
          code: 'PDF_PERSIST_NETWORK',
        }),
      persistEvidence,
      persistProgress: async () =>
        step({
          status: 'not_pending',
          kind: 'progress',
          ownerId: 'u',
          mapId: 'm',
        }),
    });

    expect(persistEvidence).not.toHaveBeenCalled();
    expect(outcome.firstActionableFailure?.code).toBe('PDF_PERSIST_NETWORK');
  });
});

describe('resolveActiveSyncFailureCode', () => {
  it('hides failures from other owner or map', () => {
    const failure: SyncFailureRecord = {
      ownerId: 'u1',
      mapId: 'm1',
      kind: 'source',
      code: 'PDF_PERSIST_NETWORK',
    };
    expect(
      resolveActiveSyncFailureCode({ failure, ownerId: 'u1', mapId: 'm1' })
    ).toBe('PDF_PERSIST_NETWORK');
    expect(
      resolveActiveSyncFailureCode({ failure, ownerId: 'u2', mapId: 'm1' })
    ).toBeNull();
    expect(
      resolveActiveSyncFailureCode({ failure, ownerId: 'u1', mapId: 'm2' })
    ).toBeNull();
  });
});
