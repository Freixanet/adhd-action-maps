# S08 — PDF nativo

**Estado:** REOPENED (residuo: QA visual en dispositivo)  
**Dependencia:** S05 (integración con S04/S06/S07 productivos)  
**Fuera de alcance:** S09 Web; OCR como éxito; Gemini multimodal como fallback PDF.

## 1. Baseline S07 (Codex)

S07 **no** fue implementado por Grok ni Cursor. Llegó de **Codex**.

| Gate | Baseline post-S07 |
|---|---|
| Suite completa RLS ×2 | **496 PASS / 0 skipped** |
| S07 focal | **21** tests en **5** archivos (incluye `shared/homeFeed.test.ts`) |
| Root semantic | **19** preexistentes |
| Mobile semantic | **4** preexistentes |

Archivos S07 focal:

1. `shared/progress/s07Progress.test.ts`
2. `shared/pendingProgressSync.test.ts`
3. `shared/s07HistoryRecovery.test.ts`
4. `shared/s07ProgressRls.integration.test.ts`
5. `shared/homeFeed.test.ts`

## 2. Arquitectura (reopen)

```text
bytes PDF
  → validatePdf (magic, MIME, 20 MiB, /Encrypt)
  → extractPdfNative (pdfjs; early reject numPages>400; AbortSignal entre páginas)
  → assessPdfCoverage (empty ≠ scanned; image-only → scanned)
  → segmentPdfPages (IDs estables, loc.page, bbox solo medido)
  → orchestratePdfTransform
       · guest → persistStatus=local
       · auth → Storage + persist_pdf_source RPC
       · sync_failed → pdfPersistRetry (segments+digests; sin re-extraer)
  → registerTransformRoutes → S04 / S05 / S06
  → sourceMeta tipada + applyPdfCoverageToMap (estructural)
  → pendingPdfSourceSync (owner-scoped) → POST /api/sources/pdf/persist
  → SourceViewerSheet (una etiqueta de página; documentUrl firmado si storagePath)
```

## 3. Tamaño

- Contrato autoritativo: **20 MiB raw** (`MAX_PDF_BYTES`).
- Transporte JSON+base64: Express `MAX_JSON_BODY` default **28mb** para que
  20 MiB raw quepan. Cliente y servidor rechazan `MAX+1` con `PDF_TOO_LARGE`.

## 4. Persistencia / retry / A→B

- IDs estables: `mapId` / `sourceId` / `sourceVersionId` / `sourceRequestId`.
- Migración: `20260729280000_s08_persist_pdf_source.sql`.
- Idempotencia exacta (mismos bytes+IDs); conflictos fail-closed.
- Retry: `orchestratePdfPersistOnly` — **no** llama extract / S04 / S05 / S06 / Gemini.
- Purga PDF pending en `removeHistoryOwnerFromStorage` (delete account / A purge).
- A/B: `shared/pdf/s08PdfPersistRls.integration.test.ts` vía
  `persistPdfSourceWithUserJwt` (sustituye inserts manuales).

## 5. Escaneados

| Caso | Código / coverage |
|---|---|
| Página vacía | `PDF_INSUFFICIENT_TEXT` / `empty` |
| Image-only (fixture real) | **exact** `PDF_SCANNED` / `scanned` |
| Mixto texto+imagen | `ok` + `partial` + `affectedPages` |

## 6. Evidence viewer

- Página única en cabecera (`… · página N`); sin duplicar `Documento en página N`.
- Excerpt resaltado si aparece en el chunk.
- Región solo con `bbox` medido.
- `resolveDocumentUrl` → `createSignedSourceUrl(storagePath)` desde
  `ResultScreen` / `SourceViewerProvider`.

**QA visual dispositivo:** NO ejecutada en este reopen (Metro en 8081; sim
booteado sin binario Nucleo instalado). Bloqueo restante para DONE.

## 7. Pruebas — productivas vs fakes

| Archivo | Productivo | Fake / stub |
|---|---|---|
| `s08PdfNative.test.ts` | `extractPdfNative`, `pdfIngestor`, validate, barrier cancel | — |
| `s08BboxChunks.test.ts` | segment bbox | — |
| `s08PersistDigest.test.ts` | `computePdfPersistPayloadDigest` | — |
| `s08DocumentUrlResolver.test.ts` | `resolvePdfDocumentUrl` + `#page=` | — |
| `s08NdjsonHttp.e2e.test.ts` | stream + `fetchTransformWithProgress` | engines |
| `s08PdfVertical.integration.test.ts` | ingest + `resolveTransformIngest` + mid-cancel | engines |
| `s08ExpressHttp.e2e.test.ts` | **handlers** `registerTransformRoutes` + persist route | S04/S05/S06 engines; `persistPdfFn` stub |
| `s08PdfPersistRls.integration.test.ts` | **`persistPdfSourceWithUserJwt`** + adversarial A/B | — |
| `s08PendingPdfSourceSync.test.ts` | cola URI durable owner-scoped | MemoryStorage + temp files |

No se llama “vertical productivo” a un UnderstandingArtifact construido a mano
sin pasar por los handlers de transform.

## 8. Gates reopen (2026-07-30 P1 pdf.js)

| Gate | Resultado |
|---|---|
| `npx supabase db reset --yes` | PASS (`…280000`–`…293100`) |
| Focal PDF + durable | **88 PASS** |
| Persist RLS A/B | **4 PASS** |
| Suite `RUN_S02_RLS=1` ×2 | **584 PASS / 0 skipped** |
| Root / mobile semantic | **19** / **4** |
| Builds + orb-web + diff-check + secrets | PASS |
| pdf.js vendor | **5.4.296** (SHA OK; no 3.11.174) |
| QA visual E | **INCOMPLETE** |

## 9. S09

`not_started` — no iniciado.
