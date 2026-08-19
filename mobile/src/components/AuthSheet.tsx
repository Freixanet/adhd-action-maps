import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, X } from '../icons';
import { signInWithPassword,
  signInWithProvider,
  signUpWithPassword,
} from '../logic/cloudHistory';
import GlassSurface from './GlassSurface';
import { useAppSession } from '../context/AppSessionContext';
import { useThemeColors } from '../context/ThemeContext';
import { type } from '@shared/design-tokens';

type AuthSheetProps = {
  visible: boolean;
  userEmail: string | null;
  onClose: () => void;
};

function authErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'No se pudo completar el acceso.';
  const msg = err.message.toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('user already registered')) return 'Esa cuenta ya existe. Prueba a entrar.';
  if (msg.includes('password') && msg.includes('least'))
    return 'La contraseña debe tener al menos 6 caracteres.';
  return err.message;
}

export default function AuthSheet({ visible, userEmail, onClose }: AuthSheetProps) {
  const session = useAppSession();
  const colors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignedIn = Boolean(userEmail);

  const resetForm = () => {
    setPassword('');
    setError(null);
    setBusy(false);
  };

  const handlePasswordSubmit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
      }
      resetForm();
      onClose();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleProvider = async (provider: 'google' | 'apple') => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const ok = await signInWithProvider(provider);
      if (ok) {
        onClose();
      } else {
        setError('Acceso cancelado.');
        session.setError('Acceso cancelado.');
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await session.handleSignOut();
      onClose();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/*
        Uniwind does not patch SafeAreaView from react-native-safe-area-context,
        so className flex-1 / bg-base are no-ops. Without style flex:1 the sheet
        collapses to the header and the login form never appears.
      */}
      <SafeAreaView
        edges={['top', 'left', 'right', 'bottom']}
        style={{ flex: 1, backgroundColor: colors.background.canvas }}
        className="flex-1 bg-base"
      >
        <GlassSurface liquid borderRadius={0} liquidBorder="bottom">
          <View className="flex-row items-center justify-between px-5 py-4">
            <Text className="text-lg font-bold text-primary">
              {isSignedIn ? 'Tu cuenta' : 'Sincroniza tu historial'}
            </Text>
            <Pressable
              onPress={onClose}
              className="w-9 h-9 rounded-full items-center justify-center bg-neutral-200/80 dark:bg-white/10"
              accessibilityLabel="Cerrar"
            >
              <X size={18} color={colors.icon.muted} />
            </Pressable>
          </View>
        </GlassSurface>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            {isSignedIn ? (
              <View>
                <View className="rounded-2xl border border-neutral-200 border-white/10 bg-white bg-surface-2 px-4 py-4">
                  <Text className="text-meta font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    Cuenta conectada
                  </Text>
                  <Text
                    className="mt-1.5 text-base font-semibold text-primary"
                    numberOfLines={1}
                  >
                    {userEmail}
                  </Text>
                  <Text className="mt-1 text-sm text-secondary leading-5">
                    Tu historial se sincroniza automáticamente entre tus dispositivos.
                  </Text>
                </View>

                <Pressable
                  onPress={() => void handleSignOut()}
                  disabled={busy}
                  className="mt-6 flex-row items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-neutral-200 border-white/10 active:bg-neutral-100 dark:active:bg-white/5"
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.icon.muted} />
                  ) : (
                    <>
                      <LogOut size={18} color={colors.icon.muted} />
                      <Text className="font-semibold text-body">
                        Cerrar sesión
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              <View>
                <Text className="text-sm text-body leading-6 mb-5">
                  Entra para guardar tus Núcleos en la nube y recuperarlos desde cualquier dispositivo.
                </Text>

                <Pressable
                  onPress={() => void handleProvider('google')}
                  disabled={busy}
                  className="flex-row items-center justify-center px-4 py-3.5 rounded-xl border border-neutral-200 border-white/10 bg-white bg-surface-2 active:bg-neutral-100 dark:active:bg-white/5"
                >
                  <Text className="font-semibold text-primary text-primary">
                    Continuar con Google
                  </Text>
                </Pressable>

                {Platform.OS === 'ios' ? (
                  <Pressable
                    onPress={() => void handleProvider('apple')}
                    disabled={busy}
                    className="mt-3 flex-row items-center justify-center px-4 py-3.5 rounded-xl border border-neutral-200 border-white/10 bg-white bg-surface-2 active:bg-neutral-100 dark:active:bg-white/5"
                  >
                    <Text className="font-semibold text-primary text-primary">
                      Continuar con Apple
                    </Text>
                  </Pressable>
                ) : null}

                <View className="flex-row items-center gap-3 my-6">
                  <View className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                  <Text className="text-xs font-medium text-secondary">o con email</Text>
                  <View className="flex-1 h-px bg-neutral-200 dark:bg-white/10" />
                </View>

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@email.com"
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  className="px-4 py-3 rounded-xl border border-neutral-200 border-white/10 bg-white bg-surface-2 text-base text-primary"
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Contraseña (mín. 6)"
                  placeholderTextColor={colors.text.secondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  onSubmitEditing={() => void handlePasswordSubmit()}
                  className="mt-3 px-4 py-3 rounded-xl border border-neutral-200 border-white/10 bg-white bg-surface-2 text-base text-primary"
                />

                <Pressable
                  onPress={() => void handlePasswordSubmit()}
                  disabled={busy || !email.trim() || password.length < 6}
                  className={`mt-4 py-3.5 rounded-xl items-center justify-center ${
                    busy || !email.trim() || password.length < 6
                      ? 'bg-accent/40'
                      : 'bg-accent active:bg-accent-pressed'
                  }`}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.text.onAccent} />
                  ) : (
                    <Text className="text-white font-bold text-base">
                      {isSignUp ? 'Crear cuenta' : 'Entrar'}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setIsSignUp((value) => !value);
                    setError(null);
                  }}
                  className="mt-4 items-center"
                >
                  <Text className="text-sm font-medium text-accent dark:text-accent">
                    {isSignUp ? '¿Ya tienes cuenta? Entrar' : '¿Primera vez? Crear cuenta'}
                  </Text>
                </Pressable>
              </View>
            )}

            {error ? (
              <View className="mt-5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3">
                <Text className="text-sm font-medium text-red-600 dark:text-red-300">{error}</Text>
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
