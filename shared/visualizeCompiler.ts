import type {
  VisualizeArtifact,
  VisualizeGrammar,
  VisualizeObjective,
  VisualizeRouteA,
  VisualizeRouteC,
  VisualizeSemanticModel,
} from './contracts';

export const VISUALIZE_MAX_ENTITIES = 12;
export const VISUALIZE_MAX_RELATIONSHIPS = 16;
export const VISUALIZE_MAX_HTML_BYTES = 80 * 1024;
/** Max steps in a mobile causal-flow. */
export const VISUALIZE_MAX_FLOW_STEPS = 6;

const OBJECTIVES: VisualizeObjective[] = [
  'understand',
  'compare',
  'explore',
  'calculate',
  'practice',
  'decide',
  'act',
];

const GRAMMARS: VisualizeGrammar[] = [
  'chart',
  'timeline',
  'process',
  'causal-flow',
  'concept-map',
  'causal-diagram',
  'comparison',
  'simulation',
  'calculator',
  'interactive-explainer',
];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function resolveObjective(value: unknown): VisualizeObjective {
  return OBJECTIVES.includes(value as VisualizeObjective)
    ? (value as VisualizeObjective)
    : 'understand';
}

function resolveGrammar(value: unknown): VisualizeGrammar {
  const raw = asString(value);
  if (raw === 'causal-diagram' || raw === 'process') return 'causal-flow';
  return GRAMMARS.includes(value as VisualizeGrammar)
    ? (value as VisualizeGrammar)
    : 'causal-flow';
}

function slugId(raw: string, fallback: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned || fallback;
}

function normalizeTextKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textsTooSimilar(a: string, b: string): boolean {
  const na = normalizeTextKey(a);
  const nb = normalizeTextKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(' ').filter((w) => w.length > 3));
  const wb = nb.split(' ').filter((w) => w.length > 3);
  if (wa.size === 0 || wb.length === 0) return false;
  const overlap = wb.filter((w) => wa.has(w)).length;
  return overlap / Math.max(wb.length, 1) >= 0.7;
}

