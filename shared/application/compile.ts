/**
 * Deterministic plan builder + compile to ActionMapData.
 * Distinctions sourceBasis / inference / adaptation are first-class in the map body.
 */

import type { ActionMapData, MapStep } from '../contracts';
import type { EvidenceArtifact } from '../evidence/types';
import { compileUnderstandingToMap } from '../understanding/compile';
import {
  buildApplicationIdentitySeed,
  stableActionId,
  stableApplicationId,
  stableAssumptionId,
} from './ids';
import {
  classifyAdaptationRisk,
  isHighRisk,
  stripInjectionLooks,
} from './policy';
import {
  isDangerousHighRiskInstruction,
  safeConsultInstructionForRisk,
} from './highRiskActionGuard';
import { evaluateContextGate, planStatusFromGate } from './contextGate';
import { selectPrimaryCandidate } from './candidates';
import type {
  ApplicationArtifactV1,
  ApplicationCandidateV1,
  ApplicationContextV1,
  ApplicationPlanV1,
} from './types';
import {
  APPLICATION_COMPILER_VERSION,
  APPLICATION_MODEL_ROUTE,
  APPLICATION_POLICY_VERSION,
  APPLICATION_PROMPT_VERSION,
  APPLICATION_SCHEMA_VERSION,
} from './versions';
import { validateApplicationArtifact } from './validate';

function chunkIdsForClaim(
  evidence: EvidenceArtifact,
  claimId: string
): string[] {
  const claim = evidence.claims.find((c) => c.id === claimId);
  if (!claim) return [];
  const ids = new Set<string>();
  for (const linkId of claim.evidenceLinkIds) {
    const link = evidence.links.find((l) => l.id === linkId);
    if (link?.chunkId) ids.add(link.chunkId);
  }
  return [...ids];
}

