import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { NativeModules, Platform } from 'react-native';

const ICON_FILE = 'nucleo-brand-icon.png';

type BrandActivityHandle = {
  update: (props: { logoUri?: string }) => Promise<void>;
  end: (reason: 'immediate') => Promise<void>;
};

type BrandActivityModule = {
  getInstances: () => BrandActivityHandle[];
  start: (props: { logoUri?: string }) => BrandActivityHandle;
};

let activityRef: BrandActivityHandle | null = null;
let startPromise: Promise<void> | null = null;
let unsupportedLogged = false;

/** Requires dev client rebuilt after adding expo-widgets + @expo/ui (ios:prebuild). */
export function isBrandLiveActivitySupported(): boolean {
  if (Platform.OS !== 'ios') return false;
  const modules = NativeModules as Record<string, unknown>;
  return Boolean(modules.ExpoWidgets && modules.ExpoUI);
}

async function ensureBrandIconUri(widgetsDirectory: string): Promise<string> {
  const file = new File(widgetsDirectory, ICON_FILE);
  if (!file.exists) {
    const asset = Asset.fromModule(require('../../assets/icon.png'));
    await asset.downloadAsync();
    const localUri = asset.localUri;
    if (!localUri) {
      throw new Error('Nucleo brand icon asset is missing a local URI.');
    }
    await new File(localUri).copy(file);
  }
  return file.uri;
}

export async function startNucleoBrandLiveActivity(): Promise<void> {
  if (!isBrandLiveActivitySupported()) {
    if (__DEV__ && !unsupportedLogged) {
      unsupportedLogged = true;
      console.info(
        '[NucleoBrandLiveActivity] Skipped — rebuild the iOS dev client (npm run ios:prebuild && npm run ios:device) to enable Live Activity.'
      );
    }
    return;
  }
  if (startPromise) return startPromise;

  startPromise = (async () => {
    try {
      const { widgetsDirectory } = await import('expo-widgets');
      const { default: NucleoBrandActivity } = (await import(
        '../../widgets/NucleoBrandActivity'
      )) as { default: BrandActivityModule };
      const logoUri = await ensureBrandIconUri(widgetsDirectory);
      const existing = NucleoBrandActivity.getInstances();
      if (existing.length > 0) {
        activityRef = existing[0]!;
        await activityRef.update({ logoUri });
        return;
      }
      activityRef = NucleoBrandActivity.start({ logoUri });
    } catch (error) {
      console.warn('[NucleoBrandLiveActivity] Could not start branding activity', error);
    }
  })();

  return startPromise;
}

export async function stopNucleoBrandLiveActivity(): Promise<void> {
  if (!isBrandLiveActivitySupported()) return;
  try {
    await activityRef?.end('immediate');
  } catch {
    // Ignore teardown errors during app shutdown.
  }
  activityRef = null;
  startPromise = null;
}
