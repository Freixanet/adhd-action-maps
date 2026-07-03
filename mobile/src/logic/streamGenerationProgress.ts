import type { ActionMapData } from './contracts';

export const STREAM_PROGRESS_MILESTONES = [15, 45, 70, 90, 100] as const;

export type StreamLoadPhase = 0 | 1 | 2;

export function isIntroReadyForTransition(map: ActionMapData): boolean {
  return Boolean(
    map.title?.trim() &&
      map.coreIdea?.trim() &&
      map.sourceMetadata?.kind &&
      (map.tldr?.length ?? 0) >= 3
  );
}

export function resolveStreamLoadPhase(map: ActionMapData): StreamLoadPhase {
  if ((map.steps?.length ?? 0) > 0) return 2;
  if (map.coreIdea?.trim()) return 1;
  return 0;
}
