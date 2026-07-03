#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/mfreixanet/antigravity/Untitled-mobile-preview"
SCRIPT_DIR="${ROOT}/scripts/local-runtime"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

FIX_ENV=0
for arg in "$@"; do
  case "${arg}" in
    --fix-env) FIX_ENV=1 ;;
    -h | --help)
      cat <<'EOF'
Usage: install-nucleo-local-runtime.sh [--fix-env]

Installs LaunchAgents for Núcleo backend (3000) and Metro (8082).

  --fix-env   Update mobile/.env EXPO_PUBLIC_API_BASE_URL to current Mac IP
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      exit 1
      ;;
  esac
done

mkdir -p "${LOG_DIR}" "${PID_DIR}"

MAC_IP="$(detect_mac_ip)"
if [[ -z "${MAC_IP}" ]]; then
  echo "ERROR: Could not detect Mac IP on en0/en1." >&2
  exit 1
fi

EXPECTED_URL="$(expected_api_url "${MAC_IP}")"
CURRENT_URL="$(read_env_api_url || true)"

echo "Detected Mac IP: ${MAC_IP}"
echo "Expected API URL: ${EXPECTED_URL}"
echo "Current mobile/.env API URL: ${CURRENT_URL:-<missing>}"

if [[ "${CURRENT_URL}" != "${EXPECTED_URL}" ]]; then
  if [[ "${FIX_ENV}" -eq 1 ]]; then
    if [[ -f "${ENV_FILE}" ]]; then
      if grep -q '^EXPO_PUBLIC_API_BASE_URL=' "${ENV_FILE}"; then
        sed -i '' "s|^EXPO_PUBLIC_API_BASE_URL=.*|EXPO_PUBLIC_API_BASE_URL=${EXPECTED_URL}|" "${ENV_FILE}"
      else
        printf '\nEXPO_PUBLIC_API_BASE_URL=%s\n' "${EXPECTED_URL}" >> "${ENV_FILE}"
      fi
    else
      printf 'EXPO_PUBLIC_API_BASE_URL=%s\n' "${EXPECTED_URL}" > "${ENV_FILE}"
    fi
    echo "Updated ${ENV_FILE}"
  else
    echo "ERROR: mobile/.env API URL does not match current IP." >&2
    echo "Re-run with --fix-env to update EXPO_PUBLIC_API_BASE_URL." >&2
    exit 1
  fi
fi

chmod +x \
  "${SCRIPT_DIR}/nucleo-backend-service.sh" \
  "${SCRIPT_DIR}/nucleo-metro-service.sh" \
  "${SCRIPT_DIR}/install-nucleo-local-runtime.sh" \
  "${SCRIPT_DIR}/start-nucleo-local-runtime.sh" \
  "${SCRIPT_DIR}/stop-nucleo-local-runtime.sh" \
  "${SCRIPT_DIR}/uninstall-nucleo-local-runtime.sh" \
  "${SCRIPT_DIR}/status-nucleo-local-runtime.sh"

cat > "${BACKEND_PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${BACKEND_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SCRIPT_DIR}/nucleo-backend-service.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/backend.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/backend.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>TRANSFORM_DEBUG</key>
    <string>1</string>
  </dict>
</dict>
</plist>
EOF

cat > "${METRO_PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${METRO_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${SCRIPT_DIR}/nucleo-metro-service.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}/mobile</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/metro.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/metro.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>${HOME}</string>
  </dict>
</dict>
</plist>
EOF

plutil -lint "${BACKEND_PLIST}" >/dev/null
plutil -lint "${METRO_PLIST}" >/dev/null

launchctl bootout "${GUI_DOMAIN}" "${BACKEND_PLIST}" 2>/dev/null || true
launchctl bootout "${GUI_DOMAIN}" "${METRO_PLIST}" 2>/dev/null || true

kill_port_listeners 3000
kill_port_listeners 8082
sleep 1

launchctl bootstrap "${GUI_DOMAIN}" "${BACKEND_PLIST}"
launchctl bootstrap "${GUI_DOMAIN}" "${METRO_PLIST}"

launchctl kickstart -k "${GUI_DOMAIN}/${BACKEND_LABEL}"
launchctl kickstart -k "${GUI_DOMAIN}/${METRO_LABEL}"

echo "Waiting for services to start..."
sleep 8

echo
echo "=== Localhost checks ==="
curl_backend_health "http://localhost:3000" || echo "WARN: backend /health on localhost:3000 failed"
echo
curl_metro_status "http://localhost:8082" || echo "WARN: metro /status on localhost:8082 failed"
echo
echo "=== LAN checks (${MAC_IP}) ==="
curl_backend_health "http://${MAC_IP}:3000" || echo "WARN: backend /health on ${MAC_IP}:3000 failed"
echo
curl_metro_status "http://${MAC_IP}:8082" || echo "WARN: metro /status on ${MAC_IP}:8082 failed"

cat <<EOF

Núcleo local runtime installed.

LaunchAgents:
  ${BACKEND_PLIST}
  ${METRO_PLIST}

Logs:
  ${LOG_DIR}/backend.log
  ${LOG_DIR}/backend.err.log
  ${LOG_DIR}/metro.log
  ${LOG_DIR}/metro.err.log

Commands:
  ./scripts/local-runtime/status-nucleo-local-runtime.sh
  ./scripts/local-runtime/stop-nucleo-local-runtime.sh
  ./scripts/local-runtime/start-nucleo-local-runtime.sh
  ./scripts/local-runtime/uninstall-nucleo-local-runtime.sh

iPhone:
  1. Mac on same Wi-Fi (${MAC_IP})
  2. Open Núcleo dev client on iPhone
  3. Reload JS if needed
  4. If API fails after IP change, re-run install with --fix-env

EOF
