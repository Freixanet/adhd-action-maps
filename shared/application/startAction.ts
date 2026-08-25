/**
 * Minimal S06 execution transition — not S07 progress.
 */

import type { ApplicationArtifactV1 } from './types';
import { validateApplicationArtifact } from './validate';

export function startApplicationAction(
  artifact: ApplicationArtifactV1,
  startedAt = new Date().toISOString()
): ApplicationArtifactV1 | null {
  if (!artifact.plan.action) return null;
  if (
    artifact.plan.status !== 'ready' &&
    artifact.plan.status !== 'provisional' &&
    artifact.plan.status !== 'in_progress'
  ) {
    return null;
  }
  const next: ApplicationArtifactV1 = {
    ...artifact,
    plan: {
      ...artifact.plan,
      status: 'in_progress',
      startedAt: artifact.plan.startedAt ?? startedAt,
    },
    status: artifact.status === 'provisional' ? 'provisional' : 'complete',
  };
  const validated = validateApplicationArtifact(next);
  return validated.ok ? validated.value : null;
}
