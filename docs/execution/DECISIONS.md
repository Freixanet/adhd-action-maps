# Registro de decisiones de Núcleo

## Formato

Cada decisión utiliza:

```text
## ADR-XXX — Título

Fecha:
Estado: proposed | accepted | superseded
Contexto:
Decisión:
Alternativas:
Consecuencias:
Evidencia:
```

---

## ADR-001 — Producto multifuente con dos resultados principales

**Fecha:** 2026-07-28  
**Estado:** accepted

**Contexto:** El uso real incluye libros, artículos, X, YouTube, PDF y archivos. Reducir Núcleo a PDF profesionales elimina utilidad esencial.

**Decisión:** Mantener amplitud de fuentes y concentrar la experiencia P0 en Entender y Aplicar.

**Alternativas:** Herramienta exclusiva de PDF; chatbot documental generalista.

**Consecuencias:** Los adaptadores evolucionan por separado y comparten motor cognitivo, evidencia y renderer.

---

## ADR-002 — YouTube transcript-first

**Fecha:** 2026-07-28  
**Estado:** accepted

**Contexto:** El caso principal utiliza subtítulos o transcripciones. La descarga audiovisual no es necesaria y añade riesgo.

**Decisión:** Tratar YouTube como texto temporal con timestamps y cobertura visual declarada.

**Consecuencias:** P0 no descarga audio/vídeo. La adquisición de transcripts debe utilizar una vía admisible y ofrecer entrada manual.

---

## ADR-003 — Stack existente antes que reescritura

**Fecha:** 2026-07-28  
**Estado:** accepted

**Contexto:** El estado del repositorio todavía no ha sido auditado.

**Decisión:** Conservar el stack si puede cumplir el contrato. Usar el stack greenfield solo si no existe una base significativa.

**Consecuencias:** S00 debe producir una recomendación con evidencia antes de grandes cambios.

---

## ADR-004 — Clasificación FUNCTIONAL tras S00

**Fecha:** 2026-07-28  
**Estado:** accepted

**Contexto:** S00 auditó el repo en `b81c76c` con cliente Expo usable, ingestores, stream, historial, auth y tests verdes (142).

**Decisión:** Clasificar como **FUNCTIONAL**. Conservar Express + Expo + `shared/`. No adoptar stack greenfield (Fastify/Trigger/Expo Router) en los próximos slices.

**Alternativas:** FOUNDATION (subestima el flujo); LEGACY_CONFLICT (sin bloqueo estructural); GREENFIELD (falso).

**Consecuencias:** S01 formaliza contratos sobre tipos existentes. X queda en S12. WIP del propietario (Capa 0, modo DEV) se preserva.

**Evidencia:** `docs/execution/REPO_AUDIT.md`

---

## ADR-005 — Contratos de dominio aislados con adaptadores (S01)

**Fecha:** 2026-07-28  
**Estado:** accepted

**Contexto:** El repo FUNCTIONAL ya tiene `SourceChunk`, `Citation` y `Coverage` en ActionMapData. La spec pide Source/Segment/Anchor/Coverage/Evidence formales.

**Decisión:** Añadir `shared/domainContracts/` con tipos + validación runtime (estilo normalize*, sin Zod) y adaptadores explícitos. Coverage de dominio se llama `SourceCoverage` para no colisionar con ActionMapData.

**Alternativas:** Extender `contracts.ts` in-place; introducir Zod.

**Consecuencias:** Pipeline sin reescritura. Slices posteriores auditan brechas usando estos contratos.

**Evidencia:** `shared/domainContracts/`, tests 10 nuevos, huellas lint idénticas.

---

## ADR-006 — Discrepancia `study` vs Automático/Entender/Aplicar

**Fecha:** 2026-07-28  
**Estado:** accepted (documentada; no corregida en S01)

**Contexto:** `MapIntent` incluye `study`. El contrato visible P0 es Automático, Entender y Aplicar.

**Decisión:** Registrar la discrepancia; no alterar intents ni UI en S01.

**Consecuencias:** Un slice posterior de producto puede alinear la pill/intent sin reconstruir el motor.

---

## ADR-007 — Honestidad semántica en domainContracts (S01 reopen)

**Fecha:** 2026-07-28  
**Estado:** accepted

**Contexto:** Auditoría encontró valores fabricados: Citation→Evidence como verified/confidence 1; cobertura 0.7/1; image→text_file; offsets inventados en round-trip; epistemicStatus descartado.

