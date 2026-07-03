import React from 'react';
import { View } from 'react-native';
import { MenuView, type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import { FEATURES } from '@shared/features';
import { stepHaptic } from '../context/AppSessionContext';
import type { DepthPreference } from '../logic/depthPreference';

type DepthMenuItem = {
  id: DepthPreference;
  title: string;
  subtitle: string;
};

const DEPTH_ITEMS: DepthMenuItem[] = [
  { id: 'rapido', title: 'Rápido', subtitle: '3 pasos · ~1 min' },
  { id: 'estandar', title: 'Estándar', subtitle: '4-6 pasos · ~3 min' },
  { id: 'profundo', title: 'Profundo', subtitle: '7-9 pasos · ~6 min' },
];

type DepthMenuProps = {
  value: DepthPreference;
  onChange: (value: DepthPreference) => void;
  onOpenPaywall?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
};

export default function DepthMenu({
  value,
  onChange,
  onOpenPaywall,
  disabled = false,
  children,
}: DepthMenuProps) {
  const isPro = FEATURES.deepDepth;

  const actions: MenuAction[] = DEPTH_ITEMS.map((item) => {
    const locked = item.id === 'profundo' && !isPro;
    return {
      id: item.id,
      title: item.title,
      subtitle: locked ? `${item.subtitle} · Pro` : item.subtitle,
      state: item.id === value ? 'on' : 'off',
    };
  });

  const handlePress = ({ nativeEvent }: NativeActionEvent) => {
    const id = nativeEvent.event as DepthPreference;
    if (id === 'profundo' && !isPro) {
      onOpenPaywall?.();
      return;
    }
    if (id === value) return;
    onChange(id);
    stepHaptic();
  };

  if (disabled) return <>{children}</>;

  return (
    // Claims the JS touch responder so the composer shell doesn't focus the
    // TextInput (which would open the keyboard). The native menu still opens.
    <View
      onStartShouldSetResponder={() => true}
      onResponderGrant={() => undefined}
      onResponderTerminationRequest={() => false}
    >
      <MenuView
        title="Profundidad"
        actions={actions}
        onPressAction={handlePress}
        shouldOpenOnLongPress={false}
        themeVariant="dark"
      >
        {children}
      </MenuView>
    </View>
  );
}
