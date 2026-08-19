/**
 * S04 Understanding Engine — version pins.
 * Bump deliberately; include in cache keys and persisted artifacts.
 */

export const UNDERSTANDING_SCHEMA_VERSION = 's04.understanding.v1';
/** Bumped for fixed two-line TLDR copy and reliable unit linking. */
export const UNDERSTANDING_PROMPT_VERSION = 's04.prompt.v1.4';
/**
 * Bumped for provenance E2E, independent chunk auth, versioned unit seeds,
 * and concrete planned-relation matching (no edgeBlob).
 */
export const UNDERSTANDING_COMPILER_VERSION = 's04.compile.v1.2';
/** Documented model routing pin for cache keys / telemetry (not a live Gemini id). */
export const UNDERSTANDING_MODEL_ROUTE = 's04.route.gemini-flash-first';

/** Supported schema versions for strict rehydration (exact match). */
export const UNDERSTANDING_SUPPORTED_SCHEMA_VERSIONS = new Set([
  UNDERSTANDING_SCHEMA_VERSION,
]);
export const UNDERSTANDING_SUPPORTED_PROMPT_VERSIONS = new Set([
  UNDERSTANDING_PROMPT_VERSION,
  's04.prompt.v1.3',
  's04.prompt.v1.2',
  's04.prompt.v1.1',
  's04.prompt.v1', // read-compatible prior prompt pin
]);
export const UNDERSTANDING_SUPPORTED_COMPILER_VERSIONS = new Set([
  UNDERSTANDING_COMPILER_VERSION,
  's04.compile.v1.1',
  's04.compile.v1',
]);

/** Human-readable stage labels for UI (never expose IDs/versions). */
export const UNDERSTANDING_STAGE_LABELS = {
  classifying: 'Comprendiendo la estructura…',
  essential: 'Preparando Lo esencial…',
  units: 'Conectando las ideas…',
  closing: 'Terminando tu Núcleo…',
} as const;

export type UnderstandingStageLabelKey = keyof typeof UNDERSTANDING_STAGE_LABELS;