**Decisión:**
- Citation→Evidence: `verifierStatus: pending`, `confidence: null`, sin `epistemicStatus` implícito.
- `epistemicStatus` validado y conservado cuando se aporta.
- Cobertura/extracción sin medición → `null`; `isComplete: null` = desconocida.
- `image`/`video` como tipos honestos; kinds desconocidos fallan.
- Round-trip exige `metadata.chunkLoc` exacto; sin offsets fabricados.
- `extractionConfidence` del segmento puede ser `null`.

**Evidencia:** tests semánticos en `domainContracts.test.ts`; lint fingerprints sin drift.

---

## ADR-008 — Validación runtime completa de SourceChunkLoc (S01 reopen)

**Fecha:** 2026-07-28  
**Estado:** accepted

**Contexto:** `isChunkLoc` solo comprobaba `start`/`end` finitos. Metadata hostil (`end < start`, offsets fraccionarios, `bbox: null`, campos opcionales mal tipados) podía llegar a `cloneChunkLoc`. Anclas y segmentos aceptaban índices fraccionarios.

**Productores auditados (invariantes):**
- `chunkText`: offsets enteros no negativos, `end >= start`.
- PDF: `page = pageIndex + 1` (entero positivo).
- EPUB: `chapterIndex` entero ≥ 0; `chapterTitle` string.
- Image: `imageId` string no vacío + offsets de `chunkText`.
- `bbox` / `timestamp`: sin productor de ingest actual; `mapData` pasa `bbox` débilmente.

**Decisión:**
- Sustituir el type guard débil por `validateSourceChunkLoc` (rechazo vía `ValidationResult` / `AdapterResult`; nunca throw).
- `start`/`end`: enteros ≥ 0 y `end >= start`.
- `page`: entero ≥ 1; `chapterIndex`: entero ≥ 0; `timestamp`: finito ≥ 0 (decimales ok).
- `chapterTitle` / `imageId`: string no vacío cuando existan.
- `bbox`: objeto completo `{x,y,w,h}` finitos con `w,h >= 0` (rechaza null/parcial/array).
- Anclas: `page`/`paragraph`/`startLine`/`endLine` enteros positivos; `char_range` enteros ≥ 0; timestamps con decimales.
- Segmentos: `ordinal` entero ≥ 0.
- Sin normalización silenciosa ni valores inventados.

**Evidencia:** tests negativos en `domainContracts.test.ts`; fingerprints lint idénticos; S02 no iniciado.

---

## ADR-009 — Procedencia local por `user.id` y fuentes privadas (S02)

**Fecha:** 2026-07-28  
**Estado:** accepted (actualizado en reopen 3)

**Contexto:** `hydrateCloudHistory` migraba todo el historial local antes del pull. La identidad de sync usaba email. Carreras A→B podían ejecutar migrate/pull/pending deletes bajo el singleton ya autenticado como B. `guestAdoption` global bloqueaba lotes guest futuros. El borrado de cuenta podía devolver éxito con blobs huérfanos. Tras el primer cierre, las mutaciones push/delete seguían usando el singleton mutable, y `storage_path` podía apuntar a un objeto de otro propietario. Tras el segundo reopen, `handleDeleteAccount` aún combinaba `cloudUserId` (React) con un `accessTokenRef` separado, permitiendo token B + userId A.

