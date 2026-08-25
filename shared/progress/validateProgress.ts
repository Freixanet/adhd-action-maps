import type { ActionMapData, SavedSession } from '../contracts';
import { deriveSemanticProgress } from './deriveProgress';
import { isSemanticProgress, type SemanticProgressV1 } from './types';

export function validateSemanticProgress(value: unknown, data?: ActionMapData | Record<string, unknown>): value is SemanticProgressV1 {
  if (!isSemanticProgress(value)) return false;
  if (data && value.totalSteps !== (Array.isArray((data as ActionMapData).steps) ? (data as ActionMapData).steps.length : 0)) return false;
  return true;
}

export function normalizeProgress(session: SavedSession, data: ActionMapData | Record<string, unknown>): SemanticProgressV1 {
  return validateSemanticProgress(session.progress, data)
    ? session.progress
    : deriveSemanticProgress(session, data);
}
