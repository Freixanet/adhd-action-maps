import { describe, expect, it, vi } from 'vitest';
import { deleteAccountFully, listAllOwnerStoragePaths } from './accountDelete';

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('deleteAccountFully storage fail-closed', () => {
  const baseDeps = {
    supabaseUrl: 'https://example.supabase.co',
    serviceRoleKey: 'service-role-test-key',
    isPlaceholderUrl: () => false,
    storageListPageSize: 2,
    storageDeleteBatchSize: 2,
  };

  it('rejects missing auth', async () => {
    const result = await deleteAccountFully(undefined, baseDeps);
    expect(result).toMatchObject({ ok: false, code: 'auth_required' });
  });

  it('rejects when service role is not configured', async () => {
    const result = await deleteAccountFully('user-a', {
      ...baseDeps,
      serviceRoleKey: undefined,
    });
    expect(result).toMatchObject({ ok: false, code: 'delete_not_configured' });
  });

  it('list failure prevents Auth delete', async () => {
    const authCalls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/rest/v1/source_versions')) return jsonResponse(200, []);
      if (u.includes('/storage/v1/object/list/')) return jsonResponse(500, { error: 'boom' });
      if (u.includes('/auth/v1/admin/users/')) {
        authCalls.push(u);
        return jsonResponse(200);
      }
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    const result = await deleteAccountFully('user-a', { ...baseDeps, fetchImpl });
    expect(result).toMatchObject({ ok: false, code: 'storage_purge_failed' });
    expect(authCalls).toHaveLength(0);
  });

  it('malformed list prevents Auth delete', async () => {
    const authCalls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/rest/v1/source_versions')) return jsonResponse(200, []);
      if (u.includes('/storage/v1/object/list/')) {
        return new Response('not-json', { status: 200 });
      }
      if (u.includes('/auth/v1/admin/users/')) {
        authCalls.push(u);
        return jsonResponse(200);
      }
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    const result = await deleteAccountFully('user-a', { ...baseDeps, fetchImpl });
    expect(result).toMatchObject({ ok: false, code: 'storage_purge_failed' });
    expect(authCalls).toHaveLength(0);
  });

  it('paginates nested source folders and deletes all pages', async () => {
    const deletedBatches: string[][] = [];
    let listCalls = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/rest/v1/source_versions')) {
        return jsonResponse(200, [
          {
            owner_id: 'user-a',
            source_id: 'src-1',
            storage_path: 'user-a/src-1/from-db.txt',
            storage_bucket: 'sources',
          },
        ]);
      }
      if (u.includes('/storage/v1/object/list/')) {
        listCalls += 1;
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          prefix?: string;
          offset?: number;
        };
        const prefix = body.prefix ?? '';
        const offset = body.offset ?? 0;
        if (prefix === 'user-a/') {
          // two folder pages
          if (offset === 0) return jsonResponse(200, [{ name: 'src-1', id: null }, { name: 'src-2', id: null }]);
          return jsonResponse(200, []);
        }
        if (prefix === 'user-a/src-1/') {
          if (offset === 0) {
            return jsonResponse(200, [
              { name: 'a.txt', id: '1' },
              { name: 'b.txt', id: '2' },
            ]);
          }
          if (offset === 2) return jsonResponse(200, [{ name: 'c.txt', id: '3' }]);
          return jsonResponse(200, []);
        }
        if (prefix === 'user-a/src-2/') {
          if (offset === 0) return jsonResponse(200, [{ name: 'd.txt', id: '4' }]);
          return jsonResponse(200, []);
        }
        return jsonResponse(200, []);
      }
      if (u.includes('/storage/v1/object/sources') && init?.method === 'DELETE') {
        const body = JSON.parse(String(init.body ?? '{}')) as { prefixes?: string[] };
        deletedBatches.push(body.prefixes ?? []);
        return jsonResponse(200);
      }
      if (u.includes('/rest/v1/maps')) return jsonResponse(200);
      if (u.includes('/rest/v1/sources')) return jsonResponse(200);
      if (u.includes('/auth/v1/admin/users/')) return jsonResponse(200);
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    // First pass lists objects; after delete, verify lists empty.
    let phase: 'inventory' | 'verify1' | 'verify2' = 'inventory';
    const wrapped: typeof fetch = async (url, init) => {
      const res = await fetchImpl(url, init);
      if (String(url).includes('/storage/v1/object/list/')) {
        if (phase === 'verify1' || phase === 'verify2') {
          return jsonResponse(200, []);
        }
      }
      if (String(url).includes('/storage/v1/object/sources') && init?.method === 'DELETE') {
        phase = 'verify1';
      }
      if (String(url).includes('/rest/v1/maps')) {
        phase = 'verify2';
      }
      return res;
    };

    const result = await deleteAccountFully('user-a', {
      ...baseDeps,
      fetchImpl: wrapped,
    });
    expect(result).toEqual({ ok: true, code: 'ok' });
    const flat = deletedBatches.flat();
    expect(flat).toEqual(
      expect.arrayContaining([
        'user-a/src-1/from-db.txt',
        'user-a/src-1/a.txt',
        'user-a/src-1/b.txt',
        'user-a/src-1/c.txt',
        'user-a/src-2/d.txt',
      ])
    );
    expect(listCalls).toBeGreaterThan(2);
  });

  it('delete page failure prevents Auth', async () => {
    const authCalls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/rest/v1/source_versions')) return jsonResponse(200, []);
      if (u.includes('/storage/v1/object/list/')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { prefix?: string };
        if (body.prefix === 'user-a/') {
          return jsonResponse(200, [{ name: 'src-1', id: null }]);
        }
        if (body.prefix === 'user-a/src-1/') {
          return jsonResponse(200, [{ name: 'a.txt', id: '1' }]);
        }
        return jsonResponse(200, []);
      }
      if (u.includes('/storage/v1/object/sources') && init?.method === 'DELETE') {
        return jsonResponse(500);
      }
      if (u.includes('/auth/v1/admin/users/')) {
        authCalls.push(u);
        return jsonResponse(200);
      }
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    const result = await deleteAccountFully('user-a', { ...baseDeps, fetchImpl });
    expect(result).toMatchObject({ ok: false, code: 'storage_purge_failed' });
    expect(authCalls).toHaveLength(0);
  });

  it('retry after partial delete completes when remaining objects are purged', async () => {
    let deletedOnce = false;
    const authCalls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/rest/v1/source_versions')) return jsonResponse(200, []);
      if (u.includes('/storage/v1/object/list/')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { prefix?: string };
        if (!deletedOnce) {
          if (body.prefix === 'user-a/') return jsonResponse(200, [{ name: 'src-1', id: null }]);
          if (body.prefix === 'user-a/src-1/') {
            return jsonResponse(200, [{ name: 'a.txt', id: '1' }]);
          }
        }
        return jsonResponse(200, []);
      }
      if (u.includes('/storage/v1/object/sources') && init?.method === 'DELETE') {
        deletedOnce = true;
        return jsonResponse(200);
      }
      if (u.includes('/rest/v1/maps')) return jsonResponse(200);
      if (u.includes('/rest/v1/sources')) return jsonResponse(200);
      if (u.includes('/auth/v1/admin/users/')) {
        authCalls.push(u);
        return jsonResponse(200);
      }
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    const first = await deleteAccountFully('user-a', { ...baseDeps, fetchImpl });
    expect(first).toEqual({ ok: true, code: 'ok' });
    // Idempotent retry on empty storage
    const second = await deleteAccountFully('user-a', { ...baseDeps, fetchImpl });
    expect(second).toEqual({ ok: true, code: 'ok' });
    expect(authCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('empty storage still requires maps/sources then Auth', async () => {
    const order: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/rest/v1/source_versions')) {
        order.push('versions');
        return jsonResponse(200, []);
      }
      if (u.includes('/storage/v1/object/list/')) {
        order.push('list');
        return jsonResponse(200, []);
      }
      if (u.includes('/rest/v1/maps')) {
        order.push('maps');
        return jsonResponse(200);
      }
      if (u.includes('/rest/v1/sources')) {
        order.push('sources');
        return jsonResponse(200);
      }
      if (u.includes('/auth/v1/admin/users/')) {
        order.push('auth');
        return jsonResponse(200);
      }
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    const result = await deleteAccountFully('user-a', { ...baseDeps, fetchImpl });
    expect(result).toEqual({ ok: true, code: 'ok' });
    expect(order.indexOf('list')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('maps')).toBeGreaterThan(order.indexOf('list'));
    expect(order.indexOf('auth')).toBeGreaterThan(order.indexOf('maps'));
    expect(order.indexOf('auth')).toBeGreaterThan(order.indexOf('sources'));
  });

  it('Auth is only invoked after storage confirmation', async () => {
    const authBeforeVerify: string[] = [];
    let sawVerifyEmpty = false;
    const fetchImpl = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes('/rest/v1/source_versions')) return jsonResponse(200, []);
      if (u.includes('/storage/v1/object/list/')) {
        sawVerifyEmpty = true;
        return jsonResponse(200, []);
      }
      if (u.includes('/rest/v1/maps') || u.includes('/rest/v1/sources')) return jsonResponse(200);
      if (u.includes('/auth/v1/admin/users/')) {
        if (!sawVerifyEmpty) authBeforeVerify.push(u);
        return jsonResponse(200);
      }
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    await deleteAccountFully('user-a', { ...baseDeps, fetchImpl });
    expect(authBeforeVerify).toHaveLength(0);
  });

  it('foreign storage_path fails closed without Storage DELETE or Auth', async () => {
    const storageDeletes: string[] = [];
    const authCalls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/rest/v1/source_versions')) {
        return jsonResponse(200, [
          {
            owner_id: 'user-a',
            source_id: '11111111-1111-1111-1111-111111111111',
            storage_bucket: 'sources',
            storage_path: 'user-b/22222222-2222-2222-2222-222222222222/private.pdf',
          },
        ]);
      }
      if (u.includes('/storage/v1/object/list/')) return jsonResponse(200, []);
      if (u.includes('/storage/v1/object/sources') && init?.method === 'DELETE') {
        storageDeletes.push(String(init.body));
        return jsonResponse(200);
      }
      if (u.includes('/auth/v1/admin/users/')) {
        authCalls.push(u);
        return jsonResponse(200);
      }
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    const result = await deleteAccountFully('user-a', { ...baseDeps, fetchImpl });
    expect(result).toMatchObject({ ok: false, code: 'storage_purge_failed' });
    expect(storageDeletes).toEqual([]);
    expect(authCalls).toEqual([]);
  });
});

describe('listAllOwnerStoragePaths', () => {
  it('walks multiple pages under nested prefixes', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { prefix?: string; offset?: number };
      if (body.prefix === 'u/') {
        if ((body.offset ?? 0) === 0) return jsonResponse(200, [{ name: 's1', id: null }]);
        return jsonResponse(200, []);
      }
      if (body.prefix === 'u/s1/') {
        if ((body.offset ?? 0) === 0) {
          return jsonResponse(200, [
            { name: 'a', id: '1' },
            { name: 'b', id: '2' },
          ]);
        }
        if ((body.offset ?? 0) === 2) return jsonResponse(200, [{ name: 'c', id: '3' }]);
        return jsonResponse(200, []);
      }
      return jsonResponse(200, []);
    }) as unknown as typeof fetch;

    const result = await listAllOwnerStoragePaths(
      fetchImpl,
      'https://example.supabase.co',
      'key',
      'u',
      2
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paths.sort()).toEqual(['u/s1/a', 'u/s1/b', 'u/s1/c']);
    }
  });
});
