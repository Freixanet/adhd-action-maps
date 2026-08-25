/**
 * S03 — pasted text: single canonical form + shared validation + operation IDs.
 *
 * Canonical string is the sole input to hash, segmentation, offsets, and persistence.
 * Offsets are JavaScript UTF-16 code unit indices (String length / slice).
 */

/** Authoritative max for pasted text (UTF-16 length of canonical form). See ADR-010. */
export const MAX_PASTED_TEXT_CHARS = 120_000;

export type PastedTextErrorCode =
  | 'TEXT_EMPTY'
  | 'TEXT_TOO_LARGE'
  | 'TEXT_INVALID'
  | 'SOURCE_PERSIST_FAILED';

export type PastedTextValidationOk = {
  ok: true;
  canonical: string;
  length: number;
};

export type PastedTextValidationFail = {
  ok: false;
  code: PastedTextErrorCode;
};

export type PastedTextValidationResult = PastedTextValidationOk | PastedTextValidationFail;

/**
 * Deterministic canonicalization for pasted text.
 * - Strip NUL and other C0 controls except TAB and LF
 * - CRLF / CR → LF
 * - Collapse trailing spaces/tabs before newlines
 * - Trim leading/trailing whitespace
 * Does not silently truncate.
 */
export function canonicalizePastedText(input: string): string {
  return canonicalizePastedTextWithMap(input).text;
}

/**
 * Same transforms as canonicalizePastedText, plus raw→canonical index map.
 * rawToCanonical[i] = canonical UTF-16 index for raw char i, or -1 if deleted.
 */
export function canonicalizePastedTextWithMap(input: string): {
  text: string;
  rawToCanonical: Int32Array;
} {
  const raw = String(input ?? '');
  const rawToCanonical = new Int32Array(raw.length);
  rawToCanonical.fill(-1);

  // Pass 1: drop controls (keep TAB/LF), map CR/LF, track kept chars.
  const interim: string[] = [];
  const interimFromRaw: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    const ch = raw[i]!;
    if (code === 0) continue;
    if (
      (code >= 1 && code <= 8) ||
      code === 0xb ||
      code === 0xc ||
      (code >= 0xe && code <= 0x1f) ||
      code === 0x7f
    ) {
      continue;
    }
    if (ch === '\r') {
      interim.push('\n');
      interimFromRaw.push(i);
      if (raw[i + 1] === '\n') i += 1;
      continue;
    }
    interim.push(ch);
    interimFromRaw.push(i);
  }

  // Pass 2: collapse spaces/tabs before newlines.
  const collapsed: string[] = [];
  const collapsedFromRaw: number[] = [];
  for (let i = 0; i < interim.length; i += 1) {
    const ch = interim[i]!;
    if (ch === '\n') {
      while (
        collapsed.length > 0 &&
        (collapsed[collapsed.length - 1] === ' ' || collapsed[collapsed.length - 1] === '\t')
      ) {
        collapsed.pop();
        collapsedFromRaw.pop();
      }
      collapsed.push('\n');
      collapsedFromRaw.push(interimFromRaw[i]!);
      continue;
    }
    collapsed.push(ch);
    collapsedFromRaw.push(interimFromRaw[i]!);
  }

  // Pass 3: trim ends.
  let start = 0;
  let end = collapsed.length;
  while (start < end && /\s/.test(collapsed[start]!)) start += 1;
  while (end > start && /\s/.test(collapsed[end - 1]!)) end -= 1;

  const outChars: string[] = [];
  for (let i = start; i < end; i += 1) {
    const rawIdx = collapsedFromRaw[i]!;
    rawToCanonical[rawIdx] = outChars.length;
    outChars.push(collapsed[i]!);
  }

  return { text: outChars.join(''), rawToCanonical };
}

/**
 * Map a canonical [start, end) range back to the tightest raw range that covers it.
 */
export function canonicalRangeToRawRange(
  rawToCanonical: Int32Array,
  canonicalStart: number,
  canonicalEnd: number
): { start: number; end: number } | null {
  if (canonicalEnd <= canonicalStart) return null;
  let rawStart = -1;
  let rawEnd = -1;
  for (let i = 0; i < rawToCanonical.length; i += 1) {
    const c = rawToCanonical[i]!;
    if (c < 0) continue;
    if (c >= canonicalStart && c < canonicalEnd) {
      if (rawStart < 0) rawStart = i;
      rawEnd = i + 1;
    }
  }
  if (rawStart < 0 || rawEnd < 0) return null;
  return { start: rawStart, end: rawEnd };
}

/**
 * Validate pasted text. Server is authoritative; client uses the same rules for UX.
 */
export function validatePastedText(input: string): PastedTextValidationResult {
  if (typeof input !== 'string') {
    return { ok: false, code: 'TEXT_INVALID' };
  }
  const canonical = canonicalizePastedText(input);
  if (!canonical) {
    return { ok: false, code: 'TEXT_EMPTY' };
  }
  if (canonical.length > MAX_PASTED_TEXT_CHARS) {
    return { ok: false, code: 'TEXT_TOO_LARGE' };
  }
  return { ok: true, canonical, length: canonical.length };
}

