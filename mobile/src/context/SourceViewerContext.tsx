import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { SourceReference } from '../logic/contracts';
import type { SourceChunk } from '@shared/types/chunk';
import {
  applyDocumentUrlOutcome,
  createDocumentUrlSignSession,
  type ResolveDocumentUrlOutcome,
} from '@shared/pdf/documentUrlSignSession';

export type SourceViewerTarget = {
  chunk: SourceChunk | null;
  reference?: SourceReference;
  sourceTitle?: string;
  /** True when chunkId was requested but exact text is unavailable. */
  inaccessible?: boolean;
  /** Authorized document URL (signed storage) when available. */
  documentUrl?: string | null;
  /** True when signing/resolving the document URL failed. */
  documentSignFailed?: boolean;
};

type SourceViewerContextValue = {
  openCitation: (chunkId: string, reference?: SourceReference) => void;
  /** Re-resolve a fresh signed URL for the current citation (never reuses the old one). */
  retryDocumentUrl: () => void;
  close: () => void;
  target: SourceViewerTarget | null;
};

const SourceViewerContext = createContext<SourceViewerContextValue | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  citedChunks?: SourceChunk[] | null;
  sourceTitle?: string;
  /** Optional resolver — discriminated outcome (ready | not_applicable | error). */
  resolveDocumentUrl?: () =>
    | ResolveDocumentUrlOutcome
    | Promise<ResolveDocumentUrlOutcome>;
};

export function SourceViewerProvider({
  children,
  citedChunks,
  sourceTitle,
  resolveDocumentUrl,
}: ProviderProps) {
  const [target, setTarget] = useState<SourceViewerTarget | null>(null);
  const sessionRef = useRef(createDocumentUrlSignSession());

  const applyReady = useCallback((chunkId: string, url: string) => {
    setTarget((prev) =>
      prev && prev.chunk?.id === chunkId
        ? { ...prev, documentUrl: url, documentSignFailed: false }
        : prev
    );
  }, []);

  const applyError = useCallback((chunkId: string) => {
    setTarget((prev) =>
      prev && prev.chunk?.id === chunkId
        ? { ...prev, documentUrl: null, documentSignFailed: true }
        : prev
    );
  }, []);

  const startResolve = useCallback(
    (chunkId: string) => {
      if (!resolveDocumentUrl) return;
      const session = sessionRef.current;
      const token = session.begin(chunkId);
      void Promise.resolve()
        .then(() => resolveDocumentUrl())
        .then((outcome) => {
          applyDocumentUrlOutcome({
            session,
            token,
            chunkId,
            outcome,
            onReady: (url) => applyReady(chunkId, url),
            onError: () => applyError(chunkId),
            onNotApplicable: () => {
              setTarget((prev) =>
                prev && prev.chunk?.id === chunkId
                  ? { ...prev, documentUrl: null, documentSignFailed: false }
                  : prev
              );
            },
          });
        })
        .catch(() => {
          applyDocumentUrlOutcome({
            session,
            token,
            chunkId,
            outcome: { status: 'error', code: 'resolve_rejected' },
            onReady: () => undefined,
            onError: () => applyError(chunkId),
          });
        });
    },
    [resolveDocumentUrl, applyReady, applyError]
  );

  const openCitation = useCallback(
    (chunkId: string, reference?: SourceReference) => {
      const chunk = citedChunks?.find((c) => c.id === chunkId) ?? null;
      sessionRef.current.invalidate();
      if (!chunk) {
        setTarget({
          chunk: null,
          reference,
          sourceTitle,
          inaccessible: true,
        });
        return;
      }
      if (/^\(segmento pendiente\)?$/i.test(chunk.text.trim())) {
        setTarget({
          chunk: null,
          reference,
          sourceTitle,
          inaccessible: true,
        });
        return;
      }
      setTarget({
        chunk,
        reference,
        sourceTitle,
        inaccessible: false,
        documentUrl: null,
        documentSignFailed: false,
      });
      startResolve(chunk.id);
    },
    [citedChunks, sourceTitle, startResolve]
  );

  const retryDocumentUrl = useCallback(() => {
    const chunkId = sessionRef.current.activeChunkId();
    if (!chunkId) return;
    setTarget((prev) =>
      prev && prev.chunk?.id === chunkId
        ? { ...prev, documentUrl: null, documentSignFailed: false }
        : prev
    );
    startResolve(chunkId);
  }, [startResolve]);

  const close = useCallback(() => {
    sessionRef.current.invalidate();
    setTarget(null);
  }, []);

  const value = useMemo(
    () => ({ openCitation, retryDocumentUrl, close, target }),
    [openCitation, retryDocumentUrl, close, target]
  );

  return <SourceViewerContext.Provider value={value}>{children}</SourceViewerContext.Provider>;
}

export function useSourceViewer(): SourceViewerContextValue {
  const ctx = useContext(SourceViewerContext);
  if (!ctx) {
    return {
      openCitation: () => undefined,
      retryDocumentUrl: () => undefined,
      close: () => undefined,
      target: null,
    };
  }
  return ctx;
}
