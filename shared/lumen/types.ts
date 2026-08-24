export type LumenSourceKind = 'text' | 'url' | 'topic' | 'sample';

export type CanvasKind =
  | 'explain'
  | 'compare'
  | 'recipe'
  | 'plan'
  | 'collection'
  | 'guide';

export type MapKind = 'core' | 'idea' | 'detail';

export type Insight = {
  title: string;
  body: string;
  analogy: string;
};

export type MapNode = {
  id: string;
  label: string;
  kind: MapKind;
  blurb: string;
};

export type MapEdge = {
  from: string;
  to: string;
  label: string;
};

export type ConceptCard = {
  term: string;
  meaning: string;
  analogy: string;
};

export type WalkBeat = {
  kicker: string;
  title: string;
  body: string;
  why: string;
};

export type QuizItem = {
  question: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  why: string;
};

export type LumenSource = {
  kind: LumenSourceKind;
  raw: string;
  title?: string;
};

export type CanvasBase = {
  id: string;
  createdAt: number;
  source: LumenSource;
  kind: CanvasKind;
  title: string;
  hook: string;
  readMinutes: number;
  prompts: string[];
};

export type ExplainCanvas = CanvasBase & {
  kind: 'explain';
  essence: string;
  insights: Insight[];
  layers: {
    surface: string;
    core: string;
    depth: string;
  };
  map: {
    nodes: MapNode[];
    edges: MapEdge[];
  };
  cards: ConceptCard[];
  walk: WalkBeat[];
  quiz: QuizItem[];
};

export type CompareItem = {
  id: string;
  name: string;
  tagline: string;
  stats: { label: string; value: string }[];
};

export type CompareCanvas = CanvasBase & {
  kind: 'compare';
  items: CompareItem[];
  criteria: { id: string; label: string; hint: string }[];
  scores: {
    criterionId: string;
    values: { itemId: string; score: number; note: string }[];
  }[];
  verdict: string;
  winnerId: string;
};

export type RecipeIngredient = {
  amount: number;
  unit: string;
  item: string;
  note?: string;
};

export type RecipeStep = {
  n: number;
  title: string;
  body: string;
  minutes?: number;
  tip?: string;
};

export type RecipeCanvas = CanvasBase & {
  kind: 'recipe';
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: string;
  yieldNote: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  science: string;
  swaps: { from: string; to: string; note: string }[];
};

export type PlanTask = {
  id: string;
  title: string;
  detail: string;
};

export type PlanCanvas = CanvasBase & {
  kind: 'plan';
  occasion: string;
  timeframe: string;
  phases: { title: string; when: string; tasks: PlanTask[] }[];
  options: { title: string; body: string; fit: string }[];
  budget: { label: string; amount: string }[];
  risks: { risk: string; ifHappens: string }[];
};

export type CollectionItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  why: string;
  tags: string[];
};

export type CollectionCanvas = CanvasBase & {
  kind: 'collection';
  query: string;
  filters: string[];
  items: CollectionItem[];
};

export type GuideStep = {
  n: number;
  title: string;
  body: string;
  why: string;
  watchOut?: string;
};

export type GuideCanvas = CanvasBase & {
  kind: 'guide';
  outcome: string;
  steps: GuideStep[];
  checklist: string[];
};

export type Canvas =
  | ExplainCanvas
  | CompareCanvas
  | RecipeCanvas
  | PlanCanvas
  | CollectionCanvas
  | GuideCanvas;

export const KIND_LABEL: Record<CanvasKind, string> = {
  explain: 'Explicar',
  compare: 'Comparar',
  recipe: 'Receta',
  plan: 'Plan',
  collection: 'Colección',
  guide: 'Guía',
};

export const CANVAS_KINDS: readonly CanvasKind[] = [
  'explain',
  'compare',
  'recipe',
  'plan',
  'collection',
  'guide',
];
