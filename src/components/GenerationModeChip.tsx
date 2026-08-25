import React from 'react';
import { FlaskConical } from 'lucide-react';
import type { NucleoGenerationMode } from '@shared/contracts';

type GenerationModeChipProps = {
  value: NucleoGenerationMode;
  onChange: (value: NucleoGenerationMode) => void;
  disabled?: boolean;
};

function nextMode(value: NucleoGenerationMode): NucleoGenerationMode {
  return value === 'study-doc-beta' ? 'classic' : 'study-doc-beta';
}

export default function GenerationModeChip({
  value,
  onChange,
  disabled = false,
}: GenerationModeChipProps) {
  const beta = value === 'study-doc-beta';
  const label = beta ? 'StudyDoc beta' : 'Actual';

  return (
    <button
      type="button"
      onClick={() => onChange(nextMode(value))}
      disabled={disabled}
      aria-label={`Formato temporal: ${label}. Toca para cambiar.`}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-opacity disabled:opacity-40 ${
        beta
          ? 'bg-[rgba(139,143,245,0.12)] text-[#8B8FF5]'
          : 'bg-white/8 text-neutral-300'
      }`}
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="max-w-[92px] truncate">{label}</span>
    </button>
  );
}
