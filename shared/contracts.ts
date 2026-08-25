import type { PersistedVisualizationRun } from './visualize';
import type { Citation, SourceChunk } from './types/chunk';
import type { EditorialPlan } from './editorial';

export type SourceType = 'text' | 'link' | 'youtube' | 'file' | 'pdf';

export type MapIntent = 'understand' | 'study' | 'apply';

export type MapDepth = 'rapido' | 'estandar' | 'profundo';

export type OutputLanguagePreference = 'device' | 'es' | 'en';

export type NucleoGenerationMode =
  | 'classic'
  | 'study-doc-beta'
  | 'visualize-html-test'
  | 'editorial-v1'
  | 'lumen-v1';

/** Resolve client/server generationMode; unknown values fall back to classic. */
export function resolveNucleoGenerationMode(value: unknown): NucleoGenerationMode {
  if (
    value === 'study-doc-beta' ||
    value === 'visualize-html-test' ||
    value === 'editorial-v1' ||
    value === 'lumen-v1'
  ) {
    return value;
  }
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
  | 'epub'
  | 'docx'
  | 'image'
  | 'video'
  | 'file';

/** Semantic identity of the material, independent from its file/container format. */
export type SourceContentKind =
  | 'book'
  | 'article'
  | 'report'
  | 'paper'
  | 'manual'
  | 'notes'
  | 'slides'
  | 'transcript'
  | 'other';

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
  /**
   * When set and present in `ActionMapData.citedChunks`, the reference is a
   * verifiable citation. Hallucinated ids are stripped server-side.
   */
  chunkId?: string;
};

