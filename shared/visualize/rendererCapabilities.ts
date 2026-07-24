import type { VisualStrategy } from './visualStrategy';

export type StructuralBudget = {
  maxPrimaryElements: number;
  maxSecondaryElements: number;
  maxTitleChars: number;
  maxLabelChars: number;
  maxDescriptionChars: number;
  maxInteractions: number;
  maxBranches: number;
};

export type RendererCapability = {
  strategy: VisualStrategy;
  supportsMobile: boolean;
  budget: StructuralBudget;
};

const MOBILE_BUDGET: StructuralBudget = {
  maxPrimaryElements: 5,
  maxSecondaryElements: 4,
  maxTitleChars: 90,
  maxLabelChars: 55,
  maxDescriptionChars: 140,
  maxInteractions: 2,
  maxBranches: 3,
};

export const RENDERER_CAPABILITIES: Record<VisualStrategy, RendererCapability> = {
  'causal-chain': {
    strategy: 'causal-chain',
    supportsMobile: true,
    budget: { ...MOBILE_BUDGET, maxPrimaryElements: 5, maxInteractions: 1 },
  },
  'branching-causality': {
    strategy: 'branching-causality',
    supportsMobile: true,
    budget: { ...MOBILE_BUDGET, maxPrimaryElements: 5, maxBranches: 3 },
  },
  'side-by-side-comparison': {
    strategy: 'side-by-side-comparison',
    supportsMobile: true,
    budget: { ...MOBILE_BUDGET, maxPrimaryElements: 4, maxInteractions: 2 },
  },
  'process-flow': {
    strategy: 'process-flow',
    supportsMobile: true,
    budget: { ...MOBILE_BUDGET, maxPrimaryElements: 5 },
  },
  'guided-reading': {
    strategy: 'guided-reading',
    supportsMobile: true,
    budget: { ...MOBILE_BUDGET, maxPrimaryElements: 4, maxInteractions: 0 },
  },
};

export function getRendererCapability(strategy: VisualStrategy): RendererCapability {
  return RENDERER_CAPABILITIES[strategy];
}
