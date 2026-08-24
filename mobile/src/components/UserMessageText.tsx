import { type, radius } from '@shared/design-tokens';
import { MenuView, type MenuAction } from '@react-native-menu/menu';
import { requireNativeModule } from 'expo-modules-core';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { NucleoUIMenuAnchor, type NucleoUIMenuAction } from '../../modules/nucleo-ui-menu/src';
import { useTheme } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { copyTextToClipboard } from '../logic/copyText';

type UserMessageTextProps = {
  text: string;
  color: string;
  maxWidth: number;
  backgroundColor: string;
  onEdit: () => void;
};

const BUBBLE_TAIL_RADIUS = 6;

const IOS_ACTIONS: NucleoUIMenuAction[] = [
  { id: 'copy', title: 'Copiar', image: 'doc.on.doc' },
  { id: 'edit', title: 'Editar', image: 'pencil' },
  { id: 'select', title: 'Seleccionar', image: 'selection.pin.in.out' },
];

const ANDROID_ACTIONS: MenuAction[] = [
  { id: 'copy', title: 'Copiar' },
  { id: 'edit', title: 'Editar' },
  { id: 'select', title: 'Seleccionar' },
];

function nativeLiftPreviewReady(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const mod = requireNativeModule('NucleoUIMenu') as { supportsLiftPreview?: () => boolean };
    return typeof mod.supportsLiftPreview === 'function' && mod.supportsLiftPreview();
  } catch {
    return false;
  }
}

/**
 * Sent-message bubble. Long-press lifts the bubble and opens
 * Copiar / Editar / Seleccionar, then Preguntar a Siri under a separator.
 */
export default function UserMessageText({
  text,
  color,
  maxWidth,
  backgroundColor,
  onEdit,
}: UserMessageTextProps) {
  const { font } = useTypography();
  const { isDark } = useTheme();
  const liftPreview = nativeLiftPreviewReady();

  const textStyle = useMemo(
    () => ({
      color,
      fontFamily: font.family,
      fontSize: type.input.fontSize,
      lineHeight: type.input.lineHeight,
    }),
    [color, font.family]
  );

  const bubbleStyle = useMemo(
    () => ({
      maxWidth,
      backgroundColor,
      borderRadius: radius.bubble,
      borderBottomRightRadius: BUBBLE_TAIL_RADIUS,
      paddingHorizontal: 14,
      paddingVertical: 10,
    }),
    [maxWidth, backgroundColor]
  );

  const handleAction = (id: string) => {
    if (id === 'copy') void copyTextToClipboard(text);
    if (id === 'edit') onEdit();
  };

  const bubble = (
    <View pointerEvents="none" collapsable={false} style={bubbleStyle}>
      <Text className="text-input leading-6" style={textStyle} maxFontSizeMultiplier={1.35}>
        {text}
      </Text>
    </View>
  );

  if (Platform.OS === 'android' || !liftPreview) {
    return (
      <MenuView
        shouldOpenOnLongPress
        actions={Platform.OS === 'ios' ? IOS_ACTIONS : ANDROID_ACTIONS}
        themeVariant={isDark ? 'dark' : 'light'}
        onPressAction={({ nativeEvent }) => handleAction(nativeEvent.event)}
      >
        {bubble}
      </MenuView>
    );
  }

  return (
    <NucleoUIMenuAnchor
      liftPreview
      themeVariant={isDark ? 'dark' : 'light'}
      actions={IOS_ACTIONS}
      previewCornerRadius={radius.bubble}
      previewTailRadius={BUBBLE_TAIL_RADIUS}
      sourceText={text}
      sourceColor={color}
      sourceFontSize={type.input.fontSize}
      sourceLineHeight={type.input.lineHeight}
      sourceFontFamily={font.family}
      onSelect={(event) => handleAction(event?.nativeEvent?.id)}
      style={styles.host}
    >
      {bubble}
    </NucleoUIMenuAnchor>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'flex-end',
  },
});
