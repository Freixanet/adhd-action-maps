/**
 * Stale-safe document URL sign/resolve session (S08).
 * Used by SourceViewerProvider — not test-only.
 */

export type DocumentUrlSignSession = {
  begin(chunkId: string): number;
  invalidate(): void;
  isCurrent(token: number, chunkId: string): boolean;
  activeChunkId(): string | null;
};

export function createDocumentUrlSignSession(): DocumentUrlSignSession {
  let gen = 0;
  let activeChunkId: string | null = null;
  return {
    begin(chunkId: string): number {
      activeChunkId = chunkId;
      gen += 1;
      return gen;
    },
    invalidate(): void {
      gen += 1;
      activeChunkId = null;
    },
    isCurrent(token: number, chunkId: string): boolean {
      return token === gen && activeChunkId === chunkId;
    },
    activeChunkId(): string | null {
      return activeChunkId;
    },
  };
}

export type ResolveDocumentUrlOutcome =
  | { status: 'ready'; url: string }
  | { status: 'not_applicable' }
  | { status: 'error'; code: string };

/**
 * Apply a resolve outcome only if the session token is still current.
 * Returns whether the UI should update.
 */
export function applyDocumentUrlOutcome(args: {
  session: DocumentUrlSignSession;
  token: number;
  chunkId: string;
  outcome: ResolveDocumentUrlOutcome;
  onReady: (url: string) => void;
  onError: (code: string) => void;
  onNotApplicable?: () => void;
}): boolean {
  if (!args.session.isCurrent(args.token, args.chunkId)) return false;
  if (args.outcome.status === 'ready') {
    args.onReady(args.outcome.url);
    return true;
  }
  if (args.outcome.status === 'error') {
    args.onError(args.outcome.code);
    return true;
  }
  args.onNotApplicable?.();
  return true;
}
