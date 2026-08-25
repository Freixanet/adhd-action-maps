#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Always serve the canonical Expo app. Preview trees desync after reboot / edits
# and caused "I changed X but the phone looks identical" failures.
METRO_ROOT="${ROOT}/mobile"

if [[ ! -d "${METRO_ROOT}" ]]; then
  echo "ERROR: canonical mobile missing at ${METRO_ROOT}" >&2
  exit 1
fi

if [[ ! -f "${METRO_ROOT}/package.json" ]]; then
  echo "ERROR: ${METRO_ROOT}/package.json missing" >&2
  exit 1
fi

# Prefer nvm Node from repo .nvmrc (LaunchAgent PATH alone is fragile across upgrades).
export NVM_DIR="${HOME}/.nvm"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "${NVM_DIR}/nvm.sh"
  if [[ -f "${ROOT}/.nvmrc" ]]; then
    nvm use "$(cat "${ROOT}/.nvmrc")" >/dev/null
  fi
fi

cd "${METRO_ROOT}"

echo "[nucleo-metro] serving CANONICAL ${METRO_ROOT} (pwd=$(pwd))"

# Optional mirror for legacy preview checkouts — never the Metro source of truth.
if [[ -d "${PREVIEW_ROOT}/mobile" ]]; then
  sync_canonical_to_preview || echo "WARN: preview mirror sync failed (Metro still uses canonical)." >&2
fi

# NUCLEO_METRO_MODE=tunnel → Expo public tunnel (use outside home WiFi).
# Default: LAN host so iPhone on same WiFi can connect.
METRO_MODE="${NUCLEO_METRO_MODE:-lan}"

export EXPO_NO_TELEMETRY=1

if [[ "${METRO_MODE}" == "tunnel" ]]; then
  unset REACT_NATIVE_PACKAGER_HOSTNAME || true
  # launchd has no TTY; CI avoids interactive prompts. Initial bundle still serves latest JS.
  export CI=1
  exec caffeinate -dimsu npx expo start --dev-client --tunnel --port 8081
fi

MAC_IP="$(detect_mac_ip || true)"
if [[ -n "${MAC_IP}" ]]; then
  export REACT_NATIVE_PACKAGER_HOSTNAME="${MAC_IP}"
fi

# Keep file watching / Fast Refresh. Do NOT set CI=1 (that freezes the bundle graph).
# launchd has no TTY, so Expo stays non-interactive without CI.
unset CI || true
export EXPO_NO_TELEMETRY=1
exec caffeinate -dimsu npx expo start --dev-client --host lan --port 8081
