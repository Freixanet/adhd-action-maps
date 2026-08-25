/**
 * Editorial results system — contracts.
 * Native text/layout always; illustrations are a separate layer (never raster pages).
 */

export const EDITORIAL_STYLE_ID = 'nucleo-editorial-v1' as const;

export type CognitiveGoal =
  | 'comprehend'
  | 'relate'
  | 'compare'
  | 'remember'
  | 'evaluate'
  | 'practice'
  | 'reflect'
  | 'apply';

export type PageArchetype =
  | 'cover'
  | 'nucleus'
  | 'explanation'
  | 'comparison'
  | 'cause-effect'
  | 'process'
  | 'experiment'
  | 'evidence'
  | 'tools'
  | 'application'
  | 'reflection'
  | 'recap';

export type IllustrationVisualRole =
  | 'hero-scene'
  | 'concept-metaphor'
  | 'spot-illustration'
  | 'experiment-sequence'
  | 'process-diagram'
  | 'comparison'
  | 'progress-path'
  | 'evidence-visual';

export type IllustrationComposition =
  | 'centered'
  | 'before-after'
  | 'left-right'
  | 'obstacle-goal'
  | 'path-progress'
  | 'sequence'
  | 'cause-effect'
  | 'layers'
  | 'transformation';

export type IllustrationSpec = {
  concept: string;
  visualRole: IllustrationVisualRole;
  metaphor: string;
  subjects: string[];
  relationship?: string;
  mood: string;
  composition: IllustrationComposition;
  emphasis: string;
  /** 3–6 concrete visual tags for catalog / provider search. */
  searchTags: string[];
  styleId: typeof EDITORIAL_STYLE_ID;
  sourceEvidenceIds?: string[];
  fallbackAssetId: string;
  accessibilityLabel: string;
  priority: 'required' | 'optional';
  optional: boolean;
};

export type ResolvedIllustration = {
  assetId: string;
  provider: 'local' | 'streamline' | 'none';
  styleId: typeof EDITORIAL_STYLE_ID;
  /** Local catalog key or streamline hash — never a remote URL stored permanently. */
  providerAssetKey: string;
  license: 'nucleo-local' | 'streamline-free' | 'streamline-unknown';
  attributionRequired: boolean;
  attributionText?: string;
  accessibilityLabel: string;
  /** Ephemeral SVG markup only when provider allows in-memory use; prefer localId. */
  localCatalogId?: string;
  /** Locked Streamline family when provider is streamline. */
  familySlug?: string;
  score: number;
};

export type EditorialListItem = {
  id: string;
  title: string;
  body: string;
  /** Optional local catalog id for a spot icon. */
  iconAssetId?: string;
};

export type EditorialCallout = {
  tone: 'neutral' | 'emphasis' | 'warning' | 'success';
  title?: string;
  body: string;
};

export type EditorialPage = {
  id: string;
  index: number;
  archetype: PageArchetype;
  cognitiveGoal: CognitiveGoal;
  /**
   * Cover: max 3 lines. Other pages: max 2 lines.
   * See EDITORIAL_COPY_LIMITS_CONTRACT — synthesize if over; UI never shrinks type.
   */
  title: string;
  /**
   * Exact substring of `title` to underline (provided by planner / LLM).
   * Must appear in `title`; UI never guesses from content.
   */
  titleEmphasis?: string;
  /**
   * Deliberate title line breaks (cover: up to 3). When set, UI renders these
   * lines instead of wrapping freely. Joined lines must equal `title`.
   */
  titleLines?: string[];
  /** Optional kicker above title. */
  kicker?: string;
  /** Entradilla: max 3 lines. Synthesize if over. */
  body?: string;
  items?: EditorialListItem[];
  callout?: EditorialCallout;
  illustration?: IllustrationSpec;
  resolvedIllustration?: ResolvedIllustration | null;
  sourceEvidenceIds?: string[];
};

export type EditorialPlan = {
  schemaVersion: 1;
  styleId: typeof EDITORIAL_STYLE_ID;
  title: string;
  sourceLabel?: string;
  sourceUrl?: string;
  /** One-line thesis for the cover / nucleus. */
  nucleusClaim: string;
  pages: EditorialPage[];
  /** Internal only — derived map intent for engines that still need MapIntent. */
  derivedMapIntent: 'understand' | 'apply';
  providerVersions: {
    planner: string;
    illustration: string;
  };
  attribution?: {
    required: boolean;
    text: string;
  };
};

export type EditorialPlannerInput = {
  sourceTitle?: string;
  sourceText: string;
  sourceLabel?: string;
  sourceUrl?: string;
  fixtureId?: string;
};
