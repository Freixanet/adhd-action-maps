#!/usr/bin/env bash
# Preflight + optional push of S02–S08 migrations to the linked remote project.
#
# Auth: uses the secure session from `npx supabase login`.
#       SUPABASE_ACCESS_TOKEN is optional (CLI may still honor it if set);
#       it is NOT required.
#
# Default mode is DRY-RUN only. Real push requires:
#   CONFIRM_REMOTE_PUSH=1
# and a recoverable backup gate (Dashboard confirmation OR local dumps).
#
# Never prints PAT, anon key, service-role, JWT, passwords, or user row data.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF="${SUPABASE_PROJECT_REF:-oxvfiyuljzchdjotyshl}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$ROOT/backups/supabase-remote-$STAMP"
mkdir -p "$OUT_DIR"

# Redact anything that looks like a secret if a tool leaks it to stdout/stderr.
redact() {
  LC_ALL=C sed -E \
    -e 's/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/***/g' \
    -e 's/sbp_[A-Za-z0-9]+/***/g' \
    -e 's/postgresql:\/\/[^[:space:]]+/***/g' \
    -e 's/(service_role|anon|password|Bearer)[=: ]+[^[:space:]]+/\1=***/Ig'
}

echo "project_ref=$REF"
echo "out_dir=$OUT_DIR"
if [[ "${CONFIRM_REMOTE_PUSH:-}" == "1" ]]; then
  echo "mode=PUSH"
else
  echo "mode=DRY_RUN"
fi
echo "note: schema-only dump is NOT a recoverable backup"
echo "note: Storage binary objects are NOT part of any database dump"

# --- 1) Confirm authenticated account can see the exact project ---
echo "checking authenticated access to $REF…"
ACCESS_JSON="$(npx supabase projects list -o json 2>/dev/null || true)"
if ! printf '%s' "$ACCESS_JSON" | python3 -c "
import json,re,sys
raw=sys.stdin.read()
m=re.search(r'(\[.*\]|\{.*\})', raw, re.S)
if not m:
  print('ACCESS_FAIL: could not parse projects list', file=sys.stderr); sys.exit(1)
data=json.loads(m.group(1))
projects=data if isinstance(data,list) else data.get('projects',[])
ref=sys.argv[1]
hit=next((p for p in projects if p.get('ref')==ref or p.get('id')==ref), None)
if not hit:
  print('ACCESS_FAIL: project not visible to authenticated session', file=sys.stderr)
  sys.exit(1)
print('ACCESS_OK name=%s status=%s region=%s' % (
  hit.get('name'), hit.get('status'), hit.get('region')))
" "$REF"; then
  echo "Run: npx supabase login" >&2
  exit 2
fi

# --- 2) Link (login session; no ACCESS_TOKEN required) ---
npx supabase link --project-ref "$REF" --yes 2>&1 | redact

# --- 3) Recoverable backup gate ---
# Prefer a recent Dashboard physical backup when available. Otherwise generate
# local recoverable dumps: schema.sql + data-only --use-copy + roles.
BACKUPS_JSON="$(npx supabase backups list --project-ref "$REF" -o json 2>/dev/null || true)"
printf '%s\n' "$BACKUPS_JSON" | python3 -c "
import json,re,sys
raw=sys.stdin.read().strip()
path=sys.argv[1]
try:
  m=re.search(r'(\{.*\}|\[.*\])', raw, re.S)
  data=json.loads(m.group(1) if m else raw or '{}')
except Exception:
  data={}
if isinstance(data, list):
  backups=data
  pitr=False
  walg=False
else:
  backups=data.get('backups') or []
  pitr=bool(data.get('pitr_enabled'))
  walg=bool(data.get('walg_enabled'))
open(path,'w').write(json.dumps({
  'walg_enabled': walg,
  'pitr_enabled': pitr,
  'backup_count': len(backups) if isinstance(backups,list) else 0,
}, indent=2)+'\n')
print('dashboard_physical_backups count=%s pitr=%s walg=%s' % (
  len(backups) if isinstance(backups,list) else 0, pitr, walg))
