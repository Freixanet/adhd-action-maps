import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MenuView, type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import { MoreHorizontal } from '../icons';
import { RADII, TEXT_BODY } from '@shared/uiTokens';
import GlassSurface from './GlassSurface';
import { usePressScale } from '../hooks/usePressScale';
import { useTheme } from '../context/ThemeContext';
import { color, type } from '@shared/design-tokens';

type CompletionOverflowMenuProps = {
  onViewAll: () => void;
};

/** Secondary overflow for completed map — primary actions live as visible CTAs (SPEC §5.5). */
export default function CompletionOverflowMenu({ onViewAll }: CompletionOverflowMenuProps) {
  const { isDark } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  const actions: MenuAction[] = [{ id: 'viewAll', title: 'Ver completo' }];

  const handlePress = ({ nativeEvent }: NativeActionEvent) => {
    if (nativeEvent.event === 'viewAll') onViewAll();
  };

  const iconColor = isDark ? TEXT_BODY : color.text.muted;

  return (
    <View style={styles.wrapper} collapsable={false}>
      <MenuView
        style={styles.menuHost}
        actions={actions}
        onPressAction={handlePress}
        themeVariant="dark"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Más acciones"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.pressable}
        >
          <Animated.View style={[styles.pressableInner, animatedStyle]}>
            <GlassSurface
              liquid
              liquidBorder="none"
              borderRadius={RADII.md}
              style={styles.shell}
              overlayClassName={isDark ? 'bg-white/[0.05]' : 'bg-white/45'}
              contentClassName="items-center justify-center"
            >
              <View style={styles.content}>
                <MoreHorizontal size={20} color={iconColor} />
              </View>
            </GlassSurface>
          </Animated.View>
        </Pressable>
      </MenuView>
    </View>
  );
}

const OVERFLOW_SIZE = 44;

const styles = StyleSheet.create({
  wrapper: {
    width: OVERFLOW_SIZE,
    height: OVERFLOW_SIZE,
    flexShrink: 0,
  },
  menuHost: {
    width: OVERFLOW_SIZE,
    height: OVERFLOW_SIZE,
  },
  pressable: {
    width: OVERFLOW_SIZE,
    height: OVERFLOW_SIZE,
  },
  pressableInner: {
    width: OVERFLOW_SIZE,
    height: OVERFLOW_SIZE,
  },
  shell: {
    width: OVERFLOW_SIZE,
    height: OVERFLOW_SIZE,
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
  content: {
    width: OVERFLOW_SIZE,
    height: OVERFLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
