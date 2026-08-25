/**
 * Gemini response schemas for S04 stages.
 * Keep constructs compatible with Gemini structured output:
 * - no additionalProperties tricks that Gemini rejects
 * - enums as string enums
 * - required arrays explicit
 * Provider schema does NOT replace post-validation fail-closed.
 */

import {
  TLDR_DEFAULT_COUNT,
  TLDR_MAX_COUNT,
  TLDR_SUBTITLE_MAX_CHARACTERS,
  TLDR_TITLE_MAX_CHARACTERS,
} from '../../../shared/contracts';

export const UNDERSTANDING_BLUEPRINT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    classification: {
      type: 'object',
      properties: {
        genre: {
          type: 'string',
          enum: [
            'explanatory',
            'argumentative',
            'narrative',
            'procedural',
            'reference',
            'mixed',
            'unknown',
          ],
        },
        discourseStructure: {
          type: 'string',
          enum: [
            'causal',
            'conceptual',
            'comparative',
            'chronological',
            'problem_solution',
            'procedural',
            'mixed',
            'unknown',
          ],
        },
        language: { type: 'string' },
        scopeKnown: { type: 'string', enum: ['complete', 'partial', 'unknown'] },
        uncertainties: { type: 'array', items: { type: 'string' } },
      },
      required: ['genre', 'discourseStructure', 'language', 'scopeKnown', 'uncertainties'],
    },
    plan: {
      type: 'object',
      properties: {
        centralQuestion: { type: 'string' },
        thesisOrPurpose: { type: 'string' },
        unitOrder: { type: 'array', items: { type: 'string' } },
        relationsToPreserve: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              kind: { type: 'string' },
            },
            required: ['from', 'to', 'kind'],
          },
        },
        mustKeep: { type: 'array', items: { type: 'string' } },
        excludedNoise: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['item', 'reason'],
          },
        },
      },
      required: [
        'centralQuestion',
        'thesisOrPurpose',
        'unitOrder',
        'relationsToPreserve',
        'mustKeep',
        'excludedNoise',
      ],
    },
    essential: {
      type: 'object',
      properties: {
        nuclearIdea: { type: 'string' },
        essentialIdeas: {
          type: 'array',
          description: `Síntesis «En 60 segundos»: ${TLDR_DEFAULT_COUNT} ideas por defecto, máximo ${TLDR_MAX_COUNT}. Prioriza por importancia.`,
          minItems: TLDR_DEFAULT_COUNT,
          maxItems: TLDR_MAX_COUNT,
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                maxLength: TLDR_TITLE_MAX_CHARACTERS,
                description: 'Título breve, específico y autónomo.',
              },
              desc: {
                type: 'string',
                maxLength: TLDR_SUBTITLE_MAX_CHARACTERS,
                description:
                  'Subtítulo completo en una frase; máximo dos líneas de tarjeta. Sin puntos suspensivos.',
              },
            },
            required: ['title', 'desc'],
          },
        },
        limitsOrConditions: { type: 'array', items: { type: 'string' } },
        doesNotClaim: { type: 'array', items: { type: 'string' } },
        layer0Synthesis: { type: 'string' },
        layer0Why: { type: 'string' },
        layer0Actions: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 3,
        },
      },
      required: [
        'nuclearIdea',
        'essentialIdeas',
        'limitsOrConditions',
        'doesNotClaim',
        'layer0Synthesis',
        'layer0Why',
        'layer0Actions',
      ],
    },
  },
  required: ['classification', 'plan', 'essential'],
} as const;

export const UNDERSTANDING_UNITS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          role: {
            type: 'string',
            enum: [
              'thesis',
              'concept',
              'cause',
              'mechanism',
              'relation',
              'evidence_described',
              'example',
              'counterargument',
              'caution',
              'limitation',
              'synthesis',
            ],
          },
          explanation: { type: 'string' },
          relations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                toUnitId: { type: 'string' },
                kind: { type: 'string' },
              },
              required: ['toUnitId', 'kind'],
            },
          },
          examples: { type: 'array', items: { type: 'string' } },
          cautions: { type: 'array', items: { type: 'string' } },
          segmentRefs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                chunkId: { type: 'string' },
                status: { type: 'string', enum: ['pending'] },
              },
              required: ['chunkId', 'status'],
            },
          },
          incomplete: { type: 'boolean' },
          incompleteReason: { type: 'string' },
        },
        required: [
          'id',
          'title',
          'role',
          'explanation',
          'relations',
          'examples',
          'cautions',
          'segmentRefs',
          'incomplete',
        ],
      },
    },
    closure: {
      type: 'object',
      properties: {
        finalSynthesis: { type: 'string' },
        mainLearnings: { type: 'array', items: { type: 'string' } },
        openQuestions: { type: 'array', items: { type: 'string' } },
        reviewPrompt: { type: 'string' },
        comprehensionLimits: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'finalSynthesis',
        'mainLearnings',
        'openQuestions',
        'reviewPrompt',
        'comprehensionLimits',
      ],
    },
  },
  required: ['units', 'closure'],
} as const;

export function understandingResponseSchemaForStage(
  stage: 'blueprint' | 'units' | 'repair'
): typeof UNDERSTANDING_BLUEPRINT_RESPONSE_SCHEMA | typeof UNDERSTANDING_UNITS_RESPONSE_SCHEMA {
  if (stage === 'units') return UNDERSTANDING_UNITS_RESPONSE_SCHEMA;
  // repair uses the stage being repaired; callers pass via stage context — default blueprint
  return stage === 'repair'
    ? UNDERSTANDING_UNITS_RESPONSE_SCHEMA
    : UNDERSTANDING_BLUEPRINT_RESPONSE_SCHEMA;
}
