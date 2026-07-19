#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/mobile"
ENV_ROOT="$ROOT/.env"
ENV_MOBILE="$MOBILE/.env"

usage() {
  cat <<'EOF'
Configura release móvil (Expo/EAS + env + redirects Supabase).

Usage:
  ./scripts/setup-mobile-release.sh env
  ./scripts/setup-mobile-release.sh supabase-redirects
  ./scripts/setup-mobile-release.sh eas-init
  ./scripts/setup-mobile-release.sh all

Requisitos opcionales:
  SUPABASE_ACCESS_TOKEN  → token personal de https://supabase.com/dashboard/account/tokens
  EXPO_TOKEN             → token de https://expo.dev/accounts/[account]/settings/access-tokens

Redirect URLs que se intentan registrar en Supabase:
  nucleo://login-callback
  nucleo://**
  com.freixanet.nucleo://login-callback
  com.nucleo.app://login-callback
  exp://**
  http://localhost:3000/**
  http://127.0.0.1:3000/**
EOF
}

read_env_value() {
  local key="$1" file="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- || true
}

write_mobile_env() {
  if [[ ! -f "$ENV_ROOT" ]]; then
    echo "No existe $ENV_ROOT" >&2
    exit 1
  fi

  local supabase_url supabase_anon api_base
  supabase_url="$(read_env_value SUPABASE_URL "$ENV_ROOT")"
  supabase_anon="$(read_env_value SUPABASE_ANON_KEY "$ENV_ROOT")"
  api_base="$(read_env_value EXPO_PUBLIC_API_BASE_URL "$ENV_MOBILE")"
  if [[ -z "$api_base" ]]; then
    api_base="http://127.0.0.1:3000"
  fi

  cat >"$ENV_MOBILE" <<EOF
EXPO_PUBLIC_API_BASE_URL=${api_base}
EXPO_PUBLIC_SUPABASE_URL=${supabase_url}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${supabase_anon}
EOF

  echo "Escrito $ENV_MOBILE"
}

configure_supabase_redirects() {
  local token="${SUPABASE_ACCESS_TOKEN:-}"
  if [[ -z "$token" ]]; then
    echo "SUPABASE_ACCESS_TOKEN no está definido."
    echo "Crea un token en https://supabase.com/dashboard/account/tokens y vuelve a ejecutar:"
    echo "  SUPABASE_ACCESS_TOKEN=... ./scripts/setup-mobile-release.sh supabase-redirects"
    echo
    echo "URLs a añadir manualmente en Auth → URL Configuration:"
    echo "  nucleo://login-callback"
    echo "  nucleo://**"
    echo "  com.freixanet.nucleo://login-callback"
    echo "  com.nucleo.app://login-callback"
    echo "  exp://**"
    echo "  http://localhost:3000/**"
    echo "  http://127.0.0.1:3000/**"
    return 1
  fi

  local project_ref="oxvfiyuljzchdjotyshl"
  local allow_list
  allow_list="$(cat <<'URLS'
nucleo://login-callback,nucleo://**,com.freixanet.nucleo://login-callback,com.nucleo.app://login-callback,exp://**,http://localhost:3000/**,http://127.0.0.1:3000/**
URLS
)"

  curl -fsS -X PATCH "https://api.supabase.com/v1/projects/${project_ref}/config/auth" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "{\"uri_allow_list\":\"${allow_list}\"}" >/dev/null

  echo "Redirect URLs actualizadas en Supabase (${project_ref})."
}

eas_init_project() {
  if [[ -z "${EXPO_TOKEN:-}" ]]; then
    if ! (cd "$MOBILE" && npx eas whoami >/dev/null 2>&1); then
      echo "No hay sesión EAS. Ejecuta primero:"
      echo "  cd mobile && npm run eas:login"
      echo "O define EXPO_TOKEN para CI."
      return 1
    fi
  fi

  cd "$MOBILE"
  npx eas init --non-interactive
  echo "Proyecto EAS inicializado. Revisa mobile/app.json → extra.eas.projectId"
}

main() {
  local cmd="${1:-all}"
  case "$cmd" in
    env) write_mobile_env ;;
    supabase-redirects) configure_supabase_redirects ;;
    eas-init) eas_init_project ;;
    all)
      write_mobile_env
      configure_supabase_redirects || true
      eas_init_project || true
      ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
