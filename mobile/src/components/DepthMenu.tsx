import React from 'react';
import { type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import type { DepthPreference } from '../logic/depthPreference';
import { useAppSession } from '../context/AppSessionContext';
import ComposerMenuTrigger from './ComposerMenuTrigger';

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
  const { isPro } = useAppSession();

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
  };

  if (disabled) return <>{children}</>;

  return (
    <ComposerMenuTrigger
      title="Profundidad"
      actions={actions}
      onPressAction={handlePress}
      accessibilityLabel="Profundidad"
    >
      {children}
    </ComposerMenuTrigger>
  );
}
