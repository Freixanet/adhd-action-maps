/**
 * Explicit `@shared/*` → `<repo>/shared/*` resolution helpers for Metro.
 * Kept out of metro.config.js exports so Metro's config validator stays clean.
 */
const fs = require('fs');
const path = require('path');

function ensureSharedSymlink(projectRoot, sharedRoot) {
  const linkPath = path.join(projectRoot, 'node_modules', '@shared');
  const desiredTarget = path.relative(path.dirname(linkPath), sharedRoot);
  try {
    const st = fs.lstatSync(linkPath);
    if (st.isSymbolicLink()) {
      const current = fs.readlinkSync(linkPath);
      if (current === desiredTarget || fs.realpathSync(linkPath) === sharedRoot) {
        return linkPath;
      }
    }
    fs.rmSync(linkPath, { recursive: true, force: true });
  } catch {
    // absent
  }
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(desiredTarget, linkPath, 'dir');
  return linkPath;
}

/**
 * Resolve `@shared/foo` via the project-local symlink path
 * `mobile/node_modules/@shared/foo…`.
 *
 * Metro's TreeFS `getSha1` returns null for the realpath under `<repo>/shared`
 * (outside projectRoot) even when the file is watched. The symlink path under
 * projectRoot carries a computed SHA-1 and is what Expo export needs.
 */
function resolveSharedFile(projectRoot, sharedRoot, sourceExts, subpath, platform) {
  ensureSharedSymlink(projectRoot, sharedRoot);
  const linkRoot = path.join(projectRoot, 'node_modules', '@shared');
  const base = path.resolve(linkRoot, subpath);

  // Reject path escape outside the shared tree.
  const realShared = fs.realpathSync(sharedRoot);
  const platformTags = [];
  if (platform) platformTags.push(`.${platform}`);
  platformTags.push('.native', '');

  const tryFile = (candidate) => {
    try {
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
      const real = fs.realpathSync(candidate);
      if (!(real === realShared || real.startsWith(realShared + path.sep))) {
        return null;
      }
      // Return the logical path under node_modules/@shared (not realpath).
      return { type: 'sourceFile', filePath: candidate };
    } catch {
      return null;
    }
  };

  for (const tag of platformTags) {
    for (const ext of sourceExts) {
      const hit = tryFile(`${base}${tag}.${ext}`);
      if (hit) return hit;
    }
  }
  for (const tag of platformTags) {
    for (const ext of sourceExts) {
      const hit = tryFile(path.join(base, `index${tag}.${ext}`));
      if (hit) return hit;
    }
  }
  return null;
}

function dedupeAssetExts(assetExts, extra) {
  const set = new Set(assetExts || []);
  for (const ext of extra) set.add(ext);
  return [...set];
}

module.exports = {
  ensureSharedSymlink,
  resolveSharedFile,
  dedupeAssetExts,
};
