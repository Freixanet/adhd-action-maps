import { NativeModules, Share } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

type ClipboardApi = {
  setStringAsync: (text: string) => Promise<boolean>;
};

function loadExpoClipboard(): ClipboardApi | null {
  if (!NativeModules.ExpoClipboard && !NativeModules.ExponentClipboard) return null;
  try {
    return require('expo-clipboard') as ClipboardApi;
  } catch {
    return null;
  }
}

function loadNucleoClipboard(): ((text: string) => void) | null {
  try {
    const mod = requireNativeModule('NucleoUIMenu') as { setClipboard?: (text: string) => void };
    if (typeof mod.setClipboard === 'function') return (text) => mod.setClipboard!(text);
  } catch {
    return null;
  }
  return null;
}

/**
 * Copies text. Never opens the share sheet — that is `sharePlainText`.
 * Returns false when no native clipboard is linked; the caller can use a
 * hidden WebView (`buildCopyHtml`) as fallback.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const payload = text.trim();
  if (!payload) return false;

  const expo = loadExpoClipboard();
  if (expo) {
    await expo.setStringAsync(payload);
    return true;
  }

  const nucleo = loadNucleoClipboard();
  if (nucleo) {
    nucleo(payload);
    return true;
  }

  return false;
}

/** Opens the system share sheet with the given text. */
export async function sharePlainText(text: string): Promise<boolean> {
  const payload = text.trim();
  if (!payload) return false;
  const result = await Share.share({ message: payload });
  return result.action !== Share.dismissedAction;
}
