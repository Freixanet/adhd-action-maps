import type { ActionMapData, SavedSession } from '../contracts';

export const PROGRESS_SCHEMA_VERSION = 's07.progress.v1' as const;

export type LibraryState =
  | 'to_start'
  | 'in_progress'
  | 'action_pending'
  | 'action_active'
  | 'completed'
  | 'blocked';

export type LibraryStateFilter = LibraryState | 'actions' | 'all';
export type ProgressSurface = 'overview' | 'reading' | 'application';

export type SemanticProgressV1 = {
  schemaVersion: typeof PROGRESS_SCHEMA_VERSION;
  state: LibraryState;
  surface: ProgressSurface;
  currentStepId: string | null;
  currentStepIndex: number;
  completedStepIds: string[];
  remainingStepIds: string[];
  totalSteps: number;
  completedSteps: number;
  layer0Passed: boolean;
  layer0CheckedActionIds: string[];
  viewAll: boolean;
  applicationStatus: string | null;
  applicationPlanId: string | null;
  snapshotAt: number;
};

export type ProgressInput = Pick<SavedSession, 'currentStep' | 'isComplete' | 'viewAll' | 'layer0Passed' | 'layer0CheckedActionIds'> & {
  data: ActionMapData | Record<string, unknown>;
};

export function isSemanticProgress(value: unknown): value is SemanticProgressV1 {
  const p = value as SemanticProgressV1;
  return Boolean(p && p.schemaVersion === PROGRESS_SCHEMA_VERSION && typeof p.state === 'string' && typeof p.snapshotAt === 'number');
}
