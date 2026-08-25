#!/usr/bin/env bash
# Clean iOS Expo export gate for S08. Temp dir; fails on @shared / missing PDF assets.
# Android is out of S08 launch scope (iOS-first product); not part of this gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
OUT="$(mktemp -d "${TMPDIR:-/tmp}/nucleo-ios-bundle.XXXXXX")"
cleanup() { rm -rf "$OUT"; }
trap cleanup EXIT

cd "$MOBILE"

echo "mobile:bundle:ios → $OUT"

# Preflight: @shared resolution
node "$MOBILE/scripts/check-metro-shared-resolve.cjs"

# Effective assetExts must include txt (*.mjs.txt)
node -e '
const c = require("./metro.config.js");
if (!c.resolver.assetExts.includes("txt")) {
  console.error("assetExts missing txt after withUniwindConfig");
  process.exit(1);
}
console.log("ok assetExts includes txt");
'

npx expo export --platform ios --output-dir "$OUT" --clear

# Expo names exported assets by MD5(content). Match the vendored PDF.js bytes.
node -e '
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const out = process.argv[1];
const mobile = process.argv[2];
const names = ["pdf.min.mjs.txt", "pdf.worker.min.mjs.txt"];
const meta = JSON.parse(fs.readFileSync(path.join(out, "metadata.json"), "utf8"));
const listed = new Set(
  (meta.fileMetadata?.ios?.assets || []).map((a) => path.basename(a.path))
);

for (const name of names) {
  const src = path.join(mobile, "assets/pdfjs", name);
  const buf = fs.readFileSync(src);
  const md5 = crypto.createHash("md5").update(buf).digest("hex");
  const dest = path.join(out, "assets", md5);
  if (!fs.existsSync(dest)) {
    console.error(`missing exported asset for ${name} (md5 ${md5})`);
    process.exit(1);
  }
  if (!listed.has(md5)) {
    console.error(`metadata.json missing ${name} as ${md5}`);
    process.exit(1);
  }
  const exported = fs.readFileSync(dest);
  if (!exported.equals(buf)) {
    console.error(`byte mismatch for exported ${name}`);
    process.exit(1);
  }
  console.log(`ok ${name} → assets/${md5} (${buf.length} bytes)`);
}
' "$OUT" "$MOBILE"

echo "mobile:bundle:ios passed"
