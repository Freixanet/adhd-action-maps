#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

MAC_IP="$(detect_mac_ip || true)"
EXPECTED_URL=""
if [[ -n "${MAC_IP}" ]]; then
  EXPECTED_URL="$(expected_api_url "${MAC_IP}")"
fi
CURRENT_URL="$(read_env_api_url "${ENV_FILE}" || true)"
PREVIEW_URL="$(read_env_api_url "${PREVIEW_ENV_FILE}" || true)"

echo "=== Núcleo local runtime status ==="
echo
echo "Canonical ROOT: ${ROOT}"
echo "Preview ROOT:   ${PREVIEW_ROOT}"
echo "Mac IP: ${MAC_IP:-<unknown>}"
echo "Expected API URL: ${EXPECTED_URL:-<unknown>}"
echo "Canonical mobile/.env: ${CURRENT_URL:-<missing>}"
echo "Preview mobile/.env:   ${PREVIEW_URL:-<missing>}"

if [[ -n "${EXPECTED_URL}" && ( "${CURRENT_URL}" != "${EXPECTED_URL}" || "${PREVIEW_URL}" != "${EXPECTED_URL}" ) ]]; then
  echo "WARN: mobile/.env does not match current IP :3000. Re-run install with --fix-env."
fi

echo
echo "=== LaunchAgents ==="
launchctl list 2>/dev/null | grep nucleo || echo "No nucleo launch agents loaded."

echo
echo "=== Listeners ==="
lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null || echo "Port 3000: not listening"
lsof -nP -iTCP:8081 -sTCP:LISTEN 2>/dev/null || echo "Port 8081: not listening"
lsof -nP -iTCP:3010 -sTCP:LISTEN 2>/dev/null || echo "Port 3010: free"

echo
echo "=== Health (localhost) ==="
if curl_backend_health "http://localhost:3000"; then
  echo
else
  echo "backend /health: FAILED"
fi
if curl_metro_status "http://localhost:8081"; then
  echo
else
  echo "metro /status: FAILED"
fi

if [[ -n "${MAC_IP}" ]]; then
  echo "=== Health (LAN ${MAC_IP}) ==="
  if curl_backend_health "http://${MAC_IP}:3000"; then
    echo
  else
    echo "backend /health: FAILED"
  fi
  if curl_metro_status "http://${MAC_IP}:8081"; then
    echo
  else
    echo "metro /status: FAILED"
  fi
fi

tail_log() {
  local file="$1"
  echo
  echo "--- ${file} (last 80 lines) ---"
  if [[ -f "${file}" ]]; then
    tail -n 80 "${file}"
  else
    echo "(missing)"
  fi
}

tail_log "${LOG_DIR}/backend.log"
tail_log "${LOG_DIR}/backend.err.log"
tail_log "${LOG_DIR}/metro.log"
tail_log "${LOG_DIR}/metro.err.log"