/** Strip remote URLs and nested iframes from LLM HTML (Route C safety). */
export function sanitizeVisualizeHtml(input: string): string {
  return input
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '')
    .replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(https?:)?\/\/[^\s"'<>]+/gi, '')
    .replace(/url\s*\(\s*['"]?[^)]+['"]?\s*\)/gi, 'none');
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function orderEntitiesByChain(
  entities: VisualizeSemanticModel['entities'],
  relationships: VisualizeSemanticModel['relationships']
): VisualizeSemanticModel['entities'] {
  if (entities.length < 2 || relationships.length === 0) return entities;
  const byId = new Map(entities.map((e) => [e.id, e]));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  entities.forEach((e) => {
    outgoing.set(e.id, []);
    indegree.set(e.id, 0);
  });
  relationships.forEach((r) => {
    if (!byId.has(r.from) || !byId.has(r.to)) return;
    outgoing.get(r.from)!.push(r.to);
    indegree.set(r.to, (indegree.get(r.to) ?? 0) + 1);
  });
  const queue = entities.filter((e) => (indegree.get(e.id) ?? 0) === 0).map((e) => e.id);
  const ordered: string[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
    for (const next of outgoing.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if ((indegree.get(next) ?? 0) <= 0) queue.push(next);
    }
  }
  entities.forEach((e) => {
    if (!seen.has(e.id)) ordered.push(e.id);
  });
  return ordered.map((id) => byId.get(id)!).filter(Boolean);
}

/**
 * Detect sequential causality (chain) vs dense network.
 * Chain → causal-flow. Dense multi-parent network → concept-map only when needed.
 */
export function detectSequentialCausality(
  entities: VisualizeSemanticModel['entities'],
  relationships: VisualizeSemanticModel['relationships']
): boolean {
  if (entities.length < 2) return false;
  if (relationships.length === 0) return entities.length >= 2;
  const outs = new Map<string, number>();
  const ins = new Map<string, number>();
  relationships.forEach((r) => {
    outs.set(r.from, (outs.get(r.from) ?? 0) + 1);
    ins.set(r.to, (ins.get(r.to) ?? 0) + 1);
  });
  const branching = [...outs.values()].filter((n) => n > 1).length;
  const multiParent = [...ins.values()].filter((n) => n > 1).length;
  // Mostly a path / chain: few branches and few multi-parent nodes.
  return branching <= 1 && multiParent <= 1;
}

export function chooseVisualizeGrammar(semantic: VisualizeSemanticModel): VisualizeGrammar {
  if ((semantic.scenarios?.length ?? 0) >= 2) return 'comparison';
  if (semantic.comparisons?.length) return 'comparison';
  if ((semantic.variables?.length ?? 0) >= 2) return 'simulation';
  if (semantic.processes?.length) return 'causal-flow';
  if (detectSequentialCausality(semantic.entities, semantic.relationships)) {
    return 'causal-flow';
  }
  if (semantic.relationships.length >= semantic.entities.length) {
    return 'concept-map';
  }
  return 'causal-flow';
}

export type CausalFlowSpec = {
  view: 'causal-flow';
  claim: string;
  caveat?: string;
  steps: Array<{ id: string; title: string; detail?: string }>;
  relations: Array<{ from: string; to: string; label: string }>;
  scenarios?: VisualizeSemanticModel['scenarios'];
  /** Only true when interaction changes what relation is visible. */
  interaction?: { kind: 'scenario-toggle'; labels: [string, string] };
};

export function buildCausalFlowSpec(semantic: VisualizeSemanticModel): CausalFlowSpec {
  const ordered = orderEntitiesByChain(semantic.entities, semantic.relationships).slice(
    0,
    VISUALIZE_MAX_FLOW_STEPS
  );
  const idSet = new Set(ordered.map((e) => e.id));
  const steps = ordered
    .filter((e): e is NonNullable<typeof e> => Boolean(e?.id && e?.label))
    .map((e) => ({
      id: e.id,
      title: e.label.slice(0, 64),
      detail: e.detail && !textsTooSimilar(e.label, e.detail) ? e.detail.slice(0, 140) : undefined,
    }));

  const relByPair = new Map<string, string>();
  semantic.relationships.forEach((r) => {
    if (!idSet.has(r.from) || !idSet.has(r.to)) return;
    const label = (r.label || r.type || 'lleva a').slice(0, 48);
    relByPair.set(`${r.from}->${r.to}`, label);
  });

  const relations: CausalFlowSpec['relations'] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const from = steps[i]!.id;
    const to = steps[i + 1]!.id;
    const label = relByPair.get(`${from}->${to}`) || 'puede llevar a';
    relations.push({ from, to, label });
  }

  const scenarios =
    semantic.scenarios && semantic.scenarios.length >= 2
      ? semantic.scenarios.slice(0, 2).map((s) => ({
          id: s.id,
          label: s.label.slice(0, 40),
          claim: s.claim,
          steps: s.steps.slice(0, VISUALIZE_MAX_FLOW_STEPS).map((st) => ({
            id: st.id,
            title: st.title.slice(0, 64),
            detail: st.detail?.slice(0, 140),
          })),
          relations: s.relations.slice(0, VISUALIZE_MAX_FLOW_STEPS).map((r) => ({
            from: r.from,
            to: r.to,
            label: r.label.slice(0, 48),
          })),
        }))
      : undefined;

  return {
    view: 'causal-flow',
    claim: groundClaim(semantic.centralIdea),
    caveat: semantic.caveat?.slice(0, 220),
    steps,
    relations,
    scenarios,
    interaction:
      scenarios && scenarios.length >= 2
        ? {
            kind: 'scenario-toggle',
            labels: [scenarios[0]!.label, scenarios[1]!.label],
          }
        : undefined,
  };
}

/** Soften absolute claims so they read as source-grounded. */
export function groundClaim(claim: string): string {
  const text = claim.trim();
  if (!text) return text;
  if (/^según\b/i.test(text) || /\bpuede\b/i.test(text) || /\bsegún el texto\b/i.test(text)) {
    return text.slice(0, 180);
  }
  if (/^(es|son|siempre|nunca|todo|toda)\b/i.test(text)) {
    return `Según el texto, ${text.charAt(0).toLowerCase()}${text.slice(1)}`.slice(0, 180);
  }
  return `Según el texto, ${text.charAt(0).toLowerCase()}${text.slice(1)}`.slice(0, 180);
}

function normalizeSemantic(input: unknown): VisualizeSemanticModel | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const centralIdea = asString(raw.centralIdea);
  if (!centralIdea) return null;

  const entityRaw = Array.isArray(raw.entities) ? raw.entities : [];
  const entities = entityRaw
    .map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const label = asString(row.label);
      if (!label) return null;
      const detail = asString(row.detail);
      return {
        id: slugId(asString(row.id) || label, `e${index + 1}`),
        label: label.slice(0, 64),
        detail: detail && !textsTooSimilar(label, detail) ? detail.slice(0, 140) : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, VISUALIZE_MAX_ENTITIES) as VisualizeSemanticModel['entities'];

  if (entities.length < 2) return null;

  const entityIds = new Set(entities.map((e) => e.id));
  const relRaw = Array.isArray(raw.relationships) ? raw.relationships : [];
  const relationships = relRaw
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const from = asString(row.from);
      const to = asString(row.to);
      const type = asString(row.type) || 'relates';
      const label = asString(row.label) || type;
      if (!from || !to || !entityIds.has(from) || !entityIds.has(to) || from === to) return null;
      return {
        from,
        to,
        type: type.slice(0, 32),
        label: label.slice(0, 48),
      };
    })
    .filter(Boolean)
    .slice(0, VISUALIZE_MAX_RELATIONSHIPS) as VisualizeSemanticModel['relationships'];

  const variables = Array.isArray(raw.variables)
    ? (raw.variables
        .map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const label = asString(row.label);
          if (!label) return null;
          return {
            id: slugId(asString(row.id) || label, `v${index + 1}`),
            label: label.slice(0, 40),
            min: asFiniteNumber(row.min),
            max: asFiniteNumber(row.max),
            unit: asString(row.unit) || undefined,
          };
        })
        .filter(Boolean) as NonNullable<VisualizeSemanticModel['variables']>)
    : undefined;

  const processes = Array.isArray(raw.processes)
    ? (raw.processes
        .map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const steps = Array.isArray(row.steps)
            ? row.steps.map((s) => asString(s)).filter(Boolean).slice(0, 8)
            : [];
          if (steps.length < 2) return null;
          return {
            id: slugId(asString(row.id) || `p${index + 1}`, `p${index + 1}`),
            steps,
          };
        })
        .filter(Boolean) as NonNullable<VisualizeSemanticModel['processes']>)
    : undefined;

  const comparisons = Array.isArray(raw.comparisons)
    ? (raw.comparisons
        .map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const axes = Array.isArray(row.axes)
            ? row.axes.map((a) => asString(a)).filter(Boolean).slice(0, 4)
            : [];
          const rows = Array.isArray(row.rows)
            ? (row.rows
                .map((r) => {
                  if (!r || typeof r !== 'object') return null;
                  const out: Record<string, string | number> = {};
                  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
                    if (typeof v === 'string' || typeof v === 'number') out[k] = v;
                  }
                  return Object.keys(out).length ? out : null;
                })
                .filter(Boolean) as Record<string, string | number>[])
            : [];
          if (axes.length < 1 || rows.length < 1) return null;
          return {
            id: slugId(asString(row.id) || `c${index + 1}`, `c${index + 1}`),
            axes,
            rows: rows.slice(0, 8),
          };
        })
        .filter(Boolean) as NonNullable<VisualizeSemanticModel['comparisons']>)
    : undefined;

  const scenarios = Array.isArray(raw.scenarios)
    ? (raw.scenarios
        .map((item, index) => {
          const row = (item ?? {}) as Record<string, unknown>;
          const label = asString(row.label);
          const stepsRaw = Array.isArray(row.steps) ? row.steps : [];
          const steps = stepsRaw
            .map((st, i) => {
              const s = (st ?? {}) as Record<string, unknown>;
              const title = asString(s.title);
              if (!title) return null;
              return {
                id: slugId(asString(s.id) || title, `s${index}_${i}`),
                title: title.slice(0, 64),
                detail: asString(s.detail).slice(0, 140) || undefined,
              };
            })
            .filter(Boolean) as Array<{ id: string; title: string; detail?: string }>;
          const rels = Array.isArray(row.relations)
            ? (row.relations
                .map((r) => {
                  const rel = (r ?? {}) as Record<string, unknown>;
                  const from = asString(rel.from);
                  const to = asString(rel.to);
                  const lab = asString(rel.label);
                  if (!from || !to || !lab) return null;
                  return { from, to, label: lab.slice(0, 48) };
                })
                .filter(Boolean) as Array<{ from: string; to: string; label: string }>)
            : [];
          if (!label || steps.length < 2) return null;
          return {
            id: slugId(asString(row.id) || label, `sc${index + 1}`),
            label: label.slice(0, 40),
            claim: asString(row.claim) || undefined,
            steps,
            relations:
              rels.length > 0
                ? rels
                : steps.slice(0, -1).map((st, i) => ({
                    from: st.id,
                    to: steps[i + 1]!.id,
                    label: 'puede llevar a',
                  })),
          };
        })
        .filter(Boolean) as NonNullable<VisualizeSemanticModel['scenarios']>)
    : undefined;

  const caveat = asString(raw.caveat) || undefined;
  const interactionOpportunities = Array.isArray(raw.interactionOpportunities)
    ? raw.interactionOpportunities.map((s) => asString(s)).filter(Boolean).slice(0, 6)
    : undefined;

  return {
    objective: resolveObjective(raw.objective),
    centralIdea: groundClaim(centralIdea).slice(0, 180),
    entities,
    relationships,
    variables: variables?.length ? variables.slice(0, 6) : undefined,
    processes: processes?.length ? processes.slice(0, 3) : undefined,
    comparisons: comparisons?.length ? comparisons.slice(0, 2) : undefined,
    caveat: caveat?.slice(0, 220),
    scenarios: scenarios?.length ? scenarios.slice(0, 2) : undefined,
    interactionOpportunities: interactionOpportunities?.length
      ? interactionOpportunities
      : undefined,
  };
}

