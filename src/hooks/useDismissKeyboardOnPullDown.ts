import { useEffect } from 'react';

export function useKeyboardDismissOnSwipeDown() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;

    const isEditableActive = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      );
    };

    const dismiss = () => {
      const el = document.activeElement;
      if (el instanceof HTMLElement) el.blur();
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t?.clientX ?? 0;
      startY = t?.clientY ?? 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isEditableActive()) return;
      const t = e.touches[0];
      const dx = Math.abs((t?.clientX ?? 0) - startX);
      const dy = (t?.clientY ?? 0) - startY;
      if (dy > 18 && dy > dx * 1.2) {
        dismiss();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    window.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
    };
  }, []);
}
