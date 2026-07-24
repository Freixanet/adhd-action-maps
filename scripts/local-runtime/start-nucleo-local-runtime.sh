#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

if [[ ! -f "${BACKEND_PLIST}" || ! -f "${METRO_PLIST}" ]]; then
  echo "ERROR: LaunchAgents not installed. Run install-nucleo-local-runtime.sh first." >&2
  exit 1
fi

plutil -lint "${BACKEND_PLIST}" >/dev/null
plutil -lint "${METRO_PLIST}" >/dev/null

# Preview holds native ios/; keep JS/shared/server in sync with canonical before Metro.
sync_canonical_to_preview

if ! launchctl print "${GUI_DOMAIN}/${BACKEND_LABEL}" >/dev/null 2>&1; then
  launchctl bootstrap "${GUI_DOMAIN}" "${BACKEND_PLIST}"
fi

if ! launchctl print "${GUI_DOMAIN}/${METRO_LABEL}" >/dev/null 2>&1; then
  launchctl bootstrap "${GUI_DOMAIN}" "${METRO_PLIST}"
fi

launchctl kickstart -k "${GUI_DOMAIN}/${BACKEND_LABEL}"
launchctl kickstart -k "${GUI_DOMAIN}/${METRO_LABEL}"

echo "Waiting for services..."
sleep 6

MAC_IP="$(detect_mac_ip || true)"

echo
echo "=== LaunchAgents ==="
launchctl list 2>/dev/null | grep nucleo || echo "No nucleo agents listed."

echo
echo "=== Listeners ==="
lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null || echo "Port 3000: not listening"
lsof -nP -iTCP:8081 -sTCP:LISTEN 2>/dev/null || echo "Port 8081: not listening"

echo
echo "=== Health ==="
curl_backend_health "http://localhost:3000" || echo "WARN: backend localhost health failed"
echo
curl_metro_status "http://localhost:8081" || echo "WARN: metro localhost status failed"

if [[ -n "${MAC_IP}" ]]; then
  echo
  curl_backend_health "http://${MAC_IP}:3000" || echo "WARN: backend LAN health failed"
  echo
  curl_metro_status "http://${MAC_IP}:8081" || echo "WARN: metro LAN status failed"
  echo
  prewarm_metro_ios_bundle "${MAC_IP}"
fi

echo
echo "Started (backend ROOT=${ROOT}; Metro PREVIEW=${PREVIEW_ROOT})."
