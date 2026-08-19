import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

type NucleoPdfThumbModuleApi = {
  renderFirstPage: (uri: string, size: number) => Promise<string>;
};

let nativeModule: NucleoPdfThumbModuleApi | null | undefined;

function loadNativeModule(): NucleoPdfThumbModuleApi | null {
  if (nativeModule !== undefined) return nativeModule;
  if (Platform.OS !== 'ios') {
    nativeModule = null;
    return null;
  }
  try {
    nativeModule = requireNativeModule<NucleoPdfThumbModuleApi>('NucleoPdfThumb');
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

/** True when PDFKit thumbnail code is in this native binary. */
export function isNativePdfThumbAvailable(): boolean {
  return loadNativeModule() != null;
}

/**
 * Rasterize page 1 to a JPEG file:// URI. Returns null when the native module
 * is not in the binary (needs a client rebuild) or the PDF cannot be drawn.
 */
export async function renderFirstPageThumbnail(
  fileUri: string,
  sizePx: number
): Promise<string | null> {
  const native = loadNativeModule();
  if (!native) return null;
  const uri = fileUri.trim();
  if (!uri.startsWith('file:') && !uri.startsWith('/')) return null;
  const size = Math.max(64, Math.min(512, Math.round(sizePx)));
  try {
    const out = await native.renderFirstPage(uri, size);
    return typeof out === 'string' && out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
