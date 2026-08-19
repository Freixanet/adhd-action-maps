import './global.css';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Appearance, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { Uniwind } from 'uniwind';
import AuthSheet from './src/components/AuthSheet';
import BetaQuotaSheet from './src/components/BetaQuotaSheet';
import PaywallSheet from './src/components/PaywallSheet';
import OAuthRedirectListener from './src/components/OAuthRedirectListener';
import DevPreviewDeepLink from './src/components/DevPreviewDeepLink';
import { AppSessionProvider, useAppSession } from './src/context/AppSessionContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { TypographyProvider } from './src/context/TypographyContext';
import { NetworkStatusProvider } from './src/context/NetworkStatusContext';
import { bootstrapStorage } from './src/shims/localStorage';
import { hideScrollIndicatorsGlobally } from './src/logic/hideScrollIndicators';
import ComprensionApp from './src/screens/ComprensionApp';
import { themeColor } from '@shared/design-tokens/generated/tokens';
import { getInitialAppearancePreference } from './src/logic/appearancePreference';

hideScrollIndicatorsGlobally();

/** Boot palette if the token module is still initializing (Metro HMR / require cycle). */
const BOOT_FALLBACK = {
  dark: {
    background: { canvas: '#181A1F' },
    action: { primary: '#8B8FF5' },
    text: { body: '#D4D4DC' },
  },
  light: {
    background: { canvas: '#F7F7FB' },
    action: { primary: '#5B60D4' },
    text: { body: '#33343F' },
  },
} as const;

function bootPalette(scheme: 'light' | 'dark') {
  return themeColor?.[scheme] ?? BOOT_FALLBACK[scheme];
}

function resolveBootScheme(): 'light' | 'dark' {
  const preference = getInitialAppearancePreference();
  if (preference === 'light' || preference === 'dark') return preference;
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

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

function BetaQuotaHost() {
  const session = useAppSession();
  return (
    <BetaQuotaSheet
      visible={session.betaQuotaOpen}
      onClose={() => session.setBetaQuotaOpen(false)}
      onLogin={() => {
        session.setBetaQuotaOpen(false);
        session.openAuthSheet();
      }}
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
  const { isDark, colors } = useTheme();
  return (
    <View className="flex-1 bg-base" style={{ flex: 1, backgroundColor: colors.background.canvas }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppSessionProvider>
        <View style={{ flex: 1 }}>
          <ComprensionApp />
          <AuthHost />
          <BetaQuotaHost />
          <PaywallHost />
          <OAuthRedirectListener />
          {__DEV__ ? <DevPreviewDeepLink /> : null}
        </View>
      </AppSessionProvider>
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootScheme, setBootScheme] = useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'light' ? 'light' : 'dark'
  );
  const [fontsLoaded, fontError] = useFonts({
    SourceSans3: require('./assets/fonts/SourceSans3-wght.ttf'),
  });

  useEffect(() => {
    const provisional = Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
    try {
      Uniwind.setTheme(provisional);
    } catch (error) {
      console.warn('Uniwind.setTheme failed', provisional, error);
    }
    bootstrapStorage()
      .then(() => {
        const scheme = resolveBootScheme();
        try {
          Uniwind.setTheme(scheme);
        } catch (error) {
          console.warn('Uniwind.setTheme failed', scheme, error);
        }
        setBootScheme(scheme);
        setReady(true);
      })
      .catch((error) => {
        console.error(error);
        setBootError('No se pudo inicializar el almacenamiento local.');
        setReady(true);
      });
  }, []);

  const bootColors = bootPalette(bootScheme);

  if (!ready || (!fontsLoaded && !fontError)) {
    return (
      <View
        className="flex-1 bg-base items-center justify-center"
        style={{ flex: 1, backgroundColor: bootColors.background.canvas }}
      >
        <ActivityIndicator size="large" color={bootColors.action.primary} />
        <StatusBar style={bootScheme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bootColors.background.canvas }}>
      <SafeAreaProvider>
        {bootError ? (
          <View
            className="flex-1 items-center justify-center px-6 bg-base"
            style={{ backgroundColor: bootColors.background.canvas }}
          >
            <Text className="text-center text-body" style={{ color: bootColors.text.body }}>
              {bootError}
            </Text>
            <StatusBar style={bootScheme === 'dark' ? 'light' : 'dark'} />
          </View>
        ) : (
          // HeroUINativeProvider already owns SafeAreaListener → Uniwind.updateInsets.
          // Nesting a second listener breaks frame/inset measurement (composer dock drifts).
          <HeroUINativeProvider>
            <ThemeProvider>
              <TypographyProvider>
                <NetworkStatusProvider>
                  <AppShell />
                </NetworkStatusProvider>
              </TypographyProvider>
            </ThemeProvider>
          </HeroUINativeProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
