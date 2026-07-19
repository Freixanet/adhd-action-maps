#!/usr/bin/env bash
# Mirror worktree + auto-pull mobile-preview + Expo LAN for iPhone preview.
# Safe: reset --hard runs ONLY inside the sibling worktree, never in your main checkout.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_NAME="$(basename "$REPO_ROOT")"
WORKTREE_PATH="$(cd "$REPO_ROOT/.." && pwd)/${REPO_NAME}-mobile-preview"
BRANCH="mobile-preview"
PULL_INTERVAL=3
PREVIEW_PORT=8082
MOBILE_DIR="$WORKTREE_PATH/mobile"

log() { printf '[mobile-preview] %s\n' "$*"; }
warn() { printf '[mobile-preview] WARN: %s\n' "$*" >&2; }

detect_package_manager() {
  local dir="$1"
  if [[ -f "$dir/bun.lockb" || -f "$dir/bun.lock" ]]; then
    echo bun
  elif [[ -f "$dir/pnpm-lock.yaml" ]]; then
    echo pnpm
  elif [[ -f "$dir/yarn.lock" ]]; then
    echo yarn
  elif [[ -f "$dir/package-lock.json" ]]; then
    echo npm
  else
    echo npm
  fi
}

main_worktree_clean() {
  if ! git -C "$REPO_ROOT" diff-index --quiet HEAD -- 2>/dev/null; then
    return 1
  fi
  if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
    return 1
  fi
  return 0
}

ensure_branch_on_remote() {
  git -C "$REPO_ROOT" fetch origin "$BRANCH" 2>/dev/null || true

  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    return 0
  fi

  if ! main_worktree_clean; then
    warn "Cannot create branch '$BRANCH' on origin: main working tree has uncommitted changes."
    warn "Commit or stash in: $REPO_ROOT"
    git -C "$REPO_ROOT" status --short
    exit 1
  fi

  log "Creating branch '$BRANCH' from current HEAD and pushing to origin..."
  git -C "$REPO_ROOT" branch -f "$BRANCH" HEAD
  git -C "$REPO_ROOT" push -u origin "$BRANCH"
}

ensure_worktree() {
  if [[ -d "$WORKTREE_PATH/.git" || -f "$WORKTREE_PATH/.git" ]]; then
    log "Reusing worktree: $WORKTREE_PATH"
    git -C "$WORKTREE_PATH" fetch origin "$BRANCH"
    git -C "$WORKTREE_PATH" checkout "$BRANCH" 2>/dev/null || git -C "$WORKTREE_PATH" checkout -B "$BRANCH" "origin/$BRANCH"
    git -C "$WORKTREE_PATH" reset --hard "origin/$BRANCH"
    return 0
  fi

  log "Creating worktree: $WORKTREE_PATH (branch $BRANCH)"
  git -C "$REPO_ROOT" fetch origin "$BRANCH"

  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git -C "$REPO_ROOT" worktree add "$WORKTREE_PATH" "$BRANCH"
  elif git -C "$REPO_ROOT" show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    git -C "$REPO_ROOT" worktree add -B "$BRANCH" "$WORKTREE_PATH" "origin/$BRANCH"
  else
    warn "Branch '$BRANCH' missing locally and on origin."
    exit 1
  fi

  git -C "$WORKTREE_PATH" reset --hard "origin/$BRANCH"
}

sync_env_file() {
  if [[ -f "$MOBILE_DIR/.env" ]]; then
    return 0
  fi
  if [[ -f "$REPO_ROOT/mobile/.env" ]]; then
    log "Copying mobile/.env from main checkout into worktree (one-time)."
    cp "$REPO_ROOT/mobile/.env" "$MOBILE_DIR/.env"
  elif [[ -f "$MOBILE_DIR/.env.example" ]]; then
    warn "No mobile/.env in worktree. Copy mobile/.env.example → mobile/.env if the app needs API keys."
  fi
}