" "$OUT_DIR/dashboard-backups-summary.json" | redact

DASHBOARD_BACKUP_OK=0
if [[ "${DASHBOARD_BACKUP_CONFIRMED:-}" == "1" ]]; then
  echo "DASHBOARD_BACKUP_CONFIRMED=1 — treating Dashboard backup as operator-confirmed"
  DASHBOARD_BACKUP_OK=1
fi

BACKUP_COUNT="$(python3 -c "import json; print(json.load(open('$OUT_DIR/dashboard-backups-summary.json')).get('backup_count',0))")"
if [[ "$BACKUP_COUNT" -gt 0 ]]; then
  echo "Dashboard lists $BACKUP_COUNT physical backup(s)"
  DASHBOARD_BACKUP_OK=1
fi

generate_local_recoverable_dumps() {
  echo "generating local recoverable dumps (schema + data-only + roles)…"
  echo "WARNING: Storage objects (PDF binaries, etc.) are NOT included in DB dumps." | tee "$OUT_DIR/STORAGE_NOT_INCLUDED.txt"
  npx supabase db dump --linked -f "$OUT_DIR/schema.sql" 2>&1 | redact
  npx supabase db dump --linked --data-only --use-copy -f "$OUT_DIR/data.sql" 2>&1 | redact
  npx supabase db dump --linked --role-only -f "$OUT_DIR/roles.sql" 2>&1 | redact
  {
    echo "local_recoverable_dump"
    echo "created_at_utc=$STAMP"
    echo "files=schema.sql,data.sql,roles.sql"
    echo "storage_binaries=NOT_INCLUDED"
    echo "schema_only_is_not_a_full_backup=true"
  } > "$OUT_DIR/MANIFEST.txt"
  echo "local dumps written under $OUT_DIR"
}

if [[ "$DASHBOARD_BACKUP_OK" -eq 0 ]]; then
  echo "No confirmed Dashboard physical backup — generating local dumps before any SQL apply."
  generate_local_recoverable_dumps
else
  # Still capture schema for audit (explicitly not labeled as the sole backup).
  echo "writing schema snapshot for audit (not the sole recoverable backup)…"
  npx supabase db dump --linked -f "$OUT_DIR/schema-snapshot-for-audit.sql" 2>&1 | redact || true
  if [[ "${GENERATE_LOCAL_DUMPS:-}" == "1" ]]; then
    generate_local_recoverable_dumps
  fi
fi

# --- 4) Migration list before ---
npx supabase migration list --linked 2>&1 | redact | tee "$OUT_DIR/migration-list-before.txt"

# --- 5) Remote precondition audit (maps / usage_daily vs S07) ---
npx supabase db query --linked -o json "
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('maps', 'usage_daily')
order by table_name, ordinal_position;
" > "$OUT_DIR/remote-maps-usage-columns.json"

OUT_DIR="$OUT_DIR" python3 - <<'PY' | tee "$OUT_DIR/precondition-audit.txt"
import json, os, sys
from pathlib import Path
path = Path(os.environ["OUT_DIR"]) / "remote-maps-usage-columns.json"
if not path.exists():
  print("PRECONDITION_FAIL: missing column dump"); sys.exit(1)
raw = path.read_text()
try:
  data = json.loads(raw)
except json.JSONDecodeError:
  print("PRECONDITION_FAIL: unreadable column dump"); sys.exit(1)
rows = data.get("rows", data if isinstance(data, list) else [])
by = {}
for r in rows:
  by.setdefault(r["table_name"], {})[r["column_name"]] = r

