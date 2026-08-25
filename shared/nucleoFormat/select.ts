import type { SourceGenre, DiscourseStructure } from '../understanding/types';
import type { NucleoFormatId } from './types';

export type NucleoFormatSignals = {
  genre?: SourceGenre | string | null;
  discourseStructure?: DiscourseStructure | string | null;
};

/**
 * Pick the reading shape from the source's job.
 * Discourse wins: it is what the reader must do. Genre is a tie-break.
 */
export function selectNucleoFormat(signals: NucleoFormatSignals): NucleoFormatId {
  const discourse = (signals.discourseStructure || '').trim().toLowerCase();
  const genre = (signals.genre || '').trim().toLowerCase();

  if (discourse === 'comparative') return 'contrast';
  if (discourse === 'causal') return 'causal';
  if (discourse === 'chronological') return 'sequence';
  if (discourse === 'procedural' || genre === 'procedural') return 'process';
  if (discourse === 'problem_solution' || genre === 'argumentative') return 'argument';
  if (discourse === 'conceptual' || genre === 'explanatory') return 'concept';
  if (genre === 'narrative') return 'sequence';
  return 'reading';
}
