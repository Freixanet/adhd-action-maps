/**
 * Document URL resolve session — production module tests.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyDocumentUrlOutcome,
  createDocumentUrlSignSession,
} from './documentUrlSignSession';
import { resolvePdfDocumentUrl } from './resolveDocumentUrl';

describe('documentUrlSignSession (productive module)', () => {
  it('discards late resolve after close or citation change', async () => {
    const session = createDocumentUrlSignSession();
    const applied: string[] = [];
    const t1 = session.begin('c1');
    const slow = new Promise<{ status: 'ready'; url: string }>((resolve) => {
      setTimeout(() => resolve({ status: 'ready', url: 'https://old.example/a.pdf' }), 30);
    });
    session.begin('c2');
    const outcome = await slow;
    applyDocumentUrlOutcome({
      session,
      token: t1,
      chunkId: 'c1',
      outcome,
      onReady: (url) => applied.push(url),
      onError: () => undefined,
    });
    expect(applied).toEqual([]);
  });

  it('retry issues a new resolve call (fresh signed URL)', async () => {
    const session = createDocumentUrlSignSession();
    const resolve = vi
      .fn()
      .mockResolvedValueOnce({ status: 'ready' as const, url: 'https://signed.example/v1.pdf' })
      .mockResolvedValueOnce({ status: 'ready' as const, url: 'https://signed.example/v2.pdf' });
    const t1 = session.begin('c1');
    const u1 = await resolve();
    expect(session.isCurrent(t1, 'c1')).toBe(true);
    expect(u1.url).toContain('/v1.pdf');
    const t2 = session.begin('c1');
    const u2 = await resolve();
    expect(session.isCurrent(t2, 'c1')).toBe(true);
    expect(u2.url).toContain('/v2.pdf');
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(u1.url).not.toBe(u2.url);
  });

  it('sign rejection maps to error outcome without unhandled rejection', async () => {
    const session = createDocumentUrlSignSession();
    const t = session.begin('c1');
    let code: string | null = null;
    await Promise.resolve()
      .then(() => {
        throw new Error('sign_failed');
      })
      .catch(() => {
        applyDocumentUrlOutcome({
          session,
          token: t,
          chunkId: 'c1',
          outcome: { status: 'error', code: 'sign_failed' },
          onReady: () => undefined,
          onError: (c) => {
            code = c;
          },
        });
      });
    expect(code).toBe('sign_failed');
  });
});

describe('resolvePdfDocumentUrl discriminated result', () => {
  it('returns not_applicable when not cloud', async () => {
    expect(
      await resolvePdfDocumentUrl({
        sourceMeta: { kind: 'pdf', persistStatus: 'local' },
        createSignedUrl: async () => ({ ok: true, url: 'https://x' }),
      })
    ).toEqual({ status: 'not_applicable' });
  });

  it('returns ready when sign succeeds', async () => {
    const createSignedUrl = vi.fn(async () => ({
      ok: true as const,
      url: 'https://signed.example/doc.pdf',
    }));
    await expect(
      resolvePdfDocumentUrl({
        sourceMeta: {
          kind: 'pdf',
          sourceId: '11111111-1111-4111-8111-111111111111',
          sourceVersionId: '22222222-2222-4222-8222-222222222222',
          sourceRequestId: '33333333-3333-4333-8333-333333333333',
          sourceStatus: 'ready',
          persistStatus: 'cloud',
          contentHash: 'abc',
          extractionDigest: 'def',
          segmentCount: 1,
          pageCount: 2,
          textualPages: 2,
          coverageStatus: 'complete',
          limitations: [],
          coverageSummary: 'ok',
          affectedPages: [],
          storagePath: 'owner/src/doc.pdf',
          schemaVersion: 's08.pdf.v1',
        },
        createSignedUrl,
      })
    ).resolves.toEqual({ status: 'ready', url: 'https://signed.example/doc.pdf' });
  });

  it('returns error when createSignedUrl fails (not null)', async () => {
    const result = await resolvePdfDocumentUrl({
      sourceMeta: {
        kind: 'pdf',
        sourceId: '11111111-1111-4111-8111-111111111111',
        sourceVersionId: '22222222-2222-4222-8222-222222222222',
        sourceRequestId: '33333333-3333-4333-8333-333333333333',
        sourceStatus: 'ready',
        persistStatus: 'cloud',
        contentHash: 'abc',
        extractionDigest: 'def',
        segmentCount: 1,
        pageCount: 2,
        textualPages: 2,
        coverageStatus: 'complete',
        limitations: [],
        coverageSummary: 'ok',
        affectedPages: [],
        storagePath: 'owner/src/doc.pdf',
        schemaVersion: 's08.pdf.v1',
      },
      createSignedUrl: async () => ({ ok: false, error: 'forbidden' }),
    });
    expect(result).toEqual({ status: 'error', code: 'forbidden' });
  });
});
