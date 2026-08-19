# S02 local Supabase A/B verification

Do **not** run against production.

## Admin key

Prefer the local **`SECRET_KEY`** (`sb_secret_…`) when `npx supabase status -o env` exposes it. That is the Admin API key on newer CLI builds.

Do **not** use `JWT_SECRET`. Use **`SERVICE_ROLE_KEY`** (legacy JWT `eyJ…`) only as fallback when `SECRET_KEY` is absent.

```bash
eval "$(npx supabase status -o env)"

export S02_SUPABASE_ADMIN_KEY="${SECRET_KEY:-$SERVICE_ROLE_KEY}"
# Legacy alias for scripts/tests that still read SERVICE_ROLE_KEY:
export S02_SUPABASE_SERVICE_ROLE_KEY="$S02_SUPABASE_ADMIN_KEY"
```

Never paste real keys into docs or commits.

## Reproducible stack (from cold)

```bash
npx supabase stop --no-backup
npx supabase start --exclude vector
npx supabase db reset --yes

set -a
eval "$(npx supabase status -o env)"
set +a

export RUN_S02_RLS=1
export S02_SUPABASE_URL="$API_URL"
export S02_SUPABASE_ANON_KEY="$ANON_KEY"
export S02_SUPABASE_ADMIN_KEY="${SECRET_KEY:-$SERVICE_ROLE_KEY}"
export S02_SUPABASE_SERVICE_ROLE_KEY="$S02_SUPABASE_ADMIN_KEY"

# Exclusive users per suite (avoid parallel mutation races):
# S02 → s02-a/b@example.com
# S03 → s03-a/b@example.com (defaults in test file)
# S05 → s05-a/b@example.com (defaults in test file)
export S02_USER_A_EMAIL="s02-a@example.com"
export S02_USER_A_PASSWORD="password-a-s02"
export S02_USER_B_EMAIL="s02-b@example.com"
export S02_USER_B_PASSWORD="password-b-s02"

# Create confirmed Auth users via Admin API for s02/s03/s05 pairs, then:
npm test -- shared/s02RlsAb.integration.test.ts
```

## Result (2026-07-29 reopen 3)

| Suite | Result |
|-------|--------|
| Tables A/B strict (sources/versions/segments/anon/usage_daily) | PASS |
| Cross-tenant / unpaired / bad-bucket / traversal `storage_path` INSERT | PASS (rejected) |
| Immutable snapshot: rewrite path to B after insert | PASS (rejected) |
| Storage A/B strict (`listErr === null`, download denied, content intact) | PASS |
| Nested storage purge under owner prefix | PASS |
| Legacy canonical row accepted; cross-tenant/malformed rejected | PASS |
| ADD CHECK with pre-existing cross-tenant row (SQL txn) | PASS — blocked |
| ADD CHECK with pre-existing canonical row (SQL txn) | PASS — allowed |

Assertions require both `data` and `error` where applicable. `usage_daily` requires an explicit denial error (empty rows alone fail the test). List isolation asserts `expect(listErr).toBeNull()` — a network error cannot pass as RLS isolation.

### Migrations

1. `20260728220000_source_versions_storage_path.sql` — pair/bucket + INSERT/UPDATE trigger  
2. `20260728230000_source_versions_storage_path_canonical_check.sql` — DO block counts non-canonical existing rows and **raises**; then ADD CHECK. Strategy: fail visibly; never leave legacy paths outside the invariant.