**Decisión:**
- Envelope `OwnedHistoryEnvelope`: particiones `guest` y `byUserId[user.id]`.
- Legacy plano → `guest` únicamente.
- **Adopción por lote:** al activar un usuario, el lote guest *actual* (si no vacío) se mueve a su partición y guest queda vacío. Lotes guest creados tras sign-out pueden adoptarse en el siguiente login. Contenido ya vinculado a A nunca vuelve a guest ni se adopta en B. `guestAdoption` es auditoría del último lote, no un candado de por vida.
- Hidratación y mutaciones: snapshot inmutable `{ epoch, userId, accessToken }` + `createSessionBoundSupabase`; resultados `applied | stale | error-current | error-stale`. Las variantes globales mobile de push/pull/migrate/delete lanzan; solo `*WithClient`.
- **Identidad activa atómica (`ActiveAuthController`):** un único ref `{epoch,userId,accessToken}` actualizado desde el mismo objeto `Session`. Delete/sign-out capturan esa unidad, invalidan a `null`, y hacen CAS al fallar/completar. Éxito de delete A con B activo: purga solo A, no UI/signOut de B. Token-refresh de A durante invalidación se ignora.
- Sign-out / delete account: invalidación **antes del primer await**. Fallo remoto restaura A solo si el epoch de invalidación sigue actual.
- Tablas `sources` / `source_versions` / `source_segments` + bucket privado `sources`.
- `source_versions.storage_path` canónico `{owner_id}/{source_id}/{safeObject}` (CHECK + trigger + **CHECK sobre filas existentes** en migración; snapshots inmutables en UPDATE). Servidor: `validateOwnedStorageRef` antes de cualquier DELETE de Storage; ruta ajena/malformada → `storage_purge_failed` sin Auth.
- Borrado de cuenta: inventariar Storage (rutas DB validadas + listado recursivo por prefijo) → borrar → verificar vacío → maps/sources → re-verificar → Auth.

**Evidencia:** `activeAuthSnapshot.test.ts`; `cloudMutationExecutor.test.ts`; `cloudHistoryHydration.test.ts`; `historyOwnership.test.ts`; `sourcesStorage.test.ts`; `accountDelete.test.ts`; `s02RlsAb.integration.test.ts` PASS con `RUN_S02_RLS=1`; prueba SQL de ADD CHECK bloqueado por fila legacy cross-tenant.

---

## ADR-010 — Límite y canonización del texto pegado (S03)

**Fecha:** 2026-07-29  
**Estado:** accepted

**Contexto:** El paste usaba `.trim()` en cliente, `normalizePlainText` solo en servidor, truncado silencioso a 120 000 tras etiquetar chunks, y un `mapId` nuevo en cada retry. Body Express admite 20 MB; el techo útil es el contexto del modelo y el número de segmentos (~273 a 500/440).

**Decisión:**
- Una sola `canonicalizePastedText` compartida (CRLF→LF, sin NUL/controles, trim, sin truncado).
- Límite autoritativo `MAX_PASTED_TEXT_CHARS = 120_000` (UTF-16) con rechazo `TEXT_TOO_LARGE`; no truncar en la ruta paste tras segmentar.
- Evolucionar `/api/transform` + `/stream` con `resolveTransformIngest` (no API greenfield).
- Idempotencia por cuarteto UUID; hash solo verifica contenido.
- Persistencia auth vía RPC JWT `security invoker`; invitado solo local.

**Alternativas:** bajar el techo a ~114 k por markers; API `/api/sources` separada; truncar labelled (roto para citas).

**Consecuencias:** paste fiable guest/auth; citas siguen en `chunk_id` textual; abort mid-Gemini no cancela al proveedor.

**Evidencia:** `pastedText.test.ts`; `s03PastedTextPersist.integration.test.ts`; `S03_PASTED_TEXT.md`.




## ADR-010b — Reopen S03: textMode, run controller, source_meta, idempotencia

**Fecha:** 2026-07-29  
**Estado:** accepted

**Contexto:** El cierre inicial de S03 dejaba ASK/paste ambiguos por heurística, cancelación tipada como `error`, meta solo en cabeceras, retry destructivo de segmentos y sin camino persist-only.

**Decisión:**
- `textMode: 'ask' | 'source'` explícito; `source` bypasa `isAskLaneInput`.
- `TransformRunController` con snapshot auth + abort antes del primer await; A→B = descarte silencioso.
- `source_meta` tipado (NDJSON + JSON) persistido en historial; UI «Sincronización pendiente».
- `POST /api/sources/pasted/persist` sin Gemini; pending sync owner-scoped.
- RPC inmutable + `source_request_id` UUID + advisory lock; sin overload text (PostgREST).
- Separación de confianza: fuente delimitada; reglas 6b en system prompt; sin interpolar usuario en system.

**Evidencia:** suite 257 PASS (0 skipped con RLS); fingerprint mobile `8d0f085701c45530c01bd35980ae6240f93bc507`; root semantic 19.


## ADR-010c — Residuos S03: colecciones, pending, identidad, SQL exacto

**Fecha:** 2026-07-29  
**Estado:** accepted

