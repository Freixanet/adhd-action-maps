import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppSession } from '../context/AppSessionContext';

/**
 * Human banner when application plan/review sync is pending (no Gemini on retry).
 */
export default function PendingApplicationSyncBanner() {
  const session = useAppSession();
  const pending =
    session.applicationSyncPending || session.applicationReviewSyncPending;
  if (!pending || session.phase !== 'result') return null;

  return (
    <View className="mx-5 mb-3 rounded-2xl border border-sky-300/70 dark:border-sky-500/30 bg-sky-50/90 dark:bg-sky-500/10 px-4 py-3">
      <Text className="text-sm font-semibold text-sky-900 dark:text-sky-100">
        Sincronización pendiente
      </Text>
      <Text className="mt-1 text-sm leading-5 text-sky-800/90 dark:text-sky-200/90">
        {session.applicationReviewSyncPending
          ? 'La revisión quedó en el dispositivo. Reintenta sin volver a generar.'
          : session.error === 'Inicio de acción pendiente de sincronizar' ||
              (session.applicationSyncPending &&
                session.error?.includes('Inicio de acción'))
            ? 'El inicio de la acción quedó pendiente. Reintenta sin volver a generar.'
            : session.error?.includes('Replanificación')
              ? 'La replanificación quedó pendiente. Reintenta sin volver a generar.'
              : 'El plan de aplicación quedó pendiente de subir. Reintenta sin volver a generar.'}
      </Text>
      <Pressable
        onPress={() => {
          void session.handlePersistApplicationSync();
        }}
        disabled={!session.canRetryApplicationSync}
        accessibilityRole="button"
        accessibilityLabel="Reintentar sincronización del plan"
        className={`mt-3 items-center rounded-xl px-3 py-2.5 ${
          session.canRetryApplicationSync
            ? 'bg-sky-700 dark:bg-sky-600 active:opacity-90'
            : 'bg-sky-700/40 dark:bg-sky-600/40'
        }`}
      >
        <Text className="text-sm font-semibold text-white">Reintentar</Text>
      </Pressable>
    </View>
  );
}
