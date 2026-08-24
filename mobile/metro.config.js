const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const {
  dedupeAssetExts,
  ensureSharedSymlink,
  resolveSharedFile,
} = require('./metro.shared-resolve');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...new Set([...(config.watchFolders || []), sharedRoot])];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const wrapped = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind-types.d.ts',
  polyfills: {
    rem: 14,
  },
});

// Post-Uniwind: watch `shared/` only. The whole repo is ~70k files and is not needed.
wrapped.watchFolders = [...new Set([...(wrapped.watchFolders || []), sharedRoot])];
wrapped.projectRoot = projectRoot;

// Post-Uniwind: deduped asset extensions. `txt` is required for vendored
// pdf.js assets named `*.mjs.txt` (last extension wins for Metro assets).
wrapped.resolver.assetExts = dedupeAssetExts(wrapped.resolver.assetExts, [
  'html',
  'pdf',
  'txt',
]);

const sourceExts = wrapped.resolver.sourceExts || [
  'ts',
  'tsx',
  'mjs',
  'js',
  'jsx',
  'json',
];

ensureSharedSymlink(projectRoot, sharedRoot);

const upstreamResolveRequest = wrapped.resolver.resolveRequest;
wrapped.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@shared' || moduleName.startsWith('@shared/')) {
    const subpath = moduleName === '@shared' ? '.' : moduleName.slice('@shared/'.length);
    const resolved = resolveSharedFile(
      projectRoot,
      sharedRoot,
      sourceExts,
      subpath,
      platform
    );
    if (resolved) return resolved;
  }
  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

wrapped.resolver.extraNodeModules = {
  ...(wrapped.resolver.extraNodeModules || {}),
  '@shared': sharedRoot,
};

module.exports = wrapped;
