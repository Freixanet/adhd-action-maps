#!/usr/bin/env bash
# Applies Xcode Personal Team / automatic signing to the generated iOS project.
# Run after `expo prebuild` and `pod install`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PBXPROJ="$ROOT/ios/Nucleo.xcodeproj/project.pbxproj"

if [[ ! -f "$PBXPROJ" ]]; then
  echo "No iOS project at $PBXPROJ — run: npm run ios:prebuild" >&2
  exit 1
fi

detect_team_id() {
  if [[ -n "${APPLE_TEAM_ID:-}" ]]; then
    echo "$APPLE_TEAM_ID"
    return
  fi
  security find-certificate -a -c "Apple Development" -p 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null \
    | sed -n 's/.*OU=\([A-Z0-9]\{10\}\).*/\1/p' \
    | head -1
}

TEAM_ID="$(detect_team_id)"
if [[ -z "$TEAM_ID" ]]; then
  echo "No Personal Team found. Sign in to Xcode (Settings → Accounts) with your Apple ID," >&2
  echo "then re-run this script or set APPLE_TEAM_ID." >&2
  exit 1
fi

export TEAM_ID PBXPROJ
node <<'NODE'
const fs = require('fs');

const pbxproj = process.env.PBXPROJ;
const teamId = process.env.TEAM_ID;
let content = fs.readFileSync(pbxproj, 'utf8');

const targetBlock =
  /buildSettings = \{([\s\S]*?PRODUCT_BUNDLE_IDENTIFIER = com\.freixanet\.nucleo;[\s\S]*?)\n\t\t\t\};/g;

content = content.replace(targetBlock, (full, inner) => {
  let settings = inner;
  if (/CODE_SIGN_STYLE\s*=/.test(settings)) {
    settings = settings.replace(/CODE_SIGN_STYLE = [^;]+;/, 'CODE_SIGN_STYLE = Automatic;');
  } else {
    settings += '\n\t\t\t\tCODE_SIGN_STYLE = Automatic;';
  }
  if (/DEVELOPMENT_TEAM\s*=/.test(settings)) {
    settings = settings.replace(/DEVELOPMENT_TEAM = [^;]+;/, `DEVELOPMENT_TEAM = ${teamId};`);
  } else {
    settings += `\n\t\t\t\tDEVELOPMENT_TEAM = ${teamId};`;
  }
  return `buildSettings = {${settings}\n\t\t\t};`;
});

fs.writeFileSync(pbxproj, content);
NODE

echo "iOS signing: Automatic + Personal Team ${TEAM_ID}"
