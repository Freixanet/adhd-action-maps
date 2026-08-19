import { EDITORIAL_STYLE_ID } from './types';

export type LocalIllustrationAsset = {
  id: string;
  tags: readonly string[];
  /** Semantic roles this asset fits. */
  roles: readonly string[];
  compositions: readonly string[];
  accessibilityLabel: string;
  /** Deterministic glyph key rendered by mobile LocalEditorialGlyph. */
  glyph: string;
};

/**
 * Curated local set — nucleo-editorial-v1 only.
 * Fast path: never block generation on external APIs.
 */
export const LOCAL_ILLUSTRATION_CATALOG: readonly LocalIllustrationAsset[] = [
  {
    id: 'local-peak-sunrise',
    tags: ['peak', 'sunrise', 'path', 'goal', 'hiker'],
    roles: ['hero-scene', 'progress-path'],
    compositions: ['centered', 'path-progress'],
    accessibilityLabel: 'Persona en un camino hacia una cima',
    glyph: 'peak-sunrise',
  },
  {
    id: 'local-three-enemies',
    tags: ['procrastinate', 'clock', 'target', 'checklist', 'goal', 'list'],
    roles: ['comparison', 'spot-illustration'],
    compositions: ['left-right', 'sequence'],
    accessibilityLabel: 'Tres enemigos con metáforas distintas',
    glyph: 'three-enemies',
  },
  {
    id: 'local-enemy-clock',
    tags: ['procrastinate', 'clock'],
    roles: ['spot-illustration', 'comparison'],
    compositions: ['centered'],
    accessibilityLabel: 'Reloj bloqueado',
    glyph: 'enemy-clock',
  },
  {
    id: 'local-enemy-target',
    tags: ['target', 'goal', 'perfection'],
    roles: ['spot-illustration', 'comparison'],
    compositions: ['centered'],
    accessibilityLabel: 'Diana inalcanzable',
    glyph: 'enemy-target',
  },
  {
    id: 'local-enemy-checklist',
    tags: ['checklist', 'list', 'plan'],
    roles: ['spot-illustration', 'comparison'],
    compositions: ['centered'],
    accessibilityLabel: 'Lista sin movimiento',
    glyph: 'enemy-checklist',
  },
  {
    id: 'local-experiment-flow',
    tags: ['experiment', 'sequence', 'shield', 'choice'],
    roles: ['experiment-sequence', 'process-diagram'],
    compositions: ['sequence', 'cause-effect'],
    accessibilityLabel: 'Secuencia de experimento',
    glyph: 'experiment-flow',
  },
  {
    id: 'local-mind-crack',
    tags: ['mind', 'insight', 'belief', 'procrastinate'],
    roles: ['concept-metaphor'],
    compositions: ['centered', 'transformation'],
    accessibilityLabel: 'Mente con idea central marcada',
    glyph: 'mind-insight',
  },
  {
    id: 'local-tools-grid',
    tags: ['tool', 'vision', 'run', 'padlock', 'group', 'environment'],
    roles: ['spot-illustration'],
    compositions: ['layers', 'centered'],
    accessibilityLabel: 'Cuatro herramientas',
    glyph: 'tools-four',
  },
  {
    id: 'local-flag-peak',
    tags: ['peak', 'flag', 'apply', 'path'],
    roles: ['progress-path', 'hero-scene'],
    compositions: ['obstacle-goal', 'path-progress'],
    accessibilityLabel: 'Cima con bandera',
    glyph: 'flag-peak',
  },
  {
    id: 'local-compare-scales',
    tags: ['compare', 'balance', 'evaluate'],
    roles: ['comparison'],
    compositions: ['left-right', 'before-after'],
    accessibilityLabel: 'Comparación en dos lados',
    glyph: 'compare-sides',
  },
  {
    id: 'local-evidence-quote',
    tags: ['evidence', 'quote', 'remember'],
    roles: ['evidence-visual'],
    compositions: ['centered'],
    accessibilityLabel: 'Marca de evidencia',
    glyph: 'evidence-mark',
  },
  {
    id: 'local-reflect',
    tags: ['reflect', 'mind', 'insight'],
    roles: ['concept-metaphor', 'spot-illustration'],
    compositions: ['centered'],
    accessibilityLabel: 'Reflexión',
    glyph: 'reflect',
  },
  {
    id: 'local-neutral-spacer',
    tags: ['neutral'],
    roles: ['spot-illustration'],
    compositions: ['centered'],
    accessibilityLabel: 'Espacio visual neutro',
    glyph: 'neutral',
  },
] as const;

export const LOCAL_CATALOG_STYLE = EDITORIAL_STYLE_ID;

export function getLocalAssetById(id: string): LocalIllustrationAsset | undefined {
  return LOCAL_ILLUSTRATION_CATALOG.find((a) => a.id === id);
}
