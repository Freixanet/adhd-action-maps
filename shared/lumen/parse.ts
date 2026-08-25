import { CANVAS_KINDS, type Canvas, type CanvasKind, type QuizItem } from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown, cap = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, cap);
}

function asQuiz(items: unknown): QuizItem[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 6).map((raw) => {
    const item = asRecord(raw) ?? {};
    const optionsRaw = Array.isArray(item.options) ? item.options.map((opt) => asString(opt)) : [];
    const options = [...optionsRaw, '—', '—', '—', '—'].slice(0, 4) as [
      string,
      string,
      string,
      string,
    ];
    const answer = Math.max(0, Math.min(3, Math.round(asNumber(item.answer, 0)))) as 0 | 1 | 2 | 3;
    return {
      question: asString(item.question),
      options,
      answer,
      why: asString(item.why),
    };
  }).filter((item) => item.question);
}

function parseBase(raw: Record<string, unknown>): {
  title: string;
  hook: string;
  readMinutes: number;
  prompts: string[];
} | null {
  const title = asString(raw.title);
  const hook = asString(raw.hook);
  if (!title || !hook) return null;
  return {
    title,
    hook,
    readMinutes: Math.max(1, Math.round(asNumber(raw.readMinutes, 4))),
    prompts: asStringArray(raw.prompts, 6),
  };
}

function parseExplain(raw: Record<string, unknown>): Omit<Extract<Canvas, { kind: 'explain' }>, 'id' | 'createdAt' | 'source'> | null {
  const base = parseBase(raw);
  if (!base) return null;
  const layers = asRecord(raw.layers) ?? {};
  const map = asRecord(raw.map) ?? {};
  const insights = Array.isArray(raw.insights)
    ? raw.insights
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const title = asString(rec.title);
          const body = asString(rec.body);
          if (!title || !body) return null;
          return { title, body, analogy: asString(rec.analogy) };
        })
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const nodes = Array.isArray(map.nodes)
    ? map.nodes
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const id = asString(rec.id);
          const label = asString(rec.label);
          if (!id || !label) return null;
          const kind = rec.kind === 'core' || rec.kind === 'detail' ? rec.kind : 'idea';
          return { id, label, kind, blurb: asString(rec.blurb) };
        })
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const cards = Array.isArray(raw.cards)
    ? raw.cards
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const term = asString(rec.term);
          const meaning = asString(rec.meaning);
          if (!term || !meaning) return null;
          return { term, meaning, analogy: asString(rec.analogy) };
        })
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const walk = Array.isArray(raw.walk)
    ? raw.walk
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const title = asString(rec.title);
          const body = asString(rec.body);
          if (!title || !body) return null;
          return {
            kicker: asString(rec.kicker),
            title,
            body,
            why: asString(rec.why),
          };
        })
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (!insights.length || nodes.length < 1 || cards.length < 1 || walk.length < 1) return null;
  return {
    kind: 'explain',
    ...base,
    essence: asString(raw.essence) || base.hook,
    insights: insights as { title: string; body: string; analogy: string }[],
    layers: {
      surface: asString(layers.surface),
      core: asString(layers.core),
      depth: asString(layers.depth),
    },
    map: {
      nodes: nodes as { id: string; label: string; kind: 'core' | 'idea' | 'detail'; blurb: string }[],
      edges: Array.isArray(map.edges)
        ? map.edges
            .map((item) => {
              const rec = asRecord(item) ?? {};
              const from = asString(rec.from);
              const to = asString(rec.to);
              if (!from || !to) return null;
              return { from, to, label: asString(rec.label) };
            })
            .filter(Boolean)
            .slice(0, 16) as { from: string; to: string; label: string }[]
        : [],
    },
    cards: cards as { term: string; meaning: string; analogy: string }[],
    walk: walk as { kicker: string; title: string; body: string; why: string }[],
    quiz: asQuiz(raw.quiz),
  };
}

