/**
 * S08 pending PDF sync — durable URI queue; awaits metadata; authentic restart.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  configureStorage,
  type DurableKeyValueStorage,
} from '../storage';
import {
  clearPendingPdfSourceSyncForUser,
  getPendingPdfSourceSyncForMap,
  commitPendingPdfSourceSync,
  upsertPendingPdfSourceSync,
  loadPendingPdfSourceSync,
  removePendingPdfSourceSyncByMapId,
} from '../pendingPdfSourceSync';
import {
  configurePendingPdfFileIO,
  readPendingPdfFile,
} from './pendingPdfFileIO';
import { createPastedTextOperationIds } from '../pastedText';

/** File-backed KV — a new instance on the same path remounts prior writes. */
class FileBackedDurableStorage implements DurableKeyValueStorage {
  private data = new Map<string, string>();

  constructor(private readonly path: string) {
    this.reload();
  }

  reload(): void {
    this.data.clear();
    if (!existsSync(this.path)) return;
    const raw = readFileSync(this.path, 'utf8');
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) this.data.set(k, v);
  }

  private persist(): void {
    const obj: Record<string, string> = {};
    for (const [k, v] of this.data) obj[k] = v;
    writeFileSync(this.path, JSON.stringify(obj));
  }

  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
    this.persist();
  }
  removeItem(key: string) {
    this.data.delete(key);
    this.persist();
  }
  async setItemDurable(key: string, value: string) {
    this.setItem(key, value);
  }
  async removeItemDurable(key: string) {
    this.removeItem(key);
  }
}

class FailingDurableStorage implements DurableKeyValueStorage {
  private data = new Map<string, string>();
  failNext = false;
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  async setItemDurable(key: string, value: string) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('forced_metadata_write_fail');
    }
    this.data.set(key, value);
  }
  async removeItemDurable(key: string) {
    this.data.delete(key);
  }
}

function baseItem(ids: ReturnType<typeof createPastedTextOperationIds>) {
  return {
    mapId: ids.mapId,
    sourceId: ids.sourceId,
    sourceVersionId: ids.sourceVersionId,
    sourceRequestId: ids.sourceRequestId,
    contentHash: 'hash-a',
    extractionDigest: 'digest-a',
    pageCount: 1,
    segments: [
      {
        ordinal: 0,
        kind: 'chunk',
        raw_text: 'hola',
        normalized_text: 'hola',
        chunk_id: 'c1',
        anchor: { type: 'page_char_range' as const, page: 1, start: 0, end: 4 },
      },
    ],
    coverage: {
      pageCount: 1,
      textualPages: 1,
      emptyPages: 0,
      imageOnlyPages: 0,
      totalExtractedChars: 4,
      status: 'complete' as const,
      affectedPages: [] as number[],
      limitations: [] as [],
      summary: 'ok',
    },
    title: 'a.pdf',
  };
}

