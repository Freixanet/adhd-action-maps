/**
 * S06 policy: which evidence may ground an affirmative application.
 */

import type { ClaimPresentationStatus, ContentClaim } from '../evidence/types';
import type { AdaptationRisk, ApplicationCandidateV1 } from './types';

const BLOCKED_FOR_AFFIRMATIVE: ReadonlySet<ClaimPresentationStatus> = new Set([
  'contradicted',
  'degraded',
  'insufficient',
  'pending',
]);

export function mayGroundAffirmativeAction(
  status: ClaimPresentationStatus
): boolean {
  return status === 'verified' || status === 'qualified' || status === 'inference';
}

export function isBlockedAffirmativeStatus(
  status: ClaimPresentationStatus
): boolean {
  return BLOCKED_FOR_AFFIRMATIVE.has(status);
}

/** Infer risk from claim/source text — fail closed on medical/legal/etc. */
export function classifyAdaptationRisk(
  texts: string[]
): AdaptationRisk {
  const blob = texts.join('\n').toLowerCase();
  if (
    /\b(diagn[oó]stico|medicaci[oó]n|dosis|psiquiat|terapia\s+farmac|tdah\s+cl[ií]nico|adhd\s+diagnos)\b/i.test(
      blob
    )
  ) {
    return 'high_medical';
  }
  if (/\b(ansiedad\s+cl[ií]nica|depresi[oó]n\s+mayor|suicidio|trauma\s+cl[ií]nico)\b/i.test(blob)) {
    return 'high_psychological';
  }
  if (/\b(contrato|demanda|abogado|legalmente|juicio)\b/i.test(blob)) {
    return 'high_legal';
  }
  if (/\b(invertir|acciones|cripto|pr[eé]stamo|deuda|aportaci[oó]n\s+financiera)\b/i.test(blob)) {
    return 'high_financial';
  }
  if (/\b(levantamiento\s+pesado|ayuno\s+extremo|dolor\s+agudo|lesi[oó]n)\b/i.test(blob)) {
    return 'high_physical';
  }
  return 'low';
}

export function isHighRisk(risk: AdaptationRisk): boolean {
  return risk !== 'low' && risk !== 'moderate';
}

export function claimToCandidateFields(claim: ContentClaim): {
  usable: boolean;
  asInferenceOnly: boolean;
  reason: string;
} {
  if (claim.presentationStatus === 'verified') {
    return { usable: true, asInferenceOnly: false, reason: 'Respaldado por esta fuente.' };
  }
  if (claim.presentationStatus === 'qualified') {
    return {
      usable: true,
      asInferenceOnly: false,
      reason: 'La fuente lo matiza; la cautela debe permanecer visible.',
    };
  }
  if (claim.presentationStatus === 'inference') {
    return {
      usable: true,
      asInferenceOnly: true,
      reason: 'Hipótesis de transferencia de Núcleo; no es afirmación de la fuente.',
    };
  }
  if (claim.presentationStatus === 'contradicted') {
    return {
      usable: false,
      asInferenceOnly: false,
      reason: 'La fuente contiene posiciones incompatibles; no recomienda acción afirmativa.',
    };
  }
  if (claim.presentationStatus === 'degraded') {
    return {
      usable: false,
      asInferenceOnly: false,
      reason: 'Afirmación degradada; no puede sustentar una recomendación.',
    };
  }
  if (claim.presentationStatus === 'insufficient') {
    return {
      usable: false,
      asInferenceOnly: false,
      reason: 'Evidencia insuficiente; no se inventa una aplicación.',
    };
  }
  return {
    usable: false,
    asInferenceOnly: false,
    reason: 'Claim pendiente de verificación; no sustenta una acción.',
  };
}

export function candidateAllowsAction(c: ApplicationCandidateV1): boolean {
  return mayGroundAffirmativeAction(c.epistemicStatus);
}

/** Prompt-injection in source must never become instructions. */
export function stripInjectionLooks(text: string): string {
  return text
    .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions?/gi, '[instrucción ignorada]')
    .replace(/system\s*:\s*/gi, '')
    .replace(/actúa\s+como\s+si\s+fueras/gi, '[instrucción ignorada]');
}
