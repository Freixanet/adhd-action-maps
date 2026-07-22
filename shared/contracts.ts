import type { PersistedVisualizationRun } from './visualize';

export type SourceType = 'text' | 'link' | 'youtube' | 'file' | 'pdf';

export type MapIntent = 'understand' | 'study' | 'apply';

export type MapDepth = 'rapido' | 'estandar' | 'profundo';

export type OutputLanguagePreference = 'device' | 'es' | 'en';

export type NucleoGenerationMode = 'classic' | 'study-doc-beta' | 'visualize-html-test';

/** Resolve client/server generationMode; unknown values fall back to classic. */
export function resolveNucleoGenerationMode(value: unknown): NucleoGenerationMode {
  if (value === 'study-doc-beta' || value === 'visualize-html-test') return value;
  return 'classic';
}

export type VisualizeObjective =
  | 'understand'
  | 'compare'
  | 'explore'
  | 'calculate'
  | 'practice'
  | 'decide'
  | 'act';

export type VisualizeGrammar =
  | 'chart'
  | 'timeline'
  | 'process'
  | 'causal-flow'
  | 'concept-map'
  | 'causal-diagram'
  | 'comparison'
  | 'simulation'
  | 'calculator'
  | 'interactive-explainer';

export type VisualizeSemanticModel = {
  objective: VisualizeObjective;
  /** Claim grounded in the source — not presented as universal law. */
  centralIdea: string;
  entities: { id: string; label: string; detail?: string }[];
  relationships: { from: string; to: string; type: string; label?: string }[];
  variables?: { id: string; label: string; min?: number; max?: number; unit?: string }[];
  processes?: { id: string; steps: string[] }[];
  comparisons?: { id: string; axes: string[]; rows: Record<string, string | number>[] }[];
  /** Optional caveat / distinction (e.g. healthy affection vs dependence). */
  caveat?: string;
  /** Two contrasting scenarios for a real interaction (not decorative). */
  scenarios?: Array<{
    id: string;
    label: string;
    claim?: string;
    steps: Array<{ id: string; title: string; detail?: string }>;
    relations: Array<{ from: string; to: string; label: string }>;
  }>;
  interactionOpportunities?: string[];
};

export type VisualizeRouteA = {
  route: 'structured';
  grammar: VisualizeGrammar;
  spec: Record<string, unknown>;
};

export type VisualizeRouteC = {
  route: 'adhoc';
  grammar: VisualizeGrammar;
  metadata: { title: string; expandable: boolean };
  content: { markup: string; styles: string; script?: string };
  initialState?: Record<string, unknown>;
  accessibility: { textAlternative: string };
};

export type VisualizeArtifact = {
  version: 1;
  semantic: VisualizeSemanticModel;
  chosen: VisualizeRouteA | VisualizeRouteC;
  rubric?: {
    fidelity: number;
    initialLegibility: number;
    robustness: number;
    cognitiveLoad: number;
  };
};

export type SourceKind =
  | 'text'
  | 'link'
  | 'youtube'
  | 'pdf'
  | 'image'
  | 'video'
  | 'file';

export type ReferenceLocatorKind =
  | 'page'
  | 'section'
  | 'timestamp'
  | 'slide'
  | 'sheet'
  | 'chapter'
  | 'region'
  | 'general';

export type SourceReference = {
  label: string;
  locator: string;
  locatorKind?: ReferenceLocatorKind;
  excerpt?: string;
  note?: string;
};

export type SourceMetadata = {
  kind: SourceKind;
  label: string;
  title?: string;
  author?: string;
  language?: string;
  detected: string[];
  limitations?: string[];
};

export type CoverageNote = {
  label: string;
  detail: string;
  tone?: 'neutral' | 'warning';
};

export type Coverage = {
  summary: string;
  notes: CoverageNote[];
};

export type KnowledgeSection = {
  title: string;
  summary: string;
  references?: SourceReference[];
};

export type TLDRItem = {
  title: string;
  desc: string;
};

export type NucleoVisualKind =
  | 'concept'
  | 'flow'
  | 'cycle'
  | 'hierarchy'
  | 'comparison'
  | 'bar'
  | 'line';

export type NucleoVisualItem = {
  id: string;
  label: string;
  detail?: string;
  group?: string;
  value?: number;
  unit?: string;
  order?: number;
  stepId?: string;
  references?: SourceReference[];
};

export type NucleoVisualLink = {
  source: string;
  target: string;
  label?: string;
};

/** Source-grounded semantic overview. Version 2 is the canonical write format. */
export type NucleoVisualSpec = {
  version: 2;
  kind: NucleoVisualKind;
  title: string;
  summary: string;
  items: NucleoVisualItem[];
  links?: NucleoVisualLink[];
  references?: SourceReference[];
  unit?: string;
  xLabel?: string;
  yLabel?: string;
};

/** @deprecated Read compatibility alias. New code should use NucleoVisualSpec. */
export type NucleoVisual = NucleoVisualSpec;

export type CalloutLabel =
  | 'Idea clave'
  | 'Matiz'
  | 'Ejemplo'
  | 'Precaución'
  | 'Para aplicarlo';

export type StepListItem = {
  strong: string;
  span?: string;
};

