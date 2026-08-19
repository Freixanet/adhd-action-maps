import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPdfPageViewerBootModule,
  buildPdfPageViewerHtml,
  PDF_PAGE_VIEWER_MAX_BYTES,
  PDF_VIEWER_CSP,
  viewerArtifactsForbidRemoteAndEval,
  viewerHtmlHasEvalSupportDisabled,
  viewerHtmlHasRemoteHost,
} from './buildPdfPageViewerHtml';
import { MAX_PDF_BYTES } from './versions';
import {
  PDFJS_MIN_SAFE_VERSION,
  PDFJS_VENDOR_ASSETS,
  PDFJS_VENDOR_CVE_FIXED,
  PDFJS_VENDOR_LICENSE,
  PDFJS_VENDOR_PACKAGE,
  PDFJS_VENDOR_VERSION,
  isPdfJsVersionSafe,
} from './pdfjsVendorManifest';
import { shouldAllowPdfViewerNavigation } from './pdfViewerNavigation';
import {
  prepareLocalPdfViewerCore,
  sweepStalePdfViewerSessions,
  type PdfViewerFileIO,
} from './prepareLocalPdfViewerCore';

const ASSET_DIR = join(process.cwd(), 'mobile/assets/pdfjs');
const MANIFEST_JSON = join(process.cwd(), 'shared/pdf/pdfjsVendorManifest.json');

describe('pdfjs vendor provenance (CVE-2024-4367)', () => {
  it('declares a safe version matching lockfile-pinned package', () => {
    expect(isPdfJsVersionSafe(PDFJS_VENDOR_VERSION)).toBe(true);
    expect(PDFJS_VENDOR_VERSION).not.toBe('3.11.174');
    expect(isPdfJsVersionSafe('3.11.174')).toBe(false);
    expect(PDFJS_VENDOR_CVE_FIXED).toContain('CVE-2024-4367');
    expect(PDFJS_VENDOR_LICENSE).toBe('Apache-2.0');

    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'node_modules/pdfjs-dist/package.json'), 'utf8')
    ) as { version: string };
    expect(pkg.version).toBe(PDFJS_VENDOR_VERSION);

    const lock = readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8');
    expect(lock).toContain(`"pdfjs-dist": "${PDFJS_VENDOR_VERSION}"`);
  });

  it('vendored assets match registered SHA-256 and safe version marker', () => {
    const json = JSON.parse(readFileSync(MANIFEST_JSON, 'utf8')) as {
      version: string;
      assets: Array<{ assetName: string; sha256: string }>;
    };
    expect(json.version).toBe(PDFJS_VENDOR_VERSION);
    expect(json.version).not.toBe('3.11.174');

    for (const asset of PDFJS_VENDOR_ASSETS) {
      const path = join(ASSET_DIR, asset.assetName);
      expect(existsSync(path)).toBe(true);
      const buf = readFileSync(path);
      const sha = createHash('sha256').update(buf).digest('hex');
      expect(sha).toBe(asset.sha256);
      expect(buf.toString('utf8')).toContain(PDFJS_VENDOR_VERSION);
      expect(buf.toString('utf8')).not.toContain('3.11.174');
      expect(buf.toString('utf8')).not.toMatch(/cdnjs\.cloudflare\.com/i);
    }
    expect(existsSync(join(ASSET_DIR, 'LICENSE'))).toBe(true);
    expect(existsSync(join(ASSET_DIR, 'PROVENANCE.json'))).toBe(true);
    expect(existsSync(join(ASSET_DIR, 'pdf.min.js.txt'))).toBe(false);
    expect(existsSync(join(ASSET_DIR, 'pdf.min.txt'))).toBe(false);
    expect(existsSync(join(ASSET_DIR, 'pdf.min.mjs.txt'))).toBe(true);
    expect(existsSync(join(ASSET_DIR, 'pdf.worker.min.mjs.txt'))).toBe(true);
  });

  it('manifest JSON, TypeScript constants, and PROVENANCE stay in deep agreement', () => {
    const json = JSON.parse(readFileSync(MANIFEST_JSON, 'utf8')) as {
      package: string;
      version: string;
      license: string;
      cveFixed: string[];
      assets: Array<{ assetName: string; packagePath: string; sha256: string }>;
    };
    expect(json.package).toBe(PDFJS_VENDOR_PACKAGE);
    expect(json.version).toBe(PDFJS_VENDOR_VERSION);
    expect(json.license).toBe(PDFJS_VENDOR_LICENSE);
    expect(json.cveFixed).toEqual([...PDFJS_VENDOR_CVE_FIXED]);
    expect(json.assets).toEqual([...PDFJS_VENDOR_ASSETS]);

    const provenance = JSON.parse(
      readFileSync(join(ASSET_DIR, 'PROVENANCE.json'), 'utf8')
    ) as {
      package: string;
      version: string;
      license: string;
      cveFixed: string[];
      assets: Array<{ assetName: string; packagePath: string; sha256: string; bytes: number }>;
      generatedAt?: string;
    };
    expect(provenance.generatedAt).toBeUndefined();
    expect(provenance.package).toBe(json.package);
    expect(provenance.version).toBe(json.version);
    expect(provenance.license).toBe(json.license);
    expect(provenance.cveFixed).toEqual(json.cveFixed);
    expect(provenance.assets.map(({ assetName, packagePath, sha256 }) => ({
      assetName,
      packagePath,
      sha256,
    }))).toEqual(json.assets);

    const onDisk = readdirSync(ASSET_DIR).filter((n) => !['LICENSE', 'PROVENANCE.json'].includes(n));
    expect(onDisk.sort()).toEqual(json.assets.map((a) => a.assetName).sort());
  });

  it('min safe floor is the CVE fix line', () => {
    expect(PDFJS_MIN_SAFE_VERSION).toBe('4.2.67');
    expect(isPdfJsVersionSafe('4.2.66')).toBe(false);
    expect(isPdfJsVersionSafe('4.2.67')).toBe(true);
  });
});

