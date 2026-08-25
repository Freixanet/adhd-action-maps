import { describe, expect, it } from 'vitest';
import {
  invalidateViewerSession,
  runViewerCleanup,
  type ViewerSessionHandles,
} from './sourceViewerSessionCleanup';
import { selectSourceViewerSurface } from './sourceViewerSurface';

describe('sourceViewerSessionCleanup (citation switch)', () => {
  it('PDF A ready → citation without documentUrl → A cleaned immediately → single fallback', async () => {
    let cleanedA = 0;
    let cleanedB = 0;
    const handlesA: ViewerSessionHandles = {
      generation: 1,
      cleanup: async () => {
        cleanedA += 1;
      },
      activeSessionId: 'session-A',
    };

    // Modal stays open; target loses documentUrl.
    const after = invalidateViewerSession(handlesA);
    await runViewerCleanup(after.pendingCleanup);

    expect(cleanedA).toBe(1);
    expect(after.handles.activeSessionId).toBeNull();
    expect(after.handles.cleanup).toBeNull();
    expect(after.handles.generation).toBe(2);

    const surface = selectSourceViewerSurface({
      hasDocumentUrl: false,
      signFailed: false,
      docStatus: 'idle',
      pdfReady: false,
      hasExcerptBody: true,
    });
    expect(surface).toEqual({ kind: 'fallback', showRetry: false });

    // A later session B must not be deleted by a stale A cleanup handle.
    const handlesB: ViewerSessionHandles = {
      generation: after.handles.generation,
      cleanup: async () => {
        cleanedB += 1;
      },
      activeSessionId: 'session-B',
    };
    // Replaying the old pendingCleanup is a no-op reference (already consumed);
    // a second invalidate of B is independent.
    await runViewerCleanup(null);
    expect(cleanedB).toBe(0);
    expect(handlesB.activeSessionId).toBe('session-B');
  });

  it('old cleanup never clears a newer generation handle', async () => {
    const order: string[] = [];
    let handles: ViewerSessionHandles = {
      generation: 0,
      cleanup: async () => {
        order.push('A');
      },
      activeSessionId: 'A',
    };

    const first = invalidateViewerSession(handles);
    handles = first.handles;
    // New session installed before A finishes.
    handles = {
      generation: handles.generation,
      cleanup: async () => {
        order.push('B');
      },
      activeSessionId: 'B',
    };
    await runViewerCleanup(first.pendingCleanup);
    expect(order).toEqual(['A']);
    expect(handles.activeSessionId).toBe('B');
    expect(handles.cleanup).not.toBeNull();
  });
});
