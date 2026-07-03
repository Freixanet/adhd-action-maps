import { Capacitor } from '@capacitor/core';
import { KeyboardResize } from '@capacitor/keyboard';

let nativeShellReady = false;

export function isNativeShell(): boolean {
  return Capacitor.isNativePlatform();
}

function syncNativeChromeTheme(): void {
  const isDark = document.documentElement.classList.contains('dark');
  const backgroundColor = isDark ? '#181A1F' : '#FAFAFA';
  document.documentElement.style.backgroundColor = backgroundColor;
  document.body.style.backgroundColor = backgroundColor;
  document.getElementById('root')?.style.setProperty('background-color', backgroundColor);
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function enableNativeShellClass(): void {
  if (document.documentElement.classList.contains('native-shell')) return;
  document.documentElement.classList.add('native-shell');
}

export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform() || nativeShellReady) return;

  syncNativeChromeTheme();
  enableNativeShellClass();

  try {
    const [{ App }, { SplashScreen }, { Keyboard }] = await Promise.all([
      import('@capacitor/app'),
      import('@capacitor/splash-screen'),
      import('@capacitor/keyboard'),
    ]);

    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});

    App.addListener('appUrlOpen', ({ url }) => {
      try {
        const callback = new URL(url);
        if (!callback.search.includes('code=') && !callback.hash.includes('access_token')) {
          return;
        }
        window.location.replace(`${window.location.pathname}${callback.search}${callback.hash}`);
      } catch {
        // ignore malformed callback URLs
      }
    });

    await waitForNextFrame();
    syncNativeChromeTheme();
    await SplashScreen.hide().catch(() => {});

    const themeObserver = new MutationObserver(syncNativeChromeTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    nativeShellReady = true;
    syncNativeChromeTheme();
  } catch (error) {
    console.error('Native shell initialization failed', error);
    enableNativeShellClass();
    syncNativeChromeTheme();
    void import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide())
      .catch(() => {});
  }
}
