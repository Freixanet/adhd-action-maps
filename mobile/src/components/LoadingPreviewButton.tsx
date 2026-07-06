import React from 'react';
import { Pressable, Text } from 'react-native';

type LoadingPreviewButtonProps = {
  onPress: () => void;
  onLongPress?: () => void;
};

/** Dev-only affordance to replay generation UI without a real transform. */
export default function LoadingPreviewButton({ onPress, onLongPress }: LoadingPreviewButtonProps) {
  if (!__DEV__) return null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        onLongPress
          ? 'Preview generación inline. Mantén pulsado para pantalla de colección.'
          : 'Preview generación inline'
      }
      className="self-center opacity-30 active:opacity-50"
    >
      <Text className="text-[11px] font-medium tracking-wide text-secondary">
        Preview generación
      </Text>
    </Pressable>
  );
}
