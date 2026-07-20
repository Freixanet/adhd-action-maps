import React from 'react';

type NucleoWordmarkProps = {
  className?: string;
  onLongPress?: () => void;
};

/** CSS approximation of the engraved iOS `nucleo` wordmark (no Skia). */
export default function NucleoWordmark({ className = '', onLongPress }: NucleoWordmarkProps) {
  return (
    <button
      type="button"
      onContextMenu={(event) => {
        if (!onLongPress) return;
        event.preventDefault();
        onLongPress();
      }}
      className={`select-none border-0 bg-transparent p-0 ${className}`}
      aria-label="nucleo"
    >
      <span
        className="block text-[40px] font-semibold tracking-[-0.04em] leading-none"
        style={{
          backgroundImage: 'linear-gradient(180deg, #1e1e1e 0%, #2a2a2a 48%, #363636 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          textShadow: '0 1px 0 rgba(255,255,255,0.14), 0 -1px 0 rgba(0,0,0,0.35)',
        }}
      >
        nucleo
      </span>
    </button>
  );
}