export function buildStructuredRouteFromSemantic(
  semantic: VisualizeSemanticModel,
  preferredGrammar?: VisualizeGrammar
): VisualizeRouteA {
  const grammar = preferredGrammar
    ? resolveGrammar(preferredGrammar)
    : chooseVisualizeGrammar(semantic);

  if (grammar === 'chart') {
    const numeric = semantic.entities
      .map((e, i) => ({
        label: e.label,
        value: asFiniteNumber((e as { value?: unknown }).value) ?? i + 1,
      }))
      .slice(0, 6);
    return {
      route: 'structured',
      grammar: 'chart',
      spec: {
        title: semantic.centralIdea,
        chartType: 'bar',
        data: numeric,
      },
    };
  }

  if (grammar === 'comparison' && !semantic.scenarios?.length && semantic.comparisons?.[0]) {
    return {
      route: 'structured',
      grammar: 'comparison',
      spec: {
        title: semantic.centralIdea,
        axes: semantic.comparisons[0].axes,
        rows: semantic.comparisons[0].rows,
        caveat: semantic.caveat,
      },
    };
  }

  if (grammar === 'timeline') {
    return {
      route: 'structured',
      grammar: 'timeline',
      spec: {
        title: semantic.centralIdea,
        events: semantic.entities.map((e) => ({
          id: e.id,
          label: e.label,
          detail: e.detail,
        })),
      },
    };
  }

  if (grammar === 'concept-map' && !detectSequentialCausality(semantic.entities, semantic.relationships)) {
    return {
      route: 'structured',
      grammar: 'concept-map',
      spec: {
        title: semantic.centralIdea,
        nodes: semantic.entities.map((e) => ({
          id: e.id,
          label: e.label,
          detail: e.detail,
        })),
        links: semantic.relationships.map((r) => ({
          source: r.from,
          target: r.to,
          label: r.label || r.type,
        })),
      },
    };
  }

  // Default and preferred mobile grammar: vertical causal flow.
  return {
    route: 'structured',
    grammar: 'causal-flow',
    spec: buildCausalFlowSpec(semantic) as unknown as Record<string, unknown>,
  };
}

