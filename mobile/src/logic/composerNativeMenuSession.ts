/**
 * Tracks whether a composer native UIMenu is open (or just dismissed).
 * KeyboardDismissBackdrop must not call Keyboard.dismiss for the outside tap
 * that closes the menu — only the menu should go away.
 */

import { Keyboard, Platform } from 'react-native';

let openCount = 0;
let suppressDismissUntil = 0;
let focusComposerInput: (() => void) | null = null;
let keyboardHideSub: { remove: () => void } | null = null;

function ensureKeyboardHideWatcher() {
  if (keyboardHideSub) return;
  const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
  keyboardHideSub = Keyboard.addListener(hideEvent, () => {
    // Only reclaim focus while a menu is actually open — not during intentional
    // dismisses (sidebar, send, etc.) and not after the menu session cleared.
    if (openCount <= 0) return;
    requestAnimationFrame(() => {
      if (openCount > 0) focusComposerInput?.();
    });
    setTimeout(() => {
      if (openCount > 0) focusComposerInput?.();
    }, 50);
  });
}

export function registerComposerInputFocus(focus: (() => void) | null) {
  focusComposerInput = focus;
  if (focus) {
    ensureKeyboardHideWatcher();
  }
}

export function markComposerNativeMenuPresented() {
  openCount += 1;
  ensureKeyboardHideWatcher();
}

export function markComposerNativeMenuEnded() {
  openCount = Math.max(0, openCount - 1);
  // Grace for the same outside tap that RN may deliver after UIMenu dismisses.
  suppressDismissUntil = Math.max(suppressDismissUntil, Date.now() + 450);
}

/** Force-clear menu keyboard protection (sidebar, send, explicit dismiss). */
export function clearComposerNativeMenuSession() {
  openCount = 0;
  suppressDismissUntil = 0;
}

export function shouldSuppressKeyboardDismissForComposerMenu(): boolean {
  return openCount > 0 || Date.now() < suppressDismissUntil;
}

export function restoreComposerInputFocus() {
  focusComposerInput?.();
}
