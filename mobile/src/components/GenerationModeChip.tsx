import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlaskConical } from 'lucide-react-native';
import type { NucleoGenerationMode } from '../logic/contracts';
import { useTheme } from '../context/ThemeContext';

type GenerationModeChipProps = {
  value: NucleoGenerationMode;
  onChange: (value: NucleoGenerationMode) => void;
  disabled?: boolean;
};

function nextMode(value: NucleoGenerationMode): NucleoGenerationMode {
  return value === 'study-doc-beta' ? 'classic' : 'study-doc-beta';
}

export default function GenerationModeChip({
  value,
  onChange,
  disabled = false,
}: GenerationModeChipProps) {
  const { isDark } = useTheme();
  const beta = value === 'study-doc-beta';
  const iconColor = beta ? '#8B8FF5' : isDark ? '#a3a3a3' : '#737373';
  const label = beta ? 'StudyDoc beta' : 'Actual';

  return (
    <Pressable
      onPress={() => onChange(nextMode(value))}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Formato temporal: ${label}. Toca para cambiar.`}
      className={`flex-row items-center gap-1.5 rounded-chip px-3 h-9 ${
        disabled ? 'opacity-40' : 'active:opacity-80'
      } ${beta ? 'bg-accent/12' : 'bg-white/8'}`}
    >
      <FlaskConical size={13} color={iconColor} />
      <View className="max-w-[92px]">
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          className={`text-[12px] font-semibold ${beta ? 'text-accent' : 'text-body'}`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