**Decisión:**
- Colecciones bajo el mismo `TransformRunController` / `runStillActive`.
- Pending sync hidratado por owner; índice por mapId; persist-only no aborta generación.
- Identidad de run = `userId` estable; epoch de credencial no invalida.
- RPC idempotente exige match exacto de segmentos.

**Evidencia (ola colecciones/pending):** suite + fingerprint mobile; S02/S04 intactos.

## ADR-010d — Handlers productivos únicos + vínculo request→version

**Fecha:** 2026-07-29  
**Estado:** accepted

**Contexto:** `createS03TransformRouter` duplicaba `/api/transform`, `/stream` y `/sources/pasted/persist` sin montarse en `server.ts`. Los tests HTTP no atravesaban handlers productivos. Además `sources.source_request_id` no fijaba `source_version_id`, y `p_utf16_length` era confiable del cliente.

**Decisión:**
- Un solo `registerTransformRoutes(app, deps)` usado por producción y supertest.
- Dependencias (auth, rate-limit, cuotas, persist, modelo) inyectables; handlers idénticos.
- Tabla inmutable `pasted_text_ingest_ops` + columna `source_versions.source_request_id`.
- RPC busca primero la ops row y verifica owner, sourceId, sourceVersionId, hash, texto, utf16, segmentos.
- `js_utf16_length()` calcula longitud UTF-16 en PostgreSQL; mismatch con `p_utf16_length` → rechazo.
- Segunda versión legítima del mismo source (nuevo request) permitida; reutilizar el request original con esa versión → rechazo.

**Capas de prueba (no confundir):**
1. Integración HTTP sobre handlers productivos (`s03ExpressHttp.e2e.test.ts`).
2. Dependencias falsas inyectadas (no sustituyen los handlers).
3. RLS/integridad real en Supabase local (`s03PastedTextPersist.integration.test.ts`).

**Evidencia:** ver `STATUS.md` / gates de cierre S03.

---

## ADR-011 — Motor Entender versionado (blueprint → units → compile)

**Fecha:** 2026-07-29  
**Estado:** accepted (enmienda final reopen 2026-07-29)

**Contexto:** Entender generaba `ActionMapData` en un solo disparo Gemini. No había IR de comprensión, `essential_ready`, fail-closed ni fixtures de fidelidad. Tras el primer cierre y un primer reopen, quedaban residuos de procedencia post-rewrite, autoautorización de chunk IDs, identidad de unidades y equivalencia de relaciones.

**Decisión:**
- Motor aislado `runUnderstandEngine` solo cuando `canRunUnderstandingEngine` confirma texto canónico extraído (no solo `intent`).
- YouTube / passthrough multimodal → legacy; ASK nunca entra.
- Contrato versionado en `shared/understanding/` (blueprint, units, closure).
- `SourceProvenance` canónica propagada ingest → routes → engine → compile; `url` → `link`; URL original conservada; texto del modelo nunca es URL.
- Etapas: cache-before-model → blueprint → `essential_ready` → units → canonicalize (seed versionado + slot keys) → compile → mapa.
- IDs persistidos siempre derivados de semilla estructural; el modelo no controla `u_*`; títulos libres no definen identidad cuando hay `unitOrder`.
- Relaciones: matching por arista concreta + familias semánticas; guardia causal degrada `causes` de forma explícita.
- Rehidratación: `allowedChunkIds` solo de fuente independiente; nunca de los `segmentRefs` del payload. Compilador adjunta IR ya validada + manifiesto de chunks.
- Caché: misma regla anti-autoautorización.
- Máximo una reparación estructurada; refs siempre `pending` (S05).
- apply/study mantienen el path monolítico temporal.

**Alternativas:** seguir con prompt monolítico + tipos cosméticos (rechazada); greenfield de router (rechazada).

**Consecuencias:** UI abre Lo esencial antes del mapa completo; S05/S06 no iniciados; legacy maps sin `understanding` siguen leyéndose.

**Evidencia:** `docs/execution/S04_UNDERSTANDING_ENGINE.md`, `STATUS.md`, suites `understandingEngine` / `s04ReopenResiduals` / `s04FinalResiduals` / `s04ExpressHttp`

---

## ADR-012 — Evidencia, cobertura y abstención (S05)

**Fecha:** 2026-07-29  
**Estado:** accepted (DONE; first-persist cardinality cerrada el mismo día)

