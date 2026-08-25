# S03 — Texto pegado de extremo a extremo

## 1. Flujo final

### Invitado
1. Pega texto → validación cliente (`validatePastedText`).
2. Se minten una sola vez `mapId`, `sourceId`, `sourceVersionId`, `sourceRequestId`.
3. `POST /api/transform[/stream]` con JWT ausente / solo install-id.
4. Servidor: misma orquestación → canoniza → segmenta → **no escribe Supabase sources**.
5. Genera Núcleo + citas `chunk_*` → historial local (partición guest).
6. `persistStatus = local`. Reintento reutiliza los mismos IDs.

### Autenticado
1–3 iguales, con `ActiveAuthSnapshot` (token + userId atómicos).
4. Tras segmentar, RPC `persist_pasted_text_source` (`security invoker`, JWT del usuario).
5. Si la persistencia falla: el Núcleo puede generarse igual; `persistStatus = sync_failed` (sin éxito cloud falso).
6. Historial local en partición del usuario + sync de `maps` (S02).

## 1b. textMode

`TransformRequest.textMode: 'ask' | 'source'`.

- Chip/acción de pegar fuente → `source` (nunca `isAskLaneInput`, aunque sea pregunta corta).
- Compositor conversacional → `ask`.
- Retry conserva el valor.

## 2. Modelo de estados

| Capa | Valores |
|------|---------|
| Fuente | `received → validating → extracting → ready \| failed` |
| Persistencia | `local \| syncing \| cloud \| sync_failed` |
| Generación | `idle \| generating \| ready \| cancelled \| failed` |

Una fuente `ready` no pasa a `failed` porque falle Gemini después.

## 3. Idempotencia

- Clave de operación = `sourceRequestId` (UUID) único por propietario, ligado de forma inmutable a `sourceId` / `sourceVersionId` / `contentHash`.
- Hash = integridad de contenido, **no** identidad de operación.
- Retry / doble pulsación / concurrentes con los mismos IDs → una fuente, una versión, **sin delete+reinsert** si el payload coincide; mismatch → fallo estable.
- Advisory `pg_advisory_xact_lock(owner, request)` serializa RPC concurrentes.
- El inline retry **ya no** crea un `mapId` nuevo; `textMode` se conserva.

## 4. Canonización y límite

`canonicalizePastedText` (única):

- quita NUL y controles C0 salvo TAB/LF;
- CRLF/CR → LF;
- colapsa espacios finales antes de `\n`;
- `trim`;
- **sin truncado silencioso**.

Offsets = índices UTF-16 de JavaScript (`String.length` / `slice`).

**Límite autoritativo:** `MAX_PASTED_TEXT_CHARS = 120_000` (igual que el techo histórico de contexto). El servidor rechaza `TEXT_TOO_LARGE` (413). Tras segmentar/etiquetar no se vuelve a truncar en la ruta paste (`skipSourceTruncate`).

ADR-010 documenta la decisión.

## 5. Esquema / migraciones

`20260729100000_s03_pasted_text_segments_chunk_id.sql` — `chunk_id`, kind `chunk`, RPC inicial.

`20260729120000_s03_pasted_text_request_idempotency.sql` — `sources.source_request_id uuid` + unique `(owner_id, source_request_id)`; RPC inmutable con lock advisory y validación estricta de segmentos.

`20260729130000_s03_drop_persist_text_overload.sql` — elimina overload `text` que rompía PostgREST (`PGRST203`).

## 6. UUID interno ↔ chunk_id citable

- `source_segments.id` = UUID interno.
- `source_segments.chunk_id` = identidad citable (`chunk_<md5>`).
- Las citas del mapa siguen usando `chunkId` textual; no se sustituyen por UUID.
- Adaptador S01: `sourceSegmentFromChunk` → kind `chunk` + metadata `chunkId`.

## 7. Atomicidad

RPC única (`security invoker`, JWT): insert source/version/segments en una transacción. Versión inmutable: match exacto → éxito idempotente; divergencia → excepción. Fallo → rollback SQL. `sync_failed` se recupera con `POST /api/sources/pasted/persist` (canon → segmentación → RPC, **sin Gemini**).

## 8. Cancelación / ejecución

