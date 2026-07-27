# ADR-001: Fix SSRF en fetcher
Fecha: 2026-07-27
Estado: Spec de Grok 4.5 aprobado
Riesgo si no se hace: RCE, coste infinito, baneo en Railway

# Secure fetcher spec — `server/src/lib/fetcher.ts`

**Context:** Today `server/remoteContent.ts` already calls `assertSafeFetchUrl` (`shared/ssrfGuard.ts`) with manual redirects and a byte cap, but still: (1) connects by hostname (DNS rebinding window), (2) regex “HTML→text”, (3) 15s / ~2MB, (4) weak MIME discipline, (5) returns a bare string. Replace with the module below; keep `ssrfGuard` as the shared IP policy or fold it in.

---

## Contract

```ts
export type FetchedDocument = {
  title: string;
  author: string | null;
  canonicalUrl: string;
  text: string;
  chunks: string[]; // ~2–4k char windows, overlap ~200, for transform pipeline
};

export type FetchErrorCode =
  | "invalid_url"
  | "unsupported_protocol"
  | "credentials_not_allowed"
  | "blocked_hostname"
  | "private_ip"
  | "dns_failed"
  | "redirect_loop"
  | "too_many_redirects"
  | "timeout"
  | "too_large"
  | "disallowed_mime"
  | "http_error"
  | "empty_content"
  | "parse_failed";

export class SafeFetchError extends Error {
  constructor(
    public readonly code: FetchErrorCode,
    message: string,
    public readonly httpStatus?: number
  ) {
    super(message);
  }
}

export async function fetchPublicDocument(rawUrl: string): Promise<FetchedDocument>;
```

Public callers (`/api/transform`) map `SafeFetchError` → 400/422 with a **generic** Spanish string. Never echo resolved IPs or redirect chains to the client.

---

## Constants

| Knob | Value |
|------|--------|
| Protocols | `http:`, `https:` only |
| Max redirects | 3 |
| Timeout | 8s total (`AbortController`) — one budget for DNS+all hops+body |
| Max body | 5 MiB (`5 * 1024 * 1024`) |
| MIME allowlist (normalized, ignore params) | `text/html`, `text/plain`, `application/pdf` |
| Chunk size | 3500 chars, overlap 200 (tune later) |
| UA | fixed product UA, no browser spoofing required for security |

Also block: `localhost`, `*.localhost`, `metadata.google.internal`, literal `169.254.169.254`, link-local/ULA/loopback as listed.

---

## Security pipeline (order matters)

```
parse URL
  → reject non-http(s), userinfo, empty host
  → blocklist hostname
  → if host is IP: reject if private/reserved/metadata
  → else DNS lookup (A+AAAA, all answers)
  → reject if ANY answer is private/reserved/metadata
  → open TCP to a *chosen public address* (pin), SNI/Host = original hostname
  → read response headers only first
  → if 3xx: resolve Location against current URL, ++redirects, re-run from parse (full SSRF check)
  → else: check Content-Type allowlist (and sniff first bytes if missing/wrong)
  → stream body with hard byte counter; abort past 5MB
  → parse by MIME → { title, author, canonicalUrl, text }
  → chunk text
  → log metadata
```

### DNS pin (anti-rebinding)

Do **not** `fetch(hostname)` after a one-shot DNS check. That leaves a TOCTOU gap.

**Plan with undici (preferred):**

1. `dns.promises.lookup(hostname, { all: true, verbatim: true })`.
2. Filter to public addresses only; if none → `private_ip` / `dns_failed`.
3. Pick first public IPv4, else first public IPv6.
4. `undici.request` with:
   - URL rewritten to `http(s)://{literal-ip}{path}{query}`
   - `headers: { Host: originalHostname }`
   - TLS: `servername: originalHostname` (SNI) via undici `connect` / `Dispatcher` options so cert validation still matches the name.
5. Optional harden: custom `connect` that refuses if remote socket address ∉ allowed set (defense in depth).

**node-fetch:** same idea is awkward (relies on global `http`/`https`). Prefer undici `Agent` + `connect` hook, or Node 18+ undici already bundled.

Redirects: `redirect: "manual"` always. After each `Location`, absolute-resolve, then **full** re-validate + **new** DNS pin. Cap 3. Same-host redirects still re-resolve (TTL/rebinding).

### IP policy (implement once, unit-test densely)

Reject IPv4:

- `0.0.0.0/8`, `10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`
- Also reject multicast/reserved you already partially cover (`224.0.0.0/4`, etc.) — keep current `ssrfGuard` extras; don’t weaken them.
- Explicit: `169.254.169.254` (covered by link-local, assert in tests).

Reject IPv6:

- `::1`, `::`, `fc00::/7`, `fe80::/10`
- IPv4-mapped `::ffff:x.x.x.x` → recurse into IPv4 checks
- Optionally reject `2001:db8::/32` (docs) and `::ffff:169.254.169.254`

No DNS to `.local` / mDNS as a policy choice (fail closed).

---

## HTTP / body

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 8_000);

