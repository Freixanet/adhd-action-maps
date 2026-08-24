import { Platform, type TextStyle } from 'react-native';
import { font, type } from '@shared/design-tokens';

export type LumenTypeRole =
  | 'lumenKicker'
  | 'lumenReadTime'
  | 'lumenSectionTitle'
  | 'lumenHook'
  | 'lumenLead'
  | 'lumenCopy'
  | 'lumenDisplayLg'
  | 'lumenDisplayXl'
  | 'lumenDisplay3xl'
  | 'lumenTab'
  | 'lumenLabel'
  | 'lumenChipLabel';

const DISPLAY_ROLES = new Set<LumenTypeRole>([
  'lumenHook',
  'lumenDisplayLg',
  'lumenDisplayXl',
  'lumenDisplay3xl',
]);

/**
 * Source Sans 3 VF defaults to ExtraLight on iOS; fontWeight does not select
 * another cut. These roles use the system face so the weight token paints.
 */
const SYSTEM_WEIGHT_ROLES = new Set<LumenTypeRole>([
  'lumenReadTime',
  'lumenSectionTitle',
  'lumenChipLabel',
]);

/** Lumen canvas type: Tailwind text-xs/sm/base/lg/xl/2xl/3xl, display serif. */
export function lumenType(role: LumenTypeRole): TextStyle {
  const style = type[role];
  const fontFamily = DISPLAY_ROLES.has(role)
    ? Platform.OS === 'ios'
      ? font.lumenDisplay
      : font.lumenDisplayFallback
    : SYSTEM_WEIGHT_ROLES.has(role)
      ? undefined
      : font.family;
  return {
    ...(fontFamily ? { fontFamily } : {}),
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: style.fontWeight,
    letterSpacing: style.letterSpacing,
    ...('textTransform' in style
      ? { textTransform: style.textTransform as TextStyle['textTransform'] }
      : {}),
  };
}