**Contexto:** S04 deja refs `pending` y un IR de comprensión. Sin verificación, un `chunkId` podía confundirse con evidencia. Reopens posteriores cerraron A/B, bindings, contradicts, digest, ledger atómico, relationId multi-rel y cardinalidad en retry idempotente. Quedaba: filas preexistentes sin op `complete` podían adoptarse implícitamente al insertar el payload y marcar `complete` sin igualdad DB↔payload.

**Decisión:**
- Motor `runEvidenceEngine` tras `attachCitations`: extract → retrieve → entailment → checks sobre chunks exactos → policy relation-aware.
- `verified` = la fuente respalda la representación; nunca verdad externa.
- Bindings estructurales `claim.surfaces`; relaciones por `relationId` estable (IR/comparison/callout); apply batch contra snapshot original.
- Persistencia primaria en `maps.session`; RPC `persist_evidence_graph` con `graph_digest` servidor, unicidad de payload, `evidence_assert_graph_matches_payload` en retry / preexistente / pre-complete, adopt solo si DB = payload, `FOR UPDATE` en `maps`, fallo atómico sin fila `failed` duradera.
- Retry productivo de evidencia desde historial/session sin Gemini.
- Suites RLS con usuarios exclusivos y ejecución secuencial bajo `RUN_S02_RLS=1`.

**Alternativas:** identidad por título/texto (rechazada); borrado secuencial por índice (rechazada); idempotencia solo payload→DB (rechazada); igualdad solo en retry idempotente (rechazada); silenciar extras preexistentes (rechazada).

**Consecuencias:** A/B local verificado 2× consecutivas con Docker. S06 depende de este artefacto y no reabre S05.

**Evidencia:** `docs/execution/S05_EVIDENCE_COVERAGE_ABSTENTION.md`, `shared/evidence/*`, `shared/s05EvidenceRls.integration.test.ts`, `shared/evidence/s05MultiRelationAtomicity.test.ts`, migraciones `20260729190000`–`20260729220000`

---

## ADR-013 — Motor Aplicar (S06)

**Fecha:** 2026-07-29  
**Estado:** accepted (DONE) — residuos finales (confirmación / CAS / high-risk action) cerrados la misma fecha

**Contexto:** Tras el segundo reopen productivo, tres residuos bloqueaban el cierre real: la confirmación de replan no era operable desde la app; el CAS de digest era volátil y el pending podía reenviar un plan distinto; una advertencia textual legitimaba acciones de alto riesgo.

**Decisión:**
- Motor versionado `shared/application` + `server/src/application` con `canRunApplicationEngine`.
- Enrichment = draft limitado; procedencia `candidate → claim → links → chunks ∩ S05`.
- Cambio de `selectedCandidateId` → rebuild skeleton + riesgo; acción final validada por `highRiskActionGuard` (médico/legal/financiero/físico); cautela en otro campo no legitima instrucción peligrosa.
- Replan cloud: P2 staged (`replanFlow`); diálogo Conservar / Reemplazar; RPC solo con `confirmReplace: true` tras confirmación; cancel mantiene P1.
- CAS: `activePlanDigestStore` durable; SQL exige `previous_digest` = digest activo para replace; pending replan guarda `immutableArtifact` + digests exactos; P2 no pisa P3.
- Pending discriminado; seal en sign-out; purge en delete; `awaiting_confirmation` no auto-retry.
- Review fail-closed; UI de supuesto fallido.
- `study` legacy.

**Alternativas:** sustituir P1 local antes de cloud (rechazada); auto-retry de confirmación como error de red (rechazada); legitimar acción peligrosa vía adaptation (rechazada).

**Consecuencias:** S07 no iniciado.

**Evidencia:** `docs/execution/S06_APPLICATION_ENGINE.md`, `shared/application/replanFlow.ts`, `shared/application/highRiskActionGuard.ts`, `shared/pendingApplicationOps.ts`, `shared/s06FinalResiduals.test.ts`, `mobile/src/components/ApplicationReplanConfirmDialog.tsx`, migraciones `20260729230000`–`20260729260000`

---

## ADR-014 — Progreso semántico, reanudación exacta y biblioteca (S07)

**Fecha:** 2026-07-29
**Estado:** accepted (DONE)

**Contexto:** `SavedSession` ya guardaba posición, pero Biblioteca la destruía
al abrir un Núcleo; el debounce podía perderse al suspender la app; Continuar
elegía por orden del array; aplicación pendiente/activa no formaba parte del
estado visible; un fallo de `maps` no tenía retry durable específico.

