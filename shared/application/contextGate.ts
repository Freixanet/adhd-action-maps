/**
 * Context gate: needs_context vs provisional vs ready.
 * Model must never invent goals, resources, diagnoses, schedules, or preferences.
 */

import { classifyAdaptationRisk, isHighRisk } from './policy';
import type {
  ApplicationCandidateV1,
  ApplicationContextV1,
  ApplicationPlanStatus,
} from './types';

export type ContextGateResult =
  | {
      status: 'needs_context';
      prompt: string;
      reason: string;
    }
  | {
      status: 'provisional' | 'ready';
      reason: string;
    };

function hasAnyContext(ctx: ApplicationContextV1): boolean {
  return Boolean(
    (ctx.goal && ctx.goal.trim()) ||
      (ctx.situation && ctx.situation.trim()) ||
      (ctx.constraint && ctx.constraint.trim()) ||
      (ctx.horizon && ctx.horizon.trim())
  );
}

function contextIsSufficient(ctx: ApplicationContextV1): boolean {
  // One high-info answer is enough when it states goal OR situation+horizon.
  if (ctx.goal && ctx.goal.trim().length >= 8) return true;
  if (
    (ctx.situation?.trim().length ?? 0) >= 8 &&
    (ctx.horizon?.trim().length ?? 0) >= 3
  ) {
    return true;
  }
  if (
    (ctx.situation?.trim().length ?? 0) >= 8 &&
    (ctx.constraint?.trim().length ?? 0) >= 4
  ) {
    return true;
  }
  return false;
}

export function evaluateContextGate(args: {
  context: ApplicationContextV1;
  candidate: ApplicationCandidateV1 | null;
}): ContextGateResult {
  const risk = classifyAdaptationRisk([
    args.candidate?.claimText ?? '',
    args.context.goal ?? '',
    args.context.situation ?? '',
  ]);

  if (!args.candidate) {
    return {
      status: 'needs_context',
      prompt: '¿Qué resultado concreto quieres probar con esta fuente?',
      reason: 'No hay una idea aplicable segura que adaptar.',
    };
  }

  if (isHighRisk(risk) && !contextIsSufficient(args.context)) {
    return {
      status: 'needs_context',
      prompt:
        'Este contenido toca un área sensible. ¿Cuál es tu objetivo concreto y qué límite no quieres cruzar?',
      reason: 'Sin contexto, una adaptación personalizada elevaría el riesgo.',
    };
  }

  if (contextIsSufficient(args.context)) {
    return { status: 'ready', reason: 'Contexto suficiente para adaptar.' };
  }

  if (!hasAnyContext(args.context) && args.candidate.reversibility === 'high') {
    return {
      status: 'provisional',
      reason:
        'Sin contexto completo: plan provisional reversible con supuestos editables.',
    };
  }

  if (!hasAnyContext(args.context) && args.candidate.reversibility !== 'high') {
    return {
      status: 'needs_context',
      prompt: '¿En qué situación quieres aplicar esta idea, y qué restricción importa más?',
      reason: 'La falta de contexto cambia materialmente la recomendación.',
    };
  }

  // Partial context: if constraint alone may invalidate, ask for goal.
  if (args.context.constraint && !args.context.goal && !args.context.situation) {
    return {
      status: 'needs_context',
      prompt: 'Con esa restricción, ¿qué resultado quieres conseguir?',
      reason: 'Hace falta el resultado buscado para no fingir personalización.',
    };
  }

  return {
    status: 'provisional',
    reason: 'Contexto parcial: supuestos explícitos y editables.',
  };
}

export function planStatusFromGate(
  gate: ContextGateResult
): Extract<ApplicationPlanStatus, 'needs_context' | 'provisional' | 'ready'> {
  return gate.status;
}
