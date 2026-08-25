#!/usr/bin/env node
/**
 * Verify remote Núcleo schema after S02–S08 migration push.
 *
 * - Fails if any required table/RPC is missing.
 * - Checks expected HTTP statuses (anon deny / service present).
 * - Confirms persist_pdf_source via SQL pg_proc (exact canonical signature),
 *   never by counting OpenAPI paths.
 * - Checks source, evidence, application, and progress tables.
 * - Checks RLS posture for anon and optional A/B authenticated users.
 *
 * Never prints PAT, anon key, service-role, JWT, passwords, or user payloads.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return out;
}

const root = loadEnv(resolve(process.cwd(), '.env'));
const url = (root.SUPABASE_URL || '').replace(/\/$/, '');
const anon = root.SUPABASE_ANON_KEY || '';
const service = root.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !anon || !service) {
  console.error('missing SUPABASE_URL / ANON / SERVICE_ROLE in .env');
  process.exit(2);
}

const host = new URL(url).host;
console.log('host', host);

/** Canonical 14-arg signature after S08 digest migrations. */
const CANONICAL_PERSIST_PDF_ARGS =
  'uuid, uuid, uuid, text, text, text, text, text, integer, text, integer, jsonb, jsonb, text';

const SOURCE_TABLES = ['sources', 'source_versions', 'source_segments'];
const EVIDENCE_TABLES = ['content_nodes', 'evidence_links', 'evidence_persist_ops'];
const APPLICATION_TABLES = [
  'application_plans',
  'application_steps',
  'application_reviews',
  'application_persist_ops',
];
const PROGRESS_TABLES = ['nucleus_progress'];
const REQUIRED_TABLES = [
  ...SOURCE_TABLES,
  ...EVIDENCE_TABLES,
  ...APPLICATION_TABLES,
  ...PROGRESS_TABLES,
];

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.log('FAIL', msg);
}

function ok(msg) {
  console.log('OK', msg);
}

async function hit(key, path) {
  const r = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return r.status;
}

async function openApi(key) {
  const r = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return { status: r.status, paths: [] };
  const j = await r.json();
  return { status: r.status, paths: Object.keys(j.paths || {}).sort() };
}

function normalizeIdentityArgs(s) {
  // pg_get_function_identity_arguments may include names: "p_source_id uuid, ..."
  // Collapse to types only for comparison.
  return String(s || '')
    .split(',')
    .map((part) => {
      const toks = part.trim().split(/\s+/);
      return (toks[toks.length - 1] || '').toLowerCase();
    })
    .filter(Boolean)
    .join(', ');
}

function runSql(sql) {
  const res = spawnSync(
    'npx',
    ['supabase', 'db', 'query', '--linked', '-o', 'json', sql],
    {
      encoding: 'utf8',
      cwd: process.cwd(),
      maxBuffer: 4 * 1024 * 1024,
    }
  );
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || '').slice(0, 400);
    throw new Error(`db query failed (exit ${res.status}): ${err.replace(/eyJ[\w.-]+/g, '***')}`);
  }
  const raw = res.stdout || '';
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) throw new Error('db query returned non-JSON');
    return JSON.parse(m[0]);
  }
}

function rowsOf(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.rows)) return data.rows;
  return [];
}

// --- OpenAPI presence (informational; not used for RPC overload counts) ---
const anonRoot = await openApi(anon);
const svcRoot = await openApi(service);
console.log('anon_openapi_status', anonRoot.status);
console.log('service_openapi_status', svcRoot.status);
if (svcRoot.status !== 200) fail(`service OpenAPI status ${svcRoot.status}`);
else ok('service OpenAPI 200');

const svcPaths = new Set(svcRoot.paths);
for (const t of REQUIRED_TABLES) {
  if (!svcPaths.has(`/${t}`)) fail(`service OpenAPI missing /${t}`);
  else ok(`openapi /${t}`);
}
if (!svcPaths.has('/rpc/persist_pdf_source')) {
  fail('service OpenAPI missing /rpc/persist_pdf_source (existence hint only)');
} else {
  ok('openapi /rpc/persist_pdf_source present (signature checked via pg_proc below)');
}

// --- HTTP table checks ---
// After grants: anon has no privileges → expect 401 (or 404 if somehow unpublished).
// service_role bypasses RLS but still needs table exposed → 200.
const ANON_DENY = new Set([401, 403, 425]);
for (const t of REQUIRED_TABLES) {
  const a = await hit(anon, `/rest/v1/${t}?select=id&limit=1`);
  const s = await hit(service, `/rest/v1/${t}?select=*&limit=1`);
  console.log(`table_${t}`, { anon: a, service: s });
  if (!ANON_DENY.has(a) && a !== 200) {
    // 200 with empty [] can happen if GRANT somehow remains; treat as fail for private tables
    fail(`${t} anon unexpected status ${a} (want 401/403)`);
  } else if (a === 200) {
    fail(`${t} anon got 200 — expected privilege denial for anon`);
  } else {
    ok(`${t} anon denied (${a})`);
  }
  if (s !== 200) fail(`${t} service status ${s} (want 200)`);
  else ok(`${t} service 200`);
}

// maps: anon may still be denied after sources_grants revoke; service 200
{
  const a = await hit(anon, '/rest/v1/maps?select=id&limit=1');
  const s = await hit(service, '/rest/v1/maps?select=id&limit=1');
  console.log('table_maps', { anon: a, service: s });
  if (s !== 200) fail(`maps service status ${s}`);
  else ok('maps service 200');
  // Post-migration anon should be revoked; if still 200, flag but don't soft-pass
  if (a === 200) fail('maps anon 200 after grants revoke expected denial');
  else if (ANON_DENY.has(a)) ok(`maps anon denied (${a})`);
  else fail(`maps anon unexpected ${a}`);
}