**Decisión:**
- `maps.session` continúa como fuente completa y autoritativa.
- Añadir `SemanticProgressV1` (`s07.progress.v1`) como proyección determinista,
  no como estado paralelo editable.
- Restaurar por `currentStepId`; usar índice solo como fallback legacy.
- Derivar estados `to_start`, `in_progress`, `action_pending`,
  `action_active`, `completed` y `blocked`.
- Forzar persistencia local al pasar a background.
- Añadir cola owner-scoped que reenvía la entrada local más reciente con
  cliente ligado al token y guardia A/B; nunca invoca modelos.
- Proyectar cloud en `nucleus_progress` exclusivamente desde trigger de
  `maps.session`; RLS de solo lectura para el owner y rollback ante mismatch.
- Mantener búsqueda/categoría y añadir filtro de estado como dimensión
  independiente.

**Alternativas rechazadas:** usar solo `isComplete`; guardar únicamente el
índice; resetear al abrir desde Biblioteca; crear una segunda fuente de verdad
cliente; retry de progreso mediante regeneración; permitir escrituras directas
a la tabla de progreso.

**Consecuencias:** cierre/reapertura recupera unidad, superficie, Capa 0 y
estado de aplicación. La acción activa gana prioridad en Continuar. S08 no se
inicia. La compatibilidad web de módulos nativos preexistente queda fuera de
este slice y se declara en el documento de cierre.

**Evidencia:** `docs/execution/S07_PROGRESS_RESUME_LIBRARY.md`,
`shared/progress/*`, `shared/pendingProgressSync.ts`,
`shared/s07HistoryRecovery.test.ts`,
`shared/s07ProgressRls.integration.test.ts`,
`supabase/migrations/20260729270000_s07_semantic_progress.sql`.

---

## ADR-015 — PDF nativo con cobertura honesta (S08)

**Fecha:** 2026-07-29
**Estado:** accepted (REOPENED — falta QA visual dispositivo)

**Contexto:** El ingestor PDF ya extraía texto por página, pero validaba poco,
caía a multimodal/Gemini ante fallo o escaneo, y podía presentar un Núcleo
aparentemente completo sin texto verificable. Las cajas geométricas no debían
inventarse. El primer DONE sobreafirmó persistencia/viewer/límites.

**Decisión:**
- Validar magic `%PDF-`, MIME, tamaño (20 MiB raw; JSON body 28mb), cifrado y
  límites de páginas con errores tipados; early reject >400 páginas.
- Extraer con pdfjs página a página; `AbortSignal` entre páginas; distinguir
  empty vs image-only (`PDF_SCANNED` exacto).
- Nunca inventar `bbox`; omitirla si no hay medición.
- Persistir auth vía Storage + `persist_pdf_source`; guest local; pending
  owner-scoped; retry sin re-extraer ni Gemini.
- Cobertura estructural en `ActionMapData` / `sourceMeta` (no prompt-only).
- Evidence viewer: una etiqueta de página; documento autorizado vía URL
  firmada; región solo con bbox.
- Cancelación efectiva; A/B vía persistidor productivo.

**Alternativas rechazadas:** OCR silencioso; inventar regiones; allow-list de
códigos en pruebas de escaneado; inserts manuales como “A/B productivo”;
reescribir S02–S07; iniciar S09.

**Consecuencias:** PDF textual → evidencia anclada; escaneado → `PDF_SCANNED`;
B no lee el PDF de A. DONE pendiente de QA visual en dispositivo.

**Evidencia:** `docs/execution/S08_PDF_NATIVE.md`, `shared/pdf/**`,
`pdfPersist.ts`, `pdfOrchestration.ts`, `pendingPdfSourceSync.ts`,
`s08ExpressHttp.e2e.test.ts`, `s08PdfPersistRls.integration.test.ts`.

---

## ADR-016 — pdf-inspector como mejora estructural opcional y aislada (S08)

**Fecha:** 2026-08-03
**Estado:** accepted (S08 continúa REOPENED)

**Contexto:** `pdf.js` ofrece anclas y geometría fiables, pero aplana tablas,
columnas, listas y jerarquía editorial. `pdf-inspector` mejora esa estructura,
pero su API síncrona podría bloquear el servidor y su binding nativo no cubre
todos los equipos de desarrollo. Tampoco debe convertir una mejora opcional en
un nuevo punto único de fallo ni presentar OCR como realizado.

