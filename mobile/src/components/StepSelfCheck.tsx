import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

type StepSelfCheckProps = {
  question: string;
};

export default function StepSelfCheck({ question }: StepSelfCheckProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mt-8 border-t border-neutral-200 border-white/10 pt-6">
      <Pressable
        onPress={() => setExpanded((value) => !value)}
        className="flex-row items-center justify-between active:opacity-70"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text className="text-[15px] font-medium text-body">
          ¿Te lo quedas? Compruébalo →
        </Text>
        <ChevronDown
          size={18}
          color="#737373"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {expanded ? (
        <Text className="mt-3 text-[17px] leading-[26px] text-primary">{question}</Text>
      ) : null}
    </View>
  );
}