/** Emphasis for interactive blocks — semantic only; visuals live in RN. */
export type BlockEmphasis = 'hero' | 'normal' | 'quiet';

export type StepContentBlockProse = {
  type: 'prose';
  text: string;
  kind?: 'action' | 'info' | 'alert';
  references?: SourceReference[];
};

export type StepContentBlockCallout = {
  type: 'callout';
  text: string;
  kind?: 'action' | 'info' | 'alert';
  label?: CalloutLabel;
  references?: SourceReference[];
};

export type StepContentBlockList = {
  type: 'list';
  text: string;
  kind?: 'action' | 'info' | 'alert';
  items?: StepListItem[];
  references?: SourceReference[];
};

export type StepContentBlockStat = {
  type: 'stat';
  value: string;
  label: string;
  source?: string;
  emphasis?: BlockEmphasis;
};

export type StepContentBlockComparison = {
  type: 'comparison';
  columns: [string, string] | [string, string, string];
  rows: { label: string; values: string[] }[];
  emphasis?: BlockEmphasis;
};

export type StepContentBlockAccordion = {
  type: 'accordion';
  title: string;
  body: string;
  references?: SourceReference[];
};

export type StepContentBlockQuiz = {
  type: 'quiz';
  question: string;
  options: string[];
  /** Zero-based index into options; must be in range after normalize. */
  correct: number;
  feedback: string;
};

export type StepContentBlock =
  | StepContentBlockProse
  | StepContentBlockCallout
  | StepContentBlockList
  | StepContentBlockStat
  | StepContentBlockComparison
  | StepContentBlockAccordion
  | StepContentBlockQuiz;

export type ReadingSection = {
  title: string;
  fromStep: number;
  toStep: number;
};

export type MapStep = {
  id: string;
  shortNav: string;
  title: string;
  time: string;
  content: StepContentBlock[];
  purpose?: string;
  references?: SourceReference[];
  visualization?: NucleoVisualSpec;
  /** Pregunta de comprensión colapsada por defecto (SPEC §5.4.3). */
  selfCheck?: string | null;
};

export type CompletionCard = {
  title: string;
  summary: string;
  takeaways: string[];
  promptQuestion?: string;
};

export type ActionMapData = {
  title: string;
  category?: string;
  tags?: string[];
  suggestedCategory?: string;
  suggestedTags?: string[];
  intent?: MapIntent;
  outputLanguage?: string;
  mapVersion?: number;
  generationMode?: NucleoGenerationMode;
  sourceMetadata?: SourceMetadata;
  coverage?: Coverage;
  coreIdea: string;
  coreSupport: string;
  tldr: TLDRItem[];
  visualization?: NucleoVisualSpec;
  /** Experimental Visualize-compiler artifact (__DEV__ generationMode visualize-html-test). */
  visualizeArtifact?: VisualizeArtifact | null;
  /**
   * Visualize v2 persisted run (shadow alongside visualizeArtifact).
   * Debug payloads must NOT be stored here — see shared/visualize VisualizationRunDebug.
   */
  visualizeRun?: PersistedVisualizationRun | null;
  knowledgeSections?: KnowledgeSection[];
  /** Agrupación de pasos para mini-completado (SPEC §4); solo si steps.length >= 6. */
  readingSections?: ReadingSection[] | null;
  steps: MapStep[];
  references?: SourceReference[];
  completionCard?: CompletionCard;
  modelUsed?: string;
};

export type SavedSession = {
  data: ActionMapData | Record<string, unknown>;
  currentStep: number;
  isComplete?: boolean;
  viewAll?: boolean;
};

export type MapRecord = {
  id: string;
  title: string;
  category?: string;
  pinned?: boolean;
  pinnedAt?: number;
  createdAt: number;
  updatedAt: number;
  sourceType: SourceType;
  session: SavedSession;
};

export type TransformRequest = {
  text?: string;
  type: 'text' | 'link' | 'youtube' | 'pdf' | 'image' | 'video';
  fileData?: string;
  mimeType?: string;
  preferredModel?: string;
  intent?: MapIntent;
  outputLanguage?: string;
  sourceLabel?: string;
  mapId?: string;
  /** Nombre visible opcional para personalizar el tono del Núcleo. No debe ser email. */
  userDisplayName?: string;
  depth?: MapDepth;
  /** Temporal: permite comparar el mapa actual con una generación tipo StudyDoc adaptada al renderer actual. */
  generationMode?: NucleoGenerationMode;
  /** Si true, fuerza un único Núcleo con límites declarados (SPEC §6.7). */
  singleNucleoMode?: boolean;
  /** Parte concreta de una fuente larga (colección). */
  segmentTitle?: string;
};

export type SourceAnalysisResponse = {
  shouldProposeSplit: boolean;
  partCount: number;
  parts: Array<{ title: string; text?: string }>;
  totalWords: number;
  collectionTitle: string;
};

export type ChatTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type MapChatRequest = {
  map?: ActionMapData;
  question: string;
  history?: ChatTurn[];
};

export type MapChatResponse = {
  answer: string;
  followUps: string[];
  citations: SourceReference[];
  limitations?: string[];
};

export type TransformStreamEvent = {
  type: 'partial' | 'done' | 'error';
  map?: ActionMapData;
  model?: string;
  error?: string;
};
