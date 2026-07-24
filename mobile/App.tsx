import './global.css';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { Uniwind } from 'uniwind';
import AuthSheet from './src/components/AuthSheet';
import PaywallSheet from './src/components/PaywallSheet';
import OAuthRedirectListener from './src/components/OAuthRedirectListener';
import { AppSessionProvider, useAppSession } from './src/context/AppSessionContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { NetworkStatusProvider } from './src/context/NetworkStatusContext';
import { bootstrapStorage } from './src/shims/localStorage';
import { hideScrollIndicatorsGlobally } from './src/logic/hideScrollIndicators';
import {
  isBrandLiveActivitySupported,
  startNucleoBrandLiveActivity,
} from './src/logic/nucleoBrandLiveActivity';
import ComprensionApp from './src/screens/ComprensionApp';
import { ACCENT } from '@shared/uiTokens';

hideScrollIndicatorsGlobally();

function AuthHost() {
  const session = useAppSession();

  return (
    <AuthSheet
      visible={session.authOpen}
      userEmail={session.cloudUserEmail}
      onClose={() => session.setAuthOpen(false)}
    />
  );
}

function PaywallHost() {
  const session = useAppSession();
  return (
    <PaywallSheet
      visible={session.paywallOpen}
      onClose={() => session.setPaywallOpen(false)}
    />
  );
}

function AppShell() {
  return (
    <View className="flex-1 bg-base" style={{ flex: 1 }}>
      <StatusBar style="light" />
      <AppSessionProvider>
        <View style={{ flex: 1 }}>
          <ComprensionApp />
          <AuthHost />
          <PaywallHost />
          <OAuthRedirectListener />
        </View>
      </AppSessionProvider>
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    Uniwind.setTheme('dark');
    bootstrapStorage()
      .then(() => setReady(true))
      .catch((error) => {
        console.error(error);
        setBootError('No se pudo inicializar el almacenamiento local.');
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready || bootError || !isBrandLiveActivitySupported()) return;
    void startNucleoBrandLiveActivity();
  }, [bootError, ready]);

  if (!ready) {
    return (
      <View className="flex-1 bg-base items-center justify-center">
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {bootError ? (
          <View className="flex-1 items-center justify-center px-6 bg-base">
            <Text className="text-center text-body">{bootError}</Text>
          </View>
        ) : (
          // HeroUINativeProvider already owns SafeAreaListener → Uniwind.updateInsets.
          // Nesting a second listener breaks frame/inset measurement (composer dock drifts).
          <HeroUINativeProvider>
            <ThemeProvider>
              <NetworkStatusProvider>
                <AppShell />
              </NetworkStatusProvider>
            </ThemeProvider>
          </HeroUINativeProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
