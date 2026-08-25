import type {
  CausalChainRenderSpec,
  GuidedReadingRenderSpec,
  RenderSpec,
  VisualizationPlan,
} from './visualizationPlan';

export function planToRenderSpec(plan: VisualizationPlan): RenderSpec {
  switch (plan.strategy) {
    case 'causal-chain':
      return causalChainSpec(plan);
    case 'guided-reading':
      return guidedReadingSpec(plan);
    default:
      throw new Error(`Renderer no implementado en slice 1: ${plan.strategy}`);
  }
}

function causalChainSpec(plan: VisualizationPlan): CausalChainRenderSpec {
  const order = plan.readingOrder;
  const byId = new Map(plan.elements.map((e) => [e.id, e]));
  const steps = order
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((el) => ({
      id: el!.id,
      label: el!.label,
      detail: el!.description,
    }));

  return {
    type: 'causal-chain',
    title: plan.title,
    insight: plan.expectedInsight,
    steps,
    edges: plan.relationships.map((r) => ({
      id: r.id,
      from: r.from,
      to: r.to,
      label: r.label,
      semanticType: r.semanticType,
    })),
  };
}

function guidedReadingSpec(plan: VisualizationPlan): GuidedReadingRenderSpec {
  const byId = new Map(plan.elements.map((e) => [e.id, e]));
  const nucleus = byId.get('nucleus') || plan.elements[0];
  const ideas = plan.elements.filter((e) => e.id.startsWith('idea-'));
  const example = byId.get('example');
  const check = byId.get('check');

  return {
    type: 'guided-reading',
    title: plan.title,
    insight: plan.expectedInsight,
    nucleus: {
      id: nucleus.id,
      label: nucleus.label,
      detail: nucleus.description,
    },
    ideas: ideas.map((i) => ({
      id: i.id,
      label: i.label,
      detail: i.description,
    })),
    example: example
      ? { id: example.id, label: example.label, detail: example.description }
      : undefined,
    check: check
      ? { id: check.id, prompt: check.description || check.label }
      : undefined,
  };
}
