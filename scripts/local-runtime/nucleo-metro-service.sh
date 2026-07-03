#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/mfreixanet/antigravity/Untitled-mobile-preview"

cd "${ROOT}/mobile"

exec caffeinate -dimsu npx expo start --dev-client --host lan --port 8082 --clear
