import { useEffect } from 'react';
import { getAppVariant } from './appVariant';
import ClassicApp from './ClassicApp';
import ComprensionApp from './ComprensionApp';
import { initNativeShell } from './nativeShell';

/**
 * Legacy/reference web shell. Product UI lives in `mobile/`.
 * See `src/LEGACY.md`.
 */
export default function App() {
  useEffect(() => {
    void initNativeShell();
  }, []);

  // Default product path is Comprensión; Classic is retained for local comparison only.
  return getAppVariant() === 'classic' ? <ClassicApp /> : <ComprensionApp />;
}
