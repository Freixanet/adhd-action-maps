/**
 * Resolve authorized PDF document URL for the evidence viewer (S08).
 * Signing is injected — never downloads 20 MiB just to probe availability.
 */

import { parsePdfSourceMeta } from './applyCoverageToMap';
import type { ResolveDocumentUrlOutcome } from './documentUrlSignSession';

export type CreateSignedSourceUrlFn = (
  storagePath: string
) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;

export type ResolvePdfDocumentUrlArgs = {
  sourceMeta: unknown;
  createSignedUrl: CreateSignedSourceUrlFn;
};

export type ResolvePdfDocumentUrlResult = ResolveDocumentUrlOutcome;

export async function resolvePdfDocumentUrl(
  args: ResolvePdfDocumentUrlArgs
): Promise<ResolvePdfDocumentUrlResult> {
  const pdfMeta = parsePdfSourceMeta(args.sourceMeta);
  const path = pdfMeta?.storagePath?.trim();
  if (!path || pdfMeta?.persistStatus !== 'cloud') {
    return { status: 'not_applicable' };
  }
  const signed = await args.createSignedUrl(path);
  if (signed.ok === false) {
    return { status: 'error', code: signed.error || 'sign_failed' };
  }
  const url = signed.url?.trim();
  if (!url) {
    return { status: 'error', code: 'empty_signed_url' };
  }
  return { status: 'ready', url };
}

/** @deprecated Prefer page-aware native/local viewers; kept for URI helpers. */
export function pdfViewerUriForPage(documentUrl: string, page: number | null): string {
  if (page == null || page < 1) return documentUrl;
  const base = documentUrl.split('#')[0]!;
  return `${base}#page=${page}`;
}
