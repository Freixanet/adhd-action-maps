/**
 * Allowlisted machine codes for source/PDF persist failures.
 * Never forward raw provider messages, tokens, or PII.
 */

const ALLOWED = new Set([
  'missing_token',
  'auth_required',
  'PDF_INVALID_SIGNATURE',
  'PDF_BYTE_SIZE_MISMATCH',
  'PDF_CONTENT_HASH_MISMATCH',
  'STORAGE_PATH_NOT_OWNED',
  'STORAGE_BYTES_CONFLICT',
  'STORAGE_UPLOAD_FAILED',
  'STORAGE_OBJECT_MISSING',
  'PDF_PERSIST_FAILED',
  'PDF_PERSIST_NOT_CLOUD',
  'PDF_PERSIST_NETWORK',
  'PDF_PERSIST_HTTP',
  'PDF_PENDING_REMOVE_FAILED',
  'PDF_LOCAL_READ_FAILED',
  'PDF_RPC_UNAVAILABLE',
  'PDF_SCHEMA_MISSING',
  'SUPABASE_ANON_INVALID',
  'SUPABASE_UNCONFIGURED',
  'SOURCE_AUTH_REQUIRED',
  'SOURCE_IDS_INCOMPLETE',
  'SOURCE_PERSIST_FAILED',
  'SOURCE_PERSIST_NOT_CLOUD',
  'SOURCE_PERSIST_NETWORK',
  'SOURCE_PERSIST_HTTP',
  'ownerId required',
  'sourceId required',
  'objectName required',
]);

const PREFIX_ALLOWED = [
  'PDF_PERSIST_HTTP_',
  'PDF_PERSIST_FAILED_',
  'SOURCE_PERSIST_HTTP_',
] as const;

/**
 * Map arbitrary persist errors to a SAFE machine code for headers / DEV panel.
 */
export function sanitizePersistFailureCode(
  raw: string | null | undefined
): string {
  const text = (raw || '').trim();
  if (!text) return 'PDF_PERSIST_FAILED';

  if (ALLOWED.has(text)) return text;
  for (const prefix of PREFIX_ALLOWED) {
    if (text.startsWith(prefix)) {
      const rest = text.slice(prefix.length);
      if (/^\d{3}$/.test(rest) || /^[A-Z0-9_]{1,40}$/.test(rest)) {
        return `${prefix}${rest}`;
      }
    }
  }

  const lower = text.toLowerCase();
  if (
    lower.includes('invalid api key') ||
    lower.includes('invalid jwt') ||
    lower.includes('jwt expired')
  ) {
    return 'SUPABASE_ANON_INVALID';
  }
  if (
    lower.includes('persist_pdf_source') ||
    lower.includes('pgrst202') ||
    lower.includes('could not find the function')
  ) {
    return 'PDF_RPC_UNAVAILABLE';
  }
  if (
    lower.includes('pgrst205') ||
    lower.includes('could not find the table') ||
    lower.includes('schema cache')
  ) {
    return 'PDF_SCHEMA_MISSING';
  }
  if (lower.includes('fetch failed') || lower.includes('network')) {
    return 'PDF_PERSIST_NETWORK';
  }
  if (lower.includes('auth') || lower.includes('jwt')) {
    return 'auth_required';
  }

  return 'PDF_PERSIST_FAILED';
}
