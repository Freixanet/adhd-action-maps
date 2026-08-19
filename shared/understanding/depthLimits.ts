import type { MapDepth } from '../contracts';

/** Depth controls density — never licenses dropping mustKeep cautions. */
export type UnderstandingDepthBudget = {
  depth: MapDepth;
  maxUnits: number;
  minUnits: number;
  maxExamplesPerUnit: number;
  maxRelations: number;
  blueprintMaxOutputTokens: number;
  unitsMaxOutputTokens: number;
};

export function understandingDepthBudget(depth: MapDepth | undefined): UnderstandingDepthBudget {
  if (depth === 'rapido') {
    return {
      depth: 'rapido',
      maxUnits: 4,
      minUnits: 2,
      maxExamplesPerUnit: 1,
      maxRelations: 4,
      blueprintMaxOutputTokens: 4096,
      unitsMaxOutputTokens: 8192,
    };
  }
  if (depth === 'profundo') {
    return {
      depth: 'profundo',
      maxUnits: 9,
      minUnits: 5,
      maxExamplesPerUnit: 3,
      maxRelations: 14,
      blueprintMaxOutputTokens: 6144,
      unitsMaxOutputTokens: 24576,
    };
  }
  return {
    depth: 'estandar',
    maxUnits: 6,
    minUnits: 3,
    maxExamplesPerUnit: 2,
    maxRelations: 8,
    blueprintMaxOutputTokens: 5120,
    unitsMaxOutputTokens: 16384,
  };
}
