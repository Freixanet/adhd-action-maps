/** Downward pan on the expanded composer that counts as a close. */
export const COMPOSER_SWIPE_DISMISS_DISTANCE = 48;
export const COMPOSER_SWIPE_DISMISS_VELOCITY = 600;

export function shouldDismissComposerSwipe(translationY: number, velocityY: number): boolean {
  'worklet';
  return (
    translationY >= COMPOSER_SWIPE_DISMISS_DISTANCE ||
    velocityY >= COMPOSER_SWIPE_DISMISS_VELOCITY
  );
}
