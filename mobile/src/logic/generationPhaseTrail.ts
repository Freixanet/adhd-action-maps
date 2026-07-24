import type { ThinkingOrbState } from '@shared/resolveThinkingOrbState';
import type { StreamLoadPhase } from '@shared/resolveThinkingOrbState';

export type GenerationPhaseStep = {
  id: string;
  label: string;
  orb: ThinkingOrbState;
};

/** Perplexity-style trail — light copy, one active step with a tiny orb. */
export const GENERATION_PHASE_STEPS: GenerationPhaseStep[] = [
  { id: 'searching', label: 'Analizando la fuente…', orb: 'searching' },
  { id: 'working', label: 'Leyendo el material…', orb: 'working' },
  { id: 'solving', label: 'Sacando la idea central…', orb: 'solving' },
  { id: 'composing', label: 'Montando tu Núcleo…', orb: 'composing' },
  { id: 'shaping', label: 'Ajustando la lectura…', orb: 'shaping' },
];

export function resolveGenerationPhaseIndex(input: {
  isAnalyzingSource: boolean;
  streamLoadPhase: StreamLoadPhase;
  softStage: number;
  /** When true, advance only via softStage so DEV preview is easy to watch. */
  softOnly?: boolean;
}): number {
  if (input.isAnalyzingSource) return 0;
  if (input.softOnly) {
    if (input.softStage >= 3) return 4;
    if (input.softStage >= 2) return 3;
    if (input.softStage >= 1) return 2;
    return 1;
  }
  if (input.softStage >= 3) return 4;
  if (input.streamLoadPhase >= 2 || input.softStage >= 2) return 3;
  if (input.streamLoadPhase >= 1 || input.softStage >= 1) return 2;
  return 1;
}

export function pickReadyAssistantMessage(title?: string | null): string {
  const clean = title?.trim();
  if (clean) {
    return `Listo. Ya tienes «${clean}» preparado para leer.`;
  }
  return 'Listo. Tu Núcleo ya está preparado para leer.';
}
