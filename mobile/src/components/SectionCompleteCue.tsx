import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

type SectionCompleteCueProps = {
  visible: boolean;
  sectionTitle?: string;
};

export default function SectionCompleteCue({ visible, sectionTitle }: SectionCompleteCueProps) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      scale.value = 0.8;
      return;
    }

    opacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(1, { duration: 900 }),
      withTiming(0, { duration: 150 })
    );
    scale.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(1, { duration: 900 }),
      withTiming(0.8, { duration: 150 })
    );
  }, [opacity, scale, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={animatedStyle} className="mb-6 items-center">
      <View className="flex-row items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2">
        <Check size={16} color="#8B8FF5" />
        <Text className="text-sm font-semibold text-accent">
          {sectionTitle ? `${sectionTitle} completada` : 'Sección completada'}
        </Text>
      </View>
    </Animated.View>
  );
}
