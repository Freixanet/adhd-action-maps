/**
 * Authenticated cloud mutations with immutable per-run identity.
 * Same guarantees as hydration: bound client + epoch checks around awaits.
 */

export type ImmutableAuthSnapshot = {
  epoch: number;
  userId: string;
  accessToken: string;
};

export type MutationOutcome = 'applied' | 'stale' | 'error-current' | 'error-stale';

export type BoundMutationClient = {
  expectedUserId: string;
  label?: string;
};

export type CloudMutationEpochGate = {
  isCurrent: (epoch: number, userId: string | null) => boolean;
};

/**
 * Run an authenticated cloud mutation against a session-bound client.
 * Stale runs never invoke onApplied / onErrorCurrent.
 */
export async function runBoundCloudMutation<TClient extends BoundMutationClient, TResult>(args: {
  snapshot: ImmutableAuthSnapshot;
  gate: CloudMutationEpochGate;
  /** Must equal snapshot.userId (active partition owner). */
  expectedOwnerId: string;
  createClient: (snapshot: ImmutableAuthSnapshot) => TClient;
  run: (client: TClient) => Promise<TResult>;
  onApplied?: (result: TResult) => void;
  onErrorCurrent?: (error: unknown) => void;
}): Promise<{ outcome: MutationOutcome; result?: TResult }> {
  const { snapshot, gate, expectedOwnerId, createClient, run, onApplied, onErrorCurrent } = args;

  if (!snapshot.userId || !snapshot.accessToken) {
    return { outcome: 'stale' };
  }
  if (expectedOwnerId !== snapshot.userId) {
    return { outcome: 'stale' };
  }
  if (!gate.isCurrent(snapshot.epoch, snapshot.userId)) {
    return { outcome: 'stale' };
  }

  let client: TClient;
  try {
    client = createClient(snapshot);
  } catch (error) {
    if (!gate.isCurrent(snapshot.epoch, snapshot.userId)) {
      return { outcome: 'error-stale' };
    }
    onErrorCurrent?.(error);
    return { outcome: 'error-current' };
  }

  if (client.expectedUserId !== snapshot.userId) {
    return { outcome: 'stale' };
  }
  if (!gate.isCurrent(snapshot.epoch, snapshot.userId)) {
    return { outcome: 'stale' };
  }

  try {
    const result = await run(client);
    if (!gate.isCurrent(snapshot.epoch, snapshot.userId)) {
      return { outcome: 'stale', result };
    }
    onApplied?.(result);
    return { outcome: 'applied', result };
  } catch (error) {
    if (!gate.isCurrent(snapshot.epoch, snapshot.userId)) {
      return { outcome: 'error-stale' };
    }
    onErrorCurrent?.(error);
    return { outcome: 'error-current' };
  }
}

/**
 * Capture a mutation snapshot from the current epoch gate + token provider.
 * Does not bump epoch (mutations share the active identity epoch).
 */
export function captureMutationSnapshot(args: {
  epoch: number;
  activeUserId: string | null;
  accessToken: string | null | undefined;
}): ImmutableAuthSnapshot | null {
  const userId = args.activeUserId?.trim() || null;
  const accessToken = args.accessToken?.trim() || null;
  if (!userId || !accessToken) return null;
  return {
    epoch: args.epoch,
    userId,
    accessToken,
  };
}
