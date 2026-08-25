/**
 * Vendored PDF.js provenance for the S08 offline WebView viewer.
 * Hashes/version must match shared/pdf/pdfjsVendorManifest.json and scripts/vendor-pdfjs.mjs.
 */

export const PDFJS_VENDOR_PACKAGE = 'pdfjs-dist';
export const PDFJS_VENDOR_VERSION = '5.4.296';
export const PDFJS_MIN_SAFE_VERSION = '4.2.67';
export const PDFJS_VENDOR_LICENSE = 'Apache-2.0';
export const PDFJS_VENDOR_LICENSE_URL = 'https://www.apache.org/licenses/LICENSE-2.0';
export const PDFJS_VENDOR_CVE_FIXED = ['CVE-2024-4367', 'GHSA-wgrm-67xf-hhpq'] as const;

export type PdfJsVendorAsset = {
  assetName: string;
  packagePath: string;
  sha256: string;
};

export const PDFJS_VENDOR_ASSETS: readonly PdfJsVendorAsset[] = [
  {
    assetName: 'pdf.min.mjs.txt',
    packagePath: 'build/pdf.min.mjs',
    sha256: '343b4166b06716a55a8f87175b83223cb1a9ab701eb8a96b2577509d47fbaf4a',
  },
  {
    assetName: 'pdf.worker.min.mjs.txt',
    packagePath: 'build/pdf.worker.min.mjs',
    sha256: 'dbcae78a691b3c501508f74b774c6066a57a14a76cefdc9e25ad86b651bb75d5',
  },
] as const;

export const PDFJS_SESSION_MAIN = 'pdf.min.mjs';
export const PDFJS_SESSION_WORKER = 'pdf.worker.min.mjs';

/** Semver compare: a < b → -1, a==b → 0, a > b → 1 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

export function isPdfJsVersionSafe(version: string): boolean {
  return compareSemver(version, PDFJS_MIN_SAFE_VERSION) >= 0;
}
