import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import NucleoOrbWebView, { type NucleoOrbState } from './NucleoOrbWebView';

export type { NucleoOrbState };

type NucleoOrbProps = {
  size?: number;
  state?: NucleoOrbState;
  glow?: boolean;
  interactive?: boolean;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Orbe 3D de producción (Three.js embebido en WebView). */
export default function NucleoOrb(props: NucleoOrbProps) {
  return <NucleoOrbWebView {...props} />;
}
