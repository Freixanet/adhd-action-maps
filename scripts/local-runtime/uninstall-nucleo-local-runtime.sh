#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

REMOVE_LOGS=0
for arg in "$@"; do
  case "${arg}" in
    --remove-logs) REMOVE_LOGS=1 ;;
    -h | --help)
      cat <<'EOF'
Usage: uninstall-nucleo-local-runtime.sh [--remove-logs]

Stops and removes Núcleo LaunchAgents.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      exit 1
      ;;
  esac
done

echo "Stopping LaunchAgents..."
launchctl bootout "${GUI_DOMAIN}" "${BACKEND_PLIST}" 2>/dev/null || true
launchctl bootout "${GUI_DOMAIN}" "${METRO_PLIST}" 2>/dev/null || true

sleep 1
kill_port_listeners 3000
kill_port_listeners 8081

rm -f "${BACKEND_PLIST}" "${METRO_PLIST}"

if [[ "${REMOVE_LOGS}" -eq 1 ]]; then
  rm -f \
    "${LOG_DIR}/backend.log" \
    "${LOG_DIR}/backend.err.log" \
    "${LOG_DIR}/metro.log" \
    "${LOG_DIR}/metro.err.log"
  echo "Removed logs in ${LOG_DIR}"
else
  echo "Logs preserved in ${LOG_DIR} (pass --remove-logs to delete)"
fi

echo
echo "Uninstalled Núcleo local runtime LaunchAgents."
