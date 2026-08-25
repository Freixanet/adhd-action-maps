import type { ActionMapData, SavedSession } from '../contracts';
import type { SemanticProgressV1, LibraryState, ProgressSurface, ProgressInput } from './types';
import { PROGRESS_SCHEMA_VERSION } from './types';

function mapData(data: ActionMapData | Record<string, unknown>): ActionMapData {
  return data as ActionMapData;
}

function deriveState(session: Pick<SavedSession, 'currentStep' | 'isComplete' | 'viewAll'>, data: ActionMapData): LibraryState {
  const plan = data.application?.plan;
  const application = data.application;
  if (application?.status === 'needs_context' || plan?.status === 'needs_context' || plan?.status === 'abstained') return 'blocked';
  if (application?.status === 'complete' && application.review) return 'completed';
  if (plan?.status === 'completed' || (application?.status === 'complete' && !plan)) return 'completed';
  if (plan?.status === 'in_progress' || plan?.startedAt) return 'action_active';
  if (plan?.status === 'ready' || plan?.status === 'provisional') return 'action_pending';
  if (session.isComplete) return 'completed';
  if (session.currentStep > 0 || session.viewAll) return 'in_progress';
  return data.intent === 'apply' ? 'action_pending' : 'to_start';
}

function deriveSurface(data: ActionMapData, state: LibraryState): ProgressSurface {
  if (data.intent === 'apply' || state === 'action_pending' || state === 'action_active' || state === 'blocked') return 'application';
  return 'reading';
}

export function deriveSemanticProgress(session: ProgressInput, data: ActionMapData | Record<string, unknown> = session.data, now = Date.now()): SemanticProgressV1 {
  const model = mapData(data);
  const steps = Array.isArray(model.steps) ? model.steps : [];
  const totalSteps = steps.length;
  const rawIndex = Number.isFinite(session.currentStep) ? Math.trunc(session.currentStep) - 1 : -1;
  const currentStepIndex = rawIndex >= 0 && rawIndex < totalSteps ? rawIndex : Math.max(0, Math.min(rawIndex, totalSteps - 1));
  const completedCount = Math.max(0, Math.min(totalSteps, session.isComplete ? totalSteps : currentStepIndex));
  const current = steps[currentStepIndex];
  const completedStepIds = steps.slice(0, completedCount).map((step) => step.id).filter(Boolean);
  const remainingStepIds = steps.slice(completedCount).map((step) => step.id).filter(Boolean);
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    state: deriveState(session, model),
    surface: deriveSurface(model, deriveState(session, model)),
    currentStepId: current?.id ?? null,
    currentStepIndex,
    completedStepIds,
    remainingStepIds,
    totalSteps,
    completedSteps: completedCount,
    layer0Passed: Boolean(session.layer0Passed),
    layer0CheckedActionIds: Array.isArray(session.layer0CheckedActionIds) ? [...session.layer0CheckedActionIds] : [],
    viewAll: Boolean(session.viewAll),
    applicationStatus: model.application?.status ?? null,
    applicationPlanId: model.application?.plan?.id ?? null,
    snapshotAt: now,
  };
}

export function sessionWithSemanticProgress(session: SavedSession, data: ActionMapData | Record<string, unknown> = session.data, now = Date.now()): SavedSession {
  return { ...session, progress: deriveSemanticProgress(session, data, now) };
}
