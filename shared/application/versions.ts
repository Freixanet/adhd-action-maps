/**
 * S06 Application Engine — version pins.
 * Bump deliberately; include in cache keys and persisted artifacts.
 */

export const APPLICATION_SCHEMA_VERSION = 's06.application.v1';
export const APPLICATION_PROMPT_VERSION = 's06.prompt.v1';
export const APPLICATION_COMPILER_VERSION = 's06.compile.v1.1';
export const APPLICATION_POLICY_VERSION = 's06.policy.v1.1';
/** Documented model routing pin for cache keys / telemetry (not a live Gemini id). */
export const APPLICATION_MODEL_ROUTE = 's06.route.gemini-flash-first';

export const APPLICATION_SUPPORTED_SCHEMA_VERSIONS = new Set([APPLICATION_SCHEMA_VERSION]);
export const APPLICATION_SUPPORTED_PROMPT_VERSIONS = new Set([APPLICATION_PROMPT_VERSION]);
export const APPLICATION_SUPPORTED_COMPILER_VERSIONS = new Set([
  APPLICATION_COMPILER_VERSION,
  's06.compile.v1', // read-compatible
]);
export const APPLICATION_SUPPORTED_POLICY_VERSIONS = new Set([
  APPLICATION_POLICY_VERSION,
  's06.policy.v1',
]);

/** Human-readable stage labels for UI (never expose IDs/versions). */
export const APPLICATION_STAGE_LABELS = {
  analyzing: 'Analizando la fuente…',
  candidates: 'Buscando ideas aplicables…',
  adapting: 'Adaptando a tu contexto…',
  preparing: 'Preparando el plan…',
} as const;

export type ApplicationStageLabelKey = keyof typeof APPLICATION_STAGE_LABELS;
