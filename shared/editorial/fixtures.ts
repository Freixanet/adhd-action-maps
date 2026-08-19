import { EDITORIAL_STYLE_ID, type EditorialPlan, type IllustrationSpec } from './types';
import { deriveMapIntentFromGoals } from './validateEditorialPlan';
import { resolvePlanIllustrations } from './selectIllustration';

function ill(
  partial: Omit<IllustrationSpec, 'styleId' | 'optional'> & { optional?: boolean }
): IllustrationSpec {
  return {
    ...partial,
    styleId: EDITORIAL_STYLE_ID,
    optional: partial.optional ?? false,
  };
}

/**
 * Procrastination / act-now editorial fixture — three designed pages only.
 * Cover · enemies · experiment. Local editorial SVG scenes; Streamline optional.
 */
export function buildProcrastinationEditorialPlan(): EditorialPlan {
  const pages = [
    {
      id: 'cover',
      index: 0,
      archetype: 'cover' as const,
      cognitiveGoal: 'comprehend' as const,
      title: 'Deja de procrastinar y actúa',
      titleEmphasis: 'actúa',
      titleLines: ['Deja de procrastinar', 'y actúa'],
      body: 'Por qué no cumples tus objetivos y cómo empezar a cambiarlo.',
      callout: {
        tone: 'emphasis' as const,
        title: 'En una frase',
        body: 'Tu valor no depende del resultado, sino de la acción constante y consciente.',
      },
      illustration: ill({
        concept: 'Persona avanzando hacia una cima',
        visualRole: 'hero-scene',
        metaphor: 'Camino + montaña + amanecer = progreso con dificultad',
        subjects: ['peak', 'sunrise', 'path', 'hiker'],
        mood: 'claro, sobrio',
        composition: 'path-progress',
        emphasis: 'trayectoria hacia la meta',
        searchTags: ['peak', 'sunrise', 'path', 'goal', 'hiker'],
        fallbackAssetId: 'local-peak-sunrise',
        accessibilityLabel: 'Persona en un camino hacia una cima al amanecer',
        priority: 'required',
      }),
    },
    {
      id: 'enemies',
      index: 1,
      archetype: 'comparison' as const,
      cognitiveGoal: 'compare' as const,
      kicker: 'Los 3 enemigos',
      title: 'que frenan tus metas',
      body: 'Distinto disfraz. Mismo freno: no avanzar.',
      items: [
        {
          id: 'e1',
          title: 'Procrastinación',
          body: 'Aplazas para proteger la imagen, no por falta de tiempo.',
          iconAssetId: 'local-enemy-clock',
        },
        {
          id: 'e2',
          title: 'Perfeccionismo',
          body: 'Exiges un resultado impecable antes de empezar.',
          iconAssetId: 'local-enemy-target',
        },
        {
          id: 'e3',
          title: 'Planificación excesiva',
          body: 'Planificar sin ejecutar se siente productivo y no mueve nada.',
          iconAssetId: 'local-enemy-checklist',
        },
      ],
      illustration: ill({
        concept: 'Tres obstáculos internos distintos',
        visualRole: 'comparison',
        metaphor: 'Reloj / diana / lista = tres frenos reconocibles',
        subjects: ['procrastinate', 'goal', 'list', 'mind'],
        mood: 'analítico',
        composition: 'sequence',
        emphasis: 'contraste entre los tres',
        searchTags: ['procrastinate', 'clock', 'target', 'checklist'],
        fallbackAssetId: 'local-three-enemies',
        accessibilityLabel: 'Tres metáforas visuales de demora, perfeccionismo y planes sin movimiento',
        priority: 'optional',
        optional: true,
      }),
    },
    {
      id: 'experiment',
      index: 2,
      archetype: 'experiment' as const,
      cognitiveGoal: 'evaluate' as const,
      title: 'Un experimento revelador',
      body: 'Eliges algo que puede empeorar el resultado. Si fallas, ya tienes una excusa.',
      items: [
        {
          id: 'x1',
          title: 'Elección',
          body: 'opción dañina',
        },
        {
          id: 'x2',
          title: 'Prueba',
          body: 'difícil de pasar',
        },
        {
          id: 'x3',
          title: 'Excusa',
          body: 'salva la imagen',
        },
      ],
      sourceEvidenceIds: ['berglas-jones-1978'],
      callout: {
        tone: 'warning' as const,
        title: 'El coste',
        body: 'La excusa salva la imagen y reduce la probabilidad de hacerlo bien.',
      },
      illustration: ill({
        concept: 'Secuencia de auto-handicap',
        visualRole: 'experiment-sequence',
        metaphor: 'Elección → prueba → escudo = cadena causal',
        subjects: ['experiment', 'sequence', 'shield'],
        mood: 'clínico',
        composition: 'sequence',
        emphasis: 'cadena causal',
        searchTags: ['experiment', 'sequence', 'shield', 'choice'],
        fallbackAssetId: 'local-experiment-flow',
        accessibilityLabel: 'Secuencia del experimento de auto-handicap',
        priority: 'required',
      }),
    },
  ];

  const goals = pages.map((p) => p.cognitiveGoal);
  const plan: EditorialPlan = {
    schemaVersion: 1,
    styleId: EDITORIAL_STYLE_ID,
    title: 'Deja de procrastinar y actúa',
    sourceLabel: 'Referencia editorial',
    nucleusClaim:
      'Tu valor no depende del resultado, sino de la acción constante y consciente.',
    pages,
    derivedMapIntent: deriveMapIntentFromGoals(goals),
    providerVersions: {
      planner: 'fixture-procrastination-v2',
      illustration: 'provisional-local-pack-v1',
    },
    attribution: {
      required: true,
      text: 'Ilustraciones: Storyset (provisional). Distribución comercial: confirmar licencia o Premium.',
    },
  };

  return resolvePlanIllustrations(plan);
}

