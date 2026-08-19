import type { ThinkingOrbState } from '@shared/resolveThinkingOrbState';
import type { StreamLoadPhase } from '@shared/resolveThinkingOrbState';

export type GenerationPhaseStep = {
  id: string;
  label: string;
  orb: ThinkingOrbState;
};

/** Perplexity-style trail — S04 Entender stage copy (human, no technical jargon). */
export const GENERATION_PHASE_STEPS: GenerationPhaseStep[] = [
  { id: 'searching', label: 'Analizando la fuente…', orb: 'searching' },
  { id: 'working', label: 'Comprendiendo la estructura…', orb: 'working' },
  { id: 'solving', label: 'Preparando Lo esencial…', orb: 'solving' },
  { id: 'composing', label: 'Conectando las ideas…', orb: 'composing' },
  { id: 'shaping', label: 'Terminando tu Núcleo…', orb: 'shaping' },
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

export {
  buildDeliveryMessageFallback,
  pickReadyAssistantMessage,
  pickReadyAssistantMessageFromMap,
  softClipDeliveryMessage,
  type ReadyAssistantMessageInput,
} from '@shared/deliveryMessage';
