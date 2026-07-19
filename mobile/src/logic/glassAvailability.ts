import { Platform } from 'react-native';
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

export function canUseNativeLiquidGlass(reduceTransparency: boolean): boolean {
  if (Platform.OS !== 'ios') return false;
  if (Number(Platform.Version) < 26) return false;
  if (reduceTransparency) return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}
