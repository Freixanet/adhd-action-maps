import type { ActionMapData } from '../contracts';
import type { HistoryStore } from '../history';
import { sessionWithSemanticProgress } from '../progress/deriveProgress';
import { resolveMapCategory, normalizeTags, deriveMapStatus } from '../categories';
import { compileUnderstandingToMap } from '../understanding/compile';
import {
  UNDERSTANDING_COMPILER_VERSION,
  UNDERSTANDING_PROMPT_VERSION,
  UNDERSTANDING_SCHEMA_VERSION,
} from '../understanding/versions';
import type { UnderstandingArtifact, UnderstandingUnit } from '../understanding/types';

export const FORMAT_EXAMPLE_NUCLEO_ID = 'nucleo-formato-ejemplo';

const NUCLEAR =
  'Subrayar casi todo aplana el texto: la marca deja de decidir.';

function unit(
  partial: Pick<UnderstandingUnit, 'id' | 'title' | 'role' | 'explanation'> &
    Partial<UnderstandingUnit>
): UnderstandingUnit {
  return {
    relations: [],
    examples: [],
    cautions: [],
    segmentRefs: [],
    incomplete: false,
    ...partial,
  };
}

function formatExampleArtifact(): UnderstandingArtifact {
  const units: UnderstandingUnit[] = [
    unit({
      id: 'u1',
      title: 'Pintar el texto borra la jerarquía',
      role: 'concept',
      explanation:
        'Cuando casi cada línea lleva color, la página vuelve a ser plana. El ojo ya no sabe qué merecía quedarse. Una marca funciona porque elige; si elige todo, no elige nada. El subrayado masivo simula trabajo y deja el mismo bloque opaco que había al empezar.',
      examples: [
        'Un capítulo entero en amarillo: al volver, no hay entrada.',
        'Tres frases en un párrafo de veinte: se ve el hilo.',
      ],
      relations: [{ id: 'rel_mark_vs_paint', toUnitId: 'u2', kind: 'contradicts' }],
    }),
    unit({
      id: 'u2',
      title: 'Una marca tiene que dejar algo fuera',
      role: 'mechanism',
      explanation:
        'La marca útil es una decisión: esto entra, esto espera. El coste es real — hay que leer antes de pintar. A cambio, al reabrir el texto hay un camino, no un campo de color. El criterio no es “lo importante en abstracto”, sino lo que sostiene la pregunta con la que viniste.',
      examples: ['Una pregunta al margen y dos frases marcadas bastan para retomar.'],
      relations: [{ id: 'rel_mark_enables', toUnitId: 'u3', kind: 'enables' }],
    }),
    unit({
      id: 'u3',
      title: 'El margen dice más que el fluorescente',
      role: 'relation',
      explanation:
        'Una palabra tuya al lado —“esto empuja X”, “no lo afirma”— convierte la marca en memoria. El color solo dice “aquí hay algo”. El margen dice qué. Si no cabe una frase, la marca todavía no está lista.',
      examples: ['“Límite, no receta” al lado de un párrafo de consejos.'],
      cautions: [
        'Esto no es un método milagroso de estudio.',
        'No habla de diagnóstico ni de atención clínica.',
      ],
    }),
  ];

  return {
    schemaVersion: UNDERSTANDING_SCHEMA_VERSION,
    promptVersion: UNDERSTANDING_PROMPT_VERSION,
    compilerVersion: UNDERSTANDING_COMPILER_VERSION,
    modelVersion: 'format-example.v1',
    intent: 'understand',
    depth: 'estandar',
    status: 'complete',
    contentHash: 'format-example-marcar-v1',
    blueprint: {
      classification: {
        genre: 'argumentative',
        discourseStructure: 'comparative',
        language: 'es',
        scopeKnown: 'complete',
        uncertainties: [],
      },
      plan: {
        centralQuestion: '¿Qué distingue marcar un texto de pintarlo entero?',
        thesisOrPurpose: 'Una marca tiene que elegir',
        unitOrder: [
          'Pintar el texto borra la jerarquía',
          'Una marca tiene que dejar algo fuera',
          'El margen dice más que el fluorescente',
        ],
        relationsToPreserve: [
          { from: 'Pintar el texto borra la jerarquía', to: 'Una marca tiene que dejar algo fuera', kind: 'contradicts' },
          { from: 'Una marca tiene que dejar algo fuera', to: 'El margen dice más que el fluorescente', kind: 'enables' },
        ],
        mustKeep: [
          'Esto no es un método milagroso de estudio.',
          'No habla de diagnóstico ni de atención clínica.',
        ],
        excludedNoise: [],
      },
      essential: {
        nuclearIdea: NUCLEAR,
        essentialIdeas: [
          {
            title: 'El color masivo aplana',
            desc: 'Si casi todo está marcado, al volver no hay entrada.',
          },
          {
            title: 'Marcar es dejar fuera',
            desc: 'Una marca útil elige; si elige todo, no elige.',
          },
          {
            title: 'El margen nombra el porqué',
            desc: 'Una frase tuya dice qué sostiene la pregunta.',
          },
        ],
        limitsOrConditions: ['Vale para un texto que vas a reabrir, no para un primer barrido.'],
        doesNotClaim: ['No afirma que subrayar sea inútil en todos los casos.'],
        layer0Synthesis: 'Marcar elige; pintar el texto esconde el hilo.',
        layer0Why: 'Sirve para reabrir un texto sin empezar de cero.',
        layer0Actions: [
          'Señala una página que pintaste entera',
          'Deja tres marcas y el resto fuera',
          'Escribe una frase al margen de cada marca',
        ],
      },
    },
    units,
    closure: {
      finalSynthesis:
        'La marca sirve cuando decide. Pintar el capítulo entero borra esa decisión; el margen la guarda.',
      mainLearnings: [
        'El subrayado masivo aplana la página.',
        'Marcar implica dejar texto fuera.',
        'Una frase al margen nombra el porqué.',
      ],
      openQuestions: ['¿Cuántas marcas caben en un capítulo antes de volver a aplanar?'],
      reviewPrompt: '¿Qué deja fuera tu próxima marca?',
      comprehensionLimits: ['El texto de origen es un ejemplo pedagógico, no un paper.'],
    },
  };
}