describe('buildPdfPageViewerHtml (local-only hardened)', () => {
  it('embeds local relative assets and forbids remote/eval tokens', () => {
    const html = buildPdfPageViewerHtml({
      page: 2,
      pdfSrc: 'document.pdf',
    });
    const boot = buildPdfPageViewerBootModule({
      page: 2,
      pdfSrc: 'document.pdf',
    });
    expect(html).toContain('boot.mjs');
    expect(html).toContain(PDF_VIEWER_CSP);
    expect(html).toContain("base-uri 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).toContain("frame-ancestors 'none'");
    expect(html).not.toContain('unsafe-eval');
    expect(html).not.toContain('cdnjs');
    expect(viewerHtmlHasRemoteHost(html)).toBe(false);
    expect(viewerHtmlHasEvalSupportDisabled(boot)).toBe(true);
    expect(boot).toContain('isEvalSupported: false');
    viewerArtifactsForbidRemoteAndEval([html, boot]);
  });

  it('rejects remote script/pdf URLs', () => {
    expect(() =>
      buildPdfPageViewerHtml({
        page: 1,
        pdfSrc: 'document.pdf',
        pdfJsSrc: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/x/pdf.min.mjs',
      })
    ).toThrow(/remote viewer asset forbidden/);
  });

  it('viewer max bytes matches S08 ingest ceiling', () => {
    expect(PDF_PAGE_VIEWER_MAX_BYTES).toBe(MAX_PDF_BYTES);
    expect(PDF_PAGE_VIEWER_MAX_BYTES).toBe(20 * 1024 * 1024);
  });
});

describe('shouldAllowPdfViewerNavigation', () => {
  const base = 'file:///tmp/nucleo-pdf-viewer/s1/';

  it('allows about:blank only during opted-in initial load', () => {
    expect(
      shouldAllowPdfViewerNavigation(
        { url: 'about:blank', isTopFrame: true },
        { baseUrl: base, allowInitialAboutBlank: true }
      )
    ).toBe(true);
    expect(
      shouldAllowPdfViewerNavigation(
        { url: 'about:blank', isTopFrame: true },
        { baseUrl: base, allowInitialAboutBlank: false }
      )
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation(
        { url: 'about:blank', isTopFrame: false },
        { baseUrl: base, allowInitialAboutBlank: true }
      )
    ).toBe(false);
  });

  it('allows blob only as subresource; blocks top-frame blob', () => {
    expect(
      shouldAllowPdfViewerNavigation(
        { url: 'blob:null/abc', isTopFrame: false },
        { baseUrl: base }
      )
    ).toBe(true);
    expect(
      shouldAllowPdfViewerNavigation(
        { url: 'blob:null/abc', isTopFrame: true },
        { baseUrl: base }
      )
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: 'blob:null/abc' }, { baseUrl: base })
    ).toBe(false);
  });

  it('allows same-dir file resources and safe relative paths', () => {
    expect(
      shouldAllowPdfViewerNavigation(
        { url: `${base}document.pdf`, isTopFrame: true },
        { baseUrl: base }
      )
    ).toBe(true);
    expect(
      shouldAllowPdfViewerNavigation({ url: 'boot.mjs', isTopFrame: false }, { baseUrl: base })
    ).toBe(true);
  });

  it('blocks http(s), intent, data, mailto, tel, javascript, and foreign files', () => {
    expect(
      shouldAllowPdfViewerNavigation({ url: 'https://evil.example/x' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: 'http://evil.example/x' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: 'intent://scan/#Intent;end' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: 'data:text/html,hi' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: 'mailto:a@b.c' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: 'tel:+123' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: 'javascript:alert(1)' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation(
        { url: 'file:///tmp/other/secret.pdf' },
        { baseUrl: base }
      )
    ).toBe(false);
  });

  it('rejects relative traversal and encoded escapes outside the session dir', () => {
    expect(
      shouldAllowPdfViewerNavigation({ url: '../secret.pdf' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: '%2e%2e/secret.pdf' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation({ url: '%2e%2e%2fsecret.pdf' }, { baseUrl: base })
    ).toBe(false);
    expect(
      shouldAllowPdfViewerNavigation(
        { url: `${base}../outside.pdf` },
        { baseUrl: base }
      )
    ).toBe(false);
  });
});

function memoryIo(seed?: {
  failCopy?: boolean;
  failDownload?: boolean;
  failGetSize?: boolean;
}): PdfViewerFileIO & {
  dirs: Set<string>;
  files: Map<string, string | Buffer>;
} {
  const dirs = new Set<string>();
  const files = new Map<string, string | Buffer>();
  return {
    dirs,
    files,
    async deleteDir(path) {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      for (const key of [...files.keys()]) {
        if (key.startsWith(prefix) || key === path) files.delete(key);
      }
      for (const d of [...dirs]) {
        if (d === path || d.startsWith(prefix)) dirs.delete(d);
      }
    },
    async makeDir(path) {
      dirs.add(path.endsWith('/') ? path : `${path}/`);
    },
    async copyFile(from, to) {
      if (seed?.failCopy) throw new Error('copy_failed');
      files.set(to, files.get(from) ?? `copied:${from}`);
    },
    async writeTextFile(path, contents) {
      files.set(path, contents);
    },
    async download(_url, to) {
      if (seed?.failDownload) throw new Error('download_failed');
      files.set(to, Buffer.alloc(32, 1));
      return { status: 200 };
    },
    async getSize(path) {
      if (seed?.failGetSize) throw new Error('stat_failed');
      const v = files.get(path);
      if (!v) return 0;
      return typeof v === 'string' ? Buffer.byteLength(v) : v.length;
    },
    async listChildDirNames(parent) {
      const base = parent.endsWith('/') ? parent : `${parent}/`;
      const names = new Set<string>();
      for (const d of dirs) {
        if (!d.startsWith(base)) continue;
        const rest = d.slice(base.length).replace(/\/$/, '');
        const name = rest.split('/')[0];
        if (name) names.add(name);
      }
      return [...names];
    },
    now: () => Date.now(),
  };
}

describe('prepareLocalPdfViewerCore fail-closed + sweep', () => {
  it('deletes session dir when download/copy/stat fails', async () => {
    for (const seed of [{ failCopy: true }, { failDownload: true }, { failGetSize: true }] as const) {
      const io = memoryIo(seed);
      const cacheRoot = '/cache/nucleo-pdf-viewer/';
      await expect(
        prepareLocalPdfViewerCore({
          signedUrl: 'https://signed.example/a.pdf',
          page: 2,
          sessionId: '1000-a',
          cacheRoot,
          pdfJsAssetUri: '/assets/pdf.min.mjs',
          pdfWorkerAssetUri: '/assets/pdf.worker.min.mjs',
          io,
        })
      ).rejects.toThrow();
      expect([...io.dirs].some((d) => d.includes('1000-a'))).toBe(false);
      expect([...io.files.keys()].some((k) => k.includes('1000-a'))).toBe(false);
    }
  });

  it('sweeps aged sessions but protects the active one', async () => {
    const io = memoryIo();
    const cacheRoot = '/cache/nucleo-pdf-viewer/';
    const oldId = `${Date.now() - 2 * 60 * 60 * 1000}-old`;
    const liveId = `${Date.now()}-live`;
    await io.makeDir(`${cacheRoot}${oldId}/`);
    await io.writeTextFile(`${cacheRoot}${oldId}/document.pdf`, 'x');
    await io.makeDir(`${cacheRoot}${liveId}/`);
    await io.writeTextFile(`${cacheRoot}${liveId}/document.pdf`, 'y');

    const removed = await sweepStalePdfViewerSessions({
      cacheRoot,
      io,
      protectSessionId: liveId,
      ttlMs: 60 * 60 * 1000,
    });
    expect(removed).toContain(oldId);
    expect(removed).not.toContain(liveId);
    expect(io.files.has(`${cacheRoot}${liveId}/document.pdf`)).toBe(true);
    expect(io.files.has(`${cacheRoot}${oldId}/document.pdf`)).toBe(false);
  });

  it('stale prepare cleanup does not delete a newer protected session dir', async () => {
    const io = memoryIo();
    const cacheRoot = '/cache/nucleo-pdf-viewer/';
    const staleId = `${Date.now()}-stale`;
    const liveId = `${Date.now()}-live`;

    // Simulate live session already present.
    await io.makeDir(`${cacheRoot}${liveId}/`);
    await io.writeTextFile(`${cacheRoot}${liveId}/marker`, 'live');

    const stale = await prepareLocalPdfViewerCore({
      signedUrl: 'https://signed.example/a.pdf',
      page: 1,
      sessionId: staleId,
      cacheRoot,
      pdfJsAssetUri: '/assets/pdf.min.mjs',
      pdfWorkerAssetUri: '/assets/pdf.worker.min.mjs',
      io,
      protectSessionId: liveId,
    });
    await stale.cleanup();

    expect(io.files.has(`${cacheRoot}${liveId}/marker`)).toBe(true);
    expect(io.files.has(`${cacheRoot}${staleId}/document.pdf`)).toBe(false);
  });

  it('successful prepare writes boot with isEvalSupported:false and local assets', async () => {
    const io = memoryIo();
    const cacheRoot = '/cache/nucleo-pdf-viewer/';
    const session = await prepareLocalPdfViewerCore({
      signedUrl: 'https://signed.example/a.pdf',
      page: 3,
      sessionId: `${Date.now()}-ok`,
      cacheRoot,
      pdfJsAssetUri: '/assets/pdf.min.mjs',
      pdfWorkerAssetUri: '/assets/pdf.worker.min.mjs',
      io,
    });
    const boot = String(io.files.get(`${session.dir}boot.mjs`) ?? '');
    expect(boot).toContain('isEvalSupported: false');
    expect(session.html).not.toContain('unsafe-eval');
    expect(session.html).not.toMatch(/https?:\/\//);
    void readdirSync; // keep import used if tree-shaken differently
  });
});
