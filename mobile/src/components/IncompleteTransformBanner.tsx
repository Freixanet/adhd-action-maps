import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from '../icons';
import { useAppSession } from '../context/AppSessionContext';

export default function IncompleteTransformBanner() {
  const session = useAppSession();

  if (!session.transformIncomplete || session.phase !== 'result') {
    return null;
  }

  return (
    <View className="mx-5 mb-3 rounded-2xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-500/10 px-4 py-3">
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Núcleo incompleto
          </Text>
          <Text className="mt-1 text-sm leading-5 text-amber-800/90 dark:text-amber-200/90">
            La generación se interrumpió. Puedes reintentar o volver al inicio.
          </Text>
        </View>
        <Pressable
          onPress={session.dismissTransformIncomplete}
          accessibilityRole="button"
          accessibilityLabel="Cerrar aviso"
          className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full active:opacity-70"
        >
          <X size={16} color="#b45309" />
        </Pressable>
      </View>
      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={() => {
            void session.handleTransform();
          }}
          disabled={!session.canSubmit || session.isStreamGenerating}
          className={`flex-1 items-center rounded-xl px-3 py-2.5 ${
            session.canSubmit && !session.isStreamGenerating
              ? 'bg-amber-700 dark:bg-amber-600 active:opacity-90'
              : 'bg-amber-700/40 dark:bg-amber-600/40'
          }`}
          accessibilityRole="button"
          accessibilityLabel="Reintentar generación"
        >
          <Text className="text-sm font-semibold text-white">Reintentar</Text>
        </Pressable>
        <Pressable
          onPress={session.handleNewMap}
          className="flex-1 items-center rounded-xl border border-amber-300/80 dark:border-amber-500/30 px-3 py-2.5 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
        >
          <Text className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Núcleo
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
