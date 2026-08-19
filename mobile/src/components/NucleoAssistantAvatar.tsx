import React from 'react';
import { View } from 'react-native';
import { ACCENT, TEXT_PRIMARY } from '@shared/uiTokens';
import AppIcon from './AppIcon';
import { useTheme } from '../context/ThemeContext';
import { color, primitive, type } from '@shared/design-tokens';

type NucleoAssistantAvatarProps = {
  size?: number;
};

/** Circular brand mark beside assistant messages in the inline thread. */
export default function NucleoAssistantAvatar({ size = 30 }: NucleoAssistantAvatarProps) {
  const { isDark } = useTheme();
  const backgroundColor = isDark ? color.background.whiteFade06 : color.background.blackFade04;
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
        color={isDark ? TEXT_PRIMARY : primitive.color.neutral['900']}
        dotColor={ACCENT}
      />
    </View>
  );
}
