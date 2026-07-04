#!/usr/bin/env bash
# Shared helpers for Núcleo local runtime scripts (source only).

ROOT="/Users/mfreixanet/antigravity/Untitled-mobile-preview"
RUNTIME_DIR="${ROOT}/.local-runtime"
LOG_DIR="${RUNTIME_DIR}/logs"
PID_DIR="${RUNTIME_DIR}/pids"
ENV_FILE="${ROOT}/mobile/.env"

BACKEND_PLIST="${HOME}/Library/LaunchAgents/com.nucleo.backend.plist"
METRO_PLIST="${HOME}/Library/LaunchAgents/com.nucleo.metro.plist"
BACKEND_LABEL="com.nucleo.backend"
METRO_LABEL="com.nucleo.metro"
GUI_DOMAIN="gui/$(id -u)"

detect_mac_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

read_env_api_url() {
  if [[ -f "${ENV_FILE}" ]] && grep -q '^EXPO_PUBLIC_API_BASE_URL=' "${ENV_FILE}"; then
    grep '^EXPO_PUBLIC_API_BASE_URL=' "${ENV_FILE}" | head -n1 | cut -d= -f2-
  fi
}

expected_api_url() {
  local ip="$1"
  echo "http://${ip}:3000"
}

kill_port_listeners() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
  fi
}

curl_backend_health() {
  local base="$1"
  curl -fsS -m 5 -i "${base%/}/health" 2>/dev/null || return 1
}

curl_metro_status() {
  local base="$1"
  curl -fsS -m 5 -I "${base%/}/status" 2>/dev/null || return 1
}

# First iOS bundle can take 20–30s; dev client times out if cold. Prewarm after Metro starts.
prewarm_metro_ios_bundle() {
  local ip="${1:-$(detect_mac_ip)}"
  if [[ -z "${ip}" ]]; then
    return 0
  fi
  local url="http://${ip}:8081/index.ts.bundle?platform=ios&dev=true&minify=false"
  echo "Prewarming iOS bundle on ${ip}:8081 (may take ~30s)..."
  curl -fsS -m 120 -o /dev/null "${url}" 2>/dev/null && echo "Bundle prewarmed." || echo "WARN: bundle prewarm failed"
}
