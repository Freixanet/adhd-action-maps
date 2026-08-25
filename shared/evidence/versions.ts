/**
 * S05 Evidence Engine — version pins.
 */

export const EVIDENCE_SCHEMA_VERSION = 's05.evidence.v1';
export const EVIDENCE_PROMPT_VERSION = 's05.prompt.v1';
export const EVIDENCE_VERIFIER_VERSION = 's05.verifier.v1';
export const EVIDENCE_COMPILER_VERSION = 's05.compile.v1';
export const EVIDENCE_MODEL_ROUTE = 's05.route.gemini-flash-first';

export const EVIDENCE_SUPPORTED_SCHEMA_VERSIONS = new Set([EVIDENCE_SCHEMA_VERSION]);
export const EVIDENCE_SUPPORTED_VERIFIER_VERSIONS = new Set([EVIDENCE_VERIFIER_VERSION]);
