import { describe, expect, it } from 'vitest';
import { PersistRetryGate } from './persistRetryGate';
import {
  canFlushEvidence,
  deriveSyncNotice,
  orderedSyncRetryPlan,
  syncLaneDevLabel,
  type ActiveMapSyncSnapshot,
} from './syncNotice';

function snap(partial: Partial<ActiveMapSyncSnapshot>): ActiveMapSyncSnapshot {
  return {
    sourcePending: false,
    evidencePending: false,
    progressPending: false,
    applicationPending: false,
    retryingKind: null,
    lastFailureCode: null,
    ...partial,
  };
}

describe('deriveSyncNotice — stable banner', () => {
  it('source + evidence pending → one stable combined message', () => {
    const notice = deriveSyncNotice(
      snap({ sourcePending: true, evidencePending: true })
    );
    expect(notice?.visible).toBe(true);
    expect(notice?.title).toBe('Sincronización pendiente');
    expect(notice?.message).toBe('Falta guardar el documento y sus referencias.');
    expect(notice?.retryKind).toBe('source');
  });

  it('100 ticks with same snapshot → identical message (no flicker)', () => {
    const base = snap({ sourcePending: true, evidencePending: true });
    const first = deriveSyncNotice(base);
    for (let i = 0; i < 100; i++) {
      const next = deriveSyncNotice({ ...base });
      expect(next?.message).toBe(first?.message);
      expect(next?.liveRegionKey).toBe(first?.liveRegionKey);
    }
  });

  it('only source → document message', () => {
    expect(deriveSyncNotice(snap({ sourcePending: true }))?.message).toBe(
      'El documento aún no se ha guardado en tu cuenta.'
    );
  });

  it('only evidence → references message', () => {
    expect(deriveSyncNotice(snap({ evidencePending: true }))?.message).toBe(
      'Las referencias del Núcleo aún no se han guardado.'
    );
  });

  it('saving source → Guardando documento… without retry', () => {
    const notice = deriveSyncNotice(
      snap({ sourcePending: true, evidencePending: true, sourceSaving: true })
    );
    expect(notice?.message).toBe('Guardando documento…');
    expect(notice?.retryLabel).toBeNull();
  });

  it('success clears notice', () => {
    expect(deriveSyncNotice(snap({}))).toBeNull();
  });

  it('saving evidence alone → Guardando referencias…', () => {
    const notice = deriveSyncNotice(
      snap({ evidencePending: true, evidenceSaving: true })
    );
    expect(notice?.message).toBe('Guardando referencias…');
    expect(notice?.retryLabel).toBeNull();
  });

  it('real failure keeps a single retry action', () => {
    const notice = deriveSyncNotice(
      snap({
        sourcePending: true,
        evidencePending: true,
        lastFailureCode: 'PDF_PERSIST_NETWORK',
      })
    );
    expect(notice?.retryLabel).toBe('Reintentar sincronización');
    expect(notice?.retryKind).toBe('source');
  });
});

describe('canFlushEvidence / ordered plan', () => {
  it('source pending blocks evidence retry', () => {
    expect(
      canFlushEvidence({
        sourcePending: true,
        evidencePending: true,
        sourceId: 's',
        sourceVersionId: 'v',
      })
    ).toEqual({ ok: false, code: 'EVIDENCE_WAITING_SOURCE' });
  });

  it('missing source ids → unbound', () => {
    expect(
      canFlushEvidence({
        sourcePending: false,
        evidencePending: true,
        sourceId: '',
        sourceVersionId: null,
      })
    ).toEqual({ ok: false, code: 'EVIDENCE_SOURCE_UNBOUND' });
  });

  it('source success enables evidence once in ordered plan', () => {
    expect(
      orderedSyncRetryPlan({
        sourcePending: true,
        evidencePending: true,
        progressPending: false,
      })
    ).toEqual(['source', 'evidence']);
    expect(
      orderedSyncRetryPlan({
        sourcePending: false,
        evidencePending: true,
        progressPending: true,
      })
    ).toEqual(['evidence', 'progress']);
  });

  it('manual retry order is source → evidence', () => {
    const plan = orderedSyncRetryPlan({
      sourcePending: true,
      evidencePending: true,
      progressPending: false,
    });
    expect(plan[0]).toBe('source');
    expect(plan[1]).toBe('evidence');
  });
});

describe('PersistRetryGate', () => {
  it('dedupes concurrent runs for same owner+map+kind', () => {
    const gate = new PersistRetryGate({ minIntervalMs: 1000, now: () => 1000 });
    expect(gate.tryBeginManual('u', 'm', 'source')).toBe(true);
    expect(gate.tryBeginManual('u', 'm', 'source')).toBe(false);
    gate.end('u', 'm', 'source');
    expect(gate.tryBeginManual('u', 'm', 'source')).toBe(true);
  });

  it('auto retry respects backoff; double reconnect does not duplicate', () => {
    let t = 0;
    const gate = new PersistRetryGate({ minIntervalMs: 5000, now: () => t });
    expect(gate.tryBeginAuto('u', 'm', 'ordered')).toBe(true);
    gate.end('u', 'm', 'ordered');
    t = 1000;
    expect(gate.tryBeginAuto('u', 'm', 'ordered')).toBe(false);
    t = 6000;
    expect(gate.tryBeginAuto('u', 'm', 'ordered')).toBe(true);
  });

  it('A→B uses distinct keys so A in-flight does not block B', () => {
    const gate = new PersistRetryGate({ minIntervalMs: 0, now: () => 1 });
    expect(gate.tryBeginManual('u', 'mapA', 'source')).toBe(true);
    expect(gate.tryBeginManual('u', 'mapB', 'source')).toBe(true);
  });
});

describe('DEV lane labels', () => {
  it('maps statuses to human Spanish', () => {
    expect(syncLaneDevLabel('saved')).toBe('guardado');
    expect(syncLaneDevLabel('confirmed')).toBe('guardado confirmado');
    expect(syncLaneDevLabel('pending')).toBe('pendiente');
    expect(syncLaneDevLabel('saving')).toBe('guardando');
    expect(syncLaneDevLabel('error')).toBe('error');
    expect(syncLaneDevLabel('unknown')).toBe('desconocido');
    expect(syncLaneDevLabel('not_applicable')).toBe('no aplicable');
  });
});
