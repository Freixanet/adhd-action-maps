import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type HomeSheetGestureLockValue = {
  locked: boolean;
  setLocked: (locked: boolean) => void;
};

export const HomeSheetGestureLockContext = createContext<HomeSheetGestureLockValue | null>(null);

export function HomeSheetGestureLockProvider({ children }: { children: React.ReactNode }) {
  const [locked, setLockedState] = useState(false);
  const setLocked = useCallback((next: boolean) => {
    setLockedState((current) => (current === next ? current : next));
  }, []);
  const value = useMemo(() => ({ locked, setLocked }), [locked, setLocked]);
  return (
    <HomeSheetGestureLockContext.Provider value={value}>
      {children}
    </HomeSheetGestureLockContext.Provider>
  );
}

export function useHomeSheetGestureLock() {
  return useContext(HomeSheetGestureLockContext);
}
