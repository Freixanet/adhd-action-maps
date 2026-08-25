/**
 * Explicit `@shared/*` → `<repo>/shared/*` resolution helpers for Metro.
 * Kept out of metro.config.js exports so Metro's config validator stays clean.
 */
const fs = require('fs');
const path = require('path');

function removeNodeModulesSharedTrap(projectRoot, sharedRoot) {
  // Leftover `node_modules/@shared → ../../shared`. npm install follows it and
  // deletes the real shared/ tree. Unlink the alias only — never rm -rf.
  const alias = path.join(projectRoot, 'node_modules', '@shared');
  try {
    if (!fs.lstatSync(alias).isSymbolicLink()) return;
    const real = fs.realpathSync(alias);
    if (real === sharedRoot || real.startsWith(sharedRoot + path.sep)) {
      fs.unlinkSync(alias);
    }
  } catch {
    // absent or already gone
  }
}

function ensureSharedSymlink(projectRoot, sharedRoot) {
  // Keep this link *outside* node_modules. `npm install` in mobile/ previously
  // followed `node_modules/@shared` and deleted the real `shared/` tree.
  removeNodeModulesSharedTrap(projectRoot, sharedRoot);
  const linkPath = path.join(projectRoot, '.metro-shared');
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
 * Resolve `@shared/foo` to the real file under `<repo>/shared`.
 *
 * Metro watches `shared/` via `watchFolders`. `.metro-shared` is gitignored, so
 * TreeFS never hashes the symlink path and `getSha1` fails. Return the realpath
 * so relative imports inside shared/ stay on the watched tree.
 */
function resolveSharedFile(projectRoot, sharedRoot, sourceExts, subpath, platform) {
  ensureSharedSymlink(projectRoot, sharedRoot);
  const base = path.resolve(sharedRoot, subpath);

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
      return { type: 'sourceFile', filePath: real };
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
  removeNodeModulesSharedTrap,
  resolveSharedFile,
  dedupeAssetExts,
};
