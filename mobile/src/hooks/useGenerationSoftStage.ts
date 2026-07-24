import { useEffect, useState } from 'react';

/** Soft stage timings while generateContent runs without mid-stream partials. */
const SOFT_STAGE_MS = [0, 2400, 5200, 9000] as const;

/** Slower choreography for DEV “Preview generation” so phases are easy to inspect. */
const PREVIEW_SOFT_STAGE_MS = [0, 5500, 12000, 19000] as const;

/**
 * Advances 0→3 while `active`, resets when inactive.
 * Used to keep thinking-orb choreography premium when the API is non-streaming.
 */
export function useGenerationSoftStage(
  active: boolean,
  pace: 'normal' | 'preview' = 'normal'
): number {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active) {
      setStage(0);
      return;
    }

    const timings = pace === 'preview' ? PREVIEW_SOFT_STAGE_MS : SOFT_STAGE_MS;
    setStage(0);
    const timers = timings.slice(1).map((ms, index) =>
      setTimeout(() => setStage(index + 1), ms)
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [active, pace]);

  return stage;
}
