import React, { useCallback, useRef, useState } from 'react';
import { Alert, Dimensions, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, FileText, LogIn, LogOut, Settings, Trash2 } from '../icons';
import ProfileAvatar from './ProfileAvatar';
import GlassSurface from './GlassSurface';
import NativeGlassButton from './NativeGlassButton';
import { FloatingGlassShell, FLOATING_CIRCLE_SIZE } from './FloatingGlassButton';
import { useGlassAccessibility } from '../hooks/useGlassAccessibility';
import { shouldUseNativeGlassButton } from '../logic/nativeGlassButtons';
import { useAppSession, stepHaptic } from '../context/AppSessionContext';
import { privacyPolicyUrl, termsOfUseUrl } from '../logic/legalUrls';
import { SEM_ALERTA, TEXT_BODY, TEXT_PRIMARY } from '@shared/uiTokens';
import { useTheme } from '../context/ThemeContext';

type ProfileMenuProps = {
  placement?: 'topRight' | 'bottomLeft';
  floating?: boolean;
};

type MenuPanel = 'root' | 'settings';

const MENU_WIDTH = 196;
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
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  destructive?: boolean;
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
        style={destructive ? { color: SEM_ALERTA } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileMenu({ placement = 'topRight', floating = false }: ProfileMenuProps) {
  const session = useAppSession();
  const { isDark } = useTheme();
  const { reduceTransparency } = useGlassAccessibility();
  const nativeGlass = shouldUseNativeGlassButton(reduceTransparency);
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

  const menuIconColor = isDark ? TEXT_PRIMARY : TEXT_BODY;
  const iconStroke = 2.25;

  const toggleMenu = () => {
    setOpen((current) => !current);
    stepHaptic();
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
        <View style={styles.modalRoot}>
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
                <View className="py-2 px-2">
                  {panel === 'root' ? (
                    <>
                      <Pressable
                        onPress={() => {
                          setPanel('settings');
                          stepHaptic();
                        }}
                        accessibilityRole="menuitem"
                        accessibilityLabel="Ajustes"
                        className="px-2.5 py-3.5 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
                      >
                        <Settings size={20} color={menuIconColor} strokeWidth={iconStroke} />
                        <Text className="flex-1 text-base font-semibold text-body">Ajustes</Text>
                        <ChevronRight size={16} color={menuIconColor} strokeWidth={iconStroke} />
                      </Pressable>

                      {session.cloudSignedIn ? (
                        <MenuRow
                          label="Cerrar sesión"
                          icon={<LogOut size={20} color={menuIconColor} strokeWidth={iconStroke} />}
                          onPress={() => {
                            closeMenu();
                            void session.handleSignOut();
                            stepHaptic();
                          }}
                        />
                      ) : session.isCloudSyncConfigured ? (
                        <MenuRow
                          label="Iniciar sesión"
                          icon={<LogIn size={20} color={menuIconColor} strokeWidth={iconStroke} />}
                          onPress={() => {
                            closeMenu();
                            session.openAuthSheet();
                            stepHaptic();
                          }}
                        />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <MenuRow
                        label="Privacidad"
                        icon={<FileText size={20} color={menuIconColor} strokeWidth={iconStroke} />}
                        onPress={() => {
                          void openLegalUrl(privacyPolicyUrl(), 'Privacidad');
                          stepHaptic();
                        }}
                      />
                      <MenuRow
                        label="Términos"
                        icon={<FileText size={20} color={menuIconColor} strokeWidth={iconStroke} />}
                        onPress={() => {
                          void openLegalUrl(termsOfUseUrl(), 'Términos');
                          stepHaptic();
                        }}
                        accessibilityLabel="Términos de uso"
                      />
                      {session.cloudSignedIn ? (
                        <MenuRow
                          label="Eliminar cuenta"
                          destructive
                          icon={<Trash2 size={20} color={SEM_ALERTA} strokeWidth={iconStroke} />}
                          onPress={() => {
                            confirmDeleteAccount();
                            stepHaptic();
                          }}
                        />
                      ) : null}
                    </>
                  )}
                </View>
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
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  menuHost: {
    position: 'absolute',
  },
});
