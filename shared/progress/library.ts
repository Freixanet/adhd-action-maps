import type { HistoryEntry } from '../history';
import type { LibraryState, LibraryStateFilter } from './types';

export type LibraryStatePresentation = { label: string; detail: string };
const labels: Record<LibraryState, string> = {
  to_start: 'Por empezar', in_progress: 'En curso', action_pending: 'Acción lista', action_active: 'Acción en curso', completed: 'Completado', blocked: 'Necesita contexto',
};

export function libraryStateForEntry(entry: HistoryEntry): LibraryState {
  return entry.session.progress?.state ?? (entry.session.isComplete ? 'completed' : entry.session.currentStep > 0 || entry.session.viewAll ? 'in_progress' : entry.intent === 'apply' ? 'action_pending' : 'to_start');
}

export function resolveLibraryStatePresentation(entry: HistoryEntry): LibraryStatePresentation {
  const state = libraryStateForEntry(entry);
  const progress = entry.session.progress;
  const detail = progress?.currentStepId ? `Paso ${Math.max(1, progress.currentStepIndex + 1)} de ${progress.totalSteps}` : state === 'completed' ? 'Listo para volver cuando quieras' : 'Sin progreso guardado';
  return { label: labels[state], detail };
}

export function filterEntriesByLibraryState(entries: HistoryEntry[], filter: LibraryStateFilter): HistoryEntry[] {
  if (filter === 'all') return entries;
  if (filter === 'actions') return entries.filter((entry) => ['action_pending', 'action_active', 'blocked'].includes(libraryStateForEntry(entry)));
  return entries.filter((entry) => libraryStateForEntry(entry) === filter);
}

export function countEntriesByLibraryState(entries: HistoryEntry[]): Record<LibraryStateFilter, number> {
  const out: Record<LibraryStateFilter, number> = { all: entries.length, actions: 0, to_start: 0, in_progress: 0, action_pending: 0, action_active: 0, completed: 0, blocked: 0 };
  for (const entry of entries) out[libraryStateForEntry(entry)] += 1;
  out.actions = out.action_pending + out.action_active + out.blocked;
  return out;
}
