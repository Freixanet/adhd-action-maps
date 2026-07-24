#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

# Metro serves the preview tree (has mobile/ios for the installed dev client).
# start-nucleo-local-runtime.sh syncs canonical → preview before kickstart.
if [[ ! -d "${PREVIEW_ROOT}/mobile" ]]; then
  echo "ERROR: preview mobile missing at ${PREVIEW_ROOT}/mobile (needed for ios/)." >&2
  exit 1
fi

cd "${PREVIEW_ROOT}/mobile"

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
