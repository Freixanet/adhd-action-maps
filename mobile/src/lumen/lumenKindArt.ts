import type { ImageSourcePropType } from 'react-native';
import type { CanvasKind } from '@shared/lumen/types';

/**
 * Lumen workspace kind photos (`public/art/*.jpg`).
 * Collection reuses compare; guide reuses plan — same as Lumen.
 */
export const LUMEN_KIND_ART: Record<CanvasKind, ImageSourcePropType> = {
  explain: require('../../assets/lumen-art/explain.jpg'),
  recipe: require('../../assets/lumen-art/recipe.jpg'),
  compare: require('../../assets/lumen-art/compare.jpg'),
  plan: require('../../assets/lumen-art/plan.jpg'),
  collection: require('../../assets/lumen-art/compare.jpg'),
  guide: require('../../assets/lumen-art/plan.jpg'),
};