function parseCompare(raw: Record<string, unknown>): Omit<Extract<Canvas, { kind: 'compare' }>, 'id' | 'createdAt' | 'source'> | null {
  const base = parseBase(raw);
  if (!base) return null;
  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const id = asString(rec.id);
          const name = asString(rec.name);
          if (!id || !name) return null;
          return {
            id,
            name,
            tagline: asString(rec.tagline),
            stats: Array.isArray(rec.stats)
              ? rec.stats
                  .map((stat) => {
                    const s = asRecord(stat) ?? {};
                    const label = asString(s.label);
                    const value = asString(s.value);
                    if (!label || !value) return null;
                    return { label, value };
                  })
                  .filter(Boolean)
                  .slice(0, 6) as { label: string; value: string }[]
              : [],
          };
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const criteria = Array.isArray(raw.criteria)
    ? raw.criteria
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const id = asString(rec.id);
          const label = asString(rec.label);
          if (!id || !label) return null;
          return { id, label, hint: asString(rec.hint) };
        })
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (items.length < 2 || criteria.length < 1) return null;
  return {
    kind: 'compare',
    ...base,
    items: items as Extract<Canvas, { kind: 'compare' }>['items'],
    criteria: criteria as Extract<Canvas, { kind: 'compare' }>['criteria'],
    scores: Array.isArray(raw.scores)
      ? raw.scores
          .map((row) => {
            const rec = asRecord(row) ?? {};
            const criterionId = asString(rec.criterionId);
            if (!criterionId || !Array.isArray(rec.values)) return null;
            return {
              criterionId,
              values: rec.values
                .map((v) => {
                  const cell = asRecord(v) ?? {};
                  const itemId = asString(cell.itemId);
                  if (!itemId) return null;
                  return {
                    itemId,
                    score: Math.max(0, Math.min(5, asNumber(cell.score, 0))),
                    note: asString(cell.note),
                  };
                })
                .filter(Boolean) as { itemId: string; score: number; note: string }[],
            };
          })
          .filter(Boolean) as Extract<Canvas, { kind: 'compare' }>['scores']
      : [],
    verdict: asString(raw.verdict),
    winnerId: asString(raw.winnerId),
  };
}

function parseRecipe(raw: Record<string, unknown>): Omit<Extract<Canvas, { kind: 'recipe' }>, 'id' | 'createdAt' | 'source'> | null {
  const base = parseBase(raw);
  if (!base) return null;
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const name = asString(rec.item);
          if (!name) return null;
          const note = asString(rec.note);
          return {
            amount: asNumber(rec.amount, 0),
            unit: asString(rec.unit),
            item: name,
            ...(note ? { note } : {}),
          };
        })
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((item, index) => {
          const rec = asRecord(item) ?? {};
          const title = asString(rec.title);
          const body = asString(rec.body);
          if (!title || !body) return null;
          const tip = asString(rec.tip);
          const minutes = asNumber(rec.minutes, 0);
          return {
            n: Math.max(1, Math.round(asNumber(rec.n, index + 1))),
            title,
            body,
            ...(minutes > 0 ? { minutes } : {}),
            ...(tip ? { tip } : {}),
          };
        })
        .filter(Boolean)
        .slice(0, 12)
    : [];
  if (ingredients.length < 1 || steps.length < 1) return null;
  return {
    kind: 'recipe',
    ...base,
    servings: Math.max(1, Math.round(asNumber(raw.servings, 1))),
    prepMinutes: Math.max(0, Math.round(asNumber(raw.prepMinutes, 0))),
    cookMinutes: Math.max(0, Math.round(asNumber(raw.cookMinutes, 0))),
    difficulty: asString(raw.difficulty) || 'Media',
    yieldNote: asString(raw.yieldNote),
    ingredients: ingredients as Extract<Canvas, { kind: 'recipe' }>['ingredients'],
    steps: steps as Extract<Canvas, { kind: 'recipe' }>['steps'],
    science: asString(raw.science),
    swaps: Array.isArray(raw.swaps)
      ? raw.swaps
          .map((item) => {
            const rec = asRecord(item) ?? {};
            const from = asString(rec.from);
            const to = asString(rec.to);
            if (!from || !to) return null;
            return { from, to, note: asString(rec.note) };
          })
          .filter(Boolean)
          .slice(0, 8) as { from: string; to: string; note: string }[]
      : [],
  };
}

function parsePlan(raw: Record<string, unknown>): Omit<Extract<Canvas, { kind: 'plan' }>, 'id' | 'createdAt' | 'source'> | null {
  const base = parseBase(raw);
  if (!base) return null;
  const phases = Array.isArray(raw.phases)
    ? raw.phases
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const title = asString(rec.title);
          if (!title) return null;
          const tasks = Array.isArray(rec.tasks)
            ? rec.tasks
                .map((task, index) => {
                  const t = asRecord(task) ?? {};
                  const taskTitle = asString(t.title);
                  if (!taskTitle) return null;
                  return {
                    id: asString(t.id) || `t${index + 1}`,
                    title: taskTitle,
                    detail: asString(t.detail),
                  };
                })
                .filter(Boolean)
            : [];
          return { title, when: asString(rec.when), tasks };
        })
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (phases.length < 1) return null;
  return {
    kind: 'plan',
    ...base,
    occasion: asString(raw.occasion),
    timeframe: asString(raw.timeframe),
    phases: phases as Extract<Canvas, { kind: 'plan' }>['phases'],
    options: Array.isArray(raw.options)
      ? raw.options
          .map((item) => {
            const rec = asRecord(item) ?? {};
            const title = asString(rec.title);
            const body = asString(rec.body);
            if (!title || !body) return null;
            return { title, body, fit: asString(rec.fit) };
          })
          .filter(Boolean)
          .slice(0, 6) as Extract<Canvas, { kind: 'plan' }>['options']
      : [],
    budget: Array.isArray(raw.budget)
      ? raw.budget
          .map((item) => {
            const rec = asRecord(item) ?? {};
            const label = asString(rec.label);
            const amount = asString(rec.amount);
            if (!label || !amount) return null;
            return { label, amount };
          })
          .filter(Boolean)
          .slice(0, 8) as { label: string; amount: string }[]
      : [],
    risks: Array.isArray(raw.risks)
      ? raw.risks
          .map((item) => {
            const rec = asRecord(item) ?? {};
            const risk = asString(rec.risk);
            if (!risk) return null;
            return { risk, ifHappens: asString(rec.ifHappens) };
          })
          .filter(Boolean)
          .slice(0, 8) as { risk: string; ifHappens: string }[]
      : [],
  };
}

