/**
 * Exclusive surface selection for the evidence source viewer (S08).
 * Exactly one of: loading | pdf | fallback | empty.
 */

export type SourceViewerSurface =
  | { kind: 'loading' }
  | { kind: 'pdf' }
  | { kind: 'fallback'; showRetry: boolean }
  | { kind: 'empty' };

export type SelectSourceViewerSurfaceArgs = {
  hasDocumentUrl: boolean;
  signFailed: boolean;
  docStatus: 'idle' | 'loading' | 'ready' | 'error';
  pdfReady: boolean;
  hasExcerptBody: boolean;
};

export const SOURCE_VIEWER_FALLBACK_LABEL = 'Mostrando el fragmento guardado.';

export function selectSourceViewerSurface(
  args: SelectSourceViewerSurfaceArgs
): SourceViewerSurface {
  const showError = args.signFailed || args.docStatus === 'error';
  if (showError) {
    return { kind: 'fallback', showRetry: true };
  }
  if (args.hasDocumentUrl && args.docStatus === 'loading' && !args.pdfReady) {
    return { kind: 'loading' };
  }
  if (args.pdfReady && args.docStatus !== 'error') {
    return { kind: 'pdf' };
  }
  if (args.hasDocumentUrl && args.docStatus === 'loading') {
    return { kind: 'loading' };
  }
  if (args.hasExcerptBody) {
    return { kind: 'fallback', showRetry: false };
  }
  return { kind: 'empty' };
}
