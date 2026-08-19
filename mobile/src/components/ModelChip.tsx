import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles } from '../icons';
import { DEPTH_OPTIONS, type DepthPreference } from '../logic/depthPreference';
import { useTheme } from '../context/ThemeContext';
import DepthMenu from './DepthMenu';
import { TEXT_SECONDARY } from '@shared/uiTokens';
import { color, type } from '@shared/design-tokens';

type ModelChipProps = {
  value: DepthPreference;
  onChange: (value: DepthPreference) => void;
  onOpenPaywall?: () => void;
  disabled?: boolean;
};

function ModelChip({ value, onChange, onOpenPaywall, disabled = false }: ModelChipProps) {
  const { isDark } = useTheme();
  const activeOption =
    DEPTH_OPTIONS.find((option) => option.id === value) ??
    DEPTH_OPTIONS.find((option) => option.id === 'estandar') ??
    DEPTH_OPTIONS[0];
  const iconMuted = isDark ? TEXT_SECONDARY : color.text.muted;

  return (
    <DepthMenu
      value={value === 'rapido' || value === 'estandar' ? value : 'estandar'}
      onChange={onChange}
      onOpenPaywall={onOpenPaywall}
      disabled={disabled}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={`Profundidad: ${activeOption.label}. Toca para elegir.`}
        className={`flex-row items-center gap-1.5 h-9 px-1 ${
          disabled ? 'opacity-40' : 'active:opacity-80'
        }`}
      >
        <Sparkles size={13} color={iconMuted} />
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.35}
          style={{ flexShrink: 0 }}
          className="text-label font-semibold text-body"
        >
          {activeOption.label}
        </Text>
      </View>
    </DepthMenu>
  );
}

export default React.memo(ModelChip);
