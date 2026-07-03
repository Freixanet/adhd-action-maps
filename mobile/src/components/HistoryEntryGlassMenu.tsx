import React from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pin, SquarePen, Tag, Trash2 } from 'lucide-react-native';
import GlassSurface from './GlassSurface';
import type { HistoryEntry } from '../logic/history';

export type HistoryEntryActionAnchor = {
  entry: HistoryEntry;
  top: number;
  left: number;
  width: number;
};

type HistoryEntryGlassMenuProps = {
  menu: HistoryEntryActionAnchor | null;
  onClose: () => void;
  onRename: (entry: HistoryEntry) => void;
  onChangeCategory: (entry: HistoryEntry) => void;
  onTogglePin: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
};

const MENU_WIDTH = 220;
const SCREEN = Dimensions.get('window');

export default function HistoryEntryGlassMenu({
  menu,
  onClose,
  onRename,
  onChangeCategory,
  onTogglePin,
  onDelete,
}: HistoryEntryGlassMenuProps) {
  if (!menu) return null;

  const left = Math.max(12, Math.min(menu.left, SCREEN.width - MENU_WIDTH - 12));
  const top = Math.min(menu.top, SCREEN.height - 180);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar menú" />
        <View pointerEvents="box-none" style={[styles.menuHost, { top, left, width: MENU_WIDTH }]}>
          <GlassSurface liquid borderRadius={20} className="rounded-card shadow-xl">
            <Pressable
              onPress={() => {
                onRename(menu.entry);
                onClose();
              }}
              className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
            >
              <SquarePen size={16} color="#737373" />
              <Text className="text-sm font-medium text-primary text-primary">Renombrar</Text>
            </Pressable>
            <View className="h-px bg-neutral-200/80 dark:bg-white/10" />
            <Pressable
              onPress={() => {
                onChangeCategory(menu.entry);
                onClose();
              }}
              className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
            >
              <Tag size={16} color="#737373" />
              <Text className="text-sm font-medium text-primary text-primary">
                Cambiar categoría
              </Text>
            </Pressable>
            <View className="h-px bg-neutral-200/80 dark:bg-white/10" />
            <Pressable
              onPress={() => {
                onTogglePin(menu.entry);
                onClose();
              }}
              className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
            >
              <Pin size={16} color={menu.entry.pinned ? '#8B8FF5' : '#737373'} />
              <Text className="text-sm font-medium text-primary text-primary">
                {menu.entry.pinned ? 'Desfijar' : 'Fijar'}
              </Text>
            </Pressable>
            <View className="h-px bg-neutral-200/80 dark:bg-white/10" />
            <Pressable
              onPress={() => {
                onDelete(menu.entry);
                onClose();
              }}
              className="flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
            >
              <Trash2 size={16} color="#dc2626" />
              <Text className="text-sm font-medium text-red-600">Eliminar</Text>
            </Pressable>
          </GlassSurface>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  menuHost: {
    position: 'absolute',
  },
});
