import React from 'react';
import type { AttachAnchorRect } from '../hooks/useAttachMenuAnchor';
import AttachMenuPopover, { ATTACH_MENU_WIDTH } from './AttachMenuPopover';
import GlassPopoverMenu from './GlassPopoverMenu';

type AttachMenuOverlayProps = {
  open: boolean;
  anchorRect: AttachAnchorRect | null;
  onClose: () => void;
  onPickImage: () => void;
  onPickCamera: () => void;
  onPickFile: () => void;
  darkSurface?: boolean;
};

export default function AttachMenuOverlay({
  open,
  anchorRect,
  onClose,
  onPickImage,
  onPickCamera,
  onPickFile,
  darkSurface = false,
}: AttachMenuOverlayProps) {
  const runPick = (pick: () => void) => {
    onClose();
    pick();
  };

  return (
    <GlassPopoverMenu
      open={open}
      onClose={onClose}
      anchorRect={anchorRect}
      width={ATTACH_MENU_WIDTH}
      transformOrigin="bottom left"
      accessibilityLabel="Cerrar menú de adjuntos"
    >
      <AttachMenuPopover
        darkSurface={darkSurface}
        onPickImage={() => runPick(onPickImage)}
        onPickCamera={() => runPick(onPickCamera)}
        onPickFile={() => runPick(onPickFile)}
      />
    </GlassPopoverMenu>
  );
}
