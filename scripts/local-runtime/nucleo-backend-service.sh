#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/mfreixanet/antigravity/Untitled-mobile-preview"

cd "${ROOT}"
export TRANSFORM_DEBUG=1

exec caffeinate -dimsu npm run dev
