/**
 * WebView navigation gate for the offline PDF viewer (S08).
 * Top-frame navigations are tightly restricted; workers/subresources are
 * limited to blob: and same-directory file: paths under the session baseUrl.
 */

export type PdfViewerNavRequest = {
  url: string;
  /** True for top-frame navigations. Prefer explicit false for subresources. */
  isTopFrame?: boolean;
  mainDocumentURL?: string | null;
};

const BLOCKED_SCHEME_RE =
  /^(https?|intent|market|itms|itms-apps|mailto|tel|sms|ftp|javascript|data):/i;

function decodePathSafely(raw: string): string | null {
  let current = raw;
  // Reject multi-encoded escapes that could hide `..`
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) return current;
      current = next;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeFilePath(pathname: string): string | null {
  const decoded = decodePathSafely(pathname);
  if (decoded == null) return null;
  // Reject null bytes and backslash escapes
  if (decoded.includes('\0')) return null;
  const parts = decoded.replace(/\\/g, '/').split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') return null;
    // Encoded-dot variants already decoded; reject leftover tricks
    if (part === '..' || /^\.\.(%2f|%5c)/i.test(part)) return null;
    out.push(part);
  }
  return '/' + out.join('/');
}

/**
 * Resolve a navigation URL against the session baseUrl and ensure the result
 * stays inside the session directory.
 */
export function resolvePdfViewerSessionUrl(
  rawUrl: string,
  baseUrl: string | null | undefined
): { kind: 'file'; path: string } | { kind: 'reject' } | { kind: 'other'; url: string } {
  const raw = (rawUrl || '').trim();
  if (!raw) return { kind: 'reject' };

  const lower = raw.toLowerCase();
  if (
    lower.startsWith('about:') ||
    lower.startsWith('blob:') ||
    BLOCKED_SCHEME_RE.test(lower)
  ) {
    return { kind: 'other', url: raw };
  }

  const base = (baseUrl || '').trim();
  let absolute = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (!base) return { kind: 'reject' };
    const baseNorm = base.endsWith('/') ? base : `${base}/`;
    absolute = new URL(raw, baseNorm).toString();
  }

  if (!absolute.toLowerCase().startsWith('file:')) {
    return { kind: 'other', url: absolute };
  }

  let filePath: string;
  try {
    filePath = new URL(absolute).pathname;
  } catch {
    return { kind: 'reject' };
  }

  const normalized = normalizeFilePath(filePath);
  if (normalized == null) return { kind: 'reject' };

  if (!base) {
    return { kind: 'file', path: normalized };
  }

  let basePath: string;
  try {
    basePath = new URL(base.endsWith('/') ? base : `${base}/`).pathname;
  } catch {
    return { kind: 'reject' };
  }
  const baseNorm = normalizeFilePath(basePath);
  if (baseNorm == null) return { kind: 'reject' };
  const baseDir = baseNorm.endsWith('/') ? baseNorm : `${baseNorm}/`;
  if (!(normalized === baseDir.slice(0, -1) || normalized.startsWith(baseDir))) {
    return { kind: 'reject' };
  }
  return { kind: 'file', path: normalized };
}

export function shouldAllowPdfViewerNavigation(
  request: PdfViewerNavRequest,
  args?: { baseUrl?: string | null; allowInitialAboutBlank?: boolean }
): boolean {
  const raw = (request.url || '').trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  const isTopFrame = request.isTopFrame !== false;

  if (lower === 'about:blank' || lower.startsWith('about:blank#')) {
    // Only during the initial load window the caller opts into.
    if (args?.allowInitialAboutBlank !== true) return false;
    return isTopFrame;
  }
  if (lower.startsWith('about:')) return false;

  if (BLOCKED_SCHEME_RE.test(lower)) {
    return false;
  }

  if (lower.startsWith('blob:')) {
    // Blob is only for workers / subresources — never top-frame navigation.
    return request.isTopFrame === false;
  }

  const resolved = resolvePdfViewerSessionUrl(raw, args?.baseUrl);
  if (resolved.kind === 'reject') return false;
  if (resolved.kind === 'file') {
    return true;
  }

  // Unknown schemes (not file/blob/about/blocked) — deny.
  if (/^[a-z][a-z0-9+.-]*:/i.test(resolved.url)) {
    return false;
  }

  return false;
}
