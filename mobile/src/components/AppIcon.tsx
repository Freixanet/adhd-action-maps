import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { ACCENT, TEXT_PRIMARY } from '@shared/uiTokens';

type AppIconProps = {
  className?: string;
  size?: number;
  color?: string;
  /** Overrides the inner dot fill (defaults to `color` or accent). */
  dotColor?: string;
};

export default function AppIcon({ size = 24, color, dotColor }: AppIconProps) {
  const strokeColor = color ?? TEXT_PRIMARY;
  const fillColor = dotColor ?? color ?? ACCENT;

  return (
    <Svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden={true}>
      <Circle cx="12" cy="12" r="8.5" stroke={strokeColor} strokeWidth="1.5" />
      <Circle cx="14.5" cy="10.5" r="2.2" fill={fillColor} />
    </Svg>
  );
}
