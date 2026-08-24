import React, { useCallback, useRef, useState } from 'react';
import { Alert, Dimensions, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, ChevronRight, Cpu, FileText, LogIn, LogOut, Settings, Trash2 } from '../icons';
import ProfileAvatar from './ProfileAvatar';
import GlassSurface from './GlassSurface';
import NativeGlassButton from './NativeGlassButton';
import { FloatingGlassShell, FLOATING_CIRCLE_SIZE } from './FloatingGlassButton';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { shouldUseNativeGlassButton } from '../logic/nativeGlassButtons';
import { useAppSession } from '../context/AppSessionContext';
import { privacyPolicyUrl, termsOfUseUrl } from '../logic/legalUrls';
import type { ModelPreference } from '@shared/modelPreference';
import { useTheme } from '../context/ThemeContext';
import { useTypography } from '../context/TypographyContext';
import { typography } from '@shared/design-tokens';
import { hapticSegment } from '../logic/haptics';

type ProfileMenuProps = {
  placement?: 'topRight' | 'bottomLeft';
  floating?: boolean;
};

type MenuPanel = 'root' | 'settings';

const DEV_MODEL_OPTIONS: ReadonlyArray<{ id: ModelPreference; label: string; hint: string }> = [
  { id: 'auto', label: 'Automático', hint: '3.7 Flash, luego Lite' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash', hint: 'Principal' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', hint: 'Rápido / pruebas' },
];

const MENU_WIDTH = 272;
const MENU_GAP = 10;
const SCREEN = Dimensions.get('window');

