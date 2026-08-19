# S05 — Evidencia, cobertura y abstención

**Estado:** DONE (first-persist cardinality 2026-07-29)  
**Alcance:** fidelidad de claims críticas respecto a la fuente aportada  
**Fuera de alcance:** S06 Aplicar; verdad del mundo real; vector search

---

## 1. Qué significa `verified`

`verified` = **esta fuente respalda esta representación** (paráfrasis/síntesis fiel).

No significa:

- hecho comprobado en el mundo;
- verdad externa;
- “el chunkId existe” (eso es solo direccionamiento).

UI: **“Respaldado por esta fuente”**. Nunca “Verdadero” / “Hecho comprobado”.

---

## 2. Distinciones

| Concepto | Significado |
|----------|-------------|
| `chunkId` | Direccionamiento a un segmento |
| `Citation` / `citedChunks` | Texto exacto del ingest para el visor |
| `EvidenceLink` | Relación claim ↔ segmento tras verificación |
| `verified` | La fuente respalda la representación |
| `PendingSegmentRef` | Ref S04 aún no verificada |

No hay un segundo sistema de citas: `attachCitations` sigue siendo el único que añade `citedChunks` reales.

---

## 3. Contratos / versiones

| Pin | Valor |
|-----|-------|
| schema | `s05.evidence.v1` |
| prompt | `s05.prompt.v1` |
| verifier | `s05.verifier.v1` |
| compiler | `s05.compile.v1` |
| route | `s05.route.gemini-flash-first` |

Tipos: `ContentClaim`, `EvidenceLinkV1`, `EvidenceAssessment`, `EvidenceCoverage`, `SourceCoverageHonest`, `EvidenceArtifact`.  
`confidence` siempre `null` (sin calibración).

Cache key incluye owner, contentHash, sourceVersionId, depth, schema, prompt, verifier, compiler, modelRoute.

---

## 4. Extracción de claims

Determinista desde el artefacto S04: idea nuclear, esenciales, límites, explicaciones (frases atómicas), cautelas, ejemplos, cierre, relaciones causales.  
No convierte títulos de navegación/UI en claims.  
IDs: `stableClaimId(seed, slotKey, index)` con seed versionado.

---

## 5. Retrieval + verificador

1. Refs pending válidas en el conjunto permitido.  
2. Coincidencia léxica en la misma source version.  
3. Entailment sobre candidatos (IDs permitidos).  
4. **Checks deterministas solo sobre el texto de los `chunkIds` elegidos** — nunca sobre la concatenación de todos los candidatos.  
5. Relación-aware: `supports/qualifies` → mismatch bloquea; `contradicts` → mismatch refuerza rechazo y emite EvidenceLink `rejected`.  
6. Provider error con candidatos → `PROVIDER_ERROR`, nunca `NO_ANCHOR` artificial.  
7. `allowedChunkIdsUsed` = fragmentos usados en la decisión.  
8. `qualifierNote` libre del modelo no entra en UI: solo matiz anclado al fragmento o formulación determinista.

---

## 6. Checks deterministas

Números, %, signos, monedas, unidades, fechas, nombres, negaciones, modalizadores, correlación≠causalidad.  
Un número correcto en un candidato irrelevante **no** autoriza otro fragmento.

---

## 7. Política + superficies visibles

| Estado | Condición | UI |
|--------|-----------|-----|
| verified | segmento + entailment supports + checks OK | Respaldado por esta fuente |
| qualified | fuente más limitada | La fuente lo matiza (sin hecho no matizado) |
| contradicted | entailment contradicts (+ link rejected) | La fuente contiene posiciones incompatibles… |
| degraded | mismatch supports-path (negación/modalidad/causalidad) | Afirmación degradada respecto a la fuente… |
| insufficient | sin ancla / checks / provider | La fuente no permite determinarlo |
| inference / adaptación | síntesis o layer0 actions | Inferencia/adaptación de Núcleo |

`applyEvidenceToMap` usa **bindings estructurales** (`claim.surfaces`: slot/índice/id). Una decisión puede actualizar varios bindings; no re-verifica duplicados.

Relaciones compiladas llevan bindings independientes:

- `step.relation.callout` — callout «Conexión» keyed by stable `relationId`  
- `step.relation.comparison` — fila de la tabla `comparison` con el mismo `relationId`  

`relationId` se asigna en canonicalize/compile/extract (`stableRelationId`); apply aplica todas las decisiones de una unidad contra el snapshot original (sin borrados secuenciales por índice).

`inference` reescribe ambas con «Inferencia de Núcleo».  
`contradicted` / `degraded` / `insufficient` eliminan callout y fila (ninguna afirmación desnuda).

Validador exhaustivo de `ClaimSurfaceBinding` (índices enteros ≥ 0; kinds desconocidos / `step.relation` sin `relKind` → fail-closed). Entradas hostiles no hacen throw en `applyEvidenceToMap`.

