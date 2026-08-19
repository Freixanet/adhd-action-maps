/**
 * Deduped + backoff-gated persist retries (owner + mapId + kind).
 */

export type PersistRetryKind = 'source' | 'evidence' | 'progress' | 'application' | 'ordered';

export type PersistRetryGateOptions = {
  /** Minimum ms between automatic retries for the same key. */
  minIntervalMs?: number;
  now?: () => number;
};

const DEFAULT_MIN_INTERVAL_MS = 8_000;

export class PersistRetryGate {
  private readonly inFlight = new Set<string>();
  private readonly lastStartedAt = new Map<string, number>();
  private readonly minIntervalMs: number;
  private readonly now: () => number;

  constructor(opts: PersistRetryGateOptions = {}) {
    this.minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.now = opts.now ?? (() => Date.now());
  }

  key(ownerId: string, mapId: string, kind: PersistRetryKind): string {
    return `${ownerId}::${mapId}::${kind}`;
  }

  isInFlight(ownerId: string, mapId: string, kind: PersistRetryKind): boolean {
    return this.inFlight.has(this.key(ownerId, mapId, kind));
  }

  /**
   * Try to begin an automatic retry. Returns false if already in flight or
   * within the backoff window.
   */
  tryBeginAuto(
    ownerId: string,
    mapId: string,
    kind: PersistRetryKind
  ): boolean {
    const k = this.key(ownerId, mapId, kind);
    if (this.inFlight.has(k)) return false;
    const last = this.lastStartedAt.get(k);
    if (last !== undefined && this.now() - last < this.minIntervalMs) return false;
    this.inFlight.add(k);
    this.lastStartedAt.set(k, this.now());
    return true;
  }

  /**
   * Manual / explicit retry (button, ordered chain) — ignores backoff but
   * still dedupes concurrent runs.
   */
  tryBeginManual(
    ownerId: string,
    mapId: string,
    kind: PersistRetryKind
  ): boolean {
    const k = this.key(ownerId, mapId, kind);
    if (this.inFlight.has(k)) return false;
    this.inFlight.add(k);
    this.lastStartedAt.set(k, this.now());
    return true;
  }

  end(ownerId: string, mapId: string, kind: PersistRetryKind): void {
    this.inFlight.delete(this.key(ownerId, mapId, kind));
  }

  /** Test helper — clear all gates. */
  reset(): void {
    this.inFlight.clear();
    this.lastStartedAt.clear();
  }
}