try {
  const res = await undici.request(pinnedUrl, {
    method: "GET",
    signal: controller.signal,
    maxRedirections: 0,
    headers: {
      Accept: "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.9",
      "User-Agent": "NucleoBot/1.0 (+https://nucleo.app)",
      Host: originalHost,
    },
    // TLS servername = originalHost
  });
  // inspect status, content-type, then stream
} finally {
  clearTimeout(timer);
}
```

**Streaming limit:** read `res.body` as async iterable / `Readable`; accumulate until `total > 5_MB` → destroy stream, throw `too_large`. Prefer counting **compressed wire bytes** if undici decompresses: document that limit applies to **decoded** body size (simpler); reject `Content-Encoding` you won’t handle if you need wire-size guarantees.

**Status:** only `200–299` proceed to body (except handled 3xx). `401/403/404/410` → `http_error`.

**MIME:**

```ts
function normalizeMime(header: string | null): string | null {
  if (!header) return null;
  return header.split(";")[0]!.trim().toLowerCase();
}
```

- Allow only the three types.
- If header missing: sniff — `%PDF` → pdf; else treat as html only if looks like markup; else reject.
- `application/xhtml+xml` → treat as html (map into allowlist explicitly or normalize).

---

## Parsing (no regex article extraction)

### `text/plain`
- Decode UTF-8 (strip BOM). `title` = hostname path basename or first non-empty line ≤120 chars. `author` = null. `canonicalUrl` = final URL after redirects.

### `text/html`
1. `jsdom.JSDOM(html, { url: canonicalUrl })` — **no** resource loading (`resources: undefined`, no external scripts).
2. `@mozilla/readability` `new Readability(dom.window.document).parse()`.
3. If parse null/empty → fallback: `document.body.textContent` scrubbed, still no regex tag soup as primary path.
4. Map:
   - `title` ← readability title || `<title>`
   - `author` ← readability byline || null
   - `text` ← readability `textContent`, whitespace-normalized
   - `canonicalUrl` ← `<link rel=canonical>` if same-site and passes `assertSafeFetchUrl`, else final fetch URL

### `application/pdf`
- Do **not** run PDF through Readability.
- Extract text via existing server PDF path if you have one; else stub: reject with clear “PDF via URL not enabled—upload file” **or** call the same library `/api/transform` uses for uploads.
- Spec requirement says allowlist includes PDF: wire to shared PDF extractor; return same `FetchedDocument` shape. If extractor missing, fail closed (`parse_failed`), don’t regex binary.

**Sanitize:** strip null bytes from `text`. Cap `text` length with existing `truncateSourceText` before LLM.

**Chunks:**

```ts
function chunkText(text: string, size = 3500, overlap = 200): string[] {
  // non-empty slices; last chunk may be short; no empty strings
}
```

---

## Logging (no body)

Structured log only:

```ts
logger.info("safe_fetch", {
  host: url.hostname,          // not full URL with query if sensitive; path optional
  finalHost: finalUrl.hostname,
  status: httpStatus,
  mime,
  bytes,
  redirects,
  durationMs,
  code: success ? "ok" : errorCode,
});
```

Never log: response body, Authorization, cookies, query tokens. Truncate `rawUrl` query in logs.

---

## File layout

```
server/src/lib/fetcher.ts          # public API + orchestration
server/src/lib/ssrf.ts             # IP/DNS policy (or re-export shared/ssrfGuard + pin helpers)
server/src/lib/htmlExtract.ts      # jsdom + Readability
server/src/lib/chunkText.ts
server/remoteContent.ts            # thin wrapper: fetchPublicDocument → text for transform
shared/ssrfGuard.test.ts           # expand cases: metadata IP, mapped v6, redirect to 10/8
server/src/lib/fetcher.test.ts     # mock undici; assert no request when DNS private
```

Deps: `undici` (or Node built-in), `jsdom`, `@mozilla/readability`. No `node-fetch` unless you already standardize on it—undici is the better pin story.

---

## Integration into `/api/transform`

1. Replace `fetchUrlContent` body with `fetchPublicDocument`.
2. Pass `doc.text` (or join `chunks` only if pipeline needs segmentation) into existing transform.
3. Prefer `doc.title` / `doc.author` / `doc.canonicalUrl` for `sourceMetadata`.
4. On `SafeFetchError` → 400, generic message; increment metric `safe_fetch_denied{code=}`.

---

## Test plan (must-have before ship)

- [ ] Literal `http://127.0.0.1/`, `http://10.0.0.1/`, `http://169.254.169.254/` → no network call.
- [ ] Hostname resolving only to private A → deny.
- [ ] Hostname with mixed public+private answers → deny (any private = fail).
- [ ] Redirect 302 → `Location: http://127.0.0.1/` → deny on hop 2.
- [ ] >3 redirects → `too_many_redirects`.
- [ ] Body stream >5MB → abort, `too_large`.
- [ ] Slow server >8s → `timeout`.
- [ ] `Content-Type: application/octet-stream` → `disallowed_mime`.
- [ ] HTML fixture → Readability returns title+text; log has bytes/duration, no body field.
- [ ] URL with `user:pass@host` → reject.
- [ ] `file:`, `gopher:`, `ftp:` → reject.

---

## Migration checklist

1. [ ] Implement `fetcher.ts` + tests (no production wiring).
2. [ ] Point `remoteContent.fetchUrlContent` at it; delete regex `htmlToText`.
3. [ ] Align env: `MAX_REMOTE_FETCH_BYTES=5242880`, timeout fixed 8s (ignore old 15s).
4. [ ] Add MIME allowlist enforcement before buffer alloc.
5. [ ] Confirm PDF-from-URL path or fail closed.
6. [ ] Red-team review: DNS pin path on real Node version you deploy.

**Out of scope for this fix:** client-side URL trust, YouTube (separate extractor), upload SSRF. Do not add “allow private IPs in dev” without a compile-time `NODE_ENV` guard that is off in staging/prod.
