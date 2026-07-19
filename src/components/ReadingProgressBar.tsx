import React, { useEffect, useRef, useState } from 'react';
import MenuTwoLines from './MenuTwoLines';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from 'motion/react';

type ReadingProgressBarProps = {
  active: boolean;
  viewAll: boolean;
  isComplete: boolean;
  stepProgress: number;
  progressLabel: string;
  scrollContainer?: React.RefObject<HTMLElement | null>;
  onToggleSidebar: () => void;
};

function ReadingProgressBar({
  active,
  viewAll,
  isComplete,
  stepProgress,
  progressLabel,
  scrollContainer,
  onToggleSidebar,
}: ReadingProgressBarProps) {
  const reduceMotion = useReducedMotion();
  const viewAllProgress = useMotionValue(isComplete ? 1 : 0);
  const smoothViewAllProgress = useSpring(viewAllProgress, {
    stiffness: 320,
    damping: 38,
    mass: 0.24,
  });
  const displayedPercentRef = useRef(isComplete ? 100 : 0);
  const [displayPercent, setDisplayPercent] = useState(isComplete ? 100 : 0);

  useMotionValueEvent(reduceMotion ? viewAllProgress : smoothViewAllProgress, 'change', (latest) => {
    const nextPercent = Math.round(Math.min(1, Math.max(0, latest)) * 100);
    if (nextPercent === displayedPercentRef.current) return;
    displayedPercentRef.current = nextPercent;
    setDisplayPercent(nextPercent);
  });

  useEffect(() => {
    if (!active || !viewAll) {
      displayedPercentRef.current = 0;
      viewAllProgress.set(0);
      setDisplayPercent(0);
      return;
    }

    if (isComplete) {
      displayedPercentRef.current = 100;
      viewAllProgress.set(1);
      setDisplayPercent(100);
      return;
    }

    const updateProgress = () => {
      const element = scrollContainer?.current;
      const scrollTop = element ? element.scrollTop : window.scrollY;
      const maxScroll = element
        ? element.scrollHeight - element.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const scrollRatio = maxScroll <= 0 ? 1 : Math.min(1, Math.max(0, scrollTop / maxScroll));
      viewAllProgress.set(scrollRatio);
    };

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateProgress();
      });
    };

    updateProgress();
    const element = scrollContainer?.current;
    const scrollTarget: EventTarget = element ?? window;
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateProgress);

    return () => {
      scrollTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateProgress);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [active, isComplete, scrollContainer, viewAll, viewAllProgress]);

  const shownPercent = viewAll ? displayPercent : Math.round(stepProgress);

  return (
    <div
      className="shrink-0 bg-neutral-50 dark:bg-app-canvas border-b border-neutral-200 dark:border-white/5"
      role="region"
      aria-label="Progreso de lectura"
    >
      <div className="flex items-center justify-between gap-3 py-2.5 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex lg:hidden ml-1 flex items-center justify-center w-8 h-8 rounded-full bg-neutral-500/10 text-neutral-600 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:bg-neutral-500/20 dark:text-neutral-400 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all duration-200 hover:bg-neutral-500/20 dark:hover:bg-white/10 hover:scale-105 active:scale-95 shrink-0"
            title="Abrir navegación"
            aria-label="Abrir navegación"
          >
            <MenuTwoLines className="w-4.5 h-4.5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-100">
              {progressLabel}
            </p>
          </div>
        </div>
        <span
          className="shrink-0 text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300"
          aria-live="polite"
        >
          {shownPercent}%
        </span>
      </div>
      <div className="h-2 bg-neutral-200 dark:bg-neutral-800">
        <motion.div
          className={`h-full bg-indigo-600 dark:bg-indigo-500 rounded-r-full${viewAll ? ' w-full origin-left will-change-transform' : ' transition-all duration-500 ease-out'}`}
          style={
            viewAll
              ? { scaleX: reduceMotion ? viewAllProgress : smoothViewAllProgress }
              : { width: `${stepProgress}%` }
          }
          role="progressbar"
          aria-valuenow={shownPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

export default React.memo(ReadingProgressBar);
