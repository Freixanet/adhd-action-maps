# ADR-001 SSRF fix — auditoría

Commit auditado: `4bece05` (`server/src/lib/secureFetcher.ts`)

Fecha: 2026-07-27

---

Audité `4bece05` (`server/src/lib/secureFetcher.ts`).

### 1. ¿Bloquea todos los rangos privados IPv4 e IPv6?
**PASS**

`isPublicIp` usa `ipaddr.js` y solo acepta `range() === "unicast"`. Eso cubre (y más) los rangos del ADR: `127/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`, `fe80::/10`, más `0.0.0.0/8` (`unspecified`), ULA, CGNAT, multicast. IPv4-mapped se desenrolla antes del check. DNS: **cualquier** A/AAAA privada → deny.

### 2. ¿Re-valida DNS tras cada redirect?
**PASS**

El bucle hace `validateAndResolve(current)` en **cada** hop (parse + blocklist + DNS + pin). Tras 3xx: destruye body, resuelve `Location`, `continue` → nueva validación completa. Tests: redirect a `127.0.0.1` y tope de 3 redirects.

### 3. ¿Bypass vía `0.0.0.0`, `::ffff:127.0.0.1`, o redirect a `file://`?
**PASS** (no hay bypass por esos tres)

| Vector | Resultado |
|--------|-----------|
| `0.0.0.0` | `unspecified` ≠ unicast → `SSRF_BLOCKED` |
| `::ffff:127.0.0.1` | mapped → `127.0.0.1` loopback → blocked (hay test) |
| Redirect `file://…` | `assertSecureFetchTarget` solo `http:`/`https:` → `unsupported_protocol` |

### 4. ¿Límite de bytes en streaming o después?
**PASS** (durante el streaming)

`readBodyCapped` acumula por chunk, aborta y `destroy` en cuanto `total > 5 MiB` (antes del `push`). Además: `Content-Length` previo y `Agent.maxResponseSize`. No espera a materializar el body completo para decidir.
