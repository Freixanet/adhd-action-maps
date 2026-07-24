import React from 'react';
import { View } from 'react-native';
import { ACCENT, TEXT_PRIMARY } from '@shared/uiTokens';
import AppIcon from './AppIcon';
import { useTheme } from '../context/ThemeContext';

type NucleoAssistantAvatarProps = {
  size?: number;
};

/** Circular brand mark beside assistant messages in the inline thread. */
export default function NucleoAssistantAvatar({ size = 30 }: NucleoAssistantAvatarProps) {
  const { isDark } = useTheme();
  const backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  // Fill most of the circle so the mark reads clearly at chat scale.
  const iconSize = Math.round(size * 0.92);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
      }}
    >
      <AppIcon
        size={iconSize}
        color={isDark ? TEXT_PRIMARY : '#1C1E24'}
        dotColor={ACCENT}
      />
    </View>
  );
}