export type SourceMetadata = {
  kind: SourceKind;
  contentKind?: SourceContentKind;
  label: string;
  /** Canonical source URL when the input was a link / YouTube video. */
  url?: string;
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

/**
 * «En 60 segundos» budget: default 3 essential ideas; 4 only when a fourth is
 * indispensable; never more than 4. Subtitles are written to fit two mobile lines.
 */
export const TLDR_DEFAULT_COUNT = 3;
export const TLDR_MAX_COUNT = 4;
export const TLDR_TITLE_MAX_CHARACTERS = 42;
export const TLDR_SUBTITLE_MAX_CHARACTERS = 65;

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
  | 'Para aplicarlo'
  | 'Conexión';

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
  /** Stable IR relation id when this callout is a compiled Conexión. */
  relationId?: string;
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
  rows: { label: string; values: string[]; /** Stable IR relation id when compiled. */ relationId?: string }[];
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

/** First screen when opening a Núcleo — readable in ~15s, zero scroll. */
export type Layer0Action = {
  id: string;
  /** Imperative action starting with a verb. */
  label: string;
};

export type Layer0 = {
  /** What this is in one sentence, ≤12 words, no jargon. */
  what: string;
  /** Why it matters; must start with a verb. */
  why: string;
  /** Exactly three checkable next actions. */
  actions: Layer0Action[];
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
  /** Capa 0 — emitted first in the stream so the app can open before steps land. */
  layer0?: Layer0;
  coreIdea: string;
  coreSupport: string;
  /**
   * Chat handoff after generation: one sentence telling the user what Núcleo
   * did with their source (concrete, first person or direct). Not a title echo.
   */
  deliveryMessage?: string;
  tldr: TLDRItem[];
  visualization?: NucleoVisualSpec;
  /** Experimental Visualize-compiler artifact (__DEV__ generationMode visualize-html-test). */
  visualizeArtifact?: VisualizeArtifact | null;
  /**
   * Visualize v2 persisted run (shadow alongside visualizeArtifact).
   * Debug payloads must NOT be stored here — see shared/visualize VisualizationRunDebug.
   */
  visualizeRun?: PersistedVisualizationRun | null;
  /**
   * Editorial results system (native pages + separate illustration layer).
   * First vertical: fixture / progressive planner; never a full-page raster.
   */
  editorialPlan?: EditorialPlan | null;
  /** Lumen workspace canvas. Present on generationMode `lumen-v1`. */
  lumenCanvas?: import('./lumen/types').Canvas | null;
  knowledgeSections?: KnowledgeSection[];
  /** Agrupación de pasos para mini-completado (SPEC §4); solo si steps.length >= 6. */
  readingSections?: ReadingSection[] | null;
  steps: MapStep[];
  references?: SourceReference[];
  /**
   * Verifiable citations in appearance order. Built server-side from
   * `references[].chunkId` after filtering hallucinated ids.
   */
  citations?: Citation[];
  /**
   * Exact original SourceChunk text for each cited id. Persisted with the map
   * so the source viewer works after restart.
   */
  citedChunks?: SourceChunk[];
  completionCard?: CompletionCard;
  modelUsed?: string;
  /**
   * S04 Understanding Engine artifact (intent=understand).
   * Optional; legacy maps omit it. References inside stay `pending` until S05.
   */
  /** S04 Understanding IR (optional; absent on legacy maps). */
  understanding?: import('./understanding/types').UnderstandingArtifact;
  /**
   * S05 Evidence artifact (claims, links, coverage).
   * `verified` means the source supports the representation — not world-truth.
   */
  evidence?: import('./evidence/types').EvidenceArtifact;
  /**
   * S06 Application artifact (fuente / inferencia / adaptación / revisión).
   * Optional; legacy apply maps omit it. Invalid IR is dropped on normalize.
   */
  application?: import('./application/types').ApplicationArtifactV1;
  /**
   * Chunk IDs from ingest at generation time (IDs only — never fabricated text).
   * Independent of segmentRefs; used for rehydrate authorization when present.
   */
  chunkIdManifest?: string[];
};

export type SavedSession = {
  data: ActionMapData | Record<string, unknown>;
  currentStep: number;
  isComplete?: boolean;
  viewAll?: boolean;
  /** User tapped “Ver núcleo completo” and left Capa 0. */
  layer0Passed?: boolean;
  /** Checked action ids on Capa 0. */
  layer0CheckedActionIds?: string[];
  /** S07 semantic progress and exact resume target. */
  progress?: import('./progress/types').SemanticProgressV1;
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
  /**
   * Provenance of plain text (S03).
   * `source` = paste-chip / explicit source — never routed to ASK heuristics.
   * `ask` = conversational question — ASK lane when type is text.
   */
  textMode?: 'ask' | 'source';
  fileData?: string;
  mimeType?: string;
  preferredModel?: string;
  intent?: MapIntent;
  outputLanguage?: string;
  sourceLabel?: string;
  mapId?: string;
  /**
   * Client-minted UUID for this generation attempt. Reused on retry so the
   * server can return an already-completed map without re-running models.
   */
  generationRunId?: string;
  /** Stable source identity for pasted-text idempotency (S03). */
  sourceId?: string;
  sourceVersionId?: string;
  sourceRequestId?: string;
  /** Nombre visible opcional para personalizar el tono del Núcleo. No debe ser email. */
  userDisplayName?: string;
  depth?: MapDepth;
  /** Temporal: permite comparar el mapa actual con una generación tipo StudyDoc adaptada al renderer actual. */
  generationMode?: NucleoGenerationMode;
  /** Si true, fuerza un único Núcleo con límites declarados (SPEC §6.7). */
  singleNucleoMode?: boolean;
  /** Parte concreta de una fuente larga (colección). */
  segmentTitle?: string;
  /** Semantic source classification determined from content, never from extension alone. */
  sourceContentKind?: SourceContentKind;
  /**
   * S06 — minimal personal context for Aplicar.
   * Never log raw values; cache keys use canonicalContextHash only.
   */
  applicationContext?: import('./application/types').ApplicationContextV1;
};

export type SourceAnalysisResponse = {
  shouldProposeSplit: boolean;
  partCount: number;
  parts: Array<{ title: string; text?: string }>;
  totalWords: number;
  collectionTitle: string;
  contentKind?: SourceContentKind;
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

/** Open-world home ask (not grounded in a Núcleo). */
export type AskRequest = {
  question: string;
  depth?: MapDepth;
  /** Nombre visible opcional para tono. No debe ser email. */
  userDisplayName?: string;
};

export type AskResponse = {
  answer: string;
  title?: string;
  /** Present when the server used the ask lane (unverified knowledge). */
  isAsk?: true;
  disclaimer?: string;
  cta?: { label: string; action: string };
};

export type TransformStreamEvent = {
  type:
    | 'partial'
    | 'done'
    | 'error'
    | 'source_meta'
    | 'essential_ready'
    | 'stage'
    | 'heartbeat'
    | 'run';
  map?: ActionMapData;
  model?: string;
  error?: string;
  code?: string;
  mapId?: string;
  generationRunId?: string;
  sourceMeta?:
    | import('./pastedText').PastedTextSourceMeta
    | import('./pdf/types').PdfSourceMeta;
  /** S08: segments+coverage for persist-only retry when sync_failed. */
  pdfPersistRetry?: import('./pdf/types').PdfPersistRetryPayload;
  /** S04: human stage label for UI (never technical). */
  stageLabel?: string;
  /** Keep-alive during long stages; does not change UI progress. */
  heartbeatAt?: number;
  /** S04: essential-ready payload before full map. */
  essential?: {
    title: string;
    coreIdea: string;
    coreSupport: string;
    layer0: Layer0;
  };
};
