import type { CognitiveTaskResult, KnowledgeModel } from '../knowledgeModel';
import { segmentSourceText } from '../sourceSegments';

const SOURCE = [
  'La validación emocional ayuda a regular el sistema nervioso cuando se ofrece con límites claros.',
  'Si la validación se vuelve constante y sustituye la autonomía, puede aumentar la dependencia afectiva.',
  'La dependencia afectiva reduce la capacidad de tomar decisiones propias y sostiene la ansiedad de separación.',
  'En contraste, la validación saludable nombra la emoción sin asumir la responsabilidad del otro.',
].join('\n\n');

export const FIXTURE_SOURCE = SOURCE;
export const FIXTURE_SEGMENTS = segmentSourceText(SOURCE);

const seg = (n: number) => ({
  segmentId: `seg-${n}`,
  support: 'direct' as const,
});

/** Frozen causal knowledge — eligible for causal-chain. */
export const FIXTURE_CAUSAL_KNOWLEDGE: KnowledgeModel = {
  thesis: 'La validación sin límites puede alimentar dependencia afectiva',
  thesisEvidence: [seg(2)],
  concepts: [
    {
      id: 'validacion',
      label: 'Validación emocional',
      summary: 'Nombrar y reconocer la emoción del otro',
      evidence: [seg(1)],
    },
    {
      id: 'limites',
      label: 'Límites claros',
      summary: 'Condición que mantiene la validación saludable',
      evidence: [seg(1)],
    },
    {
      id: 'sobrevalidacion',
      label: 'Validación constante sin autonomía',
      summary: 'Sustituye la autonomía del otro',
      evidence: [seg(2)],
    },
    {
      id: 'dependencia',
      label: 'Dependencia afectiva',
      summary: 'Menor capacidad de decidir por uno mismo',
      evidence: [seg(3)],
    },
    {
      id: 'ansiedad',
      label: 'Ansiedad de separación',
      summary: 'Sostenida por la dependencia',
      evidence: [seg(3)],
    },
  ],
  relations: [
    {
      id: 'r1',
      from: 'sobrevalidacion',
      to: 'dependencia',
      type: 'increases',
      modality: 'asserted',
      label: 'aumenta',
      evidence: [seg(2)],
      confidence: 0.9,
    },
    {
      id: 'r2',
      from: 'dependencia',
      to: 'ansiedad',
      type: 'enables',
      modality: 'asserted',
      label: 'sostiene',
      evidence: [seg(3)],
      confidence: 0.85,
    },
    {
      id: 'r3',
      from: 'limites',
      to: 'sobrevalidacion',
      type: 'prevents',
      modality: 'probable',
      label: 'previene',
      evidence: [seg(1)],
      confidence: 0.7,
    },
  ],
  sequences: [],
  comparisons: [
    {
      id: 'cmp1',
      entities: ['validacion', 'sobrevalidacion'],
      dimensions: ['autonomía', 'ansiedad'],
      evidence: [seg(4)],
    },
  ],
  uncertainties: ['El efecto depende del contexto relacional'],
  segments: FIXTURE_SEGMENTS,
};

export const FIXTURE_CAUSAL_TASKS: CognitiveTaskResult = {
  primary: 'understand-causality',
  secondary: ['absorb-overview'],
  rationale: 'El texto describe una cadena causa-efecto',
};

/** Knowledge without causal structure — should prefer guided-reading. */
export const FIXTURE_FLAT_KNOWLEDGE: KnowledgeModel = {
  thesis: 'Hay varias ideas sueltas sobre hábitos de estudio',
  thesisEvidence: [seg(1)],
  concepts: [
    {
      id: 'a',
      label: 'Pomodoro',
      summary: 'Bloques de 25 minutos',
      evidence: [seg(1)],
    },
    {
      id: 'b',
      label: 'Sueño',
      summary: 'Descanso suficiente',
      evidence: [seg(2)],
    },
  ],
  relations: [],
  sequences: [],
  comparisons: [],
  uncertainties: [],
  segments: FIXTURE_SEGMENTS,
};

export const FIXTURE_FLAT_TASKS: CognitiveTaskResult = {
  primary: 'absorb-overview',
  secondary: [],
  rationale: 'Lista de consejos sin estructura causal',
};

/** Broken evidence — must runtime-v1-fallback. */
export const FIXTURE_BROKEN_EVIDENCE: KnowledgeModel = {
  ...FIXTURE_CAUSAL_KNOWLEDGE,
  relations: [
    {
      ...FIXTURE_CAUSAL_KNOWLEDGE.relations[0]!,
      evidence: [{ segmentId: 'seg-does-not-exist', support: 'direct' }],
    },
    ...FIXTURE_CAUSAL_KNOWLEDGE.relations.slice(1),
  ],
};