export function buildDeterministicPlan(args: {
  candidates: ApplicationCandidateV1[];
  evidence: EvidenceArtifact;
  context: ApplicationContextV1;
  contentHash: string;
  depth: string;
  contextCanonicalHash: string;
  sourceId?: string;
  sourceVersionId?: string;
  modelVersion?: string;
  evidenceDigest?: string;
  understandingSchemaVersion?: string;
  understandingPromptVersion?: string;
  understandingCompilerVersion?: string;
  evidenceSchemaVersion?: string;
  evidencePromptVersion?: string;
  evidenceVerifierVersion?: string;
  evidenceCompilerVersion?: string;
  /** When set, force this allow-listed candidate instead of primary score. */
  forcedCandidateId?: string | null;
}): ApplicationArtifactV1 {
  const seed = buildApplicationIdentitySeed({
    contentHash: args.contentHash,
    sourceVersionId: args.sourceVersionId,
    depth: args.depth,
    contextCanonicalHash: args.contextCanonicalHash,
    evidenceDigest: args.evidenceDigest,
    understandingSchemaVersion: args.understandingSchemaVersion,
    understandingPromptVersion: args.understandingPromptVersion,
    understandingCompilerVersion: args.understandingCompilerVersion,
    evidenceSchemaVersion: args.evidenceSchemaVersion,
    evidencePromptVersion: args.evidencePromptVersion,
    evidenceVerifierVersion: args.evidenceVerifierVersion,
    evidenceCompilerVersion: args.evidenceCompilerVersion,
  });
  const primary =
    (args.forcedCandidateId
      ? args.candidates.find((c) => c.id === args.forcedCandidateId)
      : null) || selectPrimaryCandidate(args.candidates);
  const gate = evaluateContextGate({ context: args.context, candidate: primary });
  const planId = stableApplicationId(seed, 'plan', 0);
  const risk = classifyAdaptationRisk([
    primary?.claimText ?? '',
    args.context.goal ?? '',
    args.context.situation ?? '',
  ]);

  if (!primary) {
    const plan: ApplicationPlanV1 = {
      id: planId,
      status: 'abstained',
      selectedCandidateId: null,
      sourceBasis: 'La fuente no ofrece una base segura para una recomendación afirmativa.',
      inference: 'Núcleo no inventa una aplicación cuando la evidencia no la sostiene.',
      adaptation: '',
      assumptions: [],
      action: null,
      reviewTrigger: '',
      reviewQuestions: [],
      risk,
      abstentionReason:
        'No hay claims verified/qualified/inference con relevancia suficiente.',
      sourceChunkIds: [],
    };
    return finishArtifact(args, plan, 'abstained');
  }

  if (isHighRisk(risk) && gate.status !== 'ready') {
    const plan: ApplicationPlanV1 = {
      id: planId,
      status: 'abstained',
      selectedCandidateId: primary.id,
      sourceBasis: stripInjectionLooks(primary.claimText),
      inference:
        'Este contenido toca un área de alto riesgo. Núcleo no genera instrucciones personalizadas que excedan la evidencia.',
      adaptation: '',
      assumptions: [],
      action: null,
      reviewTrigger: '',
      reviewQuestions: [],
      risk,
      abstentionReason:
        'Contenido sensible: se favorece abstención o consulta profesional antes de personalizar.',
      needsContextPrompt: gate.status === 'needs_context' ? gate.prompt : undefined,
      sourceChunkIds: chunkIdsForClaim(args.evidence, primary.claimId),
    };
    return finishArtifact(args, plan, 'abstained');
  }

  if (gate.status === 'needs_context') {
    const plan: ApplicationPlanV1 = {
      id: planId,
      status: 'needs_context',
      selectedCandidateId: primary.id,
      sourceBasis: stripInjectionLooks(primary.claimText),
      inference: 'Sin tu contexto, personalizar sería fingir.',
      adaptation: '',
      assumptions: [],
      action: null,
      reviewTrigger: '',
      reviewQuestions: [],
      risk,
      needsContextPrompt: gate.prompt,
      sourceChunkIds: chunkIdsForClaim(args.evidence, primary.claimId),
    };
    return finishArtifact(args, plan, 'needs_context');
  }

  const status = planStatusFromGate(gate);

  // Never invent goal/situation/horizon silently as facts — only as editable assumptions
  // or needs_context when the action cannot be made specific and safe.
  const hasGoal = Boolean(args.context.goal?.trim());
  const hasSituation = Boolean(args.context.situation?.trim());
  const hasHorizon = Boolean(args.context.horizon?.trim());
  const constraint = args.context.constraint?.trim();

  if (status === 'ready' && (!hasGoal || !hasHorizon)) {
    // Ready from gate with thin context: force provisional with editable defaults, or needs_context
    // if we cannot name a specific action from the claim alone.
    if (!claimActionSpecific(primary.claimText)) {
      const plan: ApplicationPlanV1 = {
        id: planId,
        status: 'needs_context',
        selectedCandidateId: primary.id,
        sourceBasis: stripInjectionLooks(primary.claimText),
        inference: 'Sin objetivo y momento claros, no inventamos una prueba falsa.',
        adaptation: '',
        assumptions: [],
        action: null,
        reviewTrigger: '',
        reviewQuestions: [],
        risk,
        needsContextPrompt:
          '¿Qué resultado concreto quieres y cuándo puedes probarlo?',
        sourceChunkIds: chunkIdsForClaim(args.evidence, primary.claimId),
      };
      return finishArtifact(args, plan, 'needs_context');
    }
  }

  const goal = args.context.goal?.trim();
  const situation = args.context.situation?.trim();
  const horizon = args.context.horizon?.trim();

  const assumptions = [];
  if (!goal) {
    assumptions.push({
      id: stableAssumptionId(seed, 'goal', 0),
      text: 'Asumimos un objetivo provisional: comprobar si la idea de la fuente cabe en tu día.',
      editable: true,
      source: 'nucleo_default' as const,
    });
  } else {
    assumptions.push({
      id: stableAssumptionId(seed, 'goal', 0),
      text: `Tu objetivo: ${goal}.`,
      editable: true,
      source: 'user' as const,
    });
  }
  if (!situation) {
    assumptions.push({
      id: stableAssumptionId(seed, 'situation', 1),
      text: 'Asumimos la situación habitual en la que sueles trabajar o estudiar.',
      editable: true,
      source: 'nucleo_default' as const,
    });
  } else {
    assumptions.push({
      id: stableAssumptionId(seed, 'situation', 1),
      text: `Tu situación: ${situation}.`,
      editable: true,
      source: 'user' as const,
    });
  }
  if (!horizon) {
    assumptions.push({
      id: stableAssumptionId(seed, 'horizon', 5),
      text: 'Asumimos el próximo bloque libre disponible (tú eliges el momento exacto).',
      editable: true,
      source: 'nucleo_default' as const,
    });
  } else {
    assumptions.push({
      id: stableAssumptionId(seed, 'horizon', 5),
      text: `Tu horizonte: ${horizon}.`,
      editable: true,
      source: 'user' as const,
    });
  }
  if (constraint) {
    assumptions.push({
      id: stableAssumptionId(seed, 'constraint', 2),
      text: `Respetamos tu restricción: ${constraint}.`,
      editable: true,
      source: 'user' as const,
    });
  }
  if (primary.epistemicStatus === 'inference') {
    assumptions.push({
      id: stableAssumptionId(seed, 'inference', 3),
      text: 'La idea seleccionada es una inferencia de Núcleo, no una afirmación literal de la fuente.',
      editable: false,
      source: 'nucleo_default' as const,
    });
  }
  if (primary.epistemicStatus === 'qualified') {
    assumptions.push({
      id: stableAssumptionId(seed, 'qualified', 4),
      text: 'La fuente matiza esta idea; la cautela permanece visible.',
      editable: false,
      source: 'nucleo_default' as const,
    });
  }

  const effectiveStatus =
    status === 'ready' && (!hasGoal || !hasSituation || !hasHorizon)
      ? ('provisional' as const)
      : status;

  const sourceBasis = stripInjectionLooks(primary.claimText);
  const sourceBasisLabeled =
    primary.epistemicStatus === 'inference'
      ? `Inferencia (no afirmación literal de la fuente): ${sourceBasis}`
      : primary.epistemicStatus === 'qualified'
        ? `${sourceBasis} — la fuente lo matiza.`
        : sourceBasis;

  const situationLabel = situation || 'tu situación (supuesto editable)';
  const goalLabel = goal || 'comprobar la idea (supuesto editable)';
  const horizonLabel = horizon || 'el próximo bloque libre (supuesto editable)';

  const inference =
    primary.epistemicStatus === 'inference'
      ? `Núcleo propone transferir esta hipótesis a «${situationLabel}» sin convertirla en hecho de la fuente.`
      : `Núcleo interpreta que esta idea de la fuente puede trasladarse a «${situationLabel}» sin añadir causalidad que la fuente no afirma.`;

  let adaptation = `Aplica la idea seleccionada a «${goalLabel}» en «${horizonLabel}»`;
  if (constraint) adaptation += `, respetando «${constraint}»`;
  adaptation += '.';
  if (isHighRisk(risk)) {
    adaptation +=
      ' Esto no sustituye criterio profesional; quédate en acciones informativas y de bajo riesgo.';
  }

  const claimSnippet =
    primary.claimText.length > 120
      ? `${primary.claimText.slice(0, 117).trim()}…`
      : primary.claimText;

  const actionId = stableActionId(seed, planId);
  let verbLed = constraint
    ? `Aplica ahora «${claimSnippet}» hacia «${goalLabel}», sin romper «${constraint}».`
    : `Aplica ahora «${claimSnippet}» hacia «${goalLabel}».`;
  let successCriterion = goal
    ? `Al terminar el bloque, tienes un resultado concreto ligado a «${goal}» (por ejemplo: un entregable, una decisión tomada o un registro escrito de lo hecho).`
    : `Al terminar el bloque, dejas un registro escrito de qué parte de «${claimSnippet}» aplicaste y qué cambió.`;

  if (isHighRisk(risk)) {
    if (
      isDangerousHighRiskInstruction(risk, verbLed) ||
      isDangerousHighRiskInstruction(risk, claimSnippet)
    ) {
      verbLed = safeConsultInstructionForRisk(risk);
      successCriterion = 'Tener una consulta o cita agendada con el profesional adecuado.';
    }
  }

  const plan: ApplicationPlanV1 = {
    id: planId,
    status: effectiveStatus,
    selectedCandidateId: primary.id,
    sourceBasis: sourceBasisLabeled,
    inference,
    adaptation,
    assumptions,
    action: {
      id: actionId,
      verbLedInstruction: verbLed.slice(0, 280),
      whenOrTrigger: horizonLabel,
      durationOrScope: constraint
        ? `Una sola prueba que quepa en «${constraint}».`
        : 'Una sola prueba acotada al bloque que marques.',
      obstacle: constraint
        ? `La restricción «${constraint}» puede bloquear la versión completa de la idea.`
        : 'Ampliar la prueba hasta que deje de ser realizable.',
      mitigation: constraint
        ? `Recorta la acción hasta que quepa dentro de «${constraint}».`
        : 'Fija de antemano el final del bloque y para ahí.',
      successCriterion: successCriterion.slice(0, 280),
      stopOrChangeCriterion:
        'Para o cambia si aparece daño, coste no aceptado, o la restricción se rompe; no fuerces la prueba.',
    },
    reviewTrigger: `Revisa al terminar el bloque (${horizonLabel}).`,
    reviewQuestions: [
      '¿Hiciste la acción tal como estaba escrita?',
      '¿Qué resultado observable viste?',
      '¿Qué supuesto falló, si alguno?',
    ],
    risk,
    sourceChunkIds: chunkIdsForClaim(args.evidence, primary.claimId),
  };

  const artifactStatus =
    effectiveStatus === 'provisional'
      ? 'provisional'
      : effectiveStatus === 'ready'
        ? 'complete'
        : effectiveStatus;
  return finishArtifact(args, plan, artifactStatus);
}