// usage_daily: no client access
{
  const a = await hit(anon, '/rest/v1/usage_daily?select=user_id&limit=1');
  console.log('table_usage_daily_anon', a);
  if (ANON_DENY.has(a)) ok(`usage_daily anon denied (${a})`);
  else fail(`usage_daily anon unexpected ${a}`);
}

// --- SQL: persist_pdf_source exact signature via pg_proc ---
let procRows = [];
try {
  const data = runSql(`
    select
      count(*)::int as overload_count,
      coalesce(
        string_agg(pg_get_function_identity_arguments(p.oid), ' | ' order by p.oid),
        ''
      ) as signatures
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'persist_pdf_source';
  `);
  procRows = rowsOf(data);
} catch (e) {
  fail(`pg_proc query failed: ${e instanceof Error ? e.message : String(e)}`);
}

if (procRows.length) {
  const row = procRows[0];
  const count = Number(row.overload_count);
  const signatures = String(row.signatures || '');
  console.log('persist_pdf_source_overload_count', count);
  console.log('persist_pdf_source_signatures_types_only', normalizeIdentityArgs(signatures));
  if (count !== 1) {
    fail(`persist_pdf_source overload_count=${count} (want exactly 1)`);
  } else {
    ok('persist_pdf_source exactly one overload');
  }
  const types = normalizeIdentityArgs(signatures);
  const want = CANONICAL_PERSIST_PDF_ARGS.toLowerCase();
  if (types !== want) {
    fail(`persist_pdf_source signature mismatch got=[${types}] want=[${want}]`);
  } else {
    ok('persist_pdf_source canonical 14-arg signature');
  }
}

// --- SQL: required tables exist ---
try {
  const data = runSql(`
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname = any(array[${REQUIRED_TABLES.map((t) => `'${t}'`).join(',')}])
    order by 1;
  `);
  const names = new Set(rowsOf(data).map((r) => r.name));
  for (const t of REQUIRED_TABLES) {
    if (!names.has(t)) fail(`SQL missing table ${t}`);
    else ok(`sql table ${t}`);
  }
} catch (e) {
  fail(`table existence query failed: ${e instanceof Error ? e.message : String(e)}`);
}

// --- SQL: RLS enabled on required tables ---
try {
  const data = runSql(`
    select c.relname as name, c.relrowsecurity as rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname = any(array[${REQUIRED_TABLES.map((t) => `'${t}'`).join(',')}]);
  `);
  for (const r of rowsOf(data)) {
    if (!r.rls) fail(`RLS disabled on ${r.name}`);
    else ok(`RLS on ${r.name}`);
  }
} catch (e) {
  fail(`RLS query failed: ${e instanceof Error ? e.message : String(e)}`);
}

// --- Optional A/B authenticated isolation (JWT via env; never logged) ---
const jwtA = process.env.S08_VERIFY_USER_A_JWT || '';
const jwtB = process.env.S08_VERIFY_USER_B_JWT || '';
const mapIdA = process.env.S08_VERIFY_MAP_ID_A || '';

async function authedHit(jwt, path) {
  const r = await fetch(`${url}${path}`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${jwt}`,
    },
  });
  return { status: r.status, text: await r.text() };
}

if (jwtA && jwtB && mapIdA) {
  const path = `/rest/v1/maps?id=eq.${encodeURIComponent(mapIdA)}&select=id`;
  const a = await authedHit(jwtA, path);
  const b = await authedHit(jwtB, path);
  // Do not print body contents (may include ids only — still keep minimal)
  console.log('rls_ab_maps_status', { a: a.status, b: b.status, a_len: a.text.length, b_len: b.text.length });
  if (a.status !== 200) fail(`A reading own map status ${a.status}`);
  else {
    try {
      const arr = JSON.parse(a.text);
      if (!Array.isArray(arr) || arr.length < 1) fail('A cannot see own map row');
      else ok('A sees own map');
    } catch {
      fail('A maps response not JSON');
    }
  }
  if (b.status === 200) {
    try {
      const arr = JSON.parse(b.text);
      if (Array.isArray(arr) && arr.length > 0) fail('B can see A map — RLS broken');
      else ok('B cannot see A map (empty)');
    } catch {
      fail('B maps response not JSON');
    }
  } else if (ANON_DENY.has(b.status)) {
    ok(`B denied for A map (${b.status})`);
  } else {
    fail(`B unexpected status ${b.status}`);
  }

  // Source table A/B if sources exist
  const srcPath = `/rest/v1/sources?select=id&limit=5`;
  const sa = await authedHit(jwtA, srcPath);
  const sb = await authedHit(jwtB, srcPath);
  console.log('rls_ab_sources_status', { a: sa.status, b: sb.status });
  if (sa.status !== 200 || sb.status !== 200) {
    fail(`sources A/B status a=${sa.status} b=${sb.status}`);
  } else {
    ok('sources A/B both 200 (row isolation depends on ownership; statuses OK)');
  }
} else if (process.env.REQUIRE_RLS_AB === '1') {
  fail('REQUIRE_RLS_AB=1 but S08_VERIFY_USER_A_JWT / B / MAP_ID_A not set');
} else {
  console.log(
    'RLS_AB_SKIPPED set S08_VERIFY_USER_A_JWT S08_VERIFY_USER_B_JWT S08_VERIFY_MAP_ID_A (or REQUIRE_RLS_AB=1 to fail)'
  );
}

if (failures.length) {
  console.log('VERIFY_FAIL', failures.length, 'issue(s)');
  for (const f of failures) console.log(' -', f);
  process.exit(1);
}
console.log('VERIFY_OK schema_rpc_rls');
