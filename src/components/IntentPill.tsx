import React from 'react';
import type { MapIntent } from '../contracts';

type IntentPillProps = {
  value: MapIntent;
  onChange: (intent: Extract<MapIntent, 'understand' | 'apply'>) => void;
  disabled?: boolean;
};

const OPTIONS: Array<{ id: Extract<MapIntent, 'understand' | 'apply'>; label: string }> = [
  { id: 'understand', label: 'Entender' },
  { id: 'apply', label: 'Aplicar' },
];

export default function IntentPill({ value, onChange, disabled = false }: IntentPillProps) {
  const activeId = value === 'apply' ? 'apply' : 'understand';

  return (
    <div
      role="tablist"
      aria-label="Intención del mapa"
      className="inline-flex items-center rounded-full p-1 bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-xl"
    >
      {OPTIONS.map((option) => {
        const isActive = activeId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`relative min-w-[5.5rem] rounded-full px-4 py-2 text-[14px] font-semibold transition-colors disabled:opacity-50 ${
              isActive
                ? 'bg-white/12 text-[#c7d2fe] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
