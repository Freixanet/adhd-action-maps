import { describe, expect, it } from 'vitest';
import { sanitizePersistFailureCode } from './persistFailureCodes';
import {
  derivePersistLaneDevStatus,
  deriveSyncNotice,
  syncLaneDevLabel,
} from './syncNotice';

describe('sanitizePersistFailureCode', () => {
  it('maps missing RPC / schema to safe codes', () => {
    expect(
      sanitizePersistFailureCode('Could not find the function public.persist_pdf_source')
    ).toBe('PDF_RPC_UNAVAILABLE');
    expect(
      sanitizePersistFailureCode('Could not find the table \'public.sources\' in the schema cache')
    ).toBe('PDF_SCHEMA_MISSING');
  });

  it('maps invalid public key to SUPABASE_ANON_INVALID', () => {
    expect(sanitizePersistFailureCode('Invalid API key')).toBe('SUPABASE_ANON_INVALID');
  });

  it('never returns raw provider text', () => {
    const code = sanitizePersistFailureCode(
      'duplicate key value violates unique constraint "sources_pkey" detail user@email.com'
    );
    expect(code).toBe('PDF_PERSIST_FAILED');
    expect(code).not.toMatch(/@/);
  });

  it('keeps allowlisted codes', () => {
    expect(sanitizePersistFailureCode('PDF_CONTENT_HASH_MISMATCH')).toBe(
      'PDF_CONTENT_HASH_MISMATCH'
    );
  });
});

describe('honest DEV lane statuses', () => {
  it('absence of evidence pending is unknown, not confirmed', () => {
    expect(
      derivePersistLaneDevStatus({
        applicable: true,
        pending: false,
        cloudConfirmed: false,
      })
    ).toBe('unknown');
    expect(syncLaneDevLabel('unknown')).toBe('desconocido');
  });

  it('no evidence artifact → not applicable', () => {
    expect(
      derivePersistLaneDevStatus({
        applicable: false,
        pending: false,
        cloudConfirmed: false,
      })
    ).toBe('not_applicable');
    expect(syncLaneDevLabel('not_applicable')).toBe('no aplicable');
  });

  it('cloud confirmed → guardado confirmado', () => {
    expect(
      derivePersistLaneDevStatus({
        applicable: true,
        pending: false,
        cloudConfirmed: true,
      })
    ).toBe('confirmed');
    expect(syncLaneDevLabel('confirmed')).toBe('guardado confirmado');
  });

  it('deriveSyncNotice exposes honest DEV statuses', () => {
    const notice = deriveSyncNotice({
      sourcePending: true,
      evidencePending: false,
      progressPending: false,
      applicationPending: false,
      retryingKind: null,
      lastFailureCode: 'PDF_RPC_UNAVAILABLE',
      sourceCloudConfirmed: false,
      evidenceApplicable: false,
      evidenceCloudConfirmed: false,
    });
    expect(notice?.sourceDevStatus).toBe('error');
    expect(notice?.evidenceDevStatus).toBe('not_applicable');
    expect(syncLaneDevLabel(notice!.sourceDevStatus)).toBe('error');
  });

  it('source+evidence cloud confirmed clears banner', () => {
    expect(
      deriveSyncNotice({
        sourcePending: false,
        evidencePending: false,
        progressPending: false,
        applicationPending: false,
        retryingKind: null,
        lastFailureCode: null,
        sourceCloudConfirmed: true,
        evidenceApplicable: true,
        evidenceCloudConfirmed: true,
      })
    ).toBeNull();
  });
});
