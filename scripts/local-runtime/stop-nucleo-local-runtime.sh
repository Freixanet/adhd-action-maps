#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

echo "Stopping Núcleo LaunchAgents..."

launchctl bootout "${GUI_DOMAIN}" "${BACKEND_PLIST}" 2>/dev/null || true
launchctl bootout "${GUI_DOMAIN}" "${METRO_PLIST}" 2>/dev/null || true

sleep 1

echo "Killing any remaining listeners on 3000/8081..."
kill_port_listeners 3000
kill_port_listeners 8081

sleep 1

echo
echo "=== Final state ==="
launchctl list 2>/dev/null | grep nucleo || echo "No nucleo launch agents loaded."
lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null || echo "Port 3000: free"
lsof -nP -iTCP:8081 -sTCP:LISTEN 2>/dev/null || echo "Port 8081: free"

echo
echo "Stopped. Plists remain installed; run start-nucleo-local-runtime.sh to resume."