/** Human Spanish copy for structured paste errors (no IDs / hashes / table names). */
export function pastedTextErrorMessage(code: PastedTextErrorCode): string {
  switch (code) {
    case 'TEXT_EMPTY':
      return 'Pega un texto para crear tu Núcleo.';
    case 'TEXT_TOO_LARGE':
      return 'El texto es demasiado largo. Acórtalo un poco e inténtalo de nuevo.';
    case 'TEXT_INVALID':
      return 'No se pudo usar ese texto. Prueba con otro contenido.';
    case 'SOURCE_PERSIST_FAILED':
      return 'Tu Núcleo está listo, pero no se pudo guardar en la nube. Puedes reintentar el guardado.';
    default:
      return 'No se pudo procesar el texto.';
  }
}

export type PastedTextSourceStatus =
  | 'received'
  | 'validating'
  | 'extracting'
  | 'ready'
  | 'failed';

export type PastedTextPersistStatus = 'local' | 'syncing' | 'cloud' | 'sync_failed';

export type PastedTextGenerationStatus =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'cancelled'
  | 'failed';

export type PastedTextOperationIds = {
  mapId: string;
  sourceId: string;
  sourceVersionId: string;
  sourceRequestId: string;
};

function randomUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  // Fallback for older runtimes (non-crypto quality is acceptable for local ids).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Mint a full operation identity once per create intent. */
export function createPastedTextOperationIds(): PastedTextOperationIds {
  return {
    mapId: randomUuid(),
    sourceId: randomUuid(),
    sourceVersionId: randomUuid(),
    sourceRequestId: randomUuid(),
  };
}

export function isUuidLike(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export function parsePastedTextOperationIds(input: {
  mapId?: string;
  sourceId?: string;
  sourceVersionId?: string;
  sourceRequestId?: string;
}): PastedTextOperationIds | null {
  const mapId = input.mapId?.trim();
  const sourceId = input.sourceId?.trim();
  const sourceVersionId = input.sourceVersionId?.trim();
  const sourceRequestId = input.sourceRequestId?.trim();
  if (
    !isUuidLike(mapId) ||
    !isUuidLike(sourceId) ||
    !isUuidLike(sourceVersionId) ||
    !isUuidLike(sourceRequestId)
  ) {
    return null;
  }
  return {
    mapId: mapId!,
    sourceId: sourceId!,
    sourceVersionId: sourceVersionId!,
    sourceRequestId: sourceRequestId!,
  };
}

/** Safe metadata returned to clients (never includes full text or tokens). */
export type PastedTextSourceMeta = {
  sourceId: string;
  sourceVersionId: string;
  sourceRequestId: string;
  sourceStatus: PastedTextSourceStatus;
  persistStatus: PastedTextPersistStatus;
  contentHash: string;
  segmentCount: number;
  /** SAFE machine code when persistStatus is sync_failed. */
  persistFailureCode?: string;
};

const SOURCE_STATUSES: readonly PastedTextSourceStatus[] = [
  'received',
  'validating',
  'extracting',
  'ready',
  'failed',
];
const PERSIST_STATUSES: readonly PastedTextPersistStatus[] = [
  'local',
  'syncing',
  'cloud',
  'sync_failed',
];

/** Runtime guard for protocol/history payloads. */
export function parsePastedTextSourceMeta(value: unknown): PastedTextSourceMeta | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const sourceId = typeof raw.sourceId === 'string' ? raw.sourceId.trim() : '';
  const sourceVersionId =
    typeof raw.sourceVersionId === 'string' ? raw.sourceVersionId.trim() : '';
  const sourceRequestId =
    typeof raw.sourceRequestId === 'string' ? raw.sourceRequestId.trim() : '';
  const sourceStatus = raw.sourceStatus;
  const persistStatus = raw.persistStatus;
  const contentHash = typeof raw.contentHash === 'string' ? raw.contentHash.trim() : '';
  const segmentCount = Number(raw.segmentCount);
  if (
    !isUuidLike(sourceId) ||
    !isUuidLike(sourceVersionId) ||
    !isUuidLike(sourceRequestId) ||
    !SOURCE_STATUSES.includes(sourceStatus as PastedTextSourceStatus) ||
    !PERSIST_STATUSES.includes(persistStatus as PastedTextPersistStatus) ||
    !contentHash ||
    !Number.isInteger(segmentCount) ||
    segmentCount < 0
  ) {
    return null;
  }
  return {
    sourceId,
    sourceVersionId,
    sourceRequestId,
    sourceStatus: sourceStatus as PastedTextSourceStatus,
    persistStatus: persistStatus as PastedTextPersistStatus,
    contentHash,
    segmentCount,
    ...(typeof raw.persistFailureCode === 'string' &&
    raw.persistFailureCode.trim()
      ? { persistFailureCode: raw.persistFailureCode.trim() }
      : {}),
  };
}

export type PastedTextUiPhase =
  | 'reviewing'
  | 'organizing'
  | 'creating'
  | 'saving'
  | 'sync_pending'
  | 'cancelled';

export function pastedTextUiMessage(phase: PastedTextUiPhase): string {
  switch (phase) {
    case 'reviewing':
      return 'Revisando el texto…';
    case 'organizing':
      return 'Organizando la fuente…';
    case 'creating':
      return 'Creando tu Núcleo…';
    case 'saving':
      return 'Guardando…';
    case 'sync_pending':
      return 'Sincronización pendiente';
    case 'cancelled':
      return 'Creación cancelada';
    default:
      return 'Creando tu Núcleo…';
  }
}