**Decisión:**
- Ejecutar `pdf-inspector` en un worker en paralelo a `pdf.js`, con timeout y
  cancelación compartida.
- En `auto`, preferir el paquete nativo y usar el paquete WASM cuando el binding
  de la plataforma no esté disponible.
- Tratar toda salida como no confiable y validarla antes de usarla.
- Aceptar Markdown página por página solo si concuerda de forma conservadora
  con la evidencia de `pdf.js` y no requiere OCR.
- Mantener `pdf.js` como fallback total, detección de imágenes y fuente de
  cobertura; no introducir código nativo en la aplicación móvil.
- Omitir bbox al sustituir el texto por Markdown, ya que sus offsets dejan de
  corresponder a los glifos medidos.
- Fijar versiones exactas y permitir desactivación inmediata por entorno.

**Alternativas rechazadas:** sustituir `pdf.js`; ejecutar el parser síncrono en
el hilo principal; usar solo el binding nativo; enviar PDFs a un servicio
externo; activar OCR silencioso; conservar bbox después de alterar el texto.

**Consecuencias:** producción compatible obtiene estructura con menor coste de
CPU; un Mac Intel desarrolla mediante WASM; cualquier fallo vuelve a la ruta
anterior sin afectar al usuario. Las páginas estructuradas cambian
legítimamente el digest de extracción, por lo que el extractor sube a
`s08.extract.v2`. S08 sigue REOPENED por su QA visual pendiente.

**Evidencia:** `docs/execution/S08_PDF_INSPECTOR.md`,
`server/src/ingestors/pdfInspectorAdapter.ts`,
`server/src/ingestors/pdfInspectorAdapter.test.ts`,
`shared/pdf/coverage.ts`, `shared/pdf/versions.ts`.

---

## ADR-026 — Formato de lectura del Núcleo por trabajo de la fuente

**Fecha:** 2026-08-20  
**Estado:** accepted

**Contexto:** El compilador clásico hacía 1 unidad = 1 página idéntica (prosa +
callouts + tabla y otra vez las mismas aristas). Cada Núcleo se sentía el mismo
documento paginado. El catálogo tipo Monogram (UI libre) sigue fuera de alcance
sin spec de layout. La allowlist de bloques no cambia.

**Decisión:** El compilador elige un `readingFormat` interno a partir de
`classification.discourseStructure` (y género como desempate). Compone cada
página para esa faena: visual útil primero (comparison, list, callout), prosa
corta, densidad en accordion, relaciones en comparison **o** Conexión, nunca
ambos. No es un selector de usuario. No se añaden kinds de bloque.

**Alternativas rechazadas:** dejar el 1:1; activar editorial-v1 por fixtures;
inventar kinds o timeline; dejar que el modelo describa el layout.

**Consecuencias:** Nuevos Núcleos se ven distintos según la fuente. Mapas viejos
siguen igual. Prompt de unidades pide frases cortas y ejemplos concretos.

**Evidencia:** `shared/nucleoFormat/`, `shared/understanding/compile.ts`.

---

## ADR-027 — Generación de producto = canvas Lumen (`lumen-v1`)

**Fecha:** 2026-08-20  
**Estado:** accepted

**Contexto:** El compositor de Núcleo seguía emitiendo mapas clásicos Entender/Aplicar
(pasos paginados). El producto a probar es un canvas único (`explain | compare |
recipe | plan | collection | guide`) generado por un JSON, con Preguntar sobre
ese canvas. El modelo a probar primero es Gemini 3.7 Flash.

**Decisión:** Las generaciones nuevas van por `generationMode: 'lumen-v1'`. El
motor Lumen sustituye Entender/Aplicar en esa ruta. El ingest de Núcleo
(PDF, web SSRF, YouTube transcript) se conserva; no se copia el fetch ingenuo
de Lumen. Tema corto, URL o texto pegado se clasifican como en Lumen, sin
selector extra. Mapas clásicos guardados siguen abriendo; no se generan más.

**Alternativas rechazadas:** xAI/Grok 4.6 de entrada; mantener dual-write
classic+lumen; añadir un picker de kind.

