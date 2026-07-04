import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, LayoutChangeEvent } from 'react-native';
import { debugTransitionLog } from '../logic/debugTransitionLog';

type GlassMountState = {
  active: boolean;
  key: number;
};

/** After the first successful mount, remounts can skip the long UIKit settle delay. */
let deferredGlassWarm = false;

type UseDeferredGlassMountOptions = {
  /** Skip InteractionManager wait — used while continue handoff prewarms glass under overlay. */
  eager?: boolean;
};

/**
 * Defers native GlassView mount until the content-sized shell has real bounds,
 * then waits two animation frames so UIKit lays out the hierarchy before
 * UIGlassEffect initializes (expo-glass-effect #41024 / #43732).
 */
export function useDeferredGlassMount(
  refreshKey?: unknown,
  options?: UseDeferredGlassMountOptions
) {
  const [mount, setMount] = useState<GlassMountState>({ active: false, key: 0 });
  const hasValidSize = useRef(false);
  const pendingFrameRef = useRef<number | null>(null);

  const cancelPending = useCallback(() => {
    if (pendingFrameRef.current !== null) {
      cancelAnimationFrame(pendingFrameRef.current);
      pendingFrameRef.current = null;
    }
  }, []);

  const scheduleMount = useCallback(() => {
    cancelPending();
    setMount((current) => {
      if (current.active && (options?.eager || deferredGlassWarm)) {
        return { active: true, key: current.key + 1 };
      }
      return current.active ? { ...current, active: false } : current;
    });

    const activate = () => {
      pendingFrameRef.current = requestAnimationFrame(() => {
        if (!deferredGlassWarm) {
          pendingFrameRef.current = requestAnimationFrame(() => {
            pendingFrameRef.current = null;
            deferredGlassWarm = true;
            setMount((current) => ({ active: true, key: current.key + 1 }));
          });
          return;
        }
        pendingFrameRef.current = null;
        setMount((current) => ({ active: true, key: current.key + 1 }));
      });
    };

    if (options?.eager || deferredGlassWarm) {
      activate();
      return;
    }

    InteractionManager.runAfterInteractions(activate);
  }, [cancelPending, options?.eager]);

  const onShellLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width < 1 || height < 1) return;
      if (!hasValidSize.current) {
        hasValidSize.current = true;
        scheduleMount();
      }
    },
    [scheduleMount]
  );

  useEffect(() => {
    if (refreshKey === undefined) return;
    if (!hasValidSize.current) return;
    scheduleMount();
  }, [refreshKey, scheduleMount]);

  useEffect(() => cancelPending, [cancelPending]);

  useEffect(() => {
    if (!__DEV__ || !mount.active) return;
    // #region agent log
    debugTransitionLog(
      'H20',
      'useDeferredGlassMount.ts:activate',
      'native glass mounted',
      { key: mount.key, refreshKey: refreshKey ?? null, eager: options?.eager ?? false },
      'post-fix-v8'
    );
    // #endregion
  }, [mount.active, mount.key, options?.eager, refreshKey]);

  return {
    glassActive: mount.active,
    glassMountKey: mount.key,
    onShellLayout,
  };
}
