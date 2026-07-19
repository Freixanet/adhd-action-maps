import { TurboModuleRegistry } from 'react-native';

type SkiaNativeModule = {
  install?: () => boolean;
};

let cachedAvailability: boolean | undefined;

/** True when native Skia is linked and the JS runtime initialized successfully. */
export function isSkiaAvailable(): boolean {
  if (cachedAvailability !== undefined) return cachedAvailability;

  try {
    const mod = TurboModuleRegistry.get('RNSkiaModule') as SkiaNativeModule | null;
    if (mod == null) {
      cachedAvailability = false;
      return false;
    }

    if (typeof mod.install === 'function') {
      const installed = mod.install();
      if (!installed) {
        cachedAvailability = false;
        return false;
      }
    }

    // Triggers NativeSetup (JSI bindings) — must succeed for Canvas to render.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@shopify/react-native-skia');

    cachedAvailability = true;
    return true;
  } catch {
    cachedAvailability = false;
    return false;
  }
}
