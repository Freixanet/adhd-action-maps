import React, { memo, useCallback } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { CanvasKind } from '@shared/lumen/types';
import { control, radius, space, type } from '@shared/design-tokens';
import { useTheme } from '../context/ThemeContext';
import { Pin } from '../icons';
import { useTypography } from '../context/TypographyContext';
import { PRESS_HIT_SLOP, PRESS_RETENTION_OFFSET, usePressScale } from '../hooks/usePressScale';
import { SIDEBAR_EDGE_INSET } from './sidebarLayout';
import { LUMEN_KIND_ART } from '../lumen/lumenKindArt';

const THUMB_SIZE = 56;
const ROW_MIN_HEIGHT = 64;

const LUMEN_HOME_CARDS: readonly { id: string; title: string; kind: CanvasKind }[] = [
  { id: 'nucleo-formato-ejemplo', title: 'Relatividad especial', kind: 'explain' },
  { id: 'nucleo-lumen-galletas', title: 'Galletas extra chewy', kind: 'recipe' },
  { id: 'nucleo-lumen-ev', title: 'Model 3 vs Ioniq 6', kind: 'compare' },
  { id: 'nucleo-lumen-cumple', title: 'Cumple de 8 años', kind: 'plan' },
];

type JumpBackInSectionProps = {
  items?: readonly unknown[];
  onSelect: (id: string) => void;
  title?: string;
  spacing?: 'lead' | 'follow';
};

type JumpBackRowProps = {
  id: string;
  title: string;
  kind: CanvasKind;
  onSelect: (id: string) => void;
};

function PinMark({ color }: { color: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.pin}
    >
      <Pin size={control.iconSm} color={color} strokeWidth={1.5} />
    </View>
  );
}

function JumpBackRow({ id, title, kind, onSelect }: JumpBackRowProps) {
  const { isDark, colors } = useTheme();
  const { font } = useTypography();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const art = LUMEN_KIND_ART?.[kind];

  const handlePress = useCallback(() => {
    onSelect(id);
  }, [id, onSelect]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={PRESS_HIT_SLOP}
      pressRetentionOffset={PRESS_RETENTION_OFFSET}
      accessibilityRole="button"
      accessibilityLabel={`Abrir Núcleo fijado: ${title}`}
    >
      <Animated.View
        style={[
          styles.row,
          {
            backgroundColor: colors.background.surface,
            borderColor: isDark ? colors.background.whiteFade08 : colors.background.blackFade08,
          },
          Platform.OS === 'ios' ? styles.continuous : null,
          animatedStyle,
        ]}
      >
        <View style={styles.thumb}>
          {art ? (
            <Image source={art} resizeMode="cover" accessible={false} style={styles.thumbImage} />
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            {
              color: colors.text.primary,
              fontFamily: font.family,
            },
          ]}
        >
          {title}
        </Text>
        <PinMark color={colors.icon.muted} />
      </Animated.View>
    </Pressable>
    );
}

const MemoJumpBackRow = memo(JumpBackRow);

export default function JumpBackInSection({
  onSelect,
  title = 'Vuelve a tus Núcleos',
  spacing = 'lead',
}: JumpBackInSectionProps) {
  const colors = useTheme().colors;
  const { font } = useTypography();

  return (
    <View
      style={[
        styles.section,
        {
          marginTop:
            spacing === 'follow'
              ? space.section.gap
              : space.section.gap + space.stack.xl + space.stack.lg,
          paddingHorizontal: SIDEBAR_EDGE_INSET,
        },
      ]}
    >
      <Text
        style={[
          styles.heading,
          {
            color: colors.text.primary,
            fontFamily: font.family,
          },
        ]}
        maxFontSizeMultiplier={1.3}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={styles.list}>
        {LUMEN_HOME_CARDS.map((card) => (
          <MemoJumpBackRow
            key={card.id}
            id={card.id}
            title={card.title}
            kind={card.kind}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    marginBottom: space.stack.sm,
    backgroundColor: 'transparent',
  },
  heading: {
    fontSize: type.sectionTitle.fontSize,
    lineHeight: type.sectionTitle.lineHeight,
    fontWeight: type.sectionTitle.fontWeight as '600',
    letterSpacing: type.sectionTitle.letterSpacing,
  },
  list: {
    marginTop: space.stack.md,
    gap: space.card.gap,
  },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.stack.md,
    padding: space.stack.sm,
    paddingRight: space.stack.lg,
    borderRadius: radius.vizCard,
    overflow: 'hidden',
    borderWidth: 1,
  },
  continuous: {
    borderCurve: 'continuous',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  thumbImage: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: type.lumenCopy.fontSize,
    lineHeight: type.lumenCopy.lineHeight,
    fontWeight: type.lumenCopy.fontWeight as '400',
    letterSpacing: type.lumenCopy.letterSpacing,
  },
  pin: {
    flexShrink: 0,
    width: control.iconSm,
    height: control.iconSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
