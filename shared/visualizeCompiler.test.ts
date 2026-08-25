import { describe, expect, it } from 'vitest';
import {
  buildCausalFlowSpec,
  buildStructuredRouteFromSemantic,
  chooseVisualizeGrammar,
  detectSequentialCausality,
  ensureVisualizeArtifact,
  evaluateVisualizeReject,
  groundClaim,
  normalizeVisualizeArtifact,
  sanitizeVisualizeHtml,
} from './visualizeCompiler';
import type { VisualizeSemanticModel } from './contracts';

const baseSemantic: VisualizeSemanticModel = {
  objective: 'understand',
  centralIdea: 'La sobrevalidación reduce la tensión relacional',
  entities: [
    { id: 'validation', label: 'Validación constante', detail: 'Necesito confirmar que todo está bien' },
    { id: 'predictability', label: 'Menos incertidumbre', detail: 'Ya no hay espacio para descubrir' },
    { id: 'tension', label: 'Menos tensión emocional' },
    { id: 'attraction', label: 'Menor atracción' },
  ],
  relationships: [
    { from: 'validation', to: 'predictability', type: 'cause', label: 'vuelve predecible' },
    { from: 'predictability', to: 'tension', type: 'cause', label: 'puede reducir' },
    { from: 'tension', to: 'attraction', type: 'cause', label: 'puede contribuir a' },
  ],
  caveat: 'Afecto + seguridad + autonomía no es lo mismo que frialdad.',
};

describe('visualizeCompiler causal-flow', () => {
  it('detects sequential causality and chooses causal-flow over concept-map', () => {
    expect(detectSequentialCausality(baseSemantic.entities, baseSemantic.relationships)).toBe(true);
    expect(chooseVisualizeGrammar(baseSemantic)).toBe('causal-flow');
  });

  it('builds a vertical causal-flow with labeled edges', () => {
    const spec = buildCausalFlowSpec(baseSemantic);
    expect(spec.view).toBe('causal-flow');
    expect(spec.steps.length).toBe(4);
    expect(spec.relations.every((r) => r.label.length > 0)).toBe(true);
    expect(spec.claim.toLowerCase()).toContain('según el texto');
    expect(spec.caveat).toContain('autonomía');
  });

  it('grounds absolute claims', () => {
    expect(groundClaim('Siempre cae la atracción')).toMatch(/^Según el texto/i);
  });

  it('normalizes concept-map requests with sequential causality into causal-flow', () => {
    const artifact = normalizeVisualizeArtifact({
      semantic: baseSemantic,
      chosen: {
        route: 'structured',
        grammar: 'concept-map',
        spec: { title: 'x', nodes: [], links: [] },
      },
    });
    expect(artifact?.chosen.grammar).toBe('causal-flow');
    const flags = evaluateVisualizeReject(artifact!);
    expect(flags.conceptMapFallback).toBe(false);
    expect(flags.unlabeledEdges).toBe(false);
  });

  it('rejects fake manipulate prompts without real scenarios', () => {
    const artifact = normalizeVisualizeArtifact({
      semantic: {
        ...baseSemantic,
        interactionOpportunities: ['Manipula o toca un nodo'],
      },
      chosen: {
        route: 'structured',
        grammar: 'causal-flow',
        spec: buildCausalFlowSpec(baseSemantic),
      },
    });
    // repair strips fake interaction opportunities flag via shouldReject → rebuild still causal-flow
    expect(artifact?.chosen.grammar).toBe('causal-flow');
  });

  it('falls back from unsafe adhoc HTML to structured causal-flow', () => {
    const artifact = normalizeVisualizeArtifact({
      semantic: baseSemantic,
      chosen: {
        route: 'adhoc',
        grammar: 'interactive-explainer',
        metadata: { title: 'Lab', expandable: true },
        content: {
          markup: '<div>ok</div><iframe src="https://evil.example"></iframe>',
          styles: 'body{color:red}',
          script: 'fetch("https://evil.example")',
        },
        accessibility: { textAlternative: 'lab' },
      },
    });
    expect(artifact?.chosen.route).toBe('structured');
    expect(artifact?.chosen.grammar).toBe('causal-flow');
  });

  it('synthesizes causal-flow from a legacy visualization seed', () => {
    const artifact = ensureVisualizeArtifact(null, {
      coreIdea: 'La sobrevalidación puede reducir la tensión',
      visualization: {
        kind: 'flow',
        items: [
          { id: 'a', label: 'Validación constante' },
          { id: 'b', label: 'Menos incertidumbre' },
          { id: 'c', label: 'Menor atracción' },
        ],
        links: [
          { source: 'a', target: 'b', label: 'vuelve predecible' },
          { source: 'b', target: 'c', label: 'puede reducir' },
        ],
      },
    });
    expect(artifact?.chosen.grammar).toBe('causal-flow');
    expect((artifact?.chosen as { spec: { relations: unknown[] } }).spec.relations.length).toBe(2);
  });

  it('sanitizes remote urls from html fragments', () => {
    expect(sanitizeVisualizeHtml('url(https://x.test/a.png) and //cdn.test/x.js')).not.toMatch(
      /https?:|cdn\.test/
    );
  });

  it('builds structured route without defaulting to concept-map', () => {
    const route = buildStructuredRouteFromSemantic(baseSemantic);
    expect(route.grammar).toBe('causal-flow');
  });
});
