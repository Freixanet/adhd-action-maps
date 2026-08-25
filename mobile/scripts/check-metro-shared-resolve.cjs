#!/usr/bin/env node
/**
 * Automated check: Metro resolves several @shared/* cases to realpaths under
 * <repo>/shared (watchFolders). The gitignored .metro-shared symlink is not hashed.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  dedupeAssetExts,
  ensureSharedSymlink,
  resolveSharedFile,
} = require('../metro.shared-resolve');

const projectRoot = path.resolve(__dirname, '..');
const sharedRoot = path.resolve(projectRoot, '../shared');
const sourceExts = ['ts', 'tsx', 'mjs', 'js', 'jsx', 'json'];

const cases = [
  'uiTokens',
  'pdf/buildPdfPageViewerHtml',
  'pdf/prepareLocalPdfViewerCore',
  'pdf/sourceViewerSurface', // nested shared module
];

ensureSharedSymlink(projectRoot, sharedRoot);

for (const subpath of cases) {
  const resolved = resolveSharedFile(projectRoot, sharedRoot, sourceExts, subpath, 'ios');
  assert.ok(resolved, `expected resolution for @shared/${subpath}`);
  assert.equal(resolved.type, 'sourceFile');
  assert.ok(fs.existsSync(resolved.filePath), `missing file ${resolved.filePath}`);
  const real = fs.realpathSync(resolved.filePath);
  const sharedReal = fs.realpathSync(sharedRoot);
  assert.ok(
    resolved.filePath === real,
    `expected realpath for @shared/${subpath}, got ${resolved.filePath}`
  );
  assert.ok(
    real.startsWith(sharedReal + path.sep) || real === sharedReal,
    `resolved path must stay under shared/: ${real}`
  );
  console.log(`ok @shared/${subpath} -> ${resolved.filePath}`);
}

const assetExts = dedupeAssetExts(['png', 'txt', 'html'], ['html', 'pdf', 'txt']);
assert.deepEqual(
  assetExts.filter((e) => e === 'txt').length,
  1,
  'txt must appear once in assetExts'
);
assert.ok(assetExts.includes('txt'), 'txt required in assetExts');
assert.ok(assetExts.includes('pdf'), 'pdf required in assetExts');

// Effective post-Uniwind config must still include txt.
const metroConfig = require('../metro.config.js');
assert.ok(
  metroConfig.resolver.assetExts.includes('txt'),
  'effective metro config missing txt in assetExts'
);
assert.ok(
  metroConfig.watchFolders.some((f) => path.resolve(f) === sharedRoot),
  'effective metro config must watch shared/'
);

const nodeModulesAlias = path.join(projectRoot, 'node_modules', '@shared');
try {
  if (fs.lstatSync(nodeModulesAlias).isSymbolicLink()) {
    assert.fail(
      'node_modules/@shared must not symlink at shared/ (npm install would delete the tree)'
    );
  }
} catch (err) {
  if (err && err.code !== 'ENOENT') throw err;
}

console.log('ok assetExts', metroConfig.resolver.assetExts.filter((e) => ['html', 'pdf', 'txt'].includes(e)));
console.log('metro shared resolve check passed');
