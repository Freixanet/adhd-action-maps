#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
MIGRATION="$ROOT/supabase/migrations/20260621_initial_sync.sql"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/setup-supabase.sh apply --url URL --anon-key KEY [--service-key KEY]
  ./scripts/setup-supabase.sh write-env --url URL --anon-key KEY [--app-url URL]

Examples:
  ./scripts/setup-supabase.sh write-env \
    --url https://abcd1234.supabase.co \
    --anon-key eyJ...

  ./scripts/setup-supabase.sh apply \
    --url https://abcd1234.supabase.co \
    --service-key eyJ...   # Settings → API → service_role (solo local)

Redirect URLs to add in Supabase → Authentication → URL Configuration:
  - http://localhost:3000/**
  - http://127.0.0.1:3000/**
  - nucleo://login-callback
  - nucleo://**
  - com.freixanet.nucleo://login-callback
  - com.nucleo.app://login-callback
  - exp://**
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Falta $1. Instálalo e inténtalo de nuevo." >&2
    exit 1
  }
}

write_env() {
  local url="" anon="" app_url="http://localhost:3000"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --url) url="$2"; shift 2 ;;
      --anon-key) anon="$2"; shift 2 ;;
      --app-url) app_url="$2"; shift 2 ;;
      *) echo "Opción desconocida: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$url" || -z "$anon" ]]; then
    echo "Necesitas --url y --anon-key." >&2
    exit 1
  fi

  touch "$ENV_FILE"
  upsert_env() {
    local key="$1" value="$2"
    if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
      perl -0pi -e "s/^${key}=.*\$/${key}=${value}/m" "$ENV_FILE"
    else
      printf '\n%s=%s\n' "$key" "$value" >>"$ENV_FILE"
    fi
  }

  upsert_env "SUPABASE_URL" "$url"
  upsert_env "SUPABASE_ANON_KEY" "$anon"
  upsert_env "VITE_SUPABASE_URL" "$url"
  upsert_env "VITE_SUPABASE_ANON_KEY" "$anon"
  upsert_env "APP_URL" "$app_url"
  upsert_env "ALLOWED_ORIGINS" "${app_url},http://localhost:3000,http://127.0.0.1:3000"

  mkdir -p "$ROOT/mobile"
  cat >"$ROOT/mobile/.env" <<MOBILEEOF
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000
EXPO_PUBLIC_SUPABASE_URL=${url}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}
MOBILEEOF

  echo "Variables Supabase escritas en .env"
  echo "Variables Expo escritas en mobile/.env"
  echo "Reinicia npm run dev para aplicar los cambios."
}

apply_migration() {
  local url="" service=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --url) url="$2"; shift 2 ;;
      --service-key) service="$2"; shift 2 ;;
      --anon-key) shift 2 ;;
      *) echo "Opción desconocida: $1" >&2; exit 1 ;;
    esac
  done

  if [[ -z "$url" || -z "$service" ]]; then
    echo "Necesitas --url y --service-key para aplicar la migración." >&2
    exit 1
  fi

  require_cmd psql
  local db_host="${url#https://}"
  db_host="${db_host#http://}"
  db_host="db.${db_host}"

  echo "Aplicando migración en $db_host ..."
  PGPASSWORD="$service" psql \
    "postgresql://postgres:${service}@${db_host}:5432/postgres" \
    -v ON_ERROR_STOP=1 \
    -f "$MIGRATION"
  echo "Migración aplicada."
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    write-env) write_env "$@" ;;
    apply) apply_migration "$@" ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
