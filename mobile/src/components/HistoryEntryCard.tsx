import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MenuView, type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import * as Haptics from 'expo-haptics';
import { FALLBACK_MAP_CATEGORY, getIntentLabel } from '@shared/categories';
import { APP_DARK_BACKGROUND } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';
import { formatRelativeDate, type HistoryEntry } from '../logic/history';
import HistoryEntrySourceIcon from './HistoryEntrySourceIcon';
import MapCategoryLabel from './MapCategoryLabel';

export const HISTORY_ENTRY_CARD_HEIGHT = 92;
const MENU_TAP_GUARD_MS = 1200;

type HistoryEntryCardProps = {
  entry: HistoryEntry;
  isActive: boolean;
  isMenuOpen?: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onSelect: (id: string) => void;
  onRename: (entry: HistoryEntry) => void;
  onChangeCategory: (entry: HistoryEntry) => void;
  onTogglePin: (entry: HistoryEntry) => void;
  onDelete: (entry: HistoryEntry) => void;
  onExportPdf: (entry: HistoryEntry) => void;
  menuSessionOpen?: boolean;
  menuInteractionBlocked?: boolean;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
};

export default function HistoryEntryCard({
  entry,
  isActive,
  isMenuOpen = false,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onCommitRename,
  onSelect,
  onRename,
  onChangeCategory,
  onTogglePin,
  onDelete,
  onExportPdf,
  menuSessionOpen = false,
  menuInteractionBlocked = false,
  onMenuOpen,
  onMenuClose,
}: HistoryEntryCardProps) {
  const lastMenuOpenAtRef = useRef<number | null>(null);
  const { isDark } = useTheme();
  const category = entry.category || FALLBACK_MAP_CATEGORY;
  const cardBackground = isDark ? APP_DARK_BACKGROUND : '#f0f0f0';
  const metaIconColor = isDark ? '#a3a3a3' : '#737373';
  const metaTextParts = [
    entry.intent ? getIntentLabel(entry.intent) : null,
    formatRelativeDate(entry.updatedAt),
  ].filter(Boolean);

  const menuActions: MenuAction[] = [
    { id: 'pin', title: entry.pinned ? 'Desfijar' : 'Fijar' },
    { id: 'rename', title: 'Cambiar nombre' },
    { id: 'category', title: 'Cambiar categoría' },
    { id: 'pdf', title: 'Exportar' },
    {
      id: 'delete',
      title: 'Eliminar',
      attributes: { destructive: true },
    },
  ];

  const handleMenuAction = ({ nativeEvent }: NativeActionEvent) => {
    switch (nativeEvent.event) {
      case 'rename':
        onRename(entry);
        break;
      case 'category':
        onChangeCategory(entry);
        break;
      case 'pin':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTogglePin(entry);
        break;
      case 'pdf':
        onExportPdf(entry);
        break;
      case 'delete':
        onDelete(entry);
        break;
    }
  };

  if (isRenaming) {
    return (
      <View
        collapsable={false}
        className="mb-2 rounded-2xl px-3 py-3 justify-center"
        style={{ height: HISTORY_ENTRY_CARD_HEIGHT }}
      >
        <View className="flex-row items-center gap-2">
          <TextInput
            value={renameValue}
            onChangeText={onRenameValueChange}
            autoFocus
            className="flex-1 text-base text-primary border border-neutral-200 border-white/10 rounded-xl px-3 py-2"
            onSubmitEditing={onCommitRename}
          />
          <Pressable onPress={onCommitRename} className="px-3 py-2">
            <Text className="font-semibold text-accent">OK</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const showActiveStyle = isActive && !isMenuOpen;

  return (
    <View collapsable={false} style={styles.cardShell}>
      <Pressable
        onPress={() => {
          if (menuSessionOpen) return;
          const sinceMenuOpenMs =
            lastMenuOpenAtRef.current == null ? null : Date.now() - lastMenuOpenAtRef.current;
          if (sinceMenuOpenMs != null && sinceMenuOpenMs < MENU_TAP_GUARD_MS) {
            return;
          }
          onSelect(entry.id);
        }}
        pointerEvents={menuInteractionBlocked ? 'none' : 'auto'}
        className={`flex-1 rounded-2xl overflow-hidden ${showActiveStyle ? 'bg-accent/10' : ''}`}
        style={[
          styles.cardPressable,
          isMenuOpen
            ? { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)' }
            : !showActiveStyle
              ? { backgroundColor: cardBackground }
              : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={entry.title}
      >
        <MenuView
          style={styles.menuFill}
          actions={menuActions}
          onPressAction={handleMenuAction}
          onOpenMenu={() => {
            lastMenuOpenAtRef.current = Date.now();
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onMenuOpen?.();
          }}
          onCloseMenu={() => {
            onMenuClose?.();
          }}
          shouldOpenOnLongPress
          themeVariant="dark"
        >
          <View pointerEvents="none" style={styles.cardContent} collapsable={false}>
            <MapCategoryLabel category={category} />
            <Text className="mt-1 text-base font-semibold leading-5 text-primary" numberOfLines={2}>
              {entry.title}
            </Text>
            <View className="mt-1.5 flex-row items-center gap-1.5 min-w-0">
              <HistoryEntrySourceIcon entry={entry} color={metaIconColor} />
              {metaTextParts.length > 0 ? (
                <Text className="flex-1 text-xs text-secondary" numberOfLines={1}>
                  {metaTextParts.join(' · ')}
                </Text>
              ) : null}
            </View>
          </View>
        </MenuView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    height: HISTORY_ENTRY_CARD_HEIGHT,
    marginBottom: 8,
  },
  cardPressable: {
    flex: 1,
  },
  menuFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
