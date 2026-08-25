import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { hapticSegment } from '../logic/haptics';
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
import { COMPOSER_CONTROL_SIZE, COMPOSER_PLUS_ICON_SIZE } from '../logic/composerText';
import type { ModelPreference } from '@shared/modelPreference';

/** DEV picker — local list so Metro Fast Refresh cannot keep the old 3.6/3.5 catalog. */
const DEV_MODEL_OPTIONS: ReadonlyArray<{ id: ModelPreference; label: string }> = [
  { id: 'auto', label: 'Automático' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
];

type AttachMenuProps = {
  onPickCamera: () => void;
  onPickImage: () => void;
  onPickFile: () => void;
  /** DEV-only: sent Chat bubble + Thinking orb, no assistant answer. */
  onPreviewChatThinking?: () => void;
  /** DEV-only: play the hyperspace delivery shader full-screen. */
  onPreviewHyperspace?: () => void;
  /** DEV-only: open editorial demo (procrastination / attention). */
  onEditorialDemo?: (fixtureId: 'procrastination' | 'attention') => void;
  /** DEV/QA: attach bundled multipage PDF and pin Entender or Aplicar. */
  onLoadQaMultipagePdf?: (intent: QaMultipagePdfIntent) => void;
  modelPreference?: ModelPreference;
  onSelectModel?: (value: ModelPreference) => void;
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

const MODEL_ACTION_PREFIX = 'model:';

function modelActionId(id: ModelPreference): string {
  return `${MODEL_ACTION_PREFIX}${id}`;
}

function parseModelActionId(eventId: string): ModelPreference | null {
  if (!eventId.startsWith(MODEL_ACTION_PREFIX)) return null;
  const raw = eventId.slice(MODEL_ACTION_PREFIX.length);
  return DEV_MODEL_OPTIONS.some((option) => option.id === raw)
    ? (raw as ModelPreference)
    : null;
}

const DEV_ATTACH_ACTIONS: MenuAction[] = [
  {
    id: 'preview-chat-thinking',
    title: 'Preview Thinking',
    image: Platform.select({ ios: 'ellipsis.bubble', android: 'ic_menu_recent_history' }),
  },
  {
    id: 'preview-hyperspace',
    title: 'Preview hyperspace',
    image: Platform.select({ ios: 'star.fill', android: 'ic_menu_view' }),
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
  onPreviewChatThinking,
  onPreviewHyperspace,
  onEditorialDemo,
  onLoadQaMultipagePdf,
  modelPreference = 'auto',
  onSelectModel,
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
    onPreviewChatThinking ||
      onPreviewHyperspace ||
      onEditorialDemo ||
      onLoadQaMultipagePdf ||
      onSelectModel
  );
  const modelActions: MenuAction[] = onSelectModel
    ? DEV_MODEL_OPTIONS.map((option) => ({
        id: modelActionId(option.id),
        title: option.label,
        state: option.id === modelPreference ? 'on' : 'off',
        image: Platform.select({ ios: 'cpu', android: 'ic_menu_manage' }),
      }))
    : [];
  const actions = showDevActions
    ? [
        ...ATTACH_ACTIONS,
        ...modelActions,
        ...DEV_ATTACH_ACTIONS.filter((action) => {
          if (
            action.id === 'qa-multipage-pdf-understand' ||
            action.id === 'qa-multipage-pdf-apply'
          ) {
            return Boolean(onLoadQaMultipagePdf);
          }
          if (action.id === 'preview-chat-thinking') return Boolean(onPreviewChatThinking);
          if (action.id === 'preview-hyperspace') return Boolean(onPreviewHyperspace);
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
    const selectedModel = parseModelActionId(nativeEvent.event);
    if (selectedModel) {
      hapticSegment();
      onSelectModel?.(selectedModel);
      return;
    }
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
      case 'preview-chat-thinking':
        onPreviewChatThinking?.();
        break;
      case 'preview-hyperspace':
        onPreviewHyperspace?.();
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
      <Plus size={COMPOSER_PLUS_ICON_SIZE} color={iconMuted} strokeWidth={1.5} />
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
