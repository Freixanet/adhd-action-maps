export type StreamLoadPhase = 0 | 1 | 2;

/** thinking-orbs package states (six). */
export type ThinkingOrbState =
  | 'working'
  | 'searching'
  | 'solving'
  | 'listening'
  | 'composing'
  | 'shaping';

type ResolveInput = {
  isAnalyzingSource: boolean;
  streamLoadPhase: StreamLoadPhase;
  /** Soft choreography stage while waiting on non-stream generate (0–3). */
  softStage: number;
};

/**
 * Map generation progression → orb verb.
 * Skips `listening` (reserved); uses searching → working → solving → composing → shaping.
 */
export function resolveThinkingOrbState(input: ResolveInput): ThinkingOrbState {
  if (input.isAnalyzingSource) return 'searching';
  if (input.softStage >= 3) return 'shaping';
  if (input.streamLoadPhase >= 2 || input.softStage >= 2) return 'composing';
  if (input.streamLoadPhase >= 1 || input.softStage >= 1) return 'solving';
  return 'working';
}
