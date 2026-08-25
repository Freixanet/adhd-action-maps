/**
 * Apply user edits to editable assumptions only — ids stay compiler-owned.
 */

import type { ApplicationArtifactV1 } from './types';
import { validateApplicationArtifact } from './validate';

export function applyEditableAssumptionTexts(
  artifact: ApplicationArtifactV1,
  edits: Record<string, string>
): ApplicationArtifactV1 | null {
  const nextAssumptions = artifact.plan.assumptions.map((a) => {
    if (!a.editable) return a;
    const text = edits[a.id];
    if (typeof text !== 'string') return a;
    return { ...a, text: text.trim().slice(0, 400) };
  });
  for (const id of Object.keys(edits)) {
    if (!artifact.plan.assumptions.some((a) => a.id === id && a.editable)) {
      return null;
    }
  }
  const next: ApplicationArtifactV1 = {
    ...artifact,
    plan: { ...artifact.plan, assumptions: nextAssumptions },
  };
  const validated = validateApplicationArtifact(next);
  return validated.ok ? validated.value : null;
}