type MenuAnchor = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function MenuRow({
  label,
  icon,
  onPress,
  accessibilityLabel,
  destructive = false,
  destructiveColor,
  font,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  destructive?: boolean;
  destructiveColor?: string;
  font: { family: string };
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={accessibilityLabel ?? label}
      className="px-2.5 py-3.5 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
    >
      {icon}
      <Text
        className={`flex-1 text-base font-semibold ${destructive ? '' : 'text-body'}`}
        style={destructive ? { color: destructiveColor, fontFamily: font.family } : { fontFamily: font.family }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileMenu({ placement = 'topRight', floating = false }: ProfileMenuProps) {
  const session = useAppSession();
  const { colors, preference, setPreference, options: appearanceOptions } = useTheme();
  const { readingSize, setReadingSize, options: readingSizeOptions, readingFont, setReadingFont, fontOptions, font } =
    useTypography();
  const { reduceTransparency } = useGlassAccessibility();
  const nativeGlass = shouldUseNativeGlassButton(reduceTransparency);
  const menuIconColor = colors.icon.primary;
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<MenuPanel>('root');
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setPanel('root');
  }, []);

  const updateAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((left, top, width, height) => {
      setAnchor({ left, top, width, height });
    });
  }, []);

  React.useEffect(() => {
    if (!open) {
      setAnchor(null);
      setPanel('root');
      return;
    }
    updateAnchor();
  }, [open, updateAnchor]);

  const openLegalUrl = useCallback(
    async (url: string, label: string) => {
      closeMenu();
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('No se pudo abrir', `No se pudo abrir ${label}.`);
      }
    },
    [closeMenu]
  );

  const confirmDeleteAccount = useCallback(() => {
    closeMenu();
    Alert.alert(
      'Eliminar cuenta',
      'Se borrarán tu cuenta y el historial en la nube. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '¿Eliminar de verdad?',
              'Si fue un error, cancela ahora. Si confirmas, la cuenta se elimina de forma permanente.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar cuenta',
                  style: 'destructive',
                  onPress: () => {
                    void session.handleDeleteAccount().catch((err: unknown) => {
                      const message =
                        err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.';
                      Alert.alert('Error', message);
                    });
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [closeMenu, session]);

  const menuPosition = anchor
    ? placement === 'bottomLeft'
      ? {
          left: Math.max(12, Math.min(anchor.left, SCREEN.width - MENU_WIDTH - 12)),
          bottom: SCREEN.height - anchor.top + MENU_GAP,
        }
      : {
          left: Math.max(
            12,
            Math.min(anchor.left + anchor.width - MENU_WIDTH, SCREEN.width - MENU_WIDTH - 12)
          ),
          top: anchor.top + anchor.height + MENU_GAP,
        }
    : null;

  const toggleMenu = () => {
    setOpen((current) => !current);
  };

  const anchorLabel = session.cloudSignedIn ? 'Tu cuenta' : 'Cuenta y ajustes';

  return (
    <>
      <View ref={anchorRef} collapsable={false} className="relative z-50">
        {floating && nativeGlass ? (
          <NativeGlassButton
            onPress={toggleMenu}
            accessibilityLabel={anchorLabel}
            style={styles.floatingAnchor}
          >
            <ProfileAvatar
              signedIn={session.cloudSignedIn}
              avatarUrl={session.cloudUserAvatarUrl}
              floating
            />
          </NativeGlassButton>
        ) : (
          <Pressable
            onPress={toggleMenu}
            accessibilityRole="button"
            accessibilityLabel={anchorLabel}
            accessibilityState={{ expanded: open }}
            className={floating ? 'active:opacity-80' : 'rounded-xl p-1 active:opacity-80'}
          >
            {floating ? (
              <FloatingGlassShell shape="circle" size={FLOATING_CIRCLE_SIZE} prominent>
                <ProfileAvatar
                  signedIn={session.cloudSignedIn}
                  avatarUrl={session.cloudUserAvatarUrl}
                  floating
                />
              </FloatingGlassShell>
            ) : (
              <ProfileAvatar
                signedIn={session.cloudSignedIn}
                avatarUrl={session.cloudUserAvatarUrl}
              />
            )}
          </Pressable>
        )}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background.scrim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeMenu}
            accessibilityLabel="Cerrar menú de cuenta"
          />
          {menuPosition ? (
            <View
              pointerEvents="box-none"
              style={[styles.menuHost, menuPosition, { width: MENU_WIDTH }]}
              accessibilityRole="menu"
            >
              <GlassSurface liquid borderRadius={16} className="rounded-card shadow-xl">
                <ScrollView
                  className="py-2 px-2"
                  style={styles.menuScroll}
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                >
                  {panel === 'root' ? (
                    <>
                      <Pressable
                        onPress={() => {
                          setPanel('settings');
                        }}
                        accessibilityRole="menuitem"
                        accessibilityLabel="Ajustes"
                        className="px-2.5 py-3.5 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
                      >
                        <Settings size={20} color={menuIconColor} />
                        <Text
                          className="flex-1 text-base font-semibold text-body"
                          style={{ fontFamily: font.family }}
                        >
                          Ajustes
                        </Text>
                        <ChevronRight size={16} color={menuIconColor} />
                      </Pressable>

                      <MenuRow
                        font={font}
                        label={session.devToolsEnabled ? 'Salir de modo DEV' : 'Entrar en modo DEV'}
                        icon={<Cpu size={20} color={menuIconColor} />}
                        onPress={() => {
                          session.setDevToolsEnabled(!session.devToolsEnabled);
                          closeMenu();
                        }}
                        accessibilityLabel={
                          session.devToolsEnabled
                            ? 'Salir de modo desarrollador'
                            : 'Entrar en modo desarrollador'
                        }
                      />

                      {session.cloudSignedIn ? (
                        <MenuRow
                          font={font}
                          label="Cerrar sesión"
                          icon={<LogOut size={20} color={menuIconColor} />}
                          onPress={() => {
                            closeMenu();
                            void session.handleSignOut();
                          }}
                        />
                      ) : session.isCloudSyncConfigured ? (
                        <MenuRow
                          font={font}
                          label="Iniciar sesión"
                          icon={<LogIn size={20} color={menuIconColor} />}
                          onPress={() => {
                            closeMenu();
                            session.openAuthSheet();
                          }}
                        />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <View className="px-2.5 pt-1 pb-3">
                        <Text
                          className="text-meta font-bold uppercase tracking-widest text-secondary"
                          style={{ fontFamily: font.family }}
                        >
                          Apariencia
                        </Text>
                        <Text
                          className="mt-1 text-sm leading-5 text-secondary"
                          style={{ fontFamily: font.family }}
                        >
                          Sigue el sistema o fíjala en claro u oscuro.
                        </Text>
                      </View>
                      {appearanceOptions.map((option) => {
                        const selected = option.id === preference;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => {
                              setPreference(option.id);
                              hapticSegment();
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`Apariencia: ${option.label}`}
                            className="px-2.5 py-3 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
                          >
                            <CheckCircle2
                              size={18}
                              color={selected ? colors.action.primary : colors.text.muted}
                              filled={selected}
                            />
                            <Text
                              className="flex-1 text-base font-semibold text-body"
                              style={{ fontFamily: font.family }}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <View className="px-2.5 pt-3 pb-3">
                        <Text
                          className="text-meta font-bold uppercase tracking-widest text-secondary"
                          style={{ fontFamily: font.family }}
                        >
                          Fuente
                        </Text>
                        <Text
                          className="mt-1 text-sm leading-5 text-secondary"
                          style={{ fontFamily: font.family }}
                        >
                          Cambia y mira la muestra. En iOS, Rounded no es el mismo corte que SF Pro.
                        </Text>
                      </View>
                      {fontOptions.map((option) => {
                        const selected = option.id === readingFont;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => {
                              setReadingFont(option.id);
                              hapticSegment();
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`Fuente: ${option.label}`}
                            className="px-2.5 py-3 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
                          >
                            <CheckCircle2
                              size={18}
                              color={selected ? colors.action.primary : colors.text.muted}
                              filled={selected}
                            />
                            <Text
                              className="flex-1 text-base font-semibold text-body"
                              style={{ fontFamily: font.family }}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <View className="px-2.5 pb-3">
                        <Text
                          style={[
                            typography('heading'),
                            { color: colors.text.primary, fontFamily: font.family },
                          ]}
                        >
                          caso, oso, año
                        </Text>
                        <Text
                          style={[
                            typography('body'),
                            { marginTop: 4, color: colors.text.secondary, fontFamily: font.family },
                          ]}
                        >
                          Separa lo importante del ruido
                        </Text>
                      </View>
                      <View className="px-2.5 pt-3 pb-3">
                        <Text
                          className="text-meta font-bold uppercase tracking-widest text-secondary"
                          style={{ fontFamily: font.family }}
                        >
                          Tamaño de lectura
                        </Text>
                        <Text
                          className="mt-1 text-sm leading-5 text-secondary"
                          style={{ fontFamily: font.family }}
                        >
                          Se combina con el tamaño de texto del sistema.
                        </Text>
                      </View>
                      {readingSizeOptions.map((option) => {
                        const selected = option.id === readingSize;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => {
                              setReadingSize(option.id);
                              hapticSegment();
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`Tamaño de lectura: ${option.label}`}
                            className="px-2.5 py-3 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
                          >
                            <CheckCircle2
                              size={18}
                              color={selected ? colors.action.primary : colors.text.muted}
                              filled={selected}
                            />
                            <Text
                              className="flex-1 text-base font-semibold text-body"
                              style={{ fontFamily: font.family }}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <MenuRow
                        font={font}
                        label="Privacidad"
                        icon={<FileText size={20} color={menuIconColor} />}
                        onPress={() => {
                          void openLegalUrl(privacyPolicyUrl(), 'Privacidad');
                        }}
                      />
                      <MenuRow
                        font={font}
                        label="Términos"
                        icon={<FileText size={20} color={menuIconColor} />}
                        onPress={() => {
                          void openLegalUrl(termsOfUseUrl(), 'Términos');
                        }}
                        accessibilityLabel="Términos de uso"
                      />
                      {session.cloudSignedIn ? (
                        <MenuRow
                          font={font}
                          label="Eliminar cuenta"
                          destructive
                          destructiveColor={colors.action.danger}
                          icon={<Trash2 size={20} color={colors.action.danger} />}
                          onPress={() => {
                            confirmDeleteAccount();
                          }}
                        />
                      ) : null}
                      {session.devToolsEnabled ? (
                        <>
                          <View className="px-2.5 pt-3 pb-3">
                            <Text
                              className="text-meta font-bold uppercase tracking-widest text-secondary"
                              style={{ fontFamily: font.family }}
                            >
                              Modelo de IA
                            </Text>
                          </View>
                          {DEV_MODEL_OPTIONS.map((option) => {
                            const selected = option.id === session.modelPreference;
                            return (
                              <Pressable
                                key={option.id}
                                onPress={() => {
                                  session.setModelPreference(option.id);
                                  hapticSegment();
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`Modelo de IA: ${option.label}`}
                                className="px-2.5 py-3 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
                              >
                                <CheckCircle2
                                  size={18}
                                  color={selected ? colors.action.primary : colors.text.muted}
                                  filled={selected}
                                />
                                <View className="flex-1">
                                  <Text
                                    className="text-base font-semibold text-body"
                                    style={{ fontFamily: font.family }}
                                  >
                                    {option.label}
                                  </Text>
                                  <Text
                                    className="mt-0.5 text-sm leading-5 text-secondary"
                                    style={{ fontFamily: font.family }}
                                  >
                                    {option.hint}
                                  </Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </>
                      ) : null}
                      <MenuRow
                        font={font}
                        label={session.devToolsEnabled ? 'Salir de modo DEV' : 'Entrar en modo DEV'}
                        icon={<Cpu size={20} color={menuIconColor} />}
                        onPress={() => {
                          session.setDevToolsEnabled(!session.devToolsEnabled);
                          if (!session.devToolsEnabled) {
                            closeMenu();
                          }
                        }}
                        accessibilityLabel={
                          session.devToolsEnabled
                            ? 'Salir de modo desarrollador'
                            : 'Entrar en modo desarrollador'
                        }
                      />
                    </>
                  )}
                </ScrollView>
              </GlassSurface>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingAnchor: {
    width: FLOATING_CIRCLE_SIZE,
    height: FLOATING_CIRCLE_SIZE,
  },
  modalRoot: {
    flex: 1,
  },
  menuHost: {
    position: 'absolute',
  },
  menuScroll: {
    maxHeight: SCREEN.height * 0.72,
  },
});