export function buildConceptualEditorialPlan(): EditorialPlan {
  const pages = [
    {
      id: 'cover',
      index: 0,
      archetype: 'cover' as const,
      cognitiveGoal: 'comprehend' as const,
      title: 'La atención es un recurso finito',
      body: 'Cada cambio de foco gasta capacidad que ya no vuelve en esa sesión.',
      illustration: ill({
        concept: 'Recurso limitado',
        visualRole: 'concept-metaphor',
        metaphor: 'Mente = depósito que se vacía',
        subjects: ['mind', 'insight'],
        mood: 'sobrio',
        composition: 'centered',
        emphasis: 'agotamiento',
        searchTags: ['mind', 'insight', 'path'],
        fallbackAssetId: 'local-mind-crack',
        accessibilityLabel: 'Mente bajo carga',
        priority: 'required',
      }),
    },
    {
      id: 'explain',
      index: 1,
      archetype: 'explanation' as const,
      cognitiveGoal: 'comprehend' as const,
      title: 'Por qué duele interrumpir',
      body: 'Reconstruir contexto cuesta minutos. Varias interrupciones dejan la lectura a medias.',
      illustration: ill({
        concept: 'Causa y efecto del cambio',
        visualRole: 'process-diagram',
        metaphor: 'Secuencia de pérdida',
        subjects: ['sequence', 'path'],
        mood: 'explicativo',
        composition: 'sequence',
        emphasis: 'cadena',
        searchTags: ['sequence', 'path', 'mind'],
        fallbackAssetId: 'local-experiment-flow',
        accessibilityLabel: 'Secuencia de interrupción',
        priority: 'optional',
        optional: true,
      }),
    },
    {
      id: 'recap',
      index: 2,
      archetype: 'recap' as const,
      cognitiveGoal: 'remember' as const,
      title: 'Qué recordar',
      items: [
        { id: 'r1', title: 'Foco finito', body: 'No es voluntad infinita.' },
        { id: 'r2', title: 'Coste real', body: 'Cada cambio tiene precio.' },
        { id: 'r3', title: 'Diseño primero', body: 'El entorno decide más que el ánimo.' },
      ],
    },
  ];
  const plan: EditorialPlan = {
    schemaVersion: 1,
    styleId: EDITORIAL_STYLE_ID,
    title: 'Atención finita',
    nucleusClaim: 'La atención se agota con cada cambio de foco del entorno.',
    pages,
    derivedMapIntent: 'understand',
    providerVersions: {
      planner: 'fixture-conceptual-v1',
      illustration: 'local-catalog-v1',
    },
  };
  return resolvePlanIllustrations(plan);
}

