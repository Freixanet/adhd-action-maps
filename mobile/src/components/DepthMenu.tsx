import React from 'react';
import { type MenuAction, type NativeActionEvent } from '@react-native-menu/menu';
import { DEPTH_OPTIONS, type DepthPreference } from '../logic/depthPreference';
import ComposerMenuTrigger from './ComposerMenuTrigger';

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
  disabled = false,
  children,
}: DepthMenuProps) {
  const selectedId: DepthPreference =
    value === 'rapido' || value === 'estandar' ? value : 'estandar';

  const actions: MenuAction[] = DEPTH_OPTIONS.map((item) => ({
    id: item.id,
    title: item.label,
    state: item.id === selectedId ? 'on' : 'off',
  }));

  const handlePress = ({ nativeEvent }: NativeActionEvent) => {
    const id = nativeEvent.event as DepthPreference;
    if (id !== 'rapido' && id !== 'estandar') return;
    if (id === selectedId) return;
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
