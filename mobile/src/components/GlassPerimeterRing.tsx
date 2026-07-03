import React, { useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  GLASS_PERIMETER_HIGHLIGHT_COLOR_DARK,
  GLASS_PERIMETER_HIGHLIGHT_COLOR_LIGHT,
  GLASS_SPECULAR_BASE_OPACITY_DARK,
  GLASS_SPECULAR_BASE_OPACITY_LIGHT,
  GLASS_SPECULAR_CURVE_END_OPACITY_DARK,
  GLASS_SPECULAR_CURVE_END_OPACITY_LIGHT,
  GLASS_SPECULAR_PEAK_OPACITY_DARK,
  GLASS_SPECULAR_PEAK_OPACITY_LIGHT,
  type GlassSpecularStop,
} from '@shared/uiTokens';

export type GlassPerimeterHighlightProps = {
  width: number;
  height: number;
  borderRadius: number;
  isDark: boolean;
  strokeWidth?: number;
  gradientId?: string;
  inset?: number;
};

function resolveCornerRadius(width: number, height: number, borderRadius: number): number {
  const shortSide = Math.min(width, height);
  return Math.min(Math.max(0, borderRadius), shortSide / 2);
}

function isCircularShape(width: number, height: number, borderRadius: number): boolean {
  if (Math.abs(width - height) > 0.5) return false;
  return borderRadius >= width / 2 - 0.5;
}

/** Fixed vertical map for circular buttons — unchanged when rect specular tokens shift. */
const CIRCLE_SPECULAR_STOPS: readonly GlassSpecularStop[] = [
  { offset: 0, opacity: 0.14 },
  { offset: 0.28, opacity: 0.06 },
  { offset: 0.52, opacity: 0 },
  { offset: 0.85, opacity: 0 },
  { offset: 1, opacity: 0.03 },
];

const MIN_STOP_GAP = 0.02;

function clampIncreasingStops(stops: GlassSpecularStop[]): GlassSpecularStop[] {
  const out: GlassSpecularStop[] = [];
  let prev = -MIN_STOP_GAP;

  for (const stop of stops) {
    let offset = Math.max(0, Math.min(1, stop.offset));
    if (offset < prev + MIN_STOP_GAP) {
      offset = Math.min(1, prev + MIN_STOP_GAP);
    }
    out.push({ offset, opacity: stop.opacity });
    prev = offset;
  }

  return out;
}

/** Specular map from geometry: bright top arc, flat sides, subtle base. */
function buildSpecularStops(height: number, cornerRadius: number, isDark: boolean): GlassSpecularStop[] {
  if (height <= 0) return [];

  if (cornerRadius >= height / 2 - 0.001) {
    return [...CIRCLE_SPECULAR_STOPS];
  }

  const peak = isDark ? GLASS_SPECULAR_PEAK_OPACITY_DARK : GLASS_SPECULAR_PEAK_OPACITY_LIGHT;
  const curveEnd = isDark
    ? GLASS_SPECULAR_CURVE_END_OPACITY_DARK
    : GLASS_SPECULAR_CURVE_END_OPACITY_LIGHT;
  const base = isDark ? GLASS_SPECULAR_BASE_OPACITY_DARK : GLASS_SPECULAR_BASE_OPACITY_LIGHT;

  const r = Math.min(cornerRadius, height / 2);
  const curveY = r * 1.6;
  const flatEnd = height - curveY;
  const off = (y: number) => Math.max(0, Math.min(1, y / height));

  return clampIncreasingStops([
    { offset: 0, opacity: peak },
    { offset: off(curveY), opacity: curveEnd },
    { offset: off(curveY), opacity: 0 },
    { offset: off(flatEnd), opacity: 0 },
    { offset: off(flatEnd), opacity: 0 },
    { offset: 1, opacity: base },
  ]);
}

export default function GlassPerimeterHighlight({
  width,
  height,
  borderRadius,
  isDark,
  strokeWidth = 1,
  gradientId: gradientIdProp,
  inset: insetProp = 0,
}: GlassPerimeterHighlightProps) {
  const reactId = useId();
  const gradientId = useMemo(() => {
    const suffix = reactId.replace(/[^a-zA-Z0-9_-]/g, '');
    return gradientIdProp ?? `glass-specular-${suffix}`;
  }, [gradientIdProp, reactId]);

  const stopColor = isDark ? GLASS_PERIMETER_HIGHLIGHT_COLOR_DARK : GLASS_PERIMETER_HIGHLIGHT_COLOR_LIGHT;
  const cornerRadius = resolveCornerRadius(width, height, borderRadius);
  const stops = useMemo(
    () => buildSpecularStops(height, cornerRadius, isDark),
    [cornerRadius, height, isDark]
  );

  if (width <= 0 || height <= 0) return null;

  const inset = insetProp + strokeWidth / 2;
  const circular = isCircularShape(width, height, borderRadius);
  const strokeRef = `url(#${gradientId})`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shell]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={0}
            x2={0}
            y2={height}
          >
            {stops.map((stop, index) => (
              <Stop
                key={`${stop.offset}-${index}`}
                offset={stop.offset}
                stopColor={stopColor}
                stopOpacity={stop.opacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        {circular ? (
          <Circle
            cx={width / 2}
            cy={height / 2}
            r={Math.max(0, width / 2 - inset)}
            fill="none"
            stroke={strokeRef}
            strokeWidth={strokeWidth}
          />
        ) : (
          <Rect
            x={inset}
            y={inset}
            width={Math.max(0, width - inset * 2)}
            height={Math.max(0, height - inset * 2)}
            rx={Math.max(0, cornerRadius - insetProp)}
            ry={Math.max(0, cornerRadius - insetProp)}
            fill="none"
            stroke={strokeRef}
            strokeWidth={strokeWidth}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    zIndex: 20,
  },
});
