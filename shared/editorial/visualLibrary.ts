/**
 * Provider-neutral editorial visual catalog.
 *
 * Pages and the selector never bind to a vendor. The provisional pack below
 * happens to be Storyset Bro stored locally; swap `EDITORIAL_ASSET_CATALOG`
 * (or filter by provider) to replace it without touching page components.
 */

export type VisualIntent =
  | 'progress-toward-goal'
  | 'procrastination'
  | 'perfectionism'
  | 'overplanning'
  | 'internal-enemies'
  | 'choice'
  | 'hard-test'
  | 'ego-protection'
  | 'self-handicap-sequence'
  | 'attention-drain'
  | 'interruption-cost'
  | 'focus-path';

export type VisualRole =
  | 'hero'
  | 'metaphor'
  | 'comparison'
  | 'sequence'
  | 'spot';

export type VisualComposition =
  | 'centered-scene'
  | 'path-progress'
  | 'triptych'
  | 'causal-strip'
  | 'vertical-blocks'
  | 'spot';

/** Neutral asset contract — no vendor-specific fields required by UI. */
export type EditorialVisualAsset = {
  id: string;
  provider: string;
  family: string;
  sourceUrl?: string;
  intentTags: readonly VisualIntent[];
  visualRole: VisualRole;
  compatibleCompositions: readonly VisualComposition[];
  license: string;
  attributionRequired: boolean;
  accessibilityLabel: string;
  /** Key into the mobile bundled SVG map (offline). */
  localModule: string;
  concepts: readonly string[];
  synonyms: readonly string[];
  /**
   * Optional tighter viewBox for comparable visual weight without redrawing.
   * Format: "minX minY width height"
   */
  focusViewBox?: string;
  /**
   * Legacy aliases kept populated so a stale Metro bundle that still reads
   * `intents` / `role` / `compositions` does not crash on `.includes`.
   */
  intents: readonly VisualIntent[];
  role: VisualRole;
  compositions: readonly VisualComposition[];
};

/** @deprecated Use EditorialVisualAsset — alias kept for gradual migration. */
export type VisualAsset = EditorialVisualAsset;

/** Provisional pack id — not a permanent Nucleo brand commitment. */
export const PROVISIONAL_ILLUSTRATION_PROVIDER = 'storyset' as const;
export const PROVISIONAL_ILLUSTRATION_FAMILY = 'bro' as const;

/**
 * Active catalog. Replace or extend this array to swap providers.
 * Selection is semantic (intent/role/composition), never positional.
 */
