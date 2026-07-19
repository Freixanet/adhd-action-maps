import React from 'react';
import { Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import ComposerMenuTrigger from './ComposerMenuTrigger';
import { useTheme } from '../context/ThemeContext';

type AttachMenuProps = {
  onPickCamera: () => void;
  onPickImage: () => void;
  onPickFile: () => void;
  disabled?: boolean;
  darkSurface?: boolean;
};

// Icon-less rows, exactly like DepthMenu — keeps both composer menus with the
// identical native look and material.
const ATTACH_ACTIONS: MenuAction[] = [
  { id: 'camera', title: 'Cámara' },
  { id: 'gallery', title: 'Galería' },
  { id: 'file', title: 'Archivo' },
];

/**
 * Flat "+" control inside the composer glass — glass-on-glass is intentionally
 * avoided. Uses the native UIMenu (same material/animation as DepthMenu).
 */
export default function AttachMenu({
  onPickCamera,
  onPickImage,
  onPickFile,
  disabled = false,
  darkSurface = false,
}: AttachMenuProps) {
  const { isDark } = useTheme();
  const onComposer = darkSurface || isDark;
  const iconMuted = onComposer ? '#d4d4d4' : isDark ? '#a3a3a3' : '#737373';

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
    }
  };

  const button = (
    <View
      accessibilityRole="button"
      accessibilityLabel="Adjuntar"
      accessibilityState={{ disabled }}
      className={`h-10 w-10 items-center justify-center rounded-full ${
        disabled ? 'opacity-40' : 'active:bg-neutral-100/80 dark:active:bg-white/5'
      }`}
    >
      <Plus size={20} color={iconMuted} />
    </View>
  );

  if (disabled) return button;

  return (
    <ComposerMenuTrigger
      title="Adjuntar"
      actions={ATTACH_ACTIONS}
      onPressAction={handlePress}
      accessibilityLabel="Adjuntar"
    >
      {button}
    </ComposerMenuTrigger>
  );
}