export function buildFormatExampleMap(): ActionMapData {
  const compiled = compileUnderstandingToMap(formatExampleArtifact(), {
    sourceKind: 'text',
    sourceLabel: 'Notas sobre cómo marcar un texto',
  });
  if (!compiled.ok) {
    throw new Error(`format example compile failed: ${compiled.error}`);
  }
  return {
    ...compiled.map,
    category: 'Aprendizaje',
    readingFormat: 'contrast',
  };
}

export const FORMAT_EXAMPLE_NUCLEO_DATA: ActionMapData = buildFormatExampleMap();

/**
 * Puts the format example in Jump Back without stealing the active Núcleo.
 * Refreshes fixture copy when the entry already exists.
 */
export function upsertFormatExampleNucleo(store: HistoryStore): HistoryStore {
  const map = FORMAT_EXAMPLE_NUCLEO_DATA;
  const now = Date.now();
  const existing = store.entries.find((entry) => entry.id === FORMAT_EXAMPLE_NUCLEO_ID);
  const baseSession = {
    data: map,
    currentStep: existing?.session.currentStep ?? 0,
    isComplete: existing?.session.isComplete ?? false,
    viewAll: existing?.session.viewAll ?? false,
  };
  const session = sessionWithSemanticProgress(baseSession, map, now);
  const intent = map.intent === 'apply' || map.intent === 'study' ? map.intent : 'understand';
  const meta = {
    category: resolveMapCategory(map.category),
    tags: normalizeTags(map.tags),
    intent,
    status: deriveMapStatus(session, intent),
  };

  if (existing) {
    return {
      ...store,
      entries: store.entries.map((entry) =>
        entry.id === FORMAT_EXAMPLE_NUCLEO_ID
          ? {
              ...entry,
              title: map.title,
              session,
              updatedAt: now,
              ...meta,
            }
          : entry
      ),
    };
  }

  return {
    ...store,
    entries: [
      {
        id: FORMAT_EXAMPLE_NUCLEO_ID,
        title: map.title,
        createdAt: now,
        updatedAt: now,
        sourceType: 'text',
        session,
        ...meta,
      },
      ...store.entries,
    ],
  };
}
