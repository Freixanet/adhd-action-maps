/**
 * Fail-closed local PDF viewer session preparation (S08).
 * IO is injected so unit tests can assert cleanup without Expo.
 */

import { MAX_PDF_BYTES } from './versions';
import {
  buildPdfPageViewerBootModule,
  buildPdfPageViewerHtml,
  PDF_VIEWER_BOOT_FILENAME,
} from './buildPdfPageViewerHtml';
import {
  PDFJS_SESSION_MAIN,
  PDFJS_SESSION_WORKER,
} from './pdfjsVendorManifest';

export const PDF_VIEWER_CACHE_PREFIX = 'nucleo-pdf-viewer';
/** Sessions older than this are swept on prepare. */
export const PDF_VIEWER_SESSION_TTL_MS = 60 * 60 * 1000;

export type PdfViewerFileIO = {
  deleteDir(path: string): Promise<void>;
  makeDir(path: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
  writeTextFile(path: string, contents: string): Promise<void>;
  download(url: string, to: string): Promise<{ status: number }>;
  getSize(path: string): Promise<number>;
  /** List immediate child directory names under parent (not full paths). */
  listChildDirNames(parent: string): Promise<string[]>;
  now(): number;
};

export type PrepareLocalPdfViewerCoreArgs = {
  signedUrl: string;
  page: number;
  sessionId: string;
  cacheRoot: string;
  /** Absolute/local URIs for vendored pdf.js main + worker. */
  pdfJsAssetUri: string;
  pdfWorkerAssetUri: string;
  io: PdfViewerFileIO;
  /** Optional active session id that must not be swept/deleted by stale cleanup. */
  protectSessionId?: string | null;
};

export type LocalPdfViewerCoreSession = {
  sessionId: string;
  dir: string;
  html: string;
  baseUrl: string;
  cleanup: () => Promise<void>;
};

function joinRoot(cacheRoot: string, sessionId: string): string {
  const base = cacheRoot.endsWith('/') ? cacheRoot : `${cacheRoot}/`;
  return `${base}${sessionId}/`;
}

function toFileBaseUrl(dir: string): string {
  return dir.startsWith('file://') ? dir : `file://${dir}`;
}

export async function sweepStalePdfViewerSessions(args: {
  cacheRoot: string;
  io: PdfViewerFileIO;
  protectSessionId?: string | null;
  ttlMs?: number;
}): Promise<string[]> {
  const ttl = args.ttlMs ?? PDF_VIEWER_SESSION_TTL_MS;
  const now = args.io.now();
  const removed: string[] = [];
  let names: string[] = [];
  try {
    names = await args.io.listChildDirNames(args.cacheRoot);
  } catch {
    return removed;
  }
  for (const name of names) {
    if (args.protectSessionId && name === args.protectSessionId) continue;
    // sessionId format: `${Date.now()}-…` — parse leading millis when present.
    const stamp = Number.parseInt(name.split('-')[0] ?? '', 10);
    const aged = !Number.isFinite(stamp) || now - stamp > ttl;
    if (!aged) continue;
    const dir = joinRoot(args.cacheRoot, name);
    try {
      await args.io.deleteDir(dir);
      removed.push(name);
    } catch {
      // best-effort sweep
    }
  }
  return removed;
}

export async function prepareLocalPdfViewerCore(
  args: PrepareLocalPdfViewerCoreArgs
): Promise<LocalPdfViewerCoreSession> {
  const dir = joinRoot(args.cacheRoot, args.sessionId);
  let created = false;

  const cleanup = async () => {
    try {
      await args.io.deleteDir(dir);
    } catch {
      // idempotent
    }
  };

  try {
    await sweepStalePdfViewerSessions({
      cacheRoot: args.cacheRoot,
      io: args.io,
      protectSessionId: args.protectSessionId ?? args.sessionId,
    });

    await args.io.deleteDir(dir);
    await args.io.makeDir(dir);
    created = true;

    await args.io.copyFile(args.pdfJsAssetUri, `${dir}${PDFJS_SESSION_MAIN}`);
    await args.io.copyFile(args.pdfWorkerAssetUri, `${dir}${PDFJS_SESSION_WORKER}`);

    const boot = buildPdfPageViewerBootModule({
      page: args.page,
      pdfSrc: 'document.pdf',
      pdfJsSrc: PDFJS_SESSION_MAIN,
      pdfWorkerSrc: PDFJS_SESSION_WORKER,
    });
    await args.io.writeTextFile(`${dir}${PDF_VIEWER_BOOT_FILENAME}`, boot);

    const pdfPath = `${dir}document.pdf`;
    const downloaded = await args.io.download(args.signedUrl, pdfPath);
    if (downloaded.status < 200 || downloaded.status >= 300) {
      throw new Error(`pdf_download_http_${downloaded.status}`);
    }

    const size = await args.io.getSize(pdfPath);
    if (size <= 0) throw new Error('pdf_download_empty');
    if (size > MAX_PDF_BYTES) throw new Error('pdf_too_large');

    const html = buildPdfPageViewerHtml({
      page: args.page,
      pdfSrc: 'document.pdf',
      pdfJsSrc: PDFJS_SESSION_MAIN,
      pdfWorkerSrc: PDFJS_SESSION_WORKER,
      bootSrc: PDF_VIEWER_BOOT_FILENAME,
    });

    return {
      sessionId: args.sessionId,
      dir,
      html,
      baseUrl: toFileBaseUrl(dir),
      cleanup,
    };
  } catch (err) {
    if (created) await cleanup();
    else {
      try {
        await args.io.deleteDir(dir);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}