function claimActionSpecific(claimText: string): boolean {
  const t = claimText.trim();
  if (t.length < 12) return false;
  // Reject pure abstractions without a doable fragment.
  if (/^\s*(la\s+idea|el\s+concepto|en\s+general)\b/i.test(t)) return false;
  return true;
}

function finishArtifact(
  args: {
    candidates: ApplicationCandidateV1[];
    evidence: EvidenceArtifact;
    context: ApplicationContextV1;
    contentHash: string;
    depth: string;
    contextCanonicalHash: string;
    sourceId?: string;
    sourceVersionId?: string;
    modelVersion?: string;
    evidenceDigest?: string;
    understandingSchemaVersion?: string;
    understandingPromptVersion?: string;
    understandingCompilerVersion?: string;
    evidenceSchemaVersion?: string;
    evidencePromptVersion?: string;
    evidenceVerifierVersion?: string;
    evidenceCompilerVersion?: string;
  },
  plan: ApplicationPlanV1,
  status: ApplicationArtifactV1['status']
): ApplicationArtifactV1 {
  return {
    schemaVersion: APPLICATION_SCHEMA_VERSION,
    promptVersion: APPLICATION_PROMPT_VERSION,
    compilerVersion: APPLICATION_COMPILER_VERSION,
    policyVersion: APPLICATION_POLICY_VERSION,
    modelVersion: args.modelVersion ?? 'deterministic',
    modelRoute: APPLICATION_MODEL_ROUTE,
    status,
    contentHash: args.contentHash,
    sourceId: args.sourceId,
    sourceVersionId: args.sourceVersionId,
    depth: args.depth,
    contextCanonicalHash: args.contextCanonicalHash,
    understandingSchemaVersion: args.understandingSchemaVersion,
    understandingPromptVersion: args.understandingPromptVersion,
    understandingCompilerVersion: args.understandingCompilerVersion,
    evidenceSchemaVersion: args.evidenceSchemaVersion,
    evidencePromptVersion: args.evidencePromptVersion,
    evidenceVerifierVersion: args.evidenceVerifierVersion,
    evidenceCompilerVersion: args.evidenceCompilerVersion,
    evidenceDigest: args.evidenceDigest,
    context: args.context,
    candidates: args.candidates,
    plan,
    review: null,
    createdAt: new Date().toISOString(),
  };
}