install_dependencies() {
  local pm
  pm="$(detect_package_manager "$MOBILE_DIR")"

  if [[ -d "$MOBILE_DIR/node_modules" ]]; then
    log "node_modules present in worktree ($pm)."
    return 0
  fi

  log "Installing dependencies in worktree with $pm..."
  case "$pm" in
    npm)
      if [[ -f "$MOBILE_DIR/package-lock.json" ]]; then
        npm ci --prefix "$MOBILE_DIR"
      else
        npm install --prefix "$MOBILE_DIR"
      fi
      ;;
    pnpm)
      (cd "$MOBILE_DIR" && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
      ;;
    yarn)
      (cd "$MOBILE_DIR" && yarn install --frozen-lockfile 2>/dev/null || yarn install)
      ;;
    bun)
      (cd "$MOBILE_DIR" && bun install --frozen-lockfile 2>/dev/null || bun install)
      ;;
  esac
}

PULL_PID=""
cleanup() {
  if [[ -n "$PULL_PID" ]] && kill -0 "$PULL_PID" 2>/dev/null; then
    log "Stopping auto-pull loop (pid $PULL_PID)..."
    kill "$PULL_PID" 2>/dev/null || true
    wait "$PULL_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

start_pull_loop() {
  (
    while true; do
      sleep "$PULL_INTERVAL"
      if ! git -C "$WORKTREE_PATH" fetch origin "$BRANCH" 2>/dev/null; then
        continue
      fi
      local local_rev remote_rev
      local_rev="$(git -C "$WORKTREE_PATH" rev-parse HEAD)"
      remote_rev="$(git -C "$WORKTREE_PATH" rev-parse "origin/$BRANCH" 2>/dev/null || echo "")"
      if [[ -z "$remote_rev" || "$local_rev" == "$remote_rev" ]]; then
        continue
      fi
      git -C "$WORKTREE_PATH" reset --hard "origin/$BRANCH"
      printf '[mobile-preview] Pulled latest %s (%s → %s)\n' "$BRANCH" "${local_rev:0:7}" "${remote_rev:0:7}"
    done
  ) &
  PULL_PID=$!
  log "Auto-pull loop started (every ${PULL_INTERVAL}s, pid $PULL_PID)."
}

free_preview_port() {
  local pids
  pids="$(lsof -ti tcp:"$PREVIEW_PORT" 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi
  log "Freeing port $PREVIEW_PORT (preview Metro only; port 8081 untouched)..."
  # shellcheck disable=SC2068
  kill -9 $pids 2>/dev/null || true
  sleep 0.5
}

start_expo() {
  local lan_ip=""
  lan_ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  log "Starting Expo (dev client, LAN) from: $MOBILE_DIR"
  if [[ -n "$lan_ip" ]]; then
    log "On iPhone (same WiFi): http://${lan_ip}:${PREVIEW_PORT}"
  else
    log "On iPhone (same WiFi): http://<Mac-LAN-IP>:${PREVIEW_PORT}"
    log "Mac LAN IP: ipconfig getifaddr en0"
  fi
  cd "$MOBILE_DIR"
  exec npx expo start --dev-client --host lan --port "$PREVIEW_PORT"
}

# --- main ---
if [[ ! -d "$REPO_ROOT/.git" ]]; then
  warn "Not a git repository: $REPO_ROOT"
  exit 1
fi

if [[ ! -f "$REPO_ROOT/mobile/package.json" ]]; then
  warn "Expo app not found at $REPO_ROOT/mobile/package.json"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  warn "git is required."
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  warn "npx is required (install Node.js)."
  exit 1
fi

log "Main repo:    $REPO_ROOT"
log "Mirror path:  $WORKTREE_PATH"
log "Branch:       $BRANCH"

ensure_branch_on_remote
ensure_worktree
sync_env_file
install_dependencies
free_preview_port
start_pull_loop
start_expo
