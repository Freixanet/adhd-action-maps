import { useEffect, useState } from 'react';

type Options = {
  /** Characters revealed per tick. */
  charsPerTick?: number;
  tickMs?: number;
  /** When true, show full text immediately. */
  reduceMotion?: boolean;
  /** Delay before typing starts. */
  startDelayMs?: number;
};

/**
 * ChatGPT-style letter reveal. Returns displayed prefix and whether typing finished.
 */
export function useTypewriter(
  fullText: string,
  active: boolean,
  options: Options = {}
): { displayed: string; done: boolean } {
  const {
    charsPerTick = 1,
    tickMs = 18,
    reduceMotion = false,
    startDelayMs = 0,
  } = options;
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setCount(0);
    setStarted(false);
    if (!active || !fullText) return;

    if (reduceMotion) {
      setStarted(true);
      setCount(fullText.length);
      return;
    }

    const startTimer = setTimeout(() => setStarted(true), startDelayMs);
    return () => clearTimeout(startTimer);
  }, [active, fullText, reduceMotion, startDelayMs]);

  useEffect(() => {
    if (!active || !started || reduceMotion) return;
    if (count >= fullText.length) return;

    const timer = setTimeout(() => {
      setCount((prev) => Math.min(fullText.length, prev + charsPerTick));
    }, tickMs);
    return () => clearTimeout(timer);
  }, [active, charsPerTick, count, fullText.length, reduceMotion, started, tickMs]);

  const displayed = fullText.slice(0, count);
  const done = active && fullText.length > 0 && count >= fullText.length;
  return { displayed, done };
}
