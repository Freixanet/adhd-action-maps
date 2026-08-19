import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown } from '../../icons';
import * as Haptics from 'expo-haptics';
import { RADII } from '@shared/uiTokens';
import type { SourceReference, StepContentBlockAccordion } from '@shared/contracts';
import GlassSurface from '../GlassSurface';
import { useTheme } from '../../context/ThemeContext';
import { useGlassAccessibility } from '../../hooks/useGlassAccessibility';
import BlockEnter from './BlockEnter';
import { motion, type, typography } from '@shared/design-tokens';

type Props = {
  block: StepContentBlockAccordion;
  index?: number;
};

function AccordionReferences({
  references,
  mutedColor,
}: {
  references?: SourceReference[];
  mutedColor: string;
}) {
  if (!references?.length) return null;
  return (
    <View style={styles.refs}>
      {references.slice(0, 3).map((reference, idx) => (
        <Text key={`${reference.label}-${idx}`} style={[styles.refText, { color: mutedColor }]}>
          {reference.label} {reference.locator}
        </Text>
      ))}
    </View>
  );
}

export default function AccordionBlock({ block, index = 0 }: Props) {
  const { isDark, colors } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const [open, setOpen] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const progress = useSharedValue(0);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (reduceMotion) {
      progress.value = next ? 1 : 0;
      return;
    }
    progress.value = next
      ? withSpring(1, { damping: 18, stiffness: 220 })
      : withTiming(0, { duration: motion.exitSoft.duration });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    height: reduceMotion
      ? open
        ? bodyHeight || undefined
        : 0
      : progress.value * bodyHeight,
    opacity: progress.value,
    overflow: 'hidden' as const,
  }));

  return (
    <BlockEnter delayMs={index * 60}>
      <View style={styles.wrap}>
        <GlassSurface
          liquid
          borderRadius={RADII.md}
          className="rounded-2xl overflow-hidden"
          style={styles.glass}
          overlayClassName={isDark ? 'bg-white/[0.05]' : 'bg-white/45'}
        >
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={block.title}
            style={styles.header}
          >
            <Text style={[styles.title, { color: colors.text.primary }]} maxFontSizeMultiplier={1.35}>
              {block.title}
            </Text>
            <Animated.View style={chevronStyle}>
              <ChevronDown size={18} color={colors.icon.muted} />
            </Animated.View>
          </Pressable>

          <Animated.View style={bodyStyle}>
            <View
              style={styles.bodyMeasure}
              onLayout={(event) => {
                const next = Math.ceil(event.nativeEvent.layout.height);
                if (next > 0 && next !== bodyHeight) setBodyHeight(next);
              }}
            >
              <Text style={[styles.body, { color: colors.text.body }]} maxFontSizeMultiplier={1.35}>
                {block.body}
              </Text>
              <AccordionReferences references={block.references} mutedColor={colors.text.secondary} />
            </View>
          </Animated.View>

          {/* Hidden measure pass so height is known before first open */}
          {bodyHeight === 0 ? (
            <View style={styles.offscreen} pointerEvents="none">
              <View
                onLayout={(event) => {
                  const next = Math.ceil(event.nativeEvent.layout.height);
                  if (next > 0) setBodyHeight(next);
                }}
              >
                <Text style={[styles.body, { color: colors.text.body }]}>{block.body}</Text>
                <AccordionReferences references={block.references} mutedColor={colors.text.secondary} />
              </View>
            </View>
          ) : null}
        </GlassSurface>
      </View>
    </BlockEnter>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 12,
  },
  glass: {
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    flex: 1,
    ...typography('titleMedium'),
  },
  bodyMeasure: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  body: {
    ...typography('body'),
  },
  refs: {
    gap: 4,
    marginTop: 4,
  },
  refText: {
    fontSize: type.meta.fontSize,
  },
  offscreen: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
});
