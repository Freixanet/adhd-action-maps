import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image, type ImageSourcePropType } from 'react-native';

/**
 * Bundled Home jump-back covers. Assigned by list index so the six photos
 * map to the six cards. Raster painterly covers, not design tokens.
 */
export const HOME_COVER_MODULES = [
  require('../../assets/home-covers/01-moto.jpg'),
  require('../../assets/home-covers/02-desk.jpg'),
  require('../../assets/home-covers/03-headphones.jpg'),
  require('../../assets/home-covers/04-workout.jpg'),
  require('../../assets/home-covers/05-study.jpg'),
  require('../../assets/home-covers/06-meal.jpg'),
] as const;

export function homeCoverIndex(slot: number): number {
  const count = HOME_COVER_MODULES.length;
  if (count < 1) return 0;
  return ((slot % count) + count) % count;
}

export function homeCoverSource(slot: number): ImageSourcePropType {
  return HOME_COVER_MODULES[homeCoverIndex(slot)];
}

const dataUriCache = new Map<number, Promise<string | null>>();

export async function homeCoverDataUri(slot: number): Promise<string | null> {
  const index = homeCoverIndex(slot);
  const cached = dataUriCache.get(index);
  if (cached) return cached;

  const pending = (async () => {
    try {
      const source = HOME_COVER_MODULES[index];
      const resolved = Image.resolveAssetSource(source);
      const uri = resolved?.uri;
      if (!uri) return null;
      const result = await manipulateAsync(uri, [{ resize: { width: 440 } }], {
        compress: 0.72,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!result.base64) return null;
      return `data:image/jpeg;base64,${result.base64}`;
    } catch {
      return null;
    }
  })();
  dataUriCache.set(index, pending);
  return pending;
}
