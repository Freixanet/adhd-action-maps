import type { HistoryEntry } from './history';

function parseStepMinutes(steps: Array<{ time?: string }> | undefined): number | null {
  if (!steps?.length) return null;
  let total = 0;
  let found = false;
  for (const step of steps) {
    const match = String(step.time || '').match(/(\d+)\s*min/i);
    if (match) {
      total += parseInt(match[1] ?? '0', 10);
      found = true;
    }
  }
  return found ? total : null;
}

export type ContinueProgress = {
  pasoActual: number;
  totalPasos: number;
  remainingMinutes: number | null;
  progress: number;
  metaLabel: string;
};

/** Progress copy for the Home Continuar card (SPEC §5.1). */
export function resolveContinueProgress(entry: HistoryEntry): ContinueProgress {
  const steps = Array.isArray(entry.session.data?.steps)
    ? (entry.session.data.steps as Array<{ time?: string }>)
    : [];
  const totalPasos = Math.max(1, steps.length);
  const rawStep = Number(entry.session.currentStep) || 0;
  // currentStep 0 = intro; reading steps are 1..n
  const pasoActual = Math.min(Math.max(rawStep <= 0 ? 1 : rawStep, 1), totalPasos);
  const remainingMinutes = parseStepMinutes(steps.slice(Math.max(0, pasoActual - 1)));
  const progress = totalPasos > 0 ? pasoActual / totalPasos : 0;
  const remaining =
    remainingMinutes && remainingMinutes > 0 ? ` · ~${remainingMinutes} min restantes` : '';
  return {
    pasoActual,
    totalPasos,
    remainingMinutes,
    progress,
    metaLabel: `Paso ${pasoActual} de ${totalPasos}${remaining}`,
  };
}

export function sourceTypeLabel(sourceType: HistoryEntry['sourceType']): string {
  switch (sourceType) {
    case 'youtube':
      return 'YouTube';
    case 'link':
      return 'Enlace';
    case 'pdf':
      return 'PDF';
    case 'file':
      return 'Archivo';
    case 'text':
    default:
      return 'Texto';
  }
}

/** Recientes for Home: up to 3, newest first, excluding the active Continuar entry. */
export function selectHomeRecents(
  entries: HistoryEntry[],
  continueId: string | null,
  limit = 3
): HistoryEntry[] {
  return [...entries]
    .filter((entry) => entry.id !== continueId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function countNucleosThisWeek(entries: HistoryEntry[], now = Date.now()): number {
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => entry.updatedAt >= weekAgo || entry.createdAt >= weekAgo).length;
}
