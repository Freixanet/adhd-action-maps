/**
 * Offline pdf.js shell that paints page 1 fitted into the attachment chip.
 * Used for the collapsed-composer attachment FAB — never native PDF chrome.
 */

import { PDF_VIEWER_CSP, assertNoRemoteViewerAssets } from './buildPdfPageViewerHtml';

export const PDF_FAB_THUMB_BOOT = 'thumb-boot.mjs';
export const PDF_FAB_THUMB_PDF = 'document.pdf';
export const PDF_FAB_THUMB_INDEX = 'index.html';
export const PDF_FAB_THUMB_PROBE = 'probe.js';
export const PDF_FAB_THUMB_PDFJS = 'pdf.min.mjs';
export const PDF_FAB_THUMB_WORKER = 'pdf.worker.min.mjs';

function chipPx(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(24, Math.floor(value)) : fallback;
}

export function buildPdfFabThumbnailBootModule(args: {
  pdfSrc?: string;
  width: number;
  height: number;
  radius: number;
  pixelRatio: number;
  pdfJsSrc?: string;
  pdfWorkerSrc?: string;
}): string {
  const width = chipPx(args.width, 62);
  const height = chipPx(args.height, 80);
  const pixelRatio =
    Number.isFinite(args.pixelRatio) && args.pixelRatio > 0
      ? Math.min(3, args.pixelRatio)
      : 2;
  const targetW = Math.round(width * pixelRatio);
  const targetH = Math.round(height * pixelRatio);
  const radius = Math.max(
    0,
    Math.min(args.radius || 12, Math.floor(Math.min(width, height) / 2))
  );
  const radiusPx = Math.round(radius * pixelRatio);
  const pdfSrc = args.pdfSrc ?? PDF_FAB_THUMB_PDF;
  const pdfJsSrc = args.pdfJsSrc ?? PDF_FAB_THUMB_PDFJS;
  const pdfWorkerSrc = args.pdfWorkerSrc ?? PDF_FAB_THUMB_WORKER;
  assertNoRemoteViewerAssets(pdfSrc, pdfJsSrc, pdfWorkerSrc);

  return `import * as pdfjsLib from ${JSON.stringify('./' + pdfJsSrc.replace(/^\.\//, ''))};

function post(payload) {
  try {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  } catch (_) {}
}

function fail(message) {
  const err = document.getElementById('err');
  if (err) { err.hidden = false; err.textContent = String(message || 'Error'); }
  post({ type: 'error', message: String(message || 'thumb failed') });
}

try {
  post({ type: 'boot-start' });
  if (!pdfjsLib || !pdfjsLib.getDocument) {
    fail('pdf.js local no disponible');
  } else {
    pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(pdfWorkerSrc)};
    const targetW = ${targetW};
    const targetH = ${targetH};
    const radiusPx = ${radiusPx};
    const pdfSrc = ${JSON.stringify(pdfSrc)};
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d', { alpha: true });
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.beginPath();
    ctx.moveTo(radiusPx, 0);
    ctx.arcTo(targetW, 0, targetW, targetH, radiusPx);
    ctx.arcTo(targetW, targetH, 0, targetH, radiusPx);
    ctx.arcTo(0, targetH, 0, 0, radiusPx);
    ctx.arcTo(0, 0, targetW, 0, radiusPx);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);

    pdfjsLib.getDocument({
      url: pdfSrc,
      isEvalSupported: false,
      isOffscreenCanvasSupported: false,
      disableAutoFetch: true,
      disableStream: false
    }).promise.then((pdf) => {
      return pdf.getPage(1).then((page) => {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(targetW / base.width, targetH / base.height);
        const viewport = page.getViewport({ scale });
        const scratch = document.createElement('canvas');
        const sctx = scratch.getContext('2d', { alpha: false });
        scratch.width = Math.ceil(viewport.width);
        scratch.height = Math.ceil(viewport.height);
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0, 0, scratch.width, scratch.height);
        return page.render({ canvasContext: sctx, viewport }).promise.then(() => {
          const dx = Math.floor((targetW - scratch.width) / 2);
          const dy = Math.floor((targetH - scratch.height) / 2);
          ctx.drawImage(scratch, dx, dy);
          post({ type: 'ready', dataUrl: canvas.toDataURL('image/png') });
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

export function buildPdfFabThumbnailHtml(args: {
  bootSrc?: string;
  width: number;
  height: number;
  radius: number;
}): string {
  const bootSrc = args.bootSrc ?? PDF_FAB_THUMB_BOOT;
  const width = chipPx(args.width, 62);
  const height = chipPx(args.height, 80);
  const radius = Math.max(0, Math.min(args.radius || 12, Math.floor(Math.min(width, height) / 2)));
  assertNoRemoteViewerAssets(bootSrc);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=${width}, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<meta http-equiv="Content-Security-Policy" content="${PDF_VIEWER_CSP}"/>
<style>
  html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#fff;}
  #clip{width:${width}px;height:${height}px;overflow:hidden;background:#fff;}
  #c{display:block;width:${width}px;height:${height}px;}
  #err{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:6px;font:10px -apple-system,sans-serif;color:#666;text-align:center;background:#f2f2f5;border-radius:${radius}px;}
</style>
</head>
<body>
<div id="clip"><canvas id="c"></canvas></div>
<div id="err" hidden></div>
<script src="${PDF_FAB_THUMB_PROBE}"></script>
<script type="module" src="${bootSrc}"></script>
</body>
</html>`;
}