export const EDITORIAL_ASSET_CATALOG: readonly EditorialVisualAsset[] = [
  {
    id: 'viz-progress-path',
    provider: PROVISIONAL_ILLUSTRATION_PROVIDER,
    family: PROVISIONAL_ILLUSTRATION_FAMILY,
    sourceUrl: 'https://storyset.com/illustration/hiking/bro',
    intentTags: ['progress-toward-goal', 'focus-path'],
    visualRole: 'hero',
    compatibleCompositions: ['path-progress', 'centered-scene'],
    intents: ['progress-toward-goal', 'focus-path'],
    role: 'hero',
    compositions: ['path-progress', 'centered-scene'],
    license: 'storyset-freepik-attribution',
    attributionRequired: true,
    accessibilityLabel: 'Persona con mochila avanzando hacia una montaña',
    localModule: 'hiking',
    concepts: ['progress', 'goal', 'path', 'summit', 'hiker', 'hiking'],
    synonyms: ['peak', 'mountain', 'caminar', 'meta', 'avance'],
    // Soft inset — keep full hiking subject, no hard crop.
    focusViewBox: '8 0 484 500',
  },
  {
    id: 'viz-procrastinate-delay',
    provider: PROVISIONAL_ILLUSTRATION_PROVIDER,
    family: PROVISIONAL_ILLUSTRATION_FAMILY,
    sourceUrl: 'https://storyset.com/illustration/procrastination/bro',
    intentTags: ['procrastination', 'internal-enemies'],
    visualRole: 'metaphor',
    compatibleCompositions: ['vertical-blocks', 'triptych', 'spot'],
    intents: ['procrastination', 'internal-enemies'],
    role: 'metaphor',
    compositions: ['vertical-blocks', 'triptych', 'spot'],
    license: 'storyset-freepik-attribution',
    attributionRequired: true,
    accessibilityLabel: 'Reloj con la palabra later y personas que aplazan',
    localModule: 'procrastination',
    concepts: ['delay', 'avoidance', 'procrastination', 'clock'],
    synonyms: ['aplazar', 'evitar', 'demora', 'later'],
    // Safe padded frame — never crop subject edges at 200 px slots.
    focusViewBox: '-30 -30 810 560',
  },
  {
    id: 'viz-perfect-fragile',
    provider: PROVISIONAL_ILLUSTRATION_PROVIDER,
    family: PROVISIONAL_ILLUSTRATION_FAMILY,
    sourceUrl: 'https://storyset.com/illustration/target/bro',
    intentTags: ['perfectionism', 'internal-enemies'],
    visualRole: 'metaphor',
    compatibleCompositions: ['vertical-blocks', 'triptych', 'spot'],
    intents: ['perfectionism', 'internal-enemies'],
    role: 'metaphor',
    compositions: ['vertical-blocks', 'triptych', 'spot'],
    license: 'storyset-freepik-attribution',
    attributionRequired: true,
    accessibilityLabel: 'Arquero apuntando a una diana',
    localModule: 'target',
    concepts: ['perfection', 'target', 'aim'],
    synonyms: ['perfeccionismo', 'impecable', 'diana'],
    focusViewBox: '-36 -36 572 572',
  },
  {
    id: 'viz-plans-stuck',
    provider: PROVISIONAL_ILLUSTRATION_PROVIDER,
    family: PROVISIONAL_ILLUSTRATION_FAMILY,
    sourceUrl: 'https://storyset.com/illustration/schedule/bro',
    intentTags: ['overplanning', 'internal-enemies'],
    visualRole: 'metaphor',
    compatibleCompositions: ['vertical-blocks', 'triptych', 'spot'],
    intents: ['overplanning', 'internal-enemies'],
    role: 'metaphor',
    compositions: ['vertical-blocks', 'triptych', 'spot'],
    license: 'storyset-freepik-attribution',
    attributionRequired: true,
    accessibilityLabel: 'Persona junto a un calendario sobrecargado',
    localModule: 'schedule',
    concepts: ['plans', 'schedule', 'checklist'],
    synonyms: ['planificación', 'lista', 'calendario'],
    focusViewBox: '-28 -28 556 556',
  },
  {
    id: 'viz-choice-harmful',
    provider: PROVISIONAL_ILLUSTRATION_PROVIDER,
    family: PROVISIONAL_ILLUSTRATION_FAMILY,
    sourceUrl: 'https://storyset.com/illustration/choice/bro',
    intentTags: ['choice', 'self-handicap-sequence'],
    visualRole: 'metaphor',
    compatibleCompositions: ['causal-strip', 'spot'],
    intents: ['choice', 'self-handicap-sequence'],
    role: 'metaphor',
    compositions: ['causal-strip', 'spot'],
    license: 'storyset-freepik-attribution',
    attributionRequired: true,
    accessibilityLabel: 'Persona eligiendo entre dos opciones',
    localModule: 'choice',
    concepts: ['choice', 'decision', 'option'],
    synonyms: ['elección', 'opción', 'decidir'],
    focusViewBox: '-24 -24 548 548',
  },
  {
    id: 'viz-hard-test',
    provider: PROVISIONAL_ILLUSTRATION_PROVIDER,
    family: PROVISIONAL_ILLUSTRATION_FAMILY,
    sourceUrl: 'https://storyset.com/illustration/exams/bro',
    intentTags: ['hard-test', 'self-handicap-sequence'],
    visualRole: 'metaphor',
    compatibleCompositions: ['causal-strip', 'spot'],
    intents: ['hard-test', 'self-handicap-sequence'],
    role: 'metaphor',
    compositions: ['causal-strip', 'spot'],
    license: 'storyset-freepik-attribution',
    attributionRequired: true,
    accessibilityLabel: 'Persona en una prueba difícil rodeada de exámenes',
    localModule: 'exams',
    concepts: ['test', 'exam', 'challenge'],
    synonyms: ['prueba', 'examen', 'evaluación'],
    focusViewBox: '-24 -24 548 548',
  },
  {
    id: 'viz-ego-protection',
    provider: PROVISIONAL_ILLUSTRATION_PROVIDER,
    family: PROVISIONAL_ILLUSTRATION_FAMILY,
    sourceUrl: 'https://storyset.com/illustration/anxiety/bro',
    intentTags: ['ego-protection', 'self-handicap-sequence'],
    visualRole: 'metaphor',
    compatibleCompositions: ['causal-strip', 'spot'],
    intents: ['ego-protection', 'self-handicap-sequence'],
    role: 'metaphor',
    compositions: ['causal-strip', 'spot'],
    license: 'storyset-freepik-attribution',
    attributionRequired: true,
    accessibilityLabel: 'Persona protegiéndose bajo presión emocional',
    localModule: 'anxiety',
    concepts: ['excuse', 'ego', 'anxiety', 'protection'],
    synonyms: ['excusa', 'autoimagen', 'protección', 'ansiedad'],
    focusViewBox: '-24 -24 548 548',
  },
] as const;

/** Active library alias used by the selector. */
export const VISUAL_LIBRARY: readonly EditorialVisualAsset[] = EDITORIAL_ASSET_CATALOG;

/** @deprecated Legacy family id — kept for older tests/docs; not a paint path. */
export const NUCLEO_VISUAL_FAMILY_ID = 'provisional-local-pack-v1' as const;

export function getVisualAssetById(id: string): EditorialVisualAsset | undefined {
  return EDITORIAL_ASSET_CATALOG.find((a) => a.id === id);
}

export function getVisualAssetByLocalModule(localModule: string): EditorialVisualAsset | undefined {
  return EDITORIAL_ASSET_CATALOG.find((a) => a.localModule === localModule);
}
