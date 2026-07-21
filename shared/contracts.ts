export type SourceType = 'text' | 'link' | 'youtube' | 'file' | 'pdf';

export type MapIntent = 'understand' | 'study' | 'apply';

export type MapDepth = 'rapido' | 'estandar' | 'profundo';

export type OutputLanguagePreference = 'device' | 'es' | 'en';

export type NucleoGenerationMode = 'classic' | 'study-doc-beta';

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
  | 'timeline'
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

export type StepContentBlock = {
  type: 'prose' | 'callout' | 'list';
  text: string;
  kind?: 'action' | 'info' | 'alert';
  label?: CalloutLabel;
  items?: StepListItem[];
  references?: SourceReference[];
};

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
