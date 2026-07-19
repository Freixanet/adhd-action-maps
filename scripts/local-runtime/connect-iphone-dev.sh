#!/usr/bin/env bash
# Connect a paired iPhone to the LAN Metro dev server (bypasses auto-discovery).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "${SCRIPT_DIR}/_common.sh"

MAC_IP="$(detect_mac_ip)"
if [[ -z "${MAC_IP}" ]]; then
  echo "ERROR: Could not detect Mac IP." >&2
  exit 1
fi

METRO="http://${MAC_IP}:8081"
SAFARI_LINK="${METRO}/_expo/link?choice=expo-dev-client&platform=ios"
DEEP_LINK="exp+nucleo://expo-development-client/?url=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${METRO}', safe=''))")"

echo "=== Conectar Nucleo en iPhone ==="
echo
echo "Opción A (recomendada): abre en Safari del iPhone:"
echo "  ${SAFARI_LINK}"
echo
echo "Opción B: en la pantalla 'No development servers found', pulsa"
echo "  'Enter URL manually' y escribe:"
echo "  ${MAC_IP}:8081"
echo
echo "Comprueba red: en Safari del iPhone abre ${METRO}/status"
echo "  (debe mostrar: packager-status:running)"
echo
echo "Si falla, revisa Ajustes > Nucleo > Red local (activado)."
echo

DEVICE_ID="$(xcrun devicectl list devices 2>/dev/null | awk '/available \(paired\)/ {print $4; exit}')"
if [[ -n "${DEVICE_ID}" ]]; then
  echo "Relanzando Nucleo en el iPhone emparejado..."
  xcrun devicectl device process launch --device "${DEVICE_ID}" com.freixanet.nucleo 2>&1 || true
  echo "Luego abre el enlace de Safari (Opción A) en el iPhone."
fi