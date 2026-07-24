import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from '../icons';
import {
  getCategoryEditSections,
  sanitizeUserCategory,
} from '@shared/categories';
import { FEATURES } from '@shared/features';

type CategoryEditSheetProps = {
  visible: boolean;
  value: string;
  usedCategories?: string[];
  userCategories?: string[];
  mapTitle?: string;
  onClose: () => void;
  onSave: (category: string) => void;
};

function CategoryRow({
  category,
  selected,
  onPress,
}: {
  category: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between border-b border-neutral-200/80 py-3.5 border-white/10 active:opacity-70"
    >
      <Text
        className={`text-base ${
          selected
            ? 'font-semibold text-primary'
            : 'text-body'
        }`}
      >
        {category}
      </Text>
      {selected ? <Check size={18} color="#525252" /> : null}
    </Pressable>
  );
}

export default function CategoryEditSheet({
  visible,
  value,
  usedCategories = [],
  userCategories = [],
  mapTitle,
  onClose,
  onSave,
}: CategoryEditSheetProps) {
  const insets = useSafeAreaInsets();
  const [customValue, setCustomValue] = useState('');
  const allowCreate = FEATURES.customCategories;
  const { used, suggested } = useMemo(
    () => getCategoryEditSections(usedCategories),
    [usedCategories]
  );

  useEffect(() => {
    if (visible) setCustomValue('');
  }, [visible, value]);

  const handleSelect = (category: string) => {
    onSave(category);
    onClose();
  };

  const handleCreate = () => {
    const trimmed = sanitizeUserCategory(customValue);
    if (!trimmed) return;
    onSave(trimmed);
    setCustomValue('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/30" onPress={onClose} />
      <View
        className="rounded-t-[24px] bg-base px-4 pt-4 dark:bg-base"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-primary">
            Categoría
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            className="h-10 w-10 items-center justify-center active:opacity-70"
          >
            <X size={18} color="#737373" />
          </Pressable>
        </View>
        {mapTitle ? (
          <Text className="mb-4 text-sm text-secondary" numberOfLines={2}>
            {mapTitle}
          </Text>
        ) : (
          <View className="mb-4" />
        )}

        <ScrollView
          className="max-h-80"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {used.length ? (
            <View className="mb-2">
              <Text className="pb-2 text-[11px] font-bold uppercase tracking-widest text-secondary">
                En tus Núcleos
              </Text>
              {used.map((category) => (
                <CategoryRow
                  key={`used-${category}`}
                  category={category}
                  selected={category === value}
                  onPress={() => handleSelect(category)}
                />
              ))}
            </View>
          ) : null}

          {suggested.length ? (
            <View>
              <Text className="pb-2 text-[11px] font-bold uppercase tracking-widest text-secondary">
                {used.length ? 'Otras sugeridas' : 'Sugeridas'}
              </Text>
              {suggested.map((category) => (
                <CategoryRow
                  key={`suggested-${category}`}
                  category={category}
                  selected={category === value}
                  onPress={() => handleSelect(category)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>

        {allowCreate ? (
          <View className="mt-4 flex-row items-center gap-2 border-t border-neutral-200/80 pt-4 border-white/10">
            <TextInput
              value={customValue}
              onChangeText={setCustomValue}
              placeholder="Nueva categoría"
              placeholderTextColor="#a3a3a3"
              className="flex-1 border-b border-neutral-300 py-2 text-base text-primary dark:border-white/15 text-primary"
              onSubmitEditing={handleCreate}
            />
            <Pressable
              onPress={handleCreate}
              disabled={!sanitizeUserCategory(customValue)}
              className="px-2 py-2 active:opacity-70 disabled:opacity-40"
            >
              <Text className="font-semibold text-primary">Crear</Text>
            </Pressable>
          </View>
        ) : (
          <Text className="mt-4 border-t border-neutral-200/80 pt-4 text-xs text-secondary border-white/10 text-secondary">
            Las categorías personalizadas estarán disponibles en el plan Pro.
          </Text>
        )}
      </View>
    </Modal>
  );
}
