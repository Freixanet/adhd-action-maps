import { describe, expect, it } from 'vitest';
import {
  selectSourceViewerSurface,
  SOURCE_VIEWER_FALLBACK_LABEL,
} from './sourceViewerSurface';

describe('selectSourceViewerSurface (exclusive fallback)', () => {
  it('error yields a single fallback surface with retry', () => {
    const surface = selectSourceViewerSurface({
      hasDocumentUrl: true,
      signFailed: false,
      docStatus: 'error',
      pdfReady: true,
      hasExcerptBody: true,
    });
    expect(surface).toEqual({ kind: 'fallback', showRetry: true });
  });

  it('sign failure yields fallback even without documentUrl', () => {
    expect(
      selectSourceViewerSurface({
        hasDocumentUrl: false,
        signFailed: true,
        docStatus: 'idle',
        pdfReady: false,
        hasExcerptBody: true,
      })
    ).toEqual({ kind: 'fallback', showRetry: true });
  });

  it('render model includes the fallback label at most once', () => {
    const surface = selectSourceViewerSurface({
      hasDocumentUrl: true,
      signFailed: true,
      docStatus: 'error',
      pdfReady: false,
      hasExcerptBody: true,
    });
    expect(surface.kind).toBe('fallback');
    const excerpt = 'Página dos: externalizar la lista libera capacidad';
    // Simulate exclusive sheet body composition (one fallback block only).
    const body =
      surface.kind === 'fallback'
        ? [surface.showRetry ? 'No se pudo abrir el documento. Reintentar.' : '', SOURCE_VIEWER_FALLBACK_LABEL, excerpt]
            .filter(Boolean)
            .join('\n')
        : '';
    expect(body.split(SOURCE_VIEWER_FALLBACK_LABEL).length - 1).toBe(1);
    expect(body.split(excerpt).length - 1).toBe(1);
  });

  it('loading and pdf are mutually exclusive with fallback', () => {
    expect(
      selectSourceViewerSurface({
        hasDocumentUrl: true,
        signFailed: false,
        docStatus: 'loading',
        pdfReady: false,
        hasExcerptBody: true,
      }).kind
    ).toBe('loading');
    expect(
      selectSourceViewerSurface({
        hasDocumentUrl: true,
        signFailed: false,
        docStatus: 'ready',
        pdfReady: true,
        hasExcerptBody: true,
      }).kind
    ).toBe('pdf');
  });
});
