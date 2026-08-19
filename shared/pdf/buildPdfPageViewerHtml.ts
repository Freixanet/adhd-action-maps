/**
 * Controlled PDF page viewer shell (S08).
 * Local ESM pdf.js only — no remote scripts/hosts; PDF stays on a file path.
 */

import { MAX_PDF_BYTES } from './versions';
import {
  PDFJS_SESSION_MAIN,
  PDFJS_SESSION_WORKER,
} from './pdfjsVendorManifest';

export const PDF_PAGE_VIEWER_MAX_BYTES = MAX_PDF_BYTES;

export type BuildPdfPageViewerHtmlArgs = {
  /** 1-based page to render. */
  page: number;
  /** Relative name of the PDF inside the WebView read-access root. */
  pdfSrc: string;
  /** Local relative name for pdf.min.mjs — never remote. */
  pdfJsSrc?: string;
  /** Local relative name for pdf.worker.min.mjs — never remote. */
  pdfWorkerSrc?: string;
  /** Local relative boot module (default boot.mjs). */
  bootSrc?: string;
};

const REMOTE_URI_RE =
  /https?:\/\/|cdnjs\.cloudflare\.com|unpkg\.com|jsdelivr\.net|unsafe-eval/i;

/** Strict CSP: no remote hosts, no unsafe-eval, no unsafe-inline scripts. */
export const PDF_VIEWER_CSP =
  "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src file: blob:; worker-src blob: file:; style-src 'unsafe-inline'; img-src blob: data: file:; connect-src file: blob:; object-src 'none';";

export const PDF_VIEWER_BOOT_FILENAME = 'boot.mjs';

export function assertNoRemoteViewerAssets(...uris: string[]): void {
  for (const uri of uris) {
    if (REMOTE_URI_RE.test(uri)) {
      throw new Error(`remote viewer asset forbidden: ${uri}`);
    }
  }
}

/** Boot module loaded via <script type="module" src="boot.mjs"> — no inline JS. */
export function buildPdfPageViewerBootModule(args: {
  page: number;
  pdfSrc: string;
  pdfJsSrc?: string;
  pdfWorkerSrc?: string;
}): string {
  const page = Number.isFinite(args.page) && args.page >= 1 ? Math.floor(args.page) : 1;
  const pdfJsSrc = args.pdfJsSrc ?? PDFJS_SESSION_MAIN;
  const pdfWorkerSrc = args.pdfWorkerSrc ?? PDFJS_SESSION_WORKER;
  assertNoRemoteViewerAssets(args.pdfSrc, pdfJsSrc, pdfWorkerSrc);

  return `import * as pdfjsLib from ${JSON.stringify('./' + pdfJsSrc.replace(/^\.\//, ''))};

function post(payload) {
  try {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  } catch (_) {}
}

function fail(message) {
  const el = document.getElementById('err');
  if (el) { el.hidden = false; el.textContent = message || 'Error al renderizar el PDF'; }
  post({ type: 'error', message: String(message || 'render failed') });
}

try {
  if (!pdfjsLib || !pdfjsLib.getDocument) {
    fail('pdf.js local no disponible');
  } else {
    pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerSrc)};
    const pageNumber = ${page};
    const pdfSrc = ${JSON.stringify(args.pdfSrc)};
    pdfjsLib.getDocument({
      url: pdfSrc,
      isEvalSupported: false,
      disableAutoFetch: true,
      disableStream: false
    }).promise.then((pdf) => {
      const target = Math.min(Math.max(1, pageNumber), pdf.numPages);
      return pdf.getPage(target).then((page) => {
        const scale = 1.4;
        const viewport = page.getViewport({ scale });
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        return page.render({ canvasContext: ctx, viewport }).promise.then(() => {
          post({ type: 'ready', page: target, pageCount: pdf.numPages });
        });
      });
    }).catch((err) => {
      fail(err && err.message ? err.message : err);
    });
  }
} catch (err) {
  fail(err && err.message ? err.message : err);
}
`;
}

export function buildPdfPageViewerHtml(args: BuildPdfPageViewerHtmlArgs): string {
  const page = Number.isFinite(args.page) && args.page >= 1 ? Math.floor(args.page) : 1;
  const pdfJsSrc = args.pdfJsSrc ?? PDFJS_SESSION_MAIN;
  const pdfWorkerSrc = args.pdfWorkerSrc ?? PDFJS_SESSION_WORKER;
  const bootSrc = args.bootSrc ?? PDF_VIEWER_BOOT_FILENAME;
  assertNoRemoteViewerAssets(args.pdfSrc, pdfJsSrc, pdfWorkerSrc, bootSrc);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3"/>
<meta http-equiv="Content-Security-Policy" content="${PDF_VIEWER_CSP}"/>
<style>
  html,body{margin:0;padding:0;background:#111;color:#eee;font:14px -apple-system,sans-serif;}
  #wrap{display:flex;flex-direction:column;align-items:center;padding:8px;}
  canvas{max-width:100%;height:auto;background:#fff;}
  #err{padding:16px;color:#f88;}
</style>
</head>
<body>
<div id="wrap"><canvas id="c"></canvas><div id="err" hidden></div></div>
<script type="module" src="${bootSrc}"></script>
</body>
</html>`;
}

/** True when viewer HTML/assets reference a remote host or unsafe-eval (forbidden). */
export function viewerHtmlHasRemoteHost(html: string): boolean {
  return REMOTE_URI_RE.test(html);
}

export function viewerHtmlHasEvalSupportDisabled(bootOrHtml: string): boolean {
  return /isEvalSupported\s*:\s*false/.test(bootOrHtml);
}

export function viewerArtifactsForbidRemoteAndEval(parts: string[]): void {
  for (const part of parts) {
    if (REMOTE_URI_RE.test(part) || /unsafe-eval/i.test(part)) {
      throw new Error('viewer artifact contains forbidden remote/eval token');
    }
    if (/3\.11\.174/.test(part)) {
      throw new Error('viewer artifact still references vulnerable pdf.js 3.11.174');
    }
  }
}
