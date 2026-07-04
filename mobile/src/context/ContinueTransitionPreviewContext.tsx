import React, { createContext, useContext } from 'react';

const ContinueTransitionPreviewContext = createContext(false);

export function ContinueTransitionPreviewProvider({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <ContinueTransitionPreviewContext.Provider value={active}>
      {children}
    </ContinueTransitionPreviewContext.Provider>
  );
}

export function useContinueTransitionPreview() {
  return useContext(ContinueTransitionPreviewContext);
}
