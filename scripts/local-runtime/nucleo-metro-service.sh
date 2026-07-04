#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/mfreixanet/antigravity/Untitled-mobile-preview"

cd "${ROOT}/mobile"

MAC_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -n "${MAC_IP}" ]]; then
  export REACT_NATIVE_PACKAGER_HOSTNAME="${MAC_IP}"
fi

exec caffeinate -dimsu npx expo start --dev-client --host lan --port 8081