export function buildPracticalEditorialPlan(): EditorialPlan {
  const pages = [
    {
      id: 'cover',
      index: 0,
      archetype: 'cover' as const,
      cognitiveGoal: 'apply' as const,
      title: 'Tres gestos para proteger el foco',
      body: 'Acciones concretas para una sesión de lectura de 25 minutos.',
      illustration: ill({
        concept: 'Kit práctico',
        visualRole: 'spot-illustration',
        metaphor: 'Herramientas listas',
        subjects: ['tool', 'padlock', 'run'],
        mood: 'práctico',
        composition: 'layers',
        emphasis: 'acción',
        searchTags: ['tool', 'padlock', 'run', 'environment'],
        fallbackAssetId: 'local-tools-grid',
        accessibilityLabel: 'Herramientas de foco',
        priority: 'required',
      }),
    },
    {
      id: 'apply',
      index: 1,
      archetype: 'application' as const,
      cognitiveGoal: 'practice' as const,
      title: 'Hazlo en este orden',
      items: [
        { id: 'p1', title: 'Silencia avisos', body: '25 minutos, sin excepciones.' },
        { id: 'p2', title: 'Cierra una pestaña', body: 'La que más te tienta.' },
        { id: 'p3', title: 'Marca el corte', body: 'Una línea donde quedaste.' },
      ],
      callout: {
        tone: 'success' as const,
        body: 'Si solo haces el primero, ya cambió la sesión.',
      },
    },
  ];
  const plan: EditorialPlan = {
    schemaVersion: 1,
    styleId: EDITORIAL_STYLE_ID,
    title: 'Proteger el foco',
    nucleusClaim: 'Tres gestos bastan para una sesión acabable.',
    pages,
    derivedMapIntent: 'apply',
    providerVersions: {
      planner: 'fixture-practical-v1',
      illustration: 'local-catalog-v1',
    },
  };
  return resolvePlanIllustrations(plan);
}

export function buildComparisonEditorialPlan(): EditorialPlan {
  const pages = [
    {
      id: 'cover',
      index: 0,
      archetype: 'comparison' as const,
      cognitiveGoal: 'compare' as const,
      title: 'Voluntad frente a entorno',
      items: [
        {
          id: 'c1',
          title: 'Forzar voluntad',
          body: 'Agota rápido y falla cuando hay avisos.',
        },
        {
          id: 'c2',
          title: 'Diseñar entorno',
          body: 'Quita fricción a la tarea y súbela al sabotaje.',
        },
      ],
      illustration: ill({
        concept: 'Dos caminos',
        visualRole: 'comparison',
        metaphor: 'Izquierda/derecha',
        subjects: ['compare', 'balance'],
        mood: 'claro',
        composition: 'left-right',
        emphasis: 'contraste',
        searchTags: ['compare', 'balance', 'evaluate'],
        fallbackAssetId: 'local-compare-scales',
        accessibilityLabel: 'Comparación',
        priority: 'required',
      }),
    },
    {
      id: 'pick',
      index: 1,
      archetype: 'recap' as const,
      cognitiveGoal: 'evaluate' as const,
      title: 'Qué elegir hoy',
      body: 'Si solo puedes cambiar una cosa, cambia el entorno, no el ánimo.',
    },
  ];
  const plan: EditorialPlan = {
    schemaVersion: 1,
    styleId: EDITORIAL_STYLE_ID,
    title: 'Voluntad vs entorno',
    nucleusClaim: 'El entorno gana a la voluntad en sesiones largas.',
    pages,
    derivedMapIntent: 'understand',
    providerVersions: {
      planner: 'fixture-comparison-v1',
      illustration: 'local-catalog-v1',
    },
  };
  return resolvePlanIllustrations(plan);
}

