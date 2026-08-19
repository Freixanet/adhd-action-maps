/**
 * Prepare a local, offline PDF page viewer directory for WebView (S08).
 * Fail-closed: any error deletes the session directory.
 */

import { Asset } from 'expo-asset';
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import {
  PDF_VIEWER_CACHE_PREFIX,
  prepareLocalPdfViewerCore,
  sweepStalePdfViewerSessions,
  type LocalPdfViewerCoreSession,
  type PdfViewerFileIO,
} from '@shared/pdf/prepareLocalPdfViewerCore';

export type LocalPdfViewerSession = LocalPdfViewerCoreSession;

function expoIo(): PdfViewerFileIO {
  return {
    async deleteDir(path) {
      await deleteAsync(path, { idempotent: true });
    },
    async makeDir(path) {
      await makeDirectoryAsync(path, { intermediates: true });
    },
    async copyFile(from, to) {
      await copyAsync({ from, to });
    },
    async writeTextFile(path, contents) {
      await writeAsStringAsync(path, contents);
    },
    async download(url, to) {
      const result = await downloadAsync(url, to);
      return { status: result.status };
    },
    async getSize(path) {
      const info = await getInfoAsync(path);
      if (!info.exists || !('size' in info)) return 0;
      return Number(info.size) || 0;
    },
    async listChildDirNames(parent) {
      try {
        const names = await readDirectoryAsync(parent);
        return names;
      } catch {
        return [];
      }
    },
    now: () => Date.now(),
  };
}

async function ensureAssetLocalUri(mod: number): Promise<string> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('pdfjs_asset_missing');
  return asset.localUri;
}

function cacheRoot(): string {
  const root = cacheDirectory ?? '';
  return `${root}${PDF_VIEWER_CACHE_PREFIX}/`;
}

/** Sweep orphaned viewer dirs (TTL). Safe to call on app/viewer start. */
export async function sweepPdfViewerCache(protectSessionId?: string | null): Promise<string[]> {
  return sweepStalePdfViewerSessions({
    cacheRoot: cacheRoot(),
    io: expoIo(),
    protectSessionId,
  });
}

export async function prepareLocalPdfViewer(args: {
  signedUrl: string;
  page: number;
  sessionId: string;
  protectSessionId?: string | null;
}): Promise<LocalPdfViewerSession> {
  // Vendored ESM builds from lockfile-pinned pdfjs-dist (see pdfjsVendorManifest).
  // Named *.mjs.txt so Metro packs them as assets (txt ∈ assetExts) without
  // treating the payload as an executable JS module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfJsMod = require('../../assets/pdfjs/pdf.min.mjs.txt') as number;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const workerMod = require('../../assets/pdfjs/pdf.worker.min.mjs.txt') as number;

  let pdfJsUri: string;
  let workerUri: string;
  try {
    pdfJsUri = await ensureAssetLocalUri(pdfJsMod);
    workerUri = await ensureAssetLocalUri(workerMod);
  } catch (err) {
    // Fail closed even before session dir exists — sweep leftovers.
    await sweepPdfViewerCache(args.protectSessionId ?? null).catch(() => undefined);
    throw err;
  }

  return prepareLocalPdfViewerCore({
    signedUrl: args.signedUrl,
    page: args.page,
    sessionId: args.sessionId,
    cacheRoot: cacheRoot(),
    pdfJsAssetUri: pdfJsUri,
    pdfWorkerAssetUri: workerUri,
    io: expoIo(),
    protectSessionId: args.protectSessionId ?? null,
  });
}
