import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Camera, File, Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export const ATTACH_MENU_WIDTH = 168;

type AttachMenuPopoverProps = {
  onPickImage: () => void;
  onPickCamera: () => void;
  onPickFile: () => void;
  darkSurface?: boolean;
};

export default function AttachMenuPopover({
  onPickImage,
  onPickCamera,
  onPickFile,
  darkSurface = false,
}: AttachMenuPopoverProps) {
  const { isDark } = useTheme();
  const onComposer = darkSurface || isDark;
  const iconMuted = onComposer ? '#d4d4d4' : isDark ? '#a3a3a3' : '#737373';
  const textClass = onComposer
    ? 'text-base font-semibold text-neutral-200'
    : 'text-base font-semibold text-neutral-700 dark:text-neutral-200';

  return (
    <View className="py-2 px-2">
      <Pressable
        onPress={onPickCamera}
        accessibilityRole="menuitem"
        className="flex-row items-center gap-3 px-2.5 py-4 rounded-[14px] active:bg-neutral-100/70 dark:active:bg-white/6"
      >
        <Camera size={20} color={iconMuted} />
        <Text className={textClass}>Cámara</Text>
      </Pressable>

      <Pressable
        onPress={onPickImage}
        accessibilityRole="menuitem"
        className="flex-row items-center gap-3 px-2.5 py-4 rounded-[14px] active:bg-neutral-100/70 dark:active:bg-white/6"
      >
        <ImageIcon size={20} color={iconMuted} />
        <Text className={textClass}>Galería</Text>
      </Pressable>

      <Pressable
        onPress={onPickFile}
        accessibilityRole="menuitem"
        className="flex-row items-center gap-3 px-2.5 py-4 rounded-[14px] active:bg-neutral-100/70 dark:active:bg-white/6"
      >
        <File size={20} color={iconMuted} />
        <Text className={textClass}>Archivo</Text>
      </Pressable>
    </View>
  );
}
