import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { useThemeColors } from '../context/ThemeContext';

type AppIconProps = {
  className?: string;
  size?: number;
  color?: string;
  /** Overrides the inner dot fill (defaults to `color` or accent). */
  dotColor?: string;
  /** Crop viewBox padding so the outer ring fills `size`. */
  flush?: boolean;
};

/** Ring r=8.5 + 1.5 stroke, centered on 24×24. */
const FLUSH_VIEWBOX = '2.75 2.75 18.5 18.5';

export default function AppIcon({
  size = 24,
  color,
  dotColor,
  flush = false,
}: AppIconProps) {
  const colors = useThemeColors();
  const strokeColor = color ?? colors.icon.primary;
  const fillColor = dotColor ?? color ?? colors.action.primary;

  return (
    <Svg
      viewBox={flush ? FLUSH_VIEWBOX : '0 0 24 24'}
      fill="none"
      width={size}
      height={size}
      aria-hidden={true}
    >
      <Circle
        cx="12"
        cy="12"
        r="8.5"
        stroke={strokeColor}
        strokeWidth={flush ? '1.05' : '1.5'}
      />
      <Circle cx="14.5" cy="10.5" r={flush ? '1.95' : '2.2'} fill={fillColor} />
    </Svg>
  );
}