Antes de `done`: ninguna claim crítica queda `pending`.

---

## 8. Coverage

- **SourceCoverage:** `isComplete: null` si desconocido; web fetch ≠ cobertura completa; pasted canónico completo puede ser `true`.  
- **EvidenceCoverage:** conteos exactos derivados; sin % de confianza; grafo rechaza cobertura negativa/fraccionaria/incoherente.

---

## 9. Pipeline

```text
S04 compile → attachCitations (chunks exactos)
  → chunkIdManifest (IDs only)
  → claim extract → retrieve → entailment → exact-chunk checks → policy
  → applyEvidenceToMap → done
  → (cliente) upsert maps → persistEvidenceWithUserJwt
```

`essential_ready` provisional **sin** badges de verificación.  
Cancelación / A→B / snapshot obsoleto no consolida para el usuario equivocado.

---

## 10. Placeholder eliminado

S04 ya **no** fabrica `citedChunks` con `"(segmento pendiente)"`.  
Rehydrate: `citedChunks` y/o `chunkIdManifest` independientes; sin ellos + refs → omitir IR.

---

## 11. Persistencia / RLS / idempotencia exacta

- Primario: `maps.session` (ActionMapData + `evidence`).  
- Normalizado: `content_nodes` + `evidence_links` (`map_id text` FK a `maps.id`).  
- Integridad: triggers owner/map/source/version/segment/chunk; FKs parentales **inmutables en UPDATE** (incluido mismo owner).  
- Productivo: tras upsert de `maps`, `persistEvidenceWithUserJwt` → RPC `persist_evidence_graph`.  
- **`graph_digest` canónico en servidor** (mapa, source, sourceVersion, contentHash, schema/prompt/verifier/compiler/modelRoute, todos los campos inmutables de nodes/links). El cliente no aporta un hash autoritativo.  
- **Idempotencia exacta:** `evidence_assert_graph_matches_payload` comprueba igualdad DB↔payload (conteos, campos inmutables, sin extras, `content_node_id`↔claim).  
- **Cuándo se ejecuta:** retry idempotente; filas preexistentes antes de la primera escritura; inmediatamente antes de marcar `complete`.  
- **Preexistente sin op `complete`:** DB = payload → adopt/backfill + op `complete`; cualquier extra/ausente/diferente → `EVIDENCE_IDEMPOTENCY_CONFLICT`. Nunca borrar ni sobrescribir para forzar coincidencia.  
- **Conflicto:** mismo map con payload/pins distintos, claim_id/link_key duplicados, o cardinalidad divergente → `EVIDENCE_IDEMPOTENCY_CONFLICT`.  
- **Lock:** `SELECT … FROM maps … FOR UPDATE` antes de todas las decisiones.  
- **Rollback atómico:** cualquier error revierte ops/nodes/links; **no hay fila `failed` duradera**.  
- Si hay links y falta `sourceVersionId` → `EVIDENCE_SOURCE_UNBOUND` (pending).  
- Retry de red: `pendingEvidenceSync` + `flushPendingEvidenceSync` (hydrate, reconnect, manual); sin Gemini.  
- Matriz A/B: usuarios exclusivos `s05-a/b`; 0 skipped con `RUN_S02_RLS=1`.  
- Migraciones: `20260729200000`, `20260729210000`, `20260729220000_s05_first_persist_cardinality.sql`.

### Idempotencia vs conflicto vs rollback

| Caso | Resultado |
|------|-----------|
| Mismo digest + igualdad DB↔payload | `ok`, `idempotent: true` |
| Preexistente exacto sin op `complete` | adopt + `complete` (sin duplicar) |
| Nodo/link intruder o parcial antes de primera llamada | `EVIDENCE_IDEMPOTENCY_CONFLICT`; 0 ops `complete` |
| Mismo map, digest distinto / cardinalidad divergente / ids duplicados | `EVIDENCE_IDEMPOTENCY_CONFLICT` |
| Grafo inválido (chunk unbound, …) | excepción → rollback completo; 0 filas ops/nodes/links |

---

## 12. UI

- `BlockReferences`: chunkId ≠ verified.  
- `SourceViewerSheet`: texto exacto; excerpt solo si es literal; nota epistemológica.  
- `EvidenceClaimChips`: estado + texto de claim identificable; “Ver fragmento” abre el chunk usado.  
- Banner: **“Sincronización de evidencia pendiente”** (sin jerga).

---

## 13. Frontera S06

S05 no construye planes de aplicación ni reescribe el motor Aplicar.

---

## 14. Confirmación

- S04 no reabierto.  
- S06 no iniciado.  
- S05 **DONE** con first-persist cardinality (`evidence_assert_graph_matches_payload`), adopt controlado, lock concurrente y suite 2× (397/397).
