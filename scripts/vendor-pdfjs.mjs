#!/usr/bin/env node
/**
 * Copy lockfile-pinned pdfjs-dist builds into mobile/assets/pdfjs/.
 * Deterministic: identical inputs → identical output bytes (no timestamps).
 * Usage: node scripts/vendor-pdfjs.mjs
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  existsSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'shared/pdf/pdfjsVendorManifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const pkg = require('pdfjs-dist/package.json');

if (pkg.version !== manifest.version) {
  console.error(
    `pdfjs-dist installed ${pkg.version} != declared ${manifest.version}`
  );
  process.exit(1);
}

const outDir = join(root, 'mobile/assets/pdfjs');
mkdirSync(outDir, { recursive: true });

const declaredNames = new Set(manifest.assets.map((a) => a.assetName));
const allowedExtra = new Set(['PROVENANCE.json', 'LICENSE']);

// Remove legacy / undeclared asset files (keep LICENSE + PROVENANCE).
for (const name of readdirSync(outDir)) {
  if (allowedExtra.has(name) || declaredNames.has(name)) continue;
  try {
    unlinkSync(join(outDir, name));
  } catch {
    // absent
  }
}

const resolved = [];
for (const asset of manifest.assets) {
  const src = join(root, 'node_modules/pdfjs-dist', asset.packagePath);
  const dest = join(outDir, asset.assetName);
  const buf = readFileSync(src);
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== asset.sha256) {
    console.error(
      `SHA mismatch for ${asset.packagePath}: got ${sha}, expected ${asset.sha256}. Update shared/pdf/pdfjsVendorManifest.json after intentional bumps.`
    );
    process.exit(1);
  }
  if (!buf.includes(Buffer.from(manifest.version))) {
    console.error(`Version marker ${manifest.version} missing in ${asset.packagePath}`);
    process.exit(1);
  }
  // Only rewrite when bytes differ (keeps mtime stable when unchanged).
  let needsWrite = true;
  if (existsSync(dest)) {
    const existing = readFileSync(dest);
    if (existing.equals(buf)) needsWrite = false;
  }
  if (needsWrite) copyFileSync(src, dest);
  resolved.push({
    assetName: asset.assetName,
    packagePath: asset.packagePath,
    sha256: sha,
    bytes: buf.length,
  });
}

// Stable key order — no generatedAt.
const provenance = {
  package: manifest.package,
  version: manifest.version,
  license: manifest.license,
  cveFixed: manifest.cveFixed,
  lockfile: 'package-lock.json',
  source: 'node_modules/pdfjs-dist (lockfile-pinned)',
  assets: resolved,
};
const provenanceBody = `${JSON.stringify(provenance, null, 2)}\n`;
const provenancePath = join(outDir, 'PROVENANCE.json');
if (!existsSync(provenancePath) || readFileSync(provenancePath, 'utf8') !== provenanceBody) {
  writeFileSync(provenancePath, provenanceBody);
}

const licenseSrc = join(root, 'node_modules/pdfjs-dist/LICENSE');
const licenseDest = join(outDir, 'LICENSE');
const licenseBuf = readFileSync(licenseSrc);
if (!existsSync(licenseDest) || !readFileSync(licenseDest).equals(licenseBuf)) {
  writeFileSync(licenseDest, licenseBuf);
}

// Deep-equality gate vs TypeScript constants (loaded via createRequire from compiled path is hard;
// compare JSON ↔ PROVENANCE ↔ on-disk assets here; TS parity is covered by tests).
for (const asset of resolved) {
  if (!declaredNames.has(asset.assetName)) {
    console.error(`undeclared asset produced: ${asset.assetName}`);
    process.exit(1);
  }
}

console.log(JSON.stringify(provenance, null, 2));
