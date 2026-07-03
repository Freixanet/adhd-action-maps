import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogIn, LogOut } from 'lucide-react-native';
import ProfileAvatar from './ProfileAvatar';
import GlassSurface from './GlassSurface';
import { FloatingGlassShell, FLOATING_CIRCLE_SIZE } from './FloatingGlassButton';
import { useAppSession, stepHaptic } from '../context/AppSessionContext';
import { TEXT_PRIMARY } from '@shared/uiTokens';

type ProfileMenuProps = {
  placement?: 'topRight' | 'bottomLeft';
  floating?: boolean;
};

const MENU_WIDTH = 168;
const MENU_GAP = 10;
const SCREEN = Dimensions.get('window');

type MenuAnchor = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function ProfileMenu({ placement = 'topRight', floating = false }: ProfileMenuProps) {
  const session = useAppSession();
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const updateAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((left, top, width, height) => {
      setAnchor({ left, top, width, height });
    });
  }, []);

  React.useEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    updateAnchor();
  }, [open, updateAnchor]);

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

  const menuIconColor = TEXT_PRIMARY;
  const iconStroke = 2.25;

  return (
    <>
      <View ref={anchorRef} collapsable={false} className="relative z-50">
        <Pressable
          onPress={() => {
            setOpen((current) => !current);
            stepHaptic();
          }}
          accessibilityRole="button"
          accessibilityLabel={session.cloudSignedIn ? 'Tu cuenta' : 'Cuenta y ajustes'}
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
                  {session.cloudSignedIn ? (
                    <Pressable
                      onPress={() => {
                        closeMenu();
                        void session.handleSignOut();
                        stepHaptic();
                      }}
                      accessibilityRole="menuitem"
                      accessibilityLabel="Cerrar sesión"
                      className="px-2.5 py-4 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
                    >
                      <LogOut size={20} color={menuIconColor} strokeWidth={iconStroke} />
                      <Text className="text-base font-semibold text-body">Cerrar sesión</Text>
                    </Pressable>
                  ) : session.isCloudSyncConfigured ? (
                    <Pressable
                      onPress={() => {
                        closeMenu();
                        session.openAuthSheet();
                        stepHaptic();
                      }}
                      accessibilityRole="menuitem"
                      accessibilityLabel="Iniciar sesión"
                      className="px-2.5 py-4 flex-row items-center gap-3 rounded-chip active:bg-white/[0.06]"
                    >
                      <LogIn size={20} color={menuIconColor} strokeWidth={iconStroke} />
                      <Text className="text-base font-semibold text-body">Iniciar sesión</Text>
                    </Pressable>
                  ) : null}
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
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  menuHost: {
    position: 'absolute',
  },
});