**Consecuencias:** Preguntar usa el contrato corto del canvas. Home muestra el
ejemplo de relatividad. Si Flash no convence, se cambia el proveedor, no el
schema. Illuminate usa Gemini 3.7 Flash con thinking LOW (no HIGH): HIGH cae
a Flash Lite y elige `guide` en artículos. Ante duda de kind, `explain`.

**Evidencia:** `shared/lumen/`, `server/src/lumen/illuminate.ts`, `mobile/src/lumen/`.

---

## ADR-028 — Iconos híbridos SF Symbols + Hugeicons; fill y trazo ortogonales

**Fecha:** 2026-08-24  
**Estado:** accepted

**Contexto:** iOS ya pinta SF Symbols vía `expo-symbols` y el resto Hugeicons. Un umbral `strokeWidth >= 2.15` cambiaba el glifo a `.fill`, acoplando grosor y relleno. A `size` nominal la masa visual no coincide: SF escala por punto óptico, Hugeicons por viewBox 24×24.

**Decisión:** Conservar el híbrido. `filled` es una prop explícita. `strokeWidth` solo mapea a `SymbolWeight` (regular / medium / semibold). SF se dibuja a 1.1× del tamaño nominal dentro del componente. Tamaños de icono 16 / 20 / 24 (`control.iconSm|Md|Lg`). Énfasis de trazo: `control.iconEmphasis` (2.5). `play.fill` y el check de completar siguen sólidos por convención.

**Alternativas:** Deshacer SF y quedar solo en Hugeicons; seguir parcheando tamaños y grosores en cada call site.

**Consecuencias:** Subir el trazo ya no cambia contorno↔sólido. Los call sites que usaban 2.15/2.2 como proxy de fill pasan a `filled`. Los tamaños 12–15, 17, 18, 28, 32 siguen fuera de token hasta que el factor óptico cubra el desajuste.

**Evidencia:** `shared/iconAppearance.ts`, `mobile/src/icons/index.tsx`.

---

## ADR-029 — Ocho roles tipográficos y peso 600 en heading

**Fecha:** 2026-08-24  
**Estado:** accepted

**Contexto:** `semantic.type` tenía ~20 nombres para seis combinaciones reales. `heading` / `sectionTitle` / `subtitle` / `readingSection` eran 22/25/500. `label` / `meta` / `micro` eran 13/18/500. `body` / `readingBody` / `readingLead` eran 17/24/400. En `primitive.fontSize`, `3xs` = `2xs` = `xs` = `sm` = `md` = 13. Dos sesiones de agente elegían nombres distintos para el mismo slot; el checker no veía divergencia. El salto 500→700 dejaba los headings de 22px blandos.

**Decisión:** Conservar la rampa 13/15/17/22/28/34. Ocho roles de tamaño×peso: `display`, `pageTitle`, `heading`, `title`, `body`, `caption`, `callout`, `meta`. El resto son alias `{semantic.type.*}`. `kicker` es overline de `meta` (tracking abierto, uppercase), no un noveno tamaño. `heading` (22px) usa peso 600; 28 y 34 siguen en 700.

**Alternativas:** Dejar los sinónimos y documentar preferencias; fusionar `kicker` en `meta` y perder el tracking de overline.

**Consecuencias:** Call sites antiguos siguen compilando. Agentes nuevos deben usar los ocho nombres. `sectionTitle` y `heading` resuelven al mismo objeto (600).

**Evidencia:** `shared/design-tokens/canonical.json`, `docs/design-system/TYPOGRAPHY.md`, `shared/typography.test.ts`.

---

## ADR-030 — `reduceMotion` via `useGlassAccessibility` (async)

**Fecha:** 2026-08-24  
**Estado:** accepted

**Contexto:** Press physics unified on `usePressSpring` / `useCalmPress`. Reanimated `useReducedMotion()` can resolve on the first frame. `useGlassAccessibility` reads `AccessibilityInfo` asynchronously and starts as `false`.

**Decisión:** `reduceMotion` reads async via `useGlassAccessibility`; first frames may animate before the flag lands. Accepted.

**Alternativas:** Keep Reanimated’s sync hook for press; gate press until the accessibility flag resolves (extra frame of no feedback).

**Consecuencias:** Reduced-motion users can see one press-in before the flag arrives. All press aliases share that behavior.

**Evidencia:** `mobile/src/hooks/usePressSpring.ts`, `mobile/src/hooks/useGlassAccessibility.ts`.

