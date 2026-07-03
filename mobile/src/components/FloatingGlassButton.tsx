import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import GlassBarShell, { GLASS_BAR_BUTTON_RADIUS } from './GlassBarShell';
import GlassSurface from './GlassSurface';
import { SIDEBAR_HEADER_BUTTON_SIZE } from './sidebarLayout';
import { useTheme } from '../context/ThemeContext';

type FloatingGlassButtonProps = {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  shape?: 'circle' | 'pill' | 'rounded';
  tone?: 'neutral' | 'accent';
  /** Circle diameter in points. Defaults to {@link FLOATING_CIRCLE_SIZE}. */
  size?: number;
  /** Smaller pill padding for inline toolbars (e.g. map header). */
  compact?: boolean;
  /** Stretch pill/bar to parent width (e.g. completion CTAs). */
  fullWidth?: boolean;
};

/** Profile circle diameter and paired bar height (e.g. Nuevo Núcleo in history). */
export const FLOATING_CIRCLE_SIZE = 52;
export const FLOATING_BAR_HEIGHT = FLOATING_CIRCLE_SIZE;
export const FLOATING_PILL_MIN_HEIGHT = 48;
/** Capsule ends — avoids rough native glass at borderRadius 9999. */
export const FLOATING_PILL_RADIUS = FLOATING_PILL_MIN_HEIGHT / 2;

export function FloatingGlassShell({
  children,
  shape = 'pill',
  tone = 'neutral',
  size = FLOATING_CIRCLE_SIZE,
  compact = false,
  fullWidth = false,
  prominent = false,
}: Pick<FloatingGlassButtonProps, 'children' | 'shape' | 'tone' | 'size' | 'compact' | 'fullWidth'> & {
  prominent?: boolean;
}) {
  const { isDark } = useTheme();
  const isAccent = tone === 'accent';
  const isCircle = shape === 'circle';
  const isRounded = shape === 'rounded';

  const circleSizeStyle = {
    width: size,
    height: size,
  };

  const accentTint = isDark ? 'rgba(139, 143, 245, 0.52)' : 'rgba(139, 143, 245, 0.46)';
  const accentOverlay = isDark ? 'bg-accent/100/32' : 'bg-accent/28';

  if (isAccent) {
    if (isCircle) {
      const radius = size / 2;
      return (
        <View style={[styles.shadow, styles.accentShadow, circleSizeStyle]}>
          <GlassSurface
            liquid
            liquidBorder="none"
            borderRadius={radius}
            style={[styles.circleGlass, { width: size, height: size, borderRadius: radius }]}
            tintColor={accentTint}
            overlayClassName={accentOverlay}
            contentClassName="h-full w-full items-center justify-center"
          >
            <View style={styles.circleContent}>{children}</View>
          </GlassSurface>
        </View>
      );
    }

    return (
      <GlassBarShell
        style={[styles.accentBar, fullWidth ? styles.fullWidth : null]}
        tintColor={accentTint}
        overlayClassName={accentOverlay}
        contentClassName="h-full w-full items-center justify-center"
      >
        <View
          style={[
            compact ? styles.pillContentAccentCompact : styles.pillContentAccent,
            fullWidth ? styles.fullWidth : null,
          ]}
        >
          {children}
        </View>
      </GlassBarShell>
    );
  }

  if (isCircle) {
    const radius = size / 2;
    const circleGlass = (
      <GlassSurface
        liquid
        interactive
        liquidBorder="perimeter"
        liquidMaterial={prominent ? 'regular' : 'clear'}
        glassInset={prominent ? 0 : 1}
        borderRadius={radius}
        style={[styles.circleGlass, { width: size, height: size, borderRadius: radius }]}
        overlayClassName={
          prominent
            ? isDark
              ? 'bg-white/12'
              : 'bg-white/68'
            : isDark
              ? 'bg-white/[0.05]'
              : 'bg-white/40'
        }
        tintColor={
          prominent
            ? isDark
              ? 'rgba(64, 64, 64, 0.48)'
              : 'rgba(245, 245, 245, 0.72)'
            : undefined
        }
        contentClassName="h-full w-full items-center justify-center"
      >
        <View style={styles.circleContent}>{children}</View>
      </GlassSurface>
    );

    if (size <= SIDEBAR_HEADER_BUTTON_SIZE) {
      return circleGlass;
    }

    return (
      <View style={[styles.shadow, prominent ? styles.shadowProminent : null, circleSizeStyle]}>
        {circleGlass}
      </View>
    );
  }

  if (isRounded) {
    return (
      <GlassBarShell>
        <View style={styles.barContent}>{children}</View>
      </GlassBarShell>
    );
  }

  return (
    <View style={[styles.shadow, compact ? styles.shadowCompact : null]}>
      <GlassSurface
        liquid
        interactive
        liquidBorder="perimeter"
        borderRadius={FLOATING_PILL_RADIUS}
        style={styles.neutralPill}
        contentClassName="h-full w-full items-center justify-center"
      >
        <View style={compact ? styles.pillContentCompact : styles.pillContent}>{children}</View>
      </GlassSurface>
    </View>
  );
}

function FloatingGlassButton({
  onPress,
  accessibilityLabel,
  children,
  shape = 'pill',
  tone = 'neutral',
  size = FLOATING_CIRCLE_SIZE,
  compact = false,
  fullWidth = false,
}: FloatingGlassButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [fullWidth ? styles.fullWidth : null, pressed ? styles.pressed : null]}
    >
      <FloatingGlassShell
        shape={shape}
        tone={tone}
        size={size}
        compact={compact}
        fullWidth={fullWidth}
      >
        {children}
      </FloatingGlassShell>
    </Pressable>
  );
}

export default React.memo(FloatingGlassButton);

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  shadowCompact: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  accentShadow: {
    shadowColor: '#8B8FF5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  shadowProminent: {
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  circleShell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGlass: {
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  accentBar: {
    height: FLOATING_BAR_HEIGHT,
    borderRadius: GLASS_BAR_BUTTON_RADIUS,
    overflow: 'hidden',
  },
  neutralPill: {
    height: FLOATING_PILL_MIN_HEIGHT,
    borderRadius: FLOATING_PILL_RADIUS,
    overflow: 'hidden',
  },
  pillContent: {
    height: FLOATING_PILL_MIN_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  pillContentCompact: {
    height: FLOATING_PILL_MIN_HEIGHT,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  pillContentAccent: {
    height: FLOATING_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
  },
  pillContentAccentCompact: {
    height: FLOATING_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  barContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