describe('S08 pendingPdfSourceSync durable', () => {
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  let root = '';
  let kvPath = '';

  beforeEach(() => {
    root = join(tmpdir(), `s08-pending-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    kvPath = join(root, 'kv.json');
    mkdirSync(root, { recursive: true });
    configureStorage(new FileBackedDurableStorage(kvPath));
    configurePendingPdfFileIO({
      write: async ({ userId, sourceRequestId, bytes }) => {
        const dir = join(root, userId);
        mkdirSync(dir, { recursive: true });
        const uri = join(dir, `${sourceRequestId}.pdf`);
        writeFileSync(uri, Buffer.from(bytes));
        return uri;
      },
      read: async (uri) => {
        if (!existsSync(uri)) throw new Error('pending_pdf_file_missing');
        const buf = readFileSync(uri);
        if (buf.length === 0) throw new Error('pending_pdf_file_corrupt');
        return new Uint8Array(buf);
      },
      remove: async (uri) => {
        if (existsSync(uri)) rmSync(uri);
      },
    });
  });

  afterEach(async () => {
    await clearPendingPdfSourceSyncForUser(userA).catch(() => undefined);
    await clearPendingPdfSourceSyncForUser(userB).catch(() => undefined);
    configurePendingPdfFileIO(null);
    if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  it('authentic restart: second storage instance reads same underlying persistence', async () => {
    const ids = createPastedTextOperationIds();
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const committed = await commitPendingPdfSourceSync({
      userId: userA,
      liveUserId: () => userA,
      bytes,
      item: baseItem(ids),
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(existsSync(committed.localFileUri)).toBe(true);
    expect(getPendingPdfSourceSyncForMap(userB, ids.mapId)).toBeNull();

    // New process: new FileBackedDurableStorage on the same path — no manual reinsert.
    configureStorage(new FileBackedDurableStorage(kvPath));
    const remounted = loadPendingPdfSourceSync(userA);
    expect(remounted).toHaveLength(1);
    expect(remounted[0]!.sourceRequestId).toBe(ids.sourceRequestId);
    expect(remounted[0]!.localFileUri).toBe(committed.localFileUri);
    expect((remounted[0] as { fileDataBase64?: string }).fileDataBase64).toBeUndefined();
    expect(existsSync(committed.localFileUri)).toBe(true);
  });

  it('metadata write failure → ok:false and deletes newly written file', async () => {
    const failing = new FailingDurableStorage();
    failing.failNext = true;
    configureStorage(failing);
    const ids = createPastedTextOperationIds();
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const committed = await commitPendingPdfSourceSync({
      userId: userA,
      liveUserId: () => userA,
      bytes,
      item: baseItem(ids),
    });
    expect(committed.ok).toBe(false);
    expect(loadPendingPdfSourceSync(userA)).toHaveLength(0);
    const expectedUri = join(root, userA, `${ids.sourceRequestId}.pdf`);
    expect(existsSync(expectedUri)).toBe(false);
  });

  it('A→B between file write and metadata → orphan file deleted, B empty', async () => {
    let live = userA;
    let writeCount = 0;
    configurePendingPdfFileIO({
      write: async ({ userId, sourceRequestId, bytes }) => {
        const dir = join(root, userId);
        mkdirSync(dir, { recursive: true });
        const uri = join(dir, `${sourceRequestId}.pdf`);
        writeFileSync(uri, Buffer.from(bytes));
        writeCount += 1;
        // Switch owner immediately after file lands, before metadata.
        live = userB;
        return uri;
      },
      read: async (uri) => new Uint8Array(readFileSync(uri)),
      remove: async (uri) => {
        if (existsSync(uri)) rmSync(uri);
      },
    });
    const ids = createPastedTextOperationIds();
    const committed = await commitPendingPdfSourceSync({
      userId: userA,
      liveUserId: () => live,
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      item: baseItem(ids),
    });
    expect(committed.ok).toBe(false);
    expect(writeCount).toBe(1);
    expect(existsSync(join(root, userA, `${ids.sourceRequestId}.pdf`))).toBe(false);
    expect(loadPendingPdfSourceSync(userA)).toHaveLength(0);
    expect(loadPendingPdfSourceSync(userB)).toHaveLength(0);
  });

  it('missing file on flush read → typed error, no false success', async () => {
    const ids = createPastedTextOperationIds();
    const committed = await commitPendingPdfSourceSync({
      userId: userA,
      liveUserId: () => userA,
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      item: baseItem(ids),
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    rmSync(committed.localFileUri);
    const read = await readPendingPdfFile(committed.localFileUri);
    expect(read.ok).toBe(false);
    if (read.ok === false) {
      expect(read.error).toMatch(/missing|ENOENT|pending_pdf/i);
    } else {
      throw new Error('expected missing file');
    }
    // Queue metadata still coherent (caller decides cleanup).
    expect(getPendingPdfSourceSyncForMap(userA, ids.mapId)?.localFileUri).toBe(
      committed.localFileUri
    );
  });

  it('B cannot load A pending; invalid URI rejected', async () => {
    const ids = createPastedTextOperationIds();
    await commitPendingPdfSourceSync({
      userId: userA,
      liveUserId: () => userA,
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      item: baseItem(ids),
    });
    expect(getPendingPdfSourceSyncForMap(userB, ids.mapId)).toBeNull();
    const bad = await upsertPendingPdfSourceSync(userA, {
      ...baseItem(ids),
      localFileUri: '',
      byteSize: 1,
    });
    expect(bad.ok).toBe(false);
    await removePendingPdfSourceSyncByMapId(userA, ids.mapId);
  });
});