function isAdhocSafe(content: { markup: string; styles: string; script?: string }): boolean {
  const blob = `${content.markup}\n${content.styles}\n${content.script || ''}`;
  if (byteLength(blob) > VISUALIZE_MAX_HTML_BYTES) return false;
  if (/<iframe\b/i.test(blob)) return false;
  if (/\bfetch\s*\(/i.test(blob)) return false;
  if (/\bXMLHttpRequest\b/i.test(blob)) return false;
  if (/\blocalStorage\b/i.test(blob)) return false;
  if (/\bsessionStorage\b/i.test(blob)) return false;
  if (/\bWebSocket\b/i.test(blob)) return false;
  if (/\bimportScripts\b/i.test(blob)) return false;
  if (/https?:\/\//i.test(blob)) return false;
  return Boolean(content.markup.trim());
}

function normalizeRouteC(input: unknown, semantic: VisualizeSemanticModel): VisualizeRouteC | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const contentRaw = (raw.content ?? {}) as Record<string, unknown>;
  const markup = sanitizeVisualizeHtml(asString(contentRaw.markup));
  const styles = sanitizeVisualizeHtml(asString(contentRaw.styles));
  const scriptRaw = asString(contentRaw.script);
  const script = scriptRaw ? sanitizeVisualizeHtml(scriptRaw) : undefined;
  const content = { markup, styles, script };
  if (!isAdhocSafe(content)) return null;

  const meta = (raw.metadata ?? {}) as Record<string, unknown>;
  const a11y = (raw.accessibility ?? {}) as Record<string, unknown>;
  const textAlternative =
    asString(a11y.textAlternative) || semantic.centralIdea || 'Visualización interactiva';

  let initialState: Record<string, unknown> | undefined;
  if (raw.initialState && typeof raw.initialState === 'object' && !Array.isArray(raw.initialState)) {
    initialState = raw.initialState as Record<string, unknown>;
  }

  return {
    route: 'adhoc',
    grammar: resolveGrammar(raw.grammar),
    metadata: {
      title: asString(meta.title) || semantic.centralIdea.slice(0, 80),
      expandable: meta.expandable !== false,
    },
    content,
    initialState,
    accessibility: { textAlternative: textAlternative.slice(0, 240) },
  };
}

export type VisualizeRejectFlags = {
  unlabeledEdges: boolean;
  repeatedCoreClaim: boolean;
  fakeInteraction: boolean;
  emptyFlow: boolean;
  conceptMapFallback: boolean;
};

/** Measurable reject gates before showing a compiler overview. */
export function evaluateVisualizeReject(artifact: VisualizeArtifact): VisualizeRejectFlags {
  const chosen = artifact.chosen;
  const semantic = artifact.semantic;
  let unlabeledEdges = false;
  let repeatedCoreClaim = false;
  let fakeInteraction = false;
  let emptyFlow = false;
  let conceptMapFallback = false;

  if (chosen.route === 'structured' && chosen.grammar === 'causal-flow') {
    const spec = chosen.spec as Partial<CausalFlowSpec>;
    const steps = Array.isArray(spec.steps) ? spec.steps : [];
    const relations = Array.isArray(spec.relations) ? spec.relations : [];
    emptyFlow = steps.length < 2;
    unlabeledEdges = relations.some((r) => !asString(r?.label));
    if (spec.claim && steps.some((s) => textsTooSimilar(spec.claim!, s.title))) {
      repeatedCoreClaim = true;
    }
    if (spec.interaction && !(spec.scenarios && spec.scenarios.length >= 2)) {
      fakeInteraction = true;
    }
  }

  if (chosen.route === 'structured' && chosen.grammar === 'concept-map') {
    if (detectSequentialCausality(semantic.entities, semantic.relationships)) {
      conceptMapFallback = true;
    }
    const links = Array.isArray((chosen.spec as { links?: unknown }).links)
      ? ((chosen.spec as { links: Array<{ label?: string }> }).links)
      : [];
    unlabeledEdges = links.some((l) => !asString(l?.label));
  }

  const ops = semantic.interactionOpportunities ?? [];
  if (ops.some((o) => /manipula|toca un (nodo|elemento)/i.test(o)) && !semantic.scenarios?.length) {
    fakeInteraction = true;
  }

  return {
    unlabeledEdges,
    repeatedCoreClaim,
    fakeInteraction,
    emptyFlow,
    conceptMapFallback,
  };
}

export function shouldRejectVisualizeArtifact(artifact: VisualizeArtifact): boolean {
  const flags = evaluateVisualizeReject(artifact);
  return (
    flags.unlabeledEdges ||
    flags.emptyFlow ||
    flags.conceptMapFallback ||
    flags.fakeInteraction
  );
}

function repairArtifact(artifact: VisualizeArtifact): VisualizeArtifact {
  const flags = evaluateVisualizeReject(artifact);
  if (flags.conceptMapFallback || flags.emptyFlow || flags.unlabeledEdges) {
    return {
      ...artifact,
      chosen: buildStructuredRouteFromSemantic(artifact.semantic, 'causal-flow'),
    };
  }
  if (artifact.chosen.route === 'structured' && artifact.chosen.grammar === 'causal-flow') {
    const spec = { ...(artifact.chosen.spec as CausalFlowSpec) };
    if (flags.fakeInteraction) {
      delete spec.interaction;
    }
    if (flags.repeatedCoreClaim && spec.claim) {
      // Keep claim once; strip details that repeat it.
      spec.steps = spec.steps.map((s) =>
        s.detail && textsTooSimilar(spec.claim, s.detail)
          ? { id: s.id, title: s.title }
          : s
      );
    }
    return {
      ...artifact,
      chosen: { route: 'structured', grammar: 'causal-flow', spec: spec as unknown as Record<string, unknown> },
    };
  }
  return artifact;
}

function computeRubric(semantic: VisualizeSemanticModel, chosen: VisualizeRouteA | VisualizeRouteC) {
  const labeled =
    chosen.route === 'structured' && chosen.grammar === 'causal-flow'
      ? ((chosen.spec as CausalFlowSpec).relations ?? []).every((r) => Boolean(r.label))
      : semantic.relationships.every((r) => Boolean(r.label || r.type));
  return {
    fidelity: labeled ? 4 : 2,
    initialLegibility: chosen.grammar === 'causal-flow' ? 4 : 3,
    robustness: chosen.route === 'structured' ? 4 : 3,
    cognitiveLoad: semantic.entities.length <= 6 ? 4 : 3,
  };
}

function passesFidelityProxy(
  semantic: VisualizeSemanticModel,
  chosen: VisualizeRouteA | VisualizeRouteC
): boolean {
  if (!semantic.centralIdea.trim()) return false;
  if (chosen.grammar === 'causal-flow' || chosen.grammar === 'process') {
    const steps =
      chosen.route === 'structured'
        ? ((chosen.spec as CausalFlowSpec).steps?.length ?? 0)
        : semantic.entities.length;
    return steps >= 2;
  }
  return true;
}

/**
 * Normalize / repair a Visualize compiler artifact.
 * Invalid Route C degrades to Route A built from the semantic model.
 */
export function normalizeVisualizeArtifact(input: unknown): VisualizeArtifact | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const semantic = normalizeSemantic(raw.semantic);
  if (!semantic) return null;

  const chosenRaw = (raw.chosen ?? {}) as Record<string, unknown>;
  const routeKind = asString(chosenRaw.route);
  let chosen: VisualizeRouteA | VisualizeRouteC;

  if (routeKind === 'adhoc') {
    const adhoc = normalizeRouteC(chosenRaw, semantic);
    // Prefer deterministic causal-flow on mobile unless adhoc is clearly a simulation.
    chosen =
      adhoc && (adhoc.grammar === 'simulation' || adhoc.grammar === 'calculator')
        ? adhoc
        : buildStructuredRouteFromSemantic(semantic, resolveGrammar(chosenRaw.grammar));
  } else if (routeKind === 'structured') {
    const grammar = resolveGrammar(chosenRaw.grammar);
    if (grammar === 'causal-flow' || grammar === 'process' || grammar === 'causal-diagram') {
      const incoming = chosenRaw.spec as Partial<CausalFlowSpec> & { steps?: unknown };
      const rawSteps = Array.isArray(incoming?.steps) ? incoming.steps : [];
      const normalizedSteps = rawSteps
        .map((stepRaw, i) => {
          const s = stepRaw as unknown;
          if (typeof s === 'string') {
            const title = s.trim();
            if (!title) return null;
            return { id: slugId(title, `step-${i + 1}`), title, detail: undefined as string | undefined };
          }
          if (s && typeof s === 'object') {
            const row = s as { id?: string; title?: string; detail?: string };
            const title = asString(row.title);
            if (!title) return null;
            return {
              id: slugId(asString(row.id) || title, `step-${i + 1}`),
              title,
              detail: asString(row.detail) || undefined,
            };
          }
          return null;
        })
        .filter(Boolean) as Array<{ id: string; title: string; detail?: string }>;

      if (normalizedSteps.length >= 2) {
        const rebuilt = buildCausalFlowSpec({
          ...semantic,
          entities: normalizedSteps.map((s) => ({
            id: s.id,
            label: s.title,
            detail: s.detail,
          })),
          relationships: (Array.isArray(incoming.relations) ? incoming.relations : []).map((r) => ({
            from: r.from,
            to: r.to,
            type: r.label,
            label: r.label,
          })),
          caveat: incoming.caveat || semantic.caveat,
          scenarios: incoming.scenarios || semantic.scenarios,
          centralIdea: asString(incoming.claim) || semantic.centralIdea,
        });
        chosen = {
          route: 'structured',
          grammar: 'causal-flow',
          spec: rebuilt as unknown as Record<string, unknown>,
        };
      } else {
        chosen = buildStructuredRouteFromSemantic(semantic, 'causal-flow');
      }
    } else {
      const spec =
        chosenRaw.spec && typeof chosenRaw.spec === 'object' && !Array.isArray(chosenRaw.spec)
          ? (chosenRaw.spec as Record<string, unknown>)
          : null;
      chosen = spec
        ? { route: 'structured', grammar, spec }
        : buildStructuredRouteFromSemantic(semantic, grammar);
    }
  } else {
    chosen = buildStructuredRouteFromSemantic(semantic);
  }

  if (!passesFidelityProxy(semantic, chosen)) {
    chosen = buildStructuredRouteFromSemantic(semantic, 'causal-flow');
    if (!passesFidelityProxy(semantic, chosen)) return null;
  }

  let artifact: VisualizeArtifact = {
    version: 1,
    semantic,
    chosen,
    rubric: computeRubric(semantic, chosen),
  };
  artifact = repairArtifact(artifact);
  if (shouldRejectVisualizeArtifact(artifact)) {
    artifact = {
      ...artifact,
      chosen: buildStructuredRouteFromSemantic(semantic, 'causal-flow'),
    };
    artifact = repairArtifact(artifact);
  }

  return artifact;
}

