#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Backend always runs from the canonical repo (source of truth).
cd "${ROOT}"
export TRANSFORM_DEBUG=1
export PORT=3000

exec caffeinate -dimsu npm run dev
