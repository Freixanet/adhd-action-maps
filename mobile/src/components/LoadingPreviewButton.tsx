import React from 'react';
import { Pressable, Text } from 'react-native';

type LoadingPreviewButtonProps = {
  onPress: () => void;
};

/** Dev-only affordance to open the loading screen without starting a transform. */
export default function LoadingPreviewButton({ onPress }: LoadingPreviewButtonProps) {
  if (!__DEV__) return null;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Vista previa de pantalla de carga"
      className="mt-5 opacity-35 active:opacity-55"
    >
      <Text className="text-[11px] font-medium tracking-wide text-secondary text-secondary">
        Vista de carga
      </Text>
    </Pressable>
  );
}
