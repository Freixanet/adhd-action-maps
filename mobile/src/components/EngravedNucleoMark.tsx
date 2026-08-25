import React, { useMemo } from 'react';
import { Platform, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Canvas,
  LinearGradient,
  Shadow,
  Text,
  matchFont,
  vec,
} from '@shopify/react-native-skia';
import { useTheme } from '../context/ThemeContext';
import { type, engraved } from '@shared/design-tokens';

const IS_WEB = Platform.OS === 'web';

export const ENGRAVED_NUCLEO_FONT_SIZE = 40;
export const ENGRAVED_NUCLEO_COMPACT_FONT_SIZE = 28;

const WORD = 'nucleo';
const BASE_MARK_HEIGHT = 44;
const BASE_LETTER_GAP = 4.5;
const BASE_BASELINE_INSET = 5;

type InsetPalette = {
  gradient: [string, string, string];
  innerShade: string;
  innerHighlight: string;
};

export type EngravedNucleoTone = 'hero' | 'sidebar';

function paletteForTheme(isDark: boolean): InsetPalette {
  if (isDark) {
    return {
      gradient: engraved.metalDarkGradient as [string, string, string],
      innerShade: engraved.innerShadeDark,
      innerHighlight: engraved.innerHighlightDark,
    };
  }
  return {
    gradient: engraved.metalLightGradient as [string, string, string],
    innerShade: engraved.innerShadeLight,
    innerHighlight: engraved.innerHighlightLight,
  };
}

function paletteForSidebar(isDark: boolean): InsetPalette {
  const mid = isDark ? engraved.metalMidGradient[1] : engraved.metalLightGradient[1];
  return {
    gradient: [engraved.metalMidGradient[0], mid, engraved.metalMidGradient[2]] as [string, string, string],
    innerShade: engraved.innerShadeMid,
    innerHighlight: engraved.innerHighlightMid,
  };
}

function getMarkMetrics(fontSize: number, rowHeight?: number) {
  const scale = fontSize / ENGRAVED_NUCLEO_FONT_SIZE;
  const naturalHeight = BASE_MARK_HEIGHT * scale;
  const markHeight = rowHeight ?? naturalHeight;
  const letterGap = BASE_LETTER_GAP * scale;
  const baselineY =
    rowHeight != null
      ? markHeight / 2 + fontSize * 0.3
      : markHeight - BASE_BASELINE_INSET * scale;

  return {
    markHeight,
    letterGap,
    baselineY,
    scale,
  };
}

type LetterLayout = {
  letter: string;
  x: number;
  width: number;
};

function measureLetters(
  font: ReturnType<typeof matchFont>,
  letterGap: number
): LetterLayout[] {
  const layouts: LetterLayout[] = [];
  let x = 0;

  for (const letter of WORD) {
    const width = font.measureText(letter).width;
    layouts.push({ letter, x, width });
    x += width + letterGap;
  }

  return layouts;
}

type EngravedNucleoMarkProps = {
  style?: StyleProp<ViewStyle>;
  fontSize?: number;
  tone?: EngravedNucleoTone;
  /** Locks canvas height and vertically centers glyphs (sidebar header). */
  rowHeight?: number;
};

function EngravedNucleoMark({
  style,
  fontSize = ENGRAVED_NUCLEO_FONT_SIZE,
  tone = 'hero',
  rowHeight,
}: EngravedNucleoMarkProps) {
  const { isDark } = useTheme();
  const palette =
    tone === 'sidebar' ? paletteForSidebar(isDark) : paletteForTheme(isDark);
  const { markHeight, letterGap, baselineY, scale } = useMemo(
    () => getMarkMetrics(fontSize, rowHeight),
    [fontSize, rowHeight]
  );

  const font = useMemo(
    () =>
      IS_WEB
        ? null
        : matchFont({
            fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
            fontSize,
            fontWeight: engraved.fontWeight as '200',
          }),
    [fontSize]
  );

  const { layouts, canvasWidth } = useMemo(() => {
    if (!font) {
      return { layouts: [] as LetterLayout[], canvasWidth: 0 };
    }
    const letterLayouts = measureLetters(font, letterGap);
    const width =
      letterLayouts.length === 0
        ? 0
        : letterLayouts[letterLayouts.length - 1].x + letterLayouts[letterLayouts.length - 1].width;
    return { layouts: letterLayouts, canvasWidth: width };
  }, [font, letterGap]);

  if (IS_WEB) {
    return (
      <View
        style={[
          {
            height: markHeight,
            justifyContent: 'center',
          },
          style,
        ]}
        accessibilityRole="text"
        accessibilityLabel="nucleo"
        pointerEvents="none"
      >
        <RNText
          style={{
            color: palette.gradient[1],
            fontSize,
            fontWeight: engraved.fontWeight as '200',
            letterSpacing: engraved.letterSpacing * scale,
            lineHeight: fontSize * 1.1,
            fontFamily: Platform.select({
              ios: 'Helvetica Neue',
              default: 'system-ui, sans-serif',
            }),
          }}
        >
          {WORD}
        </RNText>
      </View>
    );
  }

  if (!font || canvasWidth === 0) {
    return null;
  }

  return (
    <View
      style={style}
      accessibilityRole="text"
      accessibilityLabel="nucleo"
      pointerEvents="none"
    >
      <Canvas style={{ width: canvasWidth, height: markHeight }}>
        {layouts.map(({ letter, x, width }) => (
          <Text key={`${letter}-${x}`} x={x} y={baselineY} text={letter} font={font}>
            <LinearGradient
              start={vec(x, baselineY - fontSize * 0.82)}
              end={vec(x + width, baselineY)}
              colors={palette.gradient}
            />
            <Shadow
              dx={-1.15 * scale}
              dy={-1.25 * scale}
              blur={2.4 * scale}
              color={palette.innerShade}
              inner
            />
            <Shadow
              dx={1.05 * scale}
              dy={1.2 * scale}
              blur={1.4 * scale}
              color={palette.innerHighlight}
              inner
            />
          </Text>
        ))}
      </Canvas>
    </View>
  );
}

export default React.memo(EngravedNucleoMark);
