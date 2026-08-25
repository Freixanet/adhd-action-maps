import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { NucleoGlassSegment } from '../../modules/nucleo-glass-segment/src';
import { useTheme, useThemeColors } from '../context/ThemeContext';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { shouldUseNativeMultiSegment } from '../logic/nativeGlassSegment';
import { control, radius, space } from '@shared/design-tokens';
import { PRESS_HIT_SLOP } from '../hooks/usePressSpring';
import PressableScale from '../components/PressableScale';
import { lumenType } from './lumenType';

export function LumenKicker({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
}) {
  const colors = useThemeColors();
  return (
    <Text
      style={[styles.kicker, { color: colors.text.secondary }, style]}
      maxFontSizeMultiplier={1.3}
    >
      {children}
    </Text>
  );
}

export function LumenCard({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.background.surfaceRaised,
      borderColor: colors.border.subtle,
    },
  ];
  if (!onPress) {
    return <View style={cardStyle}>{children}</View>;
  }
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      contentStyle={cardStyle}
    >
      {children}
    </PressableScale>
  );
}

/**
 * In-flow canvas controls. NativeGlassButton is chrome-only (explicit width/height);
 * UIKit glass buttons with no size measure as 0 in Yoga and paint over the document.
 */
export function LumenIconButton({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={disabled ? styles.disabled : undefined}
      contentStyle={[styles.iconBtn, { backgroundColor: colors.background.surfaceRaised }]}
    >
      <Text style={[styles.iconBtnLabel, { color: colors.text.primary }]}>{label}</Text>
    </PressableScale>
  );
}

export function LumenTextButton({
  title,
  onPress,
  disabled = false,
  emphasis = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      style={[styles.textBtnFrame, disabled ? styles.disabled : undefined]}
      contentStyle={[
        styles.textBtn,
        {
          backgroundColor: emphasis ? colors.action.primary : colors.background.surfaceRaised,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.textBtnLabel,
          { color: emphasis ? colors.text.onAccent : colors.text.primary },
        ]}
      >
        {title}
      </Text>
    </PressableScale>
  );
}

export function LumenPills<T extends string>({
  items,
  value,
  onChange,
  equal = false,
  scale = 'tab',
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  /** Full-width equal cells, like Lumen’s explain tabs. */
  equal?: boolean;
  /** `tab` = h-11 text-xs; `depth` = h-10 text-sm. */
  scale?: 'tab' | 'depth';
}) {
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const { reduceMotion } = useGlassAccessibility();
  const minHeight = scale === 'depth' ? control.lumenDepthPill : control.touchMin;
  const labelStyle = scale === 'depth' ? styles.depthLabel : styles.pillLabel;
  const useNative =
    equal &&
    items.length >= 2 &&
    items.length <= 4 &&
    shouldUseNativeMultiSegment(false);

  if (useNative) {
    const optionIds = items.map((item) => item.id);
    const optionLabels = items.map((item) => item.label);
    return (
      <View style={styles.nativeHost} accessibilityRole="tablist">
        <NucleoGlassSegment
          optionIds={optionIds}
          optionLabels={optionLabels}
          selectedId={value}
          isEnabled
          themeVariant={isDark ? 'dark' : 'light'}
          reduceMotion={reduceMotion}
          onIntentChange={(event) => {
            const next = event.nativeEvent.intent;
            if (items.some((item) => item.id === next)) onChange(next as T);
          }}
          style={styles.nativeView}
        />
      </View>
    );
  }
  return (
    <View
      style={[
        equal ? styles.pillsEqual : styles.pills,
        equal ? { backgroundColor: colors.background.surfaceRaised } : null,
      ]}
    >
      {items.map((item) => {
        const on = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
            hitSlop={PRESS_HIT_SLOP}
            style={[
              equal ? styles.pillEqual : styles.pill,
              {
                backgroundColor: on ? colors.action.primary : equal ? 'transparent' : colors.background.surfaceRaised,
                minHeight,
              },
            ]}
          >
            <Text
              style={[
                labelStyle,
                { color: on ? colors.text.onAccent : colors.text.secondary },
              ]}
              maxFontSizeMultiplier={1.2}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Extra space so the press-expanded Liquid Glass lens is not clipped. */
const NATIVE_OVERFLOW_PAD = 24;

const styles = StyleSheet.create({
  nativeHost: {
    alignSelf: 'stretch',
    width: '100%',
    height: control.touchMin + NATIVE_OVERFLOW_PAD * 2,
    marginVertical: -NATIVE_OVERFLOW_PAD,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  nativeView: {
    width: '100%',
    height: control.touchMin + NATIVE_OVERFLOW_PAD * 2,
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  kicker: {
    ...lumenType('lumenKicker'),
  },
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    padding: space.card.padding,
    gap: space.card.gap,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.stack.sm,
  },
  pillsEqual: {
    flexDirection: 'row',
    gap: space.stack.xs,
    padding: space.stack.xs,
    borderRadius: radius.pill,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: space.stack.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pillEqual: {
    flex: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.stack.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    ...lumenType('lumenTab'),
  },
  depthLabel: {
    ...lumenType('lumenCopy'),
  },
  iconBtn: {
    width: control.touchMin,
    height: control.touchMin,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconBtnLabel: {
    ...lumenType('lumenLead'),
  },
  textBtnFrame: {
    flex: 1,
    minWidth: 0,
  },
  textBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: control.touchMin,
    paddingHorizontal: space.stack.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBtnLabel: {
    ...lumenType('lumenCopy'),
  },
  disabled: {
    opacity: 0.4,
  },
});