type VisualizeMapSeed = {
  coreIdea?: string;
  tldr?: { title?: string; desc?: string }[];
  visualization?: {
    kind?: string;
    title?: string;
    summary?: string;
    items?: Array<{
      id?: string;
      label?: string;
      detail?: string;
      value?: number;
      group?: string;
      order?: number;
    }>;
    links?: Array<{ source?: string; target?: string; label?: string }>;
    unit?: string;
  } | null;
};

/**
 * Always produce a VisualizeArtifact for visualize-html-test mode.
 * Prefer the LLM artifact; otherwise synthesize causal-flow from visualization/coreIdea.
 */
export function ensureVisualizeArtifact(
  existing: unknown,
  seed: VisualizeMapSeed
): VisualizeArtifact | null {
  const normalized = normalizeVisualizeArtifact(existing);
  if (normalized) return normalized;

  const visual = seed.visualization;
  const centralIdea =
    asString(seed.coreIdea) ||
    asString(visual?.summary) ||
    asString(visual?.title) ||
    'Relación principal del Núcleo';

  const items = Array.isArray(visual?.items) ? visual!.items! : [];
  let entities = items
    .map((item, index) => {
      const label = asString(item?.label);
      if (!label) return null;
      return {
        id: slugId(asString(item?.id) || label, `e${index + 1}`),
        label: label.slice(0, 64),
        detail: asString(item?.detail) || undefined,
      };
    })
    .filter(Boolean) as VisualizeSemanticModel['entities'];

  if (entities.length < 2 && Array.isArray(seed.tldr)) {
    entities = seed.tldr
      .slice(0, 6)
      .map((item, index) => {
        const label = asString(item?.title);
        if (!label) return null;
        return {
          id: slugId(label, `t${index + 1}`),
          label: label.slice(0, 64),
          detail: asString(item?.desc) || undefined,
        };
      })
      .filter(Boolean) as VisualizeSemanticModel['entities'];
  }

  if (entities.length < 2) {
    entities = [
      { id: 'nucleo', label: 'Idea central', detail: centralIdea },
      { id: 'efecto', label: 'Efecto', detail: 'Consecuencia descrita en la fuente.' },
    ];
  }

  const entityIds = new Set(entities.map((e) => e.id));
  let relationships = (Array.isArray(visual?.links) ? visual!.links! : [])
    .map((link) => {
      const from = asString(link?.source);
      const to = asString(link?.target);
      if (!from || !to || !entityIds.has(from) || !entityIds.has(to) || from === to) return null;
      return {
        from,
        to,
        type: asString(link?.label) || 'puede llevar a',
        label: asString(link?.label) || 'puede llevar a',
      };
    })
    .filter(Boolean) as VisualizeSemanticModel['relationships'];

  if (relationships.length === 0 && entities.length >= 2) {
    relationships = entities.slice(0, -1).map((entity, index) => ({
      from: entity.id,
      to: entities[index + 1]!.id,
      type: 'puede llevar a',
      label: 'puede llevar a',
    }));
  }

  const kind = visual?.kind;
  const semantic: VisualizeSemanticModel = {
    objective: 'understand',
    centralIdea: groundClaim(centralIdea).slice(0, 180),
    entities: entities.slice(0, VISUALIZE_MAX_ENTITIES),
    relationships: relationships.slice(0, VISUALIZE_MAX_RELATIONSHIPS),
  };

  if (kind === 'bar' || kind === 'line') {
    return {
      version: 1,
      semantic,
      chosen: {
        route: 'structured',
        grammar: 'chart',
        spec: {
          title: semantic.centralIdea,
          chartType: kind === 'line' ? 'line' : 'bar',
          unit: visual?.unit,
          data: items
            .map((item) => ({
              label: asString(item?.label),
              value: asFiniteNumber(item?.value) ?? 1,
            }))
            .filter((row) => row.label)
            .slice(0, 6),
        },
      },
      rubric: { fidelity: 3, initialLegibility: 3, robustness: 4, cognitiveLoad: 3 },
    };
  }

  return {
    version: 1,
    semantic,
    chosen: buildStructuredRouteFromSemantic(semantic, 'causal-flow'),
    rubric: { fidelity: 4, initialLegibility: 4, robustness: 4, cognitiveLoad: 4 },
  };
}