export function buildNoApplicationEditorialPlan(): EditorialPlan {
  const pages = [
    {
      id: 'cover',
      index: 0,
      archetype: 'cover' as const,
      cognitiveGoal: 'comprehend' as const,
      title: 'Qué dice la fuente',
      body: 'Un texto descriptivo sin método aplicable: solo comprensión.',
    },
    {
      id: 'nucleus',
      index: 1,
      archetype: 'nucleus' as const,
      cognitiveGoal: 'comprehend' as const,
      title: 'Idea central',
      body: 'La fuente narra un fenómeno; no prescribe pasos.',
      illustration: ill({
        concept: 'Comprender sin actuar',
        visualRole: 'concept-metaphor',
        metaphor: 'Mente observando',
        subjects: ['mind', 'reflect'],
        mood: 'quieto',
        composition: 'centered',
        emphasis: 'lectura',
        searchTags: ['mind', 'reflect', 'insight'],
        fallbackAssetId: 'local-reflect',
        accessibilityLabel: 'Reflexión',
        priority: 'optional',
        optional: true,
      }),
    },
    {
      id: 'reflect',
      index: 2,
      archetype: 'reflection' as const,
      cognitiveGoal: 'reflect' as const,
      title: 'Para pensar',
      body: '¿Qué parte de este relato reconoce en su propia experiencia?',
    },
  ];
  const plan: EditorialPlan = {
    schemaVersion: 1,
    styleId: EDITORIAL_STYLE_ID,
    title: 'Solo comprensión',
    nucleusClaim: 'Esta fuente explica; no exige una acción.',
    pages,
    derivedMapIntent: 'understand',
    providerVersions: {
      planner: 'fixture-no-apply-v1',
      illustration: 'local-catalog-v1',
    },
  };
  return resolvePlanIllustrations(plan);
}

export function buildEvidenceEditorialPlan(): EditorialPlan {
  const pages = [
    {
      id: 'cover',
      index: 0,
      archetype: 'evidence' as const,
      cognitiveGoal: 'evaluate' as const,
      title: 'Qué sostiene la afirmación',
      body: 'Una fuente con experimento: primero la evidencia, luego la lectura.',
      callout: {
        tone: 'neutral' as const,
        title: 'Evidencia',
        body: 'Berglas y Jones, 1978 — preferencia por no arriesgar la autoimagen.',
      },
      illustration: ill({
        concept: 'Marca de evidencia',
        visualRole: 'evidence-visual',
        metaphor: 'Cita visual',
        subjects: ['evidence', 'quote'],
        mood: 'documental',
        composition: 'centered',
        emphasis: 'soporte',
        searchTags: ['evidence', 'quote', 'remember'],
        fallbackAssetId: 'local-evidence-quote',
        accessibilityLabel: 'Evidencia',
        priority: 'required',
      }),
      sourceEvidenceIds: ['ev-berglas-1978'],
    },
    {
      id: 'implication',
      index: 1,
      archetype: 'explanation' as const,
      cognitiveGoal: 'relate' as const,
      title: 'Qué implica',
      body: 'Si el ego teme fallar, aplazar reduce la amenaza aunque retrase la meta.',
    },
  ];
  const plan: EditorialPlan = {
    schemaVersion: 1,
    styleId: EDITORIAL_STYLE_ID,
    title: 'Evidencia primero',
    nucleusClaim: 'La evidencia explica el aplazamiento como protección del ego.',
    pages,
    derivedMapIntent: 'understand',
    providerVersions: {
      planner: 'fixture-evidence-v1',
      illustration: 'local-catalog-v1',
    },
  };
  return resolvePlanIllustrations(plan);
}


