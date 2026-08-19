/**
 * Session invalidation for SourceViewerSheet.
 * Bumps generation so in-flight prepares become stale, clears handles, and
 * schedules the previous session cleanup (session-scoped — never deletes a
 * newer directory).
 */

export type ViewerSessionHandles = {
  generation: number;
  cleanup: (() => Promise<void>) | null;
  activeSessionId: string | null;
};

export type InvalidateViewerSessionResult = {
  handles: ViewerSessionHandles;
  /** Previous cleanup to run; caller should void it after swapping state. */
  pendingCleanup: (() => Promise<void>) | null;
};

/**
 * Invalidate the active viewer session. Does not await cleanup — the caller
 * owns scheduling so React state updates stay synchronous.
 */
export function invalidateViewerSession(
  handles: ViewerSessionHandles
): InvalidateViewerSessionResult {
  return {
    handles: {
      generation: handles.generation + 1,
      cleanup: null,
      activeSessionId: null,
    },
    pendingCleanup: handles.cleanup,
  };
}

/** Run a cleanup only if it still matches the expected session id (optional). */
export async function runViewerCleanup(
  cleanup: (() => Promise<void>) | null | undefined
): Promise<void> {
  if (!cleanup) return;
  await cleanup();
}
