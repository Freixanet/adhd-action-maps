import { describe, expect, it } from 'vitest';
import type { HistoryEntry, HistoryStore } from './history';
import {
  createEmptyEnvelope,
  getActiveStore,
  parseOwnedHistoryEnvelope,
  removeHistoryOwner,
  replaceActiveStore,
  transitionHistoryOwner,
} from './historyOwnership';

function entry(id: string, title = id): HistoryEntry {
  return {
    id,
    title,
    createdAt: 1,
    updatedAt: 2,
    sourceType: 'text',
    session: {
      data: { title, steps: [{ id: 's1', title: 'Paso' }] },
      currentStep: 0,
      isComplete: false,
      viewAll: false,
    } as HistoryEntry['session'],
  };
}

function storeWith(...ids: string[]): HistoryStore {
  const entries = ids.map((id) => entry(id));
  return { activeId: entries[0]?.id ?? null, entries, collections: [] };
}

describe('historyOwnership state machine', () => {
  it('migrates legacy flat store to guest only', () => {
    const legacy = storeWith('g1');
    const envelope = parseOwnedHistoryEnvelope(legacy);
    expect(envelope.activeOwner).toEqual({ kind: 'guest' });
    expect(envelope.guest.entries.map((e) => e.id)).toEqual(['g1']);
    expect(envelope.byUserId).toEqual({});
    expect(envelope.lastBoundUserId).toBeNull();
  });

  it('guest lote 1 → A adopts current batch', () => {
    let envelope = createEmptyEnvelope();
    envelope = replaceActiveStore(envelope, storeWith('g1'));
    const result = transitionHistoryOwner(envelope, { kind: 'user', userId: 'user-a' }, { now: 10 });
    expect(result.adoptedGuest).toBe(true);
    expect(result.envelope.guest.entries).toEqual([]);
    expect(result.envelope.byUserId['user-a']?.entries.map((e) => e.id)).toEqual(['g1']);
    expect(result.cloudMigrateEntries.map((e) => e.id)).toEqual(['g1']);
  });

  it('sign-out → guest lote 2 → A adopts the new batch', () => {
    let envelope = createEmptyEnvelope();
    envelope = replaceActiveStore(envelope, storeWith('g1'));
    const first = transitionHistoryOwner(envelope, { kind: 'user', userId: 'user-a' }, { now: 1 });
    const signedOut = transitionHistoryOwner(first.envelope, { kind: 'guest' });
    let withGuest2 = {
      ...signedOut.envelope,
      guest: storeWith('g2'),
      activeOwner: { kind: 'guest' as const },
    };
    const second = transitionHistoryOwner(withGuest2, { kind: 'user', userId: 'user-a' }, { now: 2 });
    expect(second.adoptedGuest).toBe(true);
    expect(second.envelope.byUserId['user-a']?.entries.map((e) => e.id).sort()).toEqual(['g1', 'g2']);
    expect(second.envelope.guest.entries).toEqual([]);
  });

  it('sign-out → guest lote 3 → B only receives lote 3, never A content', () => {
    let envelope = createEmptyEnvelope();
    envelope = replaceActiveStore(envelope, storeWith('g1'));
    const asA = transitionHistoryOwner(envelope, { kind: 'user', userId: 'user-a' }, { now: 1 });
    const signedOut = transitionHistoryOwner(asA.envelope, { kind: 'guest' });
    const withGuest3 = {
      ...signedOut.envelope,
      guest: storeWith('g3'),
      activeOwner: { kind: 'guest' as const },
    };
    const asB = transitionHistoryOwner(withGuest3, { kind: 'user', userId: 'user-b' }, { now: 3 });
    expect(asB.envelope.byUserId['user-a']?.entries.map((e) => e.id)).toEqual(['g1']);
    expect(asB.envelope.byUserId['user-b']?.entries.map((e) => e.id)).toEqual(['g3']);
    expect(asB.cloudMigrateEntries.map((e) => e.id)).toEqual(['g3']);
    expect(getActiveStore(asB.envelope).entries.map((e) => e.id)).toEqual(['g3']);
  });

  it('retry adopt does not duplicate entries (merge by id)', () => {
    let envelope = createEmptyEnvelope();
    envelope = replaceActiveStore(envelope, storeWith('g1'));
    const first = transitionHistoryOwner(envelope, { kind: 'user', userId: 'user-a' }, { now: 1 });
    const retry = transitionHistoryOwner(first.envelope, { kind: 'user', userId: 'user-a' });
    expect(retry.envelope.byUserId['user-a']?.entries).toHaveLength(1);
    expect(retry.cloudMigrateEntries.map((e) => e.id)).toEqual(['g1']);
  });

  it('user A → user B never merges or migrates A into B', () => {
    let envelope = createEmptyEnvelope();
    envelope = {
      ...envelope,
      activeOwner: { kind: 'user', userId: 'user-a' },
      byUserId: { 'user-a': storeWith('a1') },
      lastBoundUserId: 'user-a',
      guestAdoption: { adoptedIntoUserId: 'user-a', at: 1 },
    };
    const toB = transitionHistoryOwner(envelope, { kind: 'user', userId: 'user-b' });
    expect(toB.envelope.byUserId['user-a']?.entries.map((e) => e.id)).toEqual(['a1']);
    expect(toB.cloudMigrateEntries).toEqual([]);
    expect(getActiveStore(toB.envelope).entries).toEqual([]);
  });

  it('sign-out seals user A; guest view has no A residual', () => {
    let envelope = createEmptyEnvelope();
    envelope = {
      ...envelope,
      activeOwner: { kind: 'user', userId: 'user-a' },
      byUserId: { 'user-a': storeWith('a1') },
      lastBoundUserId: 'user-a',
    };
    const signedOut = transitionHistoryOwner(envelope, { kind: 'guest' });
    expect(getActiveStore(signedOut.envelope).entries).toEqual([]);
    expect(signedOut.envelope.byUserId['user-a']?.entries.map((e) => e.id)).toEqual(['a1']);
  });

  it('session expiry → reauth A restores A without guest conversion', () => {
    let envelope = createEmptyEnvelope();
    envelope = {
      ...envelope,
      activeOwner: { kind: 'user', userId: 'user-a' },
      byUserId: { 'user-a': storeWith('a1') },
      lastBoundUserId: 'user-a',
      guestAdoption: { adoptedIntoUserId: 'user-a', at: 1 },
    };
    const expired = transitionHistoryOwner(envelope, { kind: 'guest' });
    const restored = transitionHistoryOwner(expired.envelope, { kind: 'user', userId: 'user-a' });
    expect(restored.envelope.byUserId['user-a']?.entries.map((e) => e.id)).toEqual(['a1']);
    expect(restored.adoptedGuest).toBe(false);
  });

  it('user without email still activates by userId', () => {
    const result = transitionHistoryOwner(createEmptyEnvelope(), {
      kind: 'user',
      userId: 'uuid-no-email',
    });
    expect(result.envelope.activeOwner).toEqual({ kind: 'user', userId: 'uuid-no-email' });
  });

  it('removeHistoryOwner purges A and keeps guest/B', () => {
    let envelope = createEmptyEnvelope();
    envelope = {
      ...envelope,
      guest: storeWith('g-keep'),
      activeOwner: { kind: 'user', userId: 'user-a' },
      byUserId: {
        'user-a': storeWith('a1'),
        'user-b': storeWith('b1'),
      },
      lastBoundUserId: 'user-a',
      guestAdoption: { adoptedIntoUserId: 'user-a', at: 1, entryIds: ['a1'] },
    };
    const next = removeHistoryOwner(envelope, 'user-a');
    expect(next.byUserId['user-a']).toBeUndefined();
    expect(next.byUserId['user-b']?.entries.map((e) => e.id)).toEqual(['b1']);
    expect(next.guest.entries.map((e) => e.id)).toEqual(['g-keep']);
    expect(next.lastBoundUserId).toBeNull();
    expect(next.guestAdoption).toBeNull();
    expect(next.activeOwner).toEqual({ kind: 'guest' });
  });
});