required = {
  "maps": {
    "id": "text",
    "owner_id": "uuid",
    "session": "jsonb",
    "updated_at": "timestamp with time zone",
    "title": "text",
    "source_type": "text",
  },
  "usage_daily": {
    "user_id": "uuid",
    "day": "date",
    "transform_count": "integer",
    "chat_count": "integer",
    "updated_at": "timestamp with time zone",
  },
}
ok = True
for table, cols in required.items():
  present = by.get(table, {})
  if not present:
    print(f"PRECONDITION_FAIL: table {table} missing remotely")
    ok = False
    continue
  print(f"table {table}: columns={','.join(sorted(present))}")
  for col, dtype in cols.items():
    meta = present.get(col)
    if not meta:
      print(f"  FAIL missing column {table}.{col} (needed by S07/base)")
      ok = False
    elif meta["data_type"] != dtype:
      print(f"  FAIL {table}.{col} type={meta['data_type']} expected={dtype}")
      ok = False
    else:
      print(f"  OK {table}.{col} {dtype}")
print("S07 note: migration will CREATE nucleus_progress, trigger on maps.session, and backfill all maps rows")
print("S07 note: legacy maps without session.progress remain readable; projection uses updated_at ms")
print("HISTORY note: remote has maps/usage_daily but empty migration history — push will replay base migrations")
print("HISTORY note: 20260621 uses drop policy if exists so existing maps RLS policies will not abort push")
if ok:
  print("PRECONDITION_OK maps/usage_daily compatible with S07")
else:
  print("PRECONDITION_FAIL")
  sys.exit(1)
PY

# --- 6) Dry-run first (always) ---
echo "running: supabase db push --linked --include-all --dry-run"
npx supabase db push --linked --include-all --dry-run 2>&1 | redact | tee "$OUT_DIR/db-push-dry-run.txt"

OUT_DIR="$OUT_DIR" python3 - <<'PY' | tee "$OUT_DIR/migrations-to-apply.txt"
from pathlib import Path
import os, re
out = Path(os.environ["OUT_DIR"])
text = (out / "db-push-dry-run.txt").read_text()
ordered = []
seen = set()
in_block = False
for line in text.splitlines():
  if re.search(r"dry run|would (apply|push)|following migration", line, re.I):
    in_block = True
  if not in_block and not re.search(r"20\d{6,}", line):
    continue
  for m in re.finditer(r"(20\d{12,}(?:_[A-Za-z0-9_]+)?\.sql|20\d{12,}|20\d{6,}(?:_[A-Za-z0-9_]+)?\.sql|20\d{6,})", line):
    n = m.group(1)
    if n not in seen:
      seen.add(n)
      ordered.append(n)
if not ordered:
  before = out / "migration-list-before.txt"
  if before.exists():
    for line in before.read_text().splitlines():
      parts = [p.strip() for p in line.split("|")]
      if len(parts) >= 2 and parts[0] and parts[0][0].isdigit() and parts[1] == "":
        if parts[0] not in seen:
          seen.add(parts[0])
          ordered.append(parts[0])
print("migrations_planned_count=%d" % len(ordered))
for n in ordered:
  print(n)
PY

echo ""
echo "=== DRY-RUN COMPLETE — STOPPING ==="
echo "Artifacts: $OUT_DIR"
echo "Review db-push-dry-run.txt and migrations-to-apply.txt"
echo "No remote SQL was applied."
echo "To apply later (explicit): CONFIRM_REMOTE_PUSH=1 $0"
echo "If Dashboard has a recoverable backup you verified manually: also set DASHBOARD_BACKUP_CONFIRMED=1"
echo "S08 remains REOPENED; visual QA BLOCKED; S09 not started."

if [[ "${CONFIRM_REMOTE_PUSH:-}" != "1" ]]; then
  exit 0
fi

# --- 7) Real push only with explicit confirmation ---
echo "CONFIRM_REMOTE_PUSH=1 — applying migrations for real…"
npx supabase db push --linked --include-all 2>&1 | redact | tee "$OUT_DIR/db-push-apply.txt"
npx supabase migration list --linked 2>&1 | redact | tee "$OUT_DIR/migration-list-after.txt"
echo "push finished — run: node scripts/s08-verify-remote-schema.mjs"
