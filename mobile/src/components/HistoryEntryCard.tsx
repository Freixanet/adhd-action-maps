import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MenuView, type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import { FALLBACK_MAP_CATEGORY } from '@shared/categories';
import { isChatHistoryEntry } from '@shared/historyKind';
import { resolveLibraryStatePresentation } from '@shared/progress';
import { useTheme } from '../context/ThemeContext';
import { formatRelativeDate, type HistoryEntry } from '../logic/history';
import HistoryEntrySourceIcon from './HistoryEntrySourceIcon';
import MapCategoryLabel from './MapCategoryLabel';
import { space } from '@shared/design-tokens';
import { PRESS_HIT_SLOP, PRESS_RETENTION_OFFSET, usePressScale } from '../hooks/usePressScale';

export const HISTORY_ENTRY_CARD_HEIGHT = 104;
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
  const { isDark, colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const isChat = isChatHistoryEntry(entry);
  const category = entry.category || FALLBACK_MAP_CATEGORY;
  const cardBackground = isDark ? colors.background.canvas : colors.background.surface;
  const metaIconColor = colors.icon.muted;
  const state = resolveLibraryStatePresentation(entry);
  const relativeDate = formatRelativeDate(entry.updatedAt);
  const metaTextParts = isChat
    ? ['Chat', relativeDate].filter(Boolean)
    : [state.label, state.detail, relativeDate].filter(Boolean);

  const menuActions: MenuAction[] = isChat
    ? [
        {
          id: 'pin',
          title: entry.pinned ? 'Desfijar' : 'Fijar',
          image: entry.pinned ? 'pin.slash' : 'pin',
        },
        { id: 'rename', title: 'Cambiar nombre' },
        {
          id: 'delete',
          title: 'Eliminar',
          attributes: { destructive: true },
        },
      ]
    : [
        {
          id: 'pin',
          title: entry.pinned ? 'Desfijar' : 'Fijar',
          image: entry.pinned ? 'pin.slash' : 'pin',
        },
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
        style={isChat ? undefined : { height: HISTORY_ENTRY_CARD_HEIGHT }}
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
    <View collapsable={false} style={[styles.cardShell, isChat ? styles.chatShell : styles.nucleoShell]}>
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
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        hitSlop={PRESS_HIT_SLOP}
        pressRetentionOffset={PRESS_RETENTION_OFFSET}
        pointerEvents={menuInteractionBlocked ? 'none' : 'auto'}
        className={`rounded-2xl overflow-hidden ${isChat ? '' : 'flex-1 '}${showActiveStyle ? 'bg-accent/10' : ''}`}
        style={[
          isChat ? null : styles.cardPressable,
          isMenuOpen
            ? { backgroundColor: isDark ? colors.background.whiteFade08 : colors.background.whiteFade72 }
            : !showActiveStyle
              ? { backgroundColor: cardBackground }
              : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isChat
            ? `${entry.title}. Chat. ${relativeDate}`
            : `${entry.title}. ${state.label}. ${state.detail}`
        }
      >
        <Animated.View style={[isChat ? styles.chatMenu : styles.menuFill, animatedStyle]}>
        <MenuView
          style={isChat ? styles.chatMenu : styles.menuFill}
          actions={menuActions}
          onPressAction={handleMenuAction}
          onOpenMenu={() => {
            lastMenuOpenAtRef.current = Date.now();
            onMenuOpen?.();
          }}
          onCloseMenu={() => {
            onMenuClose?.();
          }}
          shouldOpenOnLongPress
          themeVariant="dark"
        >
          <View
            pointerEvents="none"
            style={[styles.cardContent, isChat ? styles.chatContent : styles.nucleoContent]}
            collapsable={false}
          >
            {isChat ? null : <MapCategoryLabel category={category} />}
            <Text className={`${isChat ? '' : 'mt-1 '}text-base font-semibold leading-5 text-primary`} numberOfLines={2}>
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
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    marginBottom: space.stack.sm,
  },
  nucleoShell: {
    height: HISTORY_ENTRY_CARD_HEIGHT,
  },
  chatShell: {
    minHeight: 64,
  },
  cardPressable: {
    flex: 1,
  },
  menuFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  chatMenu: {
    alignSelf: 'stretch',
  },
  cardContent: {
    justifyContent: 'center',
    paddingHorizontal: space.stack.md,
    paddingVertical: space.stack.md,
  },
  nucleoContent: {
    flex: 1,
  },
  chatContent: {
    paddingVertical: space.stack.sm,
  },
});
