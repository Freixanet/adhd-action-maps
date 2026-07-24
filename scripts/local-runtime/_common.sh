#!/usr/bin/env bash
# Shared helpers for Núcleo local runtime scripts (source only).

# Canonical repo = parent of scripts/local-runtime (Projects/adhd-action-maps).
LOCAL_RUNTIME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${LOCAL_RUNTIME_DIR}/../.." && pwd)"

# Preview tree keeps mobile/ios for the installed Expo dev client; canonical has no ios/.
# start-nucleo-local-runtime.sh rsyncs JS/shared/server from ROOT → PREVIEW before Metro.
PREVIEW_ROOT="/Users/mfreixanet/antigravity/Untitled-mobile-preview"

RUNTIME_DIR="${ROOT}/.local-runtime"
LOG_DIR="${RUNTIME_DIR}/logs"
PID_DIR="${RUNTIME_DIR}/pids"
ENV_FILE="${ROOT}/mobile/.env"
PREVIEW_ENV_FILE="${PREVIEW_ROOT}/mobile/.env"

BACKEND_PLIST="${HOME}/Library/LaunchAgents/com.nucleo.backend.plist"
METRO_PLIST="${HOME}/Library/LaunchAgents/com.nucleo.metro.plist"
BACKEND_LABEL="com.nucleo.backend"
METRO_LABEL="com.nucleo.metro"
GUI_DOMAIN="gui/$(id -u)"

detect_mac_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

read_env_api_url() {
  local file="${1:-${ENV_FILE}}"
  if [[ -f "${file}" ]] && grep -q '^EXPO_PUBLIC_API_BASE_URL=' "${file}"; then
    grep '^EXPO_PUBLIC_API_BASE_URL=' "${file}" | head -n1 | cut -d= -f2-
  fi
}

expected_api_url() {
  local ip="$1"
  echo "http://${ip}:3000"
}

upsert_env_api_url() {
  local file="$1"
  local url="$2"
  mkdir -p "$(dirname "${file}")"
  if [[ -f "${file}" ]]; then
    if grep -q '^EXPO_PUBLIC_API_BASE_URL=' "${file}"; then
      sed -i '' "s|^EXPO_PUBLIC_API_BASE_URL=.*|EXPO_PUBLIC_API_BASE_URL=${url}|" "${file}"
    else
      printf '\nEXPO_PUBLIC_API_BASE_URL=%s\n' "${url}" >> "${file}"
    fi
  else
    printf 'EXPO_PUBLIC_API_BASE_URL=%s\n' "${url}" > "${file}"
  fi
}

# Sync canonical JS/server into preview (native ios/ stays only on preview).
sync_canonical_to_preview() {
  if [[ ! -d "${PREVIEW_ROOT}/mobile" ]]; then
    echo "WARN: preview tree missing at ${PREVIEW_ROOT}; Metro/dev-client may fail (no ios/ in canonical)." >&2
    return 0
  fi
  echo "Syncing ${ROOT} → ${PREVIEW_ROOT} (src/shared/server; keep preview ios/)..."
  mkdir -p "${PREVIEW_ROOT}/mobile/src" "${PREVIEW_ROOT}/shared" "${PREVIEW_ROOT}/server"
  rsync -a --delete \
    --exclude 'node_modules' --exclude '.expo' --exclude 'ios' --exclude 'android' --exclude 'orb-web' \
    "${ROOT}/mobile/src/" "${PREVIEW_ROOT}/mobile/src/"
  rsync -a "${ROOT}/shared/" "${PREVIEW_ROOT}/shared/"
  if [[ -f "${ROOT}/mobile/App.tsx" ]]; then
    cp "${ROOT}/mobile/App.tsx" "${PREVIEW_ROOT}/mobile/App.tsx"
  fi
  # Bundled WebView HTML hosts (thinking-orbs live + gallery, nucleo-orb).
  mkdir -p "${PREVIEW_ROOT}/mobile/assets"
  for asset in thinking-orb-live.html thinking-orbs-gallery.html nucleo-orb.html; do
    if [[ -f "${ROOT}/mobile/assets/${asset}" ]]; then
      cp "${ROOT}/mobile/assets/${asset}" "${PREVIEW_ROOT}/mobile/assets/${asset}"
    fi
  done
  if [[ -f "${ROOT}/server.ts" ]]; then
    cp "${ROOT}/server.ts" "${PREVIEW_ROOT}/server.ts"
  fi
  if [[ -d "${ROOT}/server" ]]; then
    cp "${ROOT}/server/"*.ts "${PREVIEW_ROOT}/server/" 2>/dev/null || true
  fi
  # Keep device API URL aligned with runtime (:3000).
  local ip url
  ip="$(detect_mac_ip || true)"
  if [[ -n "${ip}" ]]; then
    url="$(expected_api_url "${ip}")"
    upsert_env_api_url "${PREVIEW_ENV_FILE}" "${url}"
  fi
  touch "${PREVIEW_ROOT}/mobile/App.tsx" 2>/dev/null || true
  echo "Sync done."
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
