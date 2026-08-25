import { describe, expect, it } from 'vitest';
import {
  COMPOSER_SWIPE_DISMISS_DISTANCE,
  COMPOSER_SWIPE_DISMISS_VELOCITY,
  shouldDismissComposerSwipe,
} from '../mobile/src/logic/composerSwipeDismiss';

describe('shouldDismissComposerSwipe', () => {
  it('ignores a short downward drag', () => {
    expect(shouldDismissComposerSwipe(20, 100)).toBe(false);
  });

  it('closes after a long downward drag', () => {
    expect(shouldDismissComposerSwipe(COMPOSER_SWIPE_DISMISS_DISTANCE, 0)).toBe(true);
  });

  it('closes on a downward flick', () => {
    expect(shouldDismissComposerSwipe(12, COMPOSER_SWIPE_DISMISS_VELOCITY)).toBe(true);
  });

  it('does not close on an upward swipe', () => {
    expect(shouldDismissComposerSwipe(-80, -900)).toBe(false);
  });
});