/** Second demo topic — attention / interruptions. Same 3 archetypes, different visuals. */
export function buildAttentionEditorialPlan(): EditorialPlan {
  const pages = [
    {
      id: 'cover',
      index: 0,
      archetype: 'cover' as const,
      cognitiveGoal: 'comprehend' as const,
      title: 'Tu atención se agota con cada cambio',
      titleEmphasis: 'agota',
      body: 'Por qué las interrupciones dejan las lecturas a medias.',
      callout: {
        tone: 'emphasis' as const,
        title: 'En una frase',
        body: 'Cada aviso obliga a reconstruir el contexto. Ese coste acumulado corta el foco.',
      },
      illustration: ill({
        concept: 'Atención que se fragmenta',
        visualRole: 'hero-scene',
        metaphor: 'Haz central roto por avisos',
        subjects: ['mind', 'insight', 'path'],
        mood: 'sobrio',
        composition: 'centered',
        emphasis: 'fragmentación',
        searchTags: ['mind', 'attention', 'interrupt', 'focus'],
        fallbackAssetId: 'local-mind-crack',
        accessibilityLabel: 'Haz de atención fragmentado por avisos',
        priority: 'required',
      }),
    },
    {
      id: 'enemies',
      index: 1,
      archetype: 'comparison' as const,
      cognitiveGoal: 'compare' as const,
      title: 'Tres interruptores que te sacan del hilo',
      body: 'No es falta de voluntad: es un entorno que pide cambio de contexto sin pausa.',
      items: [
        {
          id: 'i1',
          title: 'Avisos',
          body: 'Un sonido corta la frase que estabas armando.',
        },
        {
          id: 'i2',
          title: 'Pestañas',
          body: 'Abrir “solo un momento” multiplica los hilos abiertos.',
        },
        {
          id: 'i3',
          title: 'Cambios de tarea',
          body: 'Volver al texto cuesta minutos que ya no recuperas en esa sesión.',
        },
      ],
      illustration: ill({
        concept: 'Tres fuentes de interrupción',
        visualRole: 'comparison',
        metaphor: 'Aviso / pestaña / cambio',
        subjects: ['mind', 'list', 'path'],
        mood: 'analítico',
        composition: 'sequence',
        emphasis: 'tres frentes',
        searchTags: ['notification', 'tabs', 'switch', 'attention'],
        fallbackAssetId: 'local-three-enemies',
        accessibilityLabel: 'Tres interruptores de atención',
        priority: 'optional',
        optional: true,
      }),
    },
    {
      id: 'experiment',
      index: 2,
      archetype: 'experiment' as const,
      cognitiveGoal: 'evaluate' as const,
      title: 'El coste de volver',
      body: 'Tras una interrupción, el cerebro reconstruye contexto antes de avanzar. Varias veces seguidas, la sesión se vacía sin que lo notes.',
      items: [],
      callout: {
        tone: 'warning' as const,
        title: 'Diseño primero',
        body: 'Quitar un aviso rinde más que forzar concentración.',
      },
      illustration: ill({
        concept: 'Coste de cambio de contexto',
        visualRole: 'experiment-sequence',
        metaphor: 'Foco → corte → reconstrucción',
        subjects: ['sequence', 'mind', 'path'],
        mood: 'clínico',
        composition: 'sequence',
        emphasis: 'pérdida acumulada',
        searchTags: ['attention', 'switch', 'cost', 'focus'],
        fallbackAssetId: 'local-experiment-flow',
        accessibilityLabel: 'Secuencia del coste de interrupción',
        priority: 'required',
      }),
    },
  ];
  const plan: EditorialPlan = {
    schemaVersion: 1,
    styleId: EDITORIAL_STYLE_ID,
    title: 'Atención finita',
    sourceLabel: 'Referencia editorial',
    nucleusClaim: 'Cada aviso obliga a reconstruir el contexto. Ese coste acumulado corta el foco.',
    pages,
    derivedMapIntent: 'understand',
    providerVersions: {
      planner: 'fixture-attention-v1',
      illustration: 'nucleo-editorial-silhouette-v1',
    },
  };
  return resolvePlanIllustrations(plan);
}

export type EditorialFixtureId =
  | 'procrastination'
  | 'attention'
  | 'conceptual'
  | 'practical'
  | 'comparison'
  | 'no-application'
  | 'evidence';

export function buildEditorialFixture(id: EditorialFixtureId): EditorialPlan {
  switch (id) {
    case 'attention':
      return buildAttentionEditorialPlan();
    case 'conceptual':
      return buildConceptualEditorialPlan();
    case 'practical':
      return buildPracticalEditorialPlan();
    case 'comparison':
      return buildComparisonEditorialPlan();
    case 'no-application':
      return buildNoApplicationEditorialPlan();
    case 'evidence':
      return buildEvidenceEditorialPlan();
    case 'procrastination':
    default:
      return buildProcrastinationEditorialPlan();
  }
}