function parseCollection(raw: Record<string, unknown>): Omit<Extract<Canvas, { kind: 'collection' }>, 'id' | 'createdAt' | 'source'> | null {
  const base = parseBase(raw);
  if (!base) return null;
  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item) => {
          const rec = asRecord(item) ?? {};
          const id = asString(rec.id);
          const title = asString(rec.title);
          if (!id || !title) return null;
          return {
            id,
            title,
            subtitle: asString(rec.subtitle),
            meta: asString(rec.meta),
            why: asString(rec.why),
            tags: asStringArray(rec.tags, 6),
          };
        })
        .filter(Boolean)
        .slice(0, 12)
    : [];
  if (items.length < 1) return null;
  return {
    kind: 'collection',
    ...base,
    query: asString(raw.query) || base.title,
    filters: asStringArray(raw.filters, 8),
    items: items as Extract<Canvas, { kind: 'collection' }>['items'],
  };
}

function parseGuide(raw: Record<string, unknown>): Omit<Extract<Canvas, { kind: 'guide' }>, 'id' | 'createdAt' | 'source'> | null {
  const base = parseBase(raw);
  if (!base) return null;
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((item, index) => {
          const rec = asRecord(item) ?? {};
          const title = asString(rec.title);
          const body = asString(rec.body);
          if (!title || !body) return null;
          const watchOut = asString(rec.watchOut);
          return {
            n: Math.max(1, Math.round(asNumber(rec.n, index + 1))),
            title,
            body,
            why: asString(rec.why),
            ...(watchOut ? { watchOut } : {}),
          };
        })
        .filter(Boolean)
        .slice(0, 10)
    : [];
  if (steps.length < 1) return null;
  return {
    kind: 'guide',
    ...base,
    outcome: asString(raw.outcome) || base.hook,
    steps: steps as Extract<Canvas, { kind: 'guide' }>['steps'],
    checklist: asStringArray(raw.checklist, 10),
  };
}

export type ParsedLumenDoc = Omit<Canvas, 'id' | 'createdAt' | 'source'>;

export function parseLumenDoc(input: unknown): ParsedLumenDoc | null {
  const raw = asRecord(input);
  if (!raw) return null;
  const kind = asString(raw.kind) as CanvasKind;
  if (!CANVAS_KINDS.includes(kind)) return null;
  if (kind === 'explain') return parseExplain(raw);
  if (kind === 'compare') return parseCompare(raw);
  if (kind === 'recipe') return parseRecipe(raw);
  if (kind === 'plan') return parsePlan(raw);
  if (kind === 'collection') return parseCollection(raw);
  return parseGuide(raw);
}

export function assembleLumenCanvas(
  doc: ParsedLumenDoc,
  meta: { id?: string; createdAt?: number; source: Canvas['source'] }
): Canvas {
  const shared = {
    id: meta.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `lumen-${Date.now()}`),
    createdAt: meta.createdAt ?? Date.now(),
    source: meta.source,
  };
  return { ...doc, ...shared } as Canvas;
}

export function parseLumenCanvas(input: unknown): Canvas | null {
  const raw = asRecord(input);
  if (!raw) return null;
  const doc = parseLumenDoc(raw);
  if (!doc) return null;
  const sourceRec = asRecord(raw.source);
  const sourceKind = asString(sourceRec?.kind);
  const source = {
    kind:
      sourceKind === 'url' || sourceKind === 'topic' || sourceKind === 'sample' || sourceKind === 'text'
        ? sourceKind
        : 'text',
    raw: asString(sourceRec?.raw),
    ...(asString(sourceRec?.title) ? { title: asString(sourceRec?.title) } : {}),
  } as Canvas['source'];
  return assembleLumenCanvas(doc, {
    id: asString(raw.id) || undefined,
    createdAt: asNumber(raw.createdAt, Date.now()),
    source,
  });
}