export function compileApplicationToMap(args: {
  baseMap: ActionMapData;
  artifact: ApplicationArtifactV1;
}): ActionMapData {
  const validated = validateApplicationArtifact(args.artifact);
  if (!validated.ok) {
    return { ...args.baseMap, intent: 'apply' };
  }
  const art = validated.value;
  const plan = art.plan;

  const steps: MapStep[] = [];

  if (plan.status === 'needs_context') {
    steps.push({
      id: 'apply-needs-context',
      shortNav: 'Contexto',
      title: 'Falta un dato para personalizar',
      time: '~1 min',
      purpose: 'Contexto mínimo',
      content: [
        {
          type: 'callout',
          kind: 'alert',
          label: 'Precaución',
          text: plan.needsContextPrompt || '¿Qué resultado concreto quieres probar?',
        },
        {
          type: 'prose',
          text: `De la fuente: ${plan.sourceBasis || '—'}`,
        },
      ],
      references: [],
    });
  } else if (plan.status === 'abstained') {
    steps.push({
      id: 'apply-abstained',
      shortNav: 'Límite',
      title: 'Sin aplicación responsable',
      time: '~1 min',
      purpose: 'Abstención',
      content: [
        {
          type: 'callout',
          kind: 'alert',
          label: 'Precaución',
          text: plan.abstentionReason || plan.inference,
        },
        ...(plan.sourceBasis
          ? [{ type: 'prose' as const, text: `De la fuente: ${plan.sourceBasis}` }]
          : []),
      ],
      references: [],
    });
  } else if (plan.action) {
    steps.push({
      id: 'apply-source',
      shortNav: 'Fuente',
      title: 'De la fuente',
      time: '~1 min',
      purpose: 'Base de la fuente',
      content: [{ type: 'prose', text: plan.sourceBasis }],
      references: plan.sourceChunkIds.map((chunkId, i) => ({
        label: `Fragmento ${i + 1}`,
        locator: chunkId,
        chunkId,
      })),
    });
    steps.push({
      id: 'apply-inference',
      shortNav: 'Inferencia',
      title: 'Inferencia de Núcleo',
      time: '~1 min',
      purpose: 'Transferencia',
      content: [{ type: 'prose', text: plan.inference }],
      references: [],
    });
    steps.push({
      id: 'apply-adaptation',
      shortNav: 'Adaptación',
      title: 'Adaptación para ti',
      time: '~1 min',
      purpose: 'Personalización',
      content: [
        { type: 'prose', text: plan.adaptation },
        ...(plan.assumptions.length
          ? [
              {
                type: 'list' as const,
                kind: 'info' as const,
                text: 'Supuestos',
                items: plan.assumptions.map((a) => ({ strong: a.text })),
              },
            ]
          : []),
      ],
      references: [],
    });
    steps.push({
      id: 'apply-action',
      shortNav: 'Acción',
      title: 'Próxima acción',
      time: plan.action.durationOrScope,
      purpose: 'Hacer',
      content: [
        {
          type: 'callout',
          kind: 'action',
          label: 'Para aplicarlo',
          text: plan.action.verbLedInstruction,
        },
        {
          type: 'list',
          kind: 'action',
          text: 'Detalle',
          items: [
            { strong: 'Cuándo', span: plan.action.whenOrTrigger },
            { strong: 'Alcance', span: plan.action.durationOrScope },
            { strong: 'Obstáculo', span: plan.action.obstacle },
            { strong: 'Mitigación', span: plan.action.mitigation },
          ],
        },
      ],
      references: [],
    });
    steps.push({
      id: 'apply-check',
      shortNav: 'Comprobar',
      title: 'Cómo comprobarlo',
      time: '~1 min',
      purpose: 'Éxito observable',
      content: [
        { type: 'prose', text: plan.action.successCriterion },
        {
          type: 'callout',
          kind: 'alert',
          label: 'Precaución',
          text: plan.action.stopOrChangeCriterion,
        },
      ],
      references: [],
    });
    steps.push({
      id: 'apply-review',
      shortNav: 'Revisión',
      title: 'Revisión',
      time: '~2 min',
      purpose: 'Cerrar el ciclo',
      content: [
        { type: 'prose', text: plan.reviewTrigger },
        {
          type: 'list',
          kind: 'info',
          text: 'Preguntas',
          items: plan.reviewQuestions.map((q) => ({ strong: q })),
        },
      ],
      references: [],
    });
  }

  const title =
    plan.action?.verbLedInstruction.slice(0, 60) ||
    args.baseMap.title ||
    'Aplicar';

  return {
    ...args.baseMap,
    title,
    intent: 'apply',
    coreIdea: plan.adaptation || plan.sourceBasis || args.baseMap.coreIdea,
    coreSupport: plan.inference || args.baseMap.coreSupport,
    layer0: {
      what: plan.action?.verbLedInstruction || plan.needsContextPrompt || 'Aplicación',
      why: plan.adaptation || plan.inference || 'Pasar de idea a prueba concreta.',
      actions: [
        {
          id: 'a1',
          label: plan.action ? 'Empezar acción' : 'Añadir contexto',
        },
        { id: 'a2', label: 'Ver de la fuente' },
        { id: 'a3', label: 'Revisar después' },
      ],
    },
    // Keep the concise, source-grounded summaries produced by Understanding.
    // Application details already live in the dedicated steps below.
    tldr: args.baseMap.tldr.length
      ? args.baseMap.tldr
      : [
          { title: 'De la fuente', desc: 'La fuente aporta la base de esta aplicación.' },
          { title: 'Inferencia', desc: 'Núcleo conecta esa base con el objetivo indicado.' },
          { title: 'Adaptación', desc: 'El plan ajusta la acción al contexto disponible.' },
        ],
    steps: steps.length ? steps : args.baseMap.steps,
    completionCard: {
      title: 'Prueba lista para revisar',
      summary: plan.reviewTrigger || 'Vuelve tras la acción y registra qué ocurrió.',
      takeaways: plan.reviewQuestions.slice(0, 3),
      promptQuestion: '¿Qué resultado observable viste?',
    },
    application: art,
  };
}

/**
 * A missing-context application artifact is useful metadata, not a replacement
 * for the Núcleo. Rebuild the already-complete understanding presentation so a
 * user can read the source now and add application context later.
 */
export function preferUnderstandingWhenApplicationNeedsContext(
  map: ActionMapData
): ActionMapData {
  if (
    map.application?.status !== 'needs_context' ||
    !map.understanding ||
    map.understanding.status !== 'complete'
  ) {
    return map;
  }

  const compiled = compileUnderstandingToMap(map.understanding, {
    sourceKind: map.sourceMetadata?.kind,
    sourceLabel: map.sourceMetadata?.label,
    sourceUrl: map.sourceMetadata?.url,
  });
  if (!compiled.ok) return map;

  return {
    ...map,
    ...compiled.map,
    intent: 'understand',
    generationMode: map.generationMode,
    application: map.application,
    sourceMetadata: map.sourceMetadata ?? compiled.map.sourceMetadata,
    coverage: map.coverage ?? compiled.map.coverage,
  };
}
