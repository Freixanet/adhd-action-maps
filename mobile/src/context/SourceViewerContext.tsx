import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { SourceReference } from '../logic/contracts';
import type { SourceChunk } from '@shared/types/chunk';

export type SourceViewerTarget = {
  chunk: SourceChunk;
  reference?: SourceReference;
  sourceTitle?: string;
};

type SourceViewerContextValue = {
  openCitation: (chunkId: string, reference?: SourceReference) => void;
  close: () => void;
  target: SourceViewerTarget | null;
};

const SourceViewerContext = createContext<SourceViewerContextValue | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  citedChunks?: SourceChunk[] | null;
  sourceTitle?: string;
};

export function SourceViewerProvider({ children, citedChunks, sourceTitle }: ProviderProps) {
  const [target, setTarget] = useState<SourceViewerTarget | null>(null);

  const openCitation = useCallback(
    (chunkId: string, reference?: SourceReference) => {
      const chunk = citedChunks?.find((c) => c.id === chunkId);
      if (!chunk) return;
      setTarget({ chunk, reference, sourceTitle });
    },
    [citedChunks, sourceTitle]
  );

  const close = useCallback(() => setTarget(null), []);

  const value = useMemo(
    () => ({ openCitation, close, target }),
    [openCitation, close, target]
  );

  return <SourceViewerContext.Provider value={value}>{children}</SourceViewerContext.Provider>;
}

export function useSourceViewer(): SourceViewerContextValue {
  const ctx = useContext(SourceViewerContext);
  if (!ctx) {
    return {
      openCitation: () => undefined,
      close: () => undefined,
      target: null,
    };
  }
  return ctx;
}
