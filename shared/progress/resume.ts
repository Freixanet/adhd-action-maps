import type { ActionMapData, SavedSession } from '../contracts';
import type { HistoryEntry } from '../history';
import { deriveSemanticProgress } from './deriveProgress';
import { normalizeProgress } from './validateProgress';
import type { SemanticProgressV1 } from './types';

export type ResumeSummary = {
  objective: string;
  untilNow: string;
  point: string;
  remaining: string;
  currentStepId: string | null;
  currentStepIndex: number;
};

export function buildResumeSummary(data: ActionMapData, session: SavedSession): ResumeSummary {
  const progress = normalizeProgress(session, data);
  const current = data.steps?.[progress.currentStepIndex];
  const objective = data.title || 'Este Núcleo';
  const untilNow = progress.completedSteps > 0 ? `${progress.completedSteps} de ${progress.totalSteps} pasos completados.` : 'Aún no has empezado este recorrido.';
  const point = current ? `Ahora: ${current.title}.` : progress.state === 'completed' ? 'Recorrido completado.' : 'Listo para empezar.';
  const remaining = progress.remainingStepIds.length > 0 ? `Quedan ${progress.remainingStepIds.length} pasos.` : 'No quedan pasos pendientes.';
  return { objective, untilNow, point, remaining, currentStepId: progress.currentStepId, currentStepIndex: progress.currentStepIndex };
}

export function restoreResumeUiState(
  data: ActionMapData,
  session: SavedSession
): SavedSession & Required<Pick<SavedSession, 'isComplete' | 'viewAll' | 'layer0Passed' | 'layer0CheckedActionIds'>> {
  const progress = normalizeProgress(session, data);
  const currentStep = progress.currentStepIndex >= 0 ? progress.currentStepIndex + 1 : 0;
  return {
    ...session,
    currentStep,
    isComplete: Boolean(session.isComplete),
    viewAll: progress.viewAll,
    layer0Passed: progress.layer0Passed,
    layer0CheckedActionIds: progress.layer0CheckedActionIds,
    progress,
  };
}

export function selectPrimaryResumeEntry(entries: HistoryEntry[]): HistoryEntry | null {
  const priority: Record<string, number> = { action_active: 0, action_pending: 1, in_progress: 2, blocked: 3, to_start: 4, completed: 5 };
  return [...entries]
    .filter((entry) => entry.session?.progress?.state !== 'completed' && !entry.session?.isComplete)
    .sort((a, b) => {
      const ap = priority[a.session.progress?.state ?? 'in_progress'] ?? 9;
      const bp = priority[b.session.progress?.state ?? 'in_progress'] ?? 9;
      return ap - bp || b.updatedAt - a.updatedAt;
    })[0] ?? null;
}
