import React from 'react';
import { View, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { DEPTH_OPTIONS, type DepthPreference } from '../logic/depthPreference';
import { useTheme } from '../context/ThemeContext';
import DepthMenu from './DepthMenu';

type ModelChipProps = {
  value: DepthPreference;
  onChange: (value: DepthPreference) => void;
  onOpenPaywall?: () => void;
  disabled?: boolean;
};

function ModelChip({ value, onChange, onOpenPaywall, disabled = false }: ModelChipProps) {
  const { isDark } = useTheme();
  const activeOption = DEPTH_OPTIONS.find((option) => option.id === value) ?? DEPTH_OPTIONS[1];
  const iconMuted = isDark ? '#a3a3a3' : '#737373';

  return (
    <DepthMenu
      value={value}
      onChange={onChange}
      onOpenPaywall={onOpenPaywall}
      disabled={disabled}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={`Profundidad: ${activeOption.label}. Toca para elegir.`}
        className={`flex-row items-center gap-1.5 rounded-chip px-3 h-9 ${
          disabled ? 'opacity-40' : 'active:opacity-80'
        } bg-white/8`}
      >
        <Sparkles size={13} color={iconMuted} />
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{ flexShrink: 0 }}
          className="text-[13px] font-semibold text-body"
        >
          {activeOption.label}
        </Text>
      </View>
    </DepthMenu>
  );
}

export default React.memo(ModelChip);
