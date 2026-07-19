import React from 'react';
import Svg, { Path } from 'react-native-svg';

type MenuTwoLinesProps = {
  size?: number;
  color?: string;
};

export default function MenuTwoLines({ size = 24, color = 'currentColor' }: MenuTwoLinesProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      width={size}
      height={size}
      aria-hidden={true}
    >
      <Path d="M4 9h16" />
      <Path d="M4 15h16" />
    </Svg>
  );
}