- Cliente: `TransformRunController` (runId + auth snapshot + `AbortController`) creado **antes del primer await**.
- Tras cada await y en callbacks (`onFirstStreamByte`, `onPartial`, early Capa 0, `onDone`, `onAsk`, timers, sync historial) se valida `isCurrentForAuth`.
- Política A→B: **descarte silencioso** — el resultado de A no consolida en B.
- `handleCancelLoading` → estado semántico `cancelled` (no `error`).
- Servidor: comprueba cancelación antes de persistir / generar / consolidar.
- Limitación residual: Gemini mid-call no se aborta al proveedor.

## 9. Matriz de pruebas

| Área | Cobertura |
|------|-----------|
| textMode ask vs source | `server/src/ingestors/askLane.test.ts` |
| TransformRunController | `shared/transformRunController.test.ts` |
| source_meta stream + pending ownership | `shared/s03SourceMetaProtocol.test.ts` |
| Dual-route E2E fakes (stream+JSON) | `shared/s03DualRouteE2E.test.ts` |
| Canon / hash / offsets / sync_failed | `shared/pastedText.test.ts` |
| Persist RLS (retry, concurrent, reject, rollback, anon) | `s03PastedTextPersist.integration.test.ts` — **0 skipped** con `RUN_S02_RLS=1` |
| RLS matriz S02 | `s02RlsAb.integration.test.ts` |

## 10. Riesgos residuales

1. Abort mid-Gemini no cancela el RPC del proveedor (solo evita `done` / JSON final).
2. Persist cloud en fallo de red sigue requiriendo el botón de reintento (`sync_failed` → persist-only).
3. Rutas no-paste (PDF/URL/…) no usan aún la misma orquestación de persistencia de sources (fuera de S03).
4. Cabeceras `X-Nucleo-*` y el campo `contentHash` viajan en protocolo; la UI no muestra hashes ni IDs.
5. Exact slice equality de anchors UTF-16 vs índices PG se valida en TypeScript antes del RPC; SQL valida rangos estructurales.

## Decisión de API

Se evolucionó `/api/transform` + `/api/transform/stream` con `resolveTransformIngest`. Se añadió `POST /api/sources/pasted/persist` solo para retry de persistencia sin regeneración. Protocolo: evento NDJSON `source_meta` + `sourceMeta` en JSON.


## 11. Residuos reopen (cerrados)

### Colecciones
- `runStillActive()` en todos los puntos de mutación de la rama `collectionPlan`.
- Identidad estable por parte (`mapId/sourceId/sourceVersionId/sourceRequestId` + `textMode: source`).
- `sourceMeta` por parte → historial + pending owner-scoped.

### Pending hydrate
- Al activar partición de usuario: `reconcilePendingSourceSyncWithHistory`.
- Índice `pendingSyncByMapId`; retry por `mapId` sin `inlineRetryPayloadRef`.
- Sign-out sella; reentrada a A restaura; B no ve pendientes de A.

### Sync retry UX
- Durante `generating`: aviso discreto, sin botón que aborte la generación.
- Persist-only usa `persistSyncAbortRef` independiente del `TransformRunController`.

### Begin antes del primer await
- Identidad del run antes de `isDeviceOffline()` / headers / analyze.
- Matching de identidad por `userId` (refresh de token no descarta).

### SQL
- Migración `20260729140000_s03_exact_segment_idempotency.sql`: comparación exacta de segmentos.
- Migración `20260729150000_s03_request_version_binding_utf16.sql`:
  - tabla inmutable `pasted_text_ingest_ops` (`owner_id + source_request_id → source_id + source_version_id + content_hash`);
  - `source_versions.source_request_id` con índice único owner-scoped;
  - `js_utf16_length()` en PostgreSQL (paridad JS); rechazo si `p_utf16_length` no coincide;
  - segunda versión del mismo source bajo request distinto es legítima; reutilizar el request original con esa versión falla.

### HTTP productivo
- `registerTransformRoutes(app, deps)` en `server/src/routes/registerTransformRoutes.ts`.
- `server.ts` y `shared/s03ExpressHttp.e2e.test.ts` registran **las mismas** funciones handler.
- Tests inyectan auth/persist/modelo falsos; no hay router paralelo.
- Paridad arquitectónica: falla si `server.ts` deja de llamar al registrador o reaparece `createS03TransformRouter`.

### Capas de prueba
| Capa | Qué cubre |
|---|---|
| HTTP productivo | Handlers de `registerTransformRoutes` vía supertest |
| Dependencias falsas | Auth, rate-limit, persist, Gemini inyectados |
| RLS real | JWT + RPC contra Supabase local (`RUN_S02_RLS=1`) |
