/**
 * S08 PDF native — version pins and resource ceilings.
 *
 * Authoritative byte ceiling is 20 MiB of raw PDF bytes.
 * JSON+base64 transport requires raising the Express JSON body limit
 * (see server.ts MAX_JSON_BODY default 28mb) so 20 MiB raw fits.
 */

export const PDF_SCHEMA_VERSION = 's08.pdf.v1';
export const PDF_EXTRACTOR_VERSION = 's08.extract.v1';
export const PDF_VALIDATOR_VERSION = 's08.validate.v1';
export const PDF_PERSIST_VERSION = 's08.persist.v1';

/** Authoritative raw-byte ceiling (client + server). */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Hard page ceiling — reject before full text extraction. */
export const MAX_PDF_PAGES = 400;

/** Below this many extractable chars on a page → page treated as non-textual. */
export const MIN_PAGE_TEXT_CHARS = 12;

/** If fewer than this fraction of pages have text → scanned / insufficient. */
export const MIN_TEXTUAL_PAGE_RATIO = 0.15;
