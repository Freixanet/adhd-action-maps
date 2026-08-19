import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Plus } from '../icons';
import { MenuView, type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import ComposerMenuTrigger from './ComposerMenuTrigger';
import FloatingGlassButton from './FloatingGlassButton';
import { useTheme } from '../context/ThemeContext';
import type { QaMultipagePdfIntent } from '../logic/intentPreselection';
import {
  QA_MULTIPAGE_PDF_APPLY_LABEL,
  QA_MULTIPAGE_PDF_UNDERSTAND_LABEL,
} from '../logic/intentPreselection';
import { SIDEBAR_TOGGLE_BUTTON_SIZE } from './sidebarLayout';
import { COMPOSER_CONTROL_SIZE } from '../logic/composerText';
import { control } from '@shared/design-tokens';

type AttachMenuProps = {
  onPickCamera: () => void;
  onPickImage: () => void;
  onPickFile: () => void;
  /** DEV-only: replay inline generation UI without a real transform. */
  onPreviewGeneration?: () => void;
  /** DEV-only: open the ready pre-map chat (Abrir Núcleo). */
  onPreviewPreMapChat?: () => void;
  /** DEV-only: open the collection loading screen preview. */
  onPreviewLoadingScreen?: () => void;
  /** DEV-only: open ResultScreen with the bundled demo Núcleo. */
  onPreviewNucleo?: () => void;
  /** DEV-only: open editorial demo (procrastination / attention). */
  onEditorialDemo?: (fixtureId: 'procrastination' | 'attention') => void;
  /** DEV/QA: attach bundled multipage PDF and pin Entender or Aplicar. */
  onLoadQaMultipagePdf?: (intent: QaMultipagePdfIntent) => void;
  disabled?: boolean;
  darkSurface?: boolean;
  /**
   * `composer` — flat "+" inside the composer glass.
   * `fab` — Liquid Glass circle (home dock, mirrors the keyboard FAB).
   */
  variant?: 'composer' | 'fab';
};

const ATTACH_ACTIONS: MenuAction[] = [
  {
    id: 'camera',
    title: 'Cámara',
    image: Platform.select({ ios: 'camera', android: 'ic_menu_camera' }),
  },
  {
    id: 'gallery',
    title: 'Galería',
    image: Platform.select({ ios: 'photo.on.rectangle', android: 'ic_menu_gallery' }),
  },
  {
    id: 'file',
    title: 'Archivos',
    image: Platform.select({ ios: 'doc', android: 'ic_menu_agenda' }),
  },
];

const DEV_ATTACH_ACTIONS: MenuAction[] = [
  {
    id: 'preview-generation',
    title: 'Preview generación',
    image: Platform.select({ ios: 'play.rectangle', android: 'ic_media_play' }),
  },
  {
    id: 'preview-pre-map-chat',
    title: 'Chat previo al mapa',
    image: Platform.select({ ios: 'bubble.left.and.bubble.right', android: 'ic_menu_recent_history' }),
  },
  {
    id: 'preview-loading',
    title: 'Preview colección',
    image: Platform.select({ ios: 'square.stack.3d.up', android: 'ic_menu_sort_by_size' }),
  },
  {
    id: 'preview-nucleo',
    title: 'Preview Núcleo',
    image: Platform.select({ ios: 'sparkles', android: 'ic_menu_view' }),
  },
  {
    id: 'editorial-demo-actuar',
    title: 'Demo editorial: actuar',
    image: Platform.select({ ios: 'book.pages', android: 'ic_menu_agenda' }),
  },
  {
    id: 'editorial-demo-atencion',
    title: 'Demo editorial: atención',
    image: Platform.select({ ios: 'book.pages', android: 'ic_menu_agenda' }),
  },
  {
    id: 'qa-multipage-pdf-understand',
    title: QA_MULTIPAGE_PDF_UNDERSTAND_LABEL,
    image: Platform.select({ ios: 'doc.richtext', android: 'ic_menu_agenda' }),
  },
  {
    id: 'qa-multipage-pdf-apply',
    title: QA_MULTIPAGE_PDF_APPLY_LABEL,
    image: Platform.select({ ios: 'doc.richtext', android: 'ic_menu_agenda' }),
  },
];

/**
 * Attach control + native UIMenu.
 * - `composer`: flat "+" inside the composer glass (no glass-on-glass).
 * - `fab`: same Liquid Glass circle as the keyboard FAB (`FloatingGlassButton`).
 */
export default function AttachMenu({
  onPickCamera,
  onPickImage,
  onPickFile,
  onPreviewGeneration,
  onPreviewPreMapChat,
  onPreviewLoadingScreen,
  onPreviewNucleo,
  onEditorialDemo,
  onLoadQaMultipagePdf,
  disabled = false,
  darkSurface = false,
  variant = 'composer',
}: AttachMenuProps) {
  const { isDark, colors } = useTheme();
  const onComposer = darkSurface || isDark;
  const iconMuted = onComposer ? colors.text.body : colors.icon.muted;
  const fabIconColor = colors.icon.primary;
  const isFab = variant === 'fab';

  const showDevActions = Boolean(
    onPreviewGeneration ||
      onPreviewPreMapChat ||
      onPreviewLoadingScreen ||
      onPreviewNucleo ||
      onEditorialDemo ||
      onLoadQaMultipagePdf
  );
  const actions = showDevActions
    ? [
        ...ATTACH_ACTIONS,
        ...DEV_ATTACH_ACTIONS.filter((action) => {
          if (
            action.id === 'qa-multipage-pdf-understand' ||
            action.id === 'qa-multipage-pdf-apply'
          ) {
            return Boolean(onLoadQaMultipagePdf);
          }
          if (action.id === 'preview-generation') return Boolean(onPreviewGeneration);
          if (action.id === 'preview-pre-map-chat') return Boolean(onPreviewPreMapChat);
          if (action.id === 'preview-loading') return Boolean(onPreviewLoadingScreen);
          if (action.id === 'preview-nucleo') return Boolean(onPreviewNucleo);
          if (
            action.id === 'editorial-demo-actuar' ||
            action.id === 'editorial-demo-atencion'
          ) {
            return Boolean(onEditorialDemo);
          }
          return true;
        }),
      ]
    : ATTACH_ACTIONS;

  const handlePress = ({ nativeEvent }: NativeActionEvent) => {
    switch (nativeEvent.event) {
      case 'camera':
        onPickCamera();
        break;
      case 'gallery':
        onPickImage();
        break;
      case 'file':
        onPickFile();
        break;
      case 'preview-generation':
        onPreviewGeneration?.();
        break;
      case 'preview-pre-map-chat':
        onPreviewPreMapChat?.();
        break;
      case 'preview-loading':
        onPreviewLoadingScreen?.();
        break;
      case 'preview-nucleo':
        onPreviewNucleo?.();
        break;
      case 'editorial-demo-actuar':
        onEditorialDemo?.('procrastination');
        break;
      case 'editorial-demo-atencion':
        onEditorialDemo?.('attention');
        break;
      case 'qa-multipage-pdf-understand':
        onLoadQaMultipagePdf?.('understand');
        break;
      case 'qa-multipage-pdf-apply':
        onLoadQaMultipagePdf?.('apply');
        break;
    }
  };

  const button = isFab ? (
    <FloatingGlassButton
      onPress={() => {}}
      accessibilityLabel="Adjuntar"
      shape="circle"
      size={SIDEBAR_TOGGLE_BUTTON_SIZE}
      systemImage="plus"
      symbolPointSize={15}
    >
      <Plus size={15} color={fabIconColor} strokeWidth={1.85} />
    </FloatingGlassButton>
  ) : (
    <View
      accessibilityRole="button"
      accessibilityLabel="Adjuntar"
      accessibilityState={{ disabled }}
      style={[styles.composerHit, disabled ? styles.composerHitDisabled : null]}
    >
      <Plus size={control.iconLg} color={iconMuted} />
    </View>
  );

  if (disabled) {
    if (!isFab) return button;
    return (
      <View accessibilityRole="button" accessibilityLabel="Adjuntar" accessibilityState={{ disabled: true }}>
        {button}
      </View>
    );
  }

  if (Platform.OS !== 'ios') {
    return (
      <MenuView actions={actions} onPressAction={handlePress}>
        {button}
      </MenuView>
    );
  }

  return (
    <ComposerMenuTrigger
      title=""
      actions={actions}
      onPressAction={handlePress}
      accessibilityLabel="Adjuntar"
      themeVariant={isDark ? 'dark' : 'light'}
      style={
        isFab
          ? { width: SIDEBAR_TOGGLE_BUTTON_SIZE, height: SIDEBAR_TOGGLE_BUTTON_SIZE }
          : styles.composerHit
      }
    >
      {button}
    </ComposerMenuTrigger>
  );
}

const styles = StyleSheet.create({
  composerHit: {
    width: COMPOSER_CONTROL_SIZE,
    height: COMPOSER_CONTROL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerHitDisabled: {
    opacity: 0.4,
  },
});
