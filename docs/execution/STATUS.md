# Estado de ejecución de Núcleo

## Resumen

```yaml
milestone: pdf_native
current_slice: S08
status: REOPENED
last_verified_at: 2026-08-03T22:00:17Z
classification: FUNCTIONAL
s02: DONE
s03: DONE
s04: DONE
s05: DONE
s06: DONE
s07: DONE
s08: REOPENED
s08_reopen_gates:
  supabase_db_reset: PASS (prior)
  migrations:
    - 20260729280000_s08_persist_pdf_source.sql
    - 20260729290000_s08_persist_pdf_payload_digest.sql
    - 20260729300000_s08_server_payload_digest.sql
    - 20260729310000_s08_drop_persist_pdf_13arg.sql
  vitest_full: 656 PASS / 14 skipped (integration gates without credentials skipped)
  root_semantic: baseline preexistente (0 IntentSelector/S08 en tsc root)
  mobile_semantic: 4 (fingerprint 8d0f085701c45530c01bd35980ae6240f93bc507)
  builds_orb_diff_secrets: PASS
  pdfjs_vendor: 5.4.296 (CVE-2024-4367 accepted closed; deterministic vendor:pdfjs)
  pdf_inspector: PASS (native 1.12.0 + WASM 0.1.3; worker, timeout, fallback)
  mobile_bundle_ios: PASS (npm run mobile:bundle:ios; @shared + *.mjs.txt)
  android_bundle: OUT_OF_SCOPE_S08 (iOS-first launch; documented)
  qa_dev_intent_flow: PASS (QA Entender/Aplicar menu + IntentSelector + pin)
  intent_selector_capsule: PASS_ARCH (solid RN capsule; ChatGPT visual parity PENDING reference screenshot)
  sync_notice_model: PASS (deriveSyncNotice + PersistRetryGate; focal vitest)
  persist_orchestrator: PASS (typed PersistStepResult; await PDF durable remove; unified reconnect)
  hydrate_via_ordered: PASS (captureDurableSyncPending; no direct progress on login)
  contextual_saving: PASS (owner+map saving; retryingKind ignored for Guardando)
  visual_qa_device: BLOCKED_REMOTE_SCHEMA (dry-run OK; awaiting explicit CONFIRM_REMOTE_PUSH=1)
  persist_honesty: PASS (safe persistFailureCode + DEV lane confirmed/unknown/n_a)
s09: not_started
```

## Reopen — estructura PDF opcional (2026-08-03)

| Item | Estado |
|---|---|
| `pdf-inspector` nativo + WASM | IMPLEMENTADO en backend; versiones exactas |
| Hilo principal | PROTEGIDO — parser aislado en worker con timeout/cancelación |
| Fallback | PASS — cualquier fallo conserva la extracción `pdf.js` |
| OCR | NO ACTIVADO — recomendaciones se registran, no se presentan como éxito |
| Anclas / bbox | Página exacta; bbox omitida si el Markdown cambia offsets |
| App móvil | SIN dependencia nativa ni WASM; flujo de subida existente |
| QA visual dispositivo | PENDIENTE — S08 continúa REOPENED |

## Reopen — IntentSelector SwiftUI Liquid Glass (2026-07-30)

| Item | Estado |
|---|---|
| Camino de producto | SwiftUI `GlassEffectContainer` + `.glassEffect(.regular.interactive())` |
| Lente | Capsule con `glassEffectID`; overflow reservado (no clip) |
| Fallback RN | Solo si módulo/API ausentes; badge DEV `fallback` |
| Badge DEV | `native_liquid_glass` / `fallback` bajo el selector |
| Rebuild binario | PASS (`expo run:ios`, `NucleoGlassSegment` empaquetado) |
| Evidencia reposo | `docs/execution/evidence/intent-native-rest-fixed.png` (badge nativo) |
| Evidencia pulsación mantenida / overflow | **PENDING** (requiere gesto o grabación) |
| Paridad ChatGPT | **PENDING** grabación Chat↔Work |
| S08 | REOPENED |
| Push Supabase | No ejecutado |
| S09 | not_started |

## Reopen — IntentSelector capsule (2026-07-30)

| Item | Estado |
|---|---|
| Selector Entender/Aplicar | Cápsula RN sólida + thumb deslizante (pan/tap) |
| Superficie determinista | Siempre (track + thumb testIDs) |
| Native `nucleo-glass-segment` | Disponible, **OFF** por defecto (lazy load; no crash Metro) |
| Paridad visual ChatGPT Chat/Work | **PENDING** — sin captura de referencia verificable |
| Invariantes intent/QA pin | Conservadas (`intentSelectorModel` + preselection tests) |
| `USE_NATIVE_GLASS_BUTTONS` | No tocado en este cambio |
| QA visual productivas S08 | Sigue pendiente |
| Push remoto Supabase | No ejecutado |
| S09 | not_started |

## Reopen — remote schema + persist honesty (2026-07-30)

| Item | Estado |
|---|---|
| Proyecto remoto `oxvfiyuljzchdjotyshl` | CONFIRMADO (login session; ACCESS_OK) |
| Esquema remoto sources/RPC S02–S08 | **AUSENTE** (solo maps, usage_daily) |
| Dashboard physical backups | **0** (PITR off); local dumps generated |
| Push migraciones | **DRY-RUN OK** — 26 migrations; no SQL applied |
| Precondiciones maps/usage_daily (S07) | **PASS** |
| Script `scripts/s08-push-remote-migrations.sh` | Endurecido (login, dumps, dry-run default) |
| Script `scripts/s08-verify-remote-schema.mjs` | Endurecido (pg_proc + HTTP + RLS) |
| `persistFailureCode` tipado → DEV | DONE |
| DEV lanes confirmed/unknown/n_a | DONE |
| QA visual | **BLOQUEADO** hasta push real + verify |
| S09 | not_started |

## Reopen — hydrate / saving / A→B residuals (2026-07-30)

| Item | Estado |
|---|---|
| Hydrate vía `orderedPersistRetryRef` + `captureDurableSyncPending` | DONE |
| Progress durable en captura (no solo React) | DONE |
| Saving contextual `{ownerId,mapId}`; sin `syncRetryingKind` para Guardando | DONE |
| Prueba A→B real (suspend → stale → sin evidence/progress) | PASS |
| Focal + suite 627 + build + lint + secrets | PASS |
| `mobile:bundle:ios` | PASS |
| QA visual | **AUTHORIZED** — ejecutar `S08_VISUAL_QA_E.md`; S08 sigue REOPENED |

## Reopen — sync orchestrator residuals (2026-07-30)

| Item | Estado |
|---|---|
| Await `removePendingPdfSourceSync` before evidence | DONE |
| Typed `PersistStepResult` + ordered stop-on-fail | DONE |
| Unified AppState/NetInfo; progress gated + map-scoped | DONE |
| Contextual `SyncFailureRecord` (owner+map+kind) | DONE |
| Orchestration tests (`persistSyncCoordinator.test.ts`) | PASS |
| Full vitest + RLS | PASS (627) |
| `mobile:bundle:ios` | PASS |
| Builds / orb-web / secrets scan | PASS (mobile lint: 4 pre-existing IconProps) |
| QA visual dispositivo | **NOT STARTED** — S08 REOPENED |

## Reopen — sync banner / botones / geometría (2026-07-30)

| Item | Estado |
|---|---|
| Modelo `deriveSyncNotice` (no `setError` last-wins) | DONE (código) |
| `PersistRetryGate` + retry ordenado fuente→evidencia | DONE (código) |
| Evidencia bloqueada hasta source cloud | DONE (código) |
| Panel DEV Documento/Referencias | DONE (código) |
| `NativeGlassButton` fallback sólido; native CTAs off | DONE (código) |
| `ResultNoticesZone` bajo header de lectura | DONE (código) |
| Tests focal sync + superficie | PASS |
| QA visual dispositivo (3 fallos) | **PENDING** — S08 sigue REOPENED |

## Reopen — bundle/Metro + seguridad residual (2026-07-30)

| Item | Estado |
|---|---|
| A `@shared/*` → `shared/*` vía symlink `node_modules/@shared` + resolveRequest | DONE |
| B `txt` en `assetExts` post-Uniwind; assets `pdf.min.mjs.txt` / `pdf.worker.min.mjs.txt` | DONE |
| C `npm run mobile:bundle:ios` (export limpio + MD5 assets) | DONE |
| D `invalidateViewerSession` en close/unmount/cambio/doc vacío | DONE |
| E nav: `isTopFrame`, blob solo subrecurso, rechazo `..` / escapes | DONE |
| F `vendor:pdfjs` determinista (sin `generatedAt`; JSON/TS/PROVENANCE) | DONE |
| G gates automatizados | DONE |
| QA visual E | **PENDING** (no es gate final de cierre; S08 sigue REOPENED) |
| CVE-2024-4367 | **aceptada cerrada** — no revertir 5.4.296 |

## Home chrome (local, no es gate S08)

| Item | Estado |
|---|---|
| Hero «Separa lo importante del ruido.» | Composer-gated (no se oculta por adjunto); color vía `ThemeContext`, no Uniwind |
| Jump Back cards | Radio del título por debajo del cover (z-index); no agranda la banda sobre el dibujo |
| FAB adjunto | 72 pt; página 1 entera (PDFKit o WKWebView del PDF); sin recorte de esquina |
| Fecha | 2026-08-13 |
| Banner «plan de aplicación pendiente» al abrir | Home no pinta sync de S06; ops huérfanas se dropean al hidratar |

## Slices

| ID | Estado | Notas |
|---|---|---|
| S02–S07 | DONE | No reabrir |
| S08 | REOPENED | Bundle limpio OK; falta QA E productiva |
| S09 | READY | **not_started** |

## Product audit execution (2026-08-20)

Código del plan de enganche/diseño/suscripción (sin tocar el plan `.md`):

- IAP: `react-native-purchases` + `expo-notifications` en mobile; Pro servidor vía `REVENUECAT_SECRET_API_KEY` (`server/revenueCatEntitlement.ts`); Preguntar visible con gate Pro.
- Home: Continuar + títulos en Jump Back; portadas de `generatedCover`/editorial (sin pinturas genéricas forzadas).
- Entrega: quitado `ApplicationContextBar`; contrato no-ai-slop + anti-saturación.
- Hábito: reminder local incompleto 18:00; deep links `nucleo://map/` e `import`; contrato Share Extension en `mobile/docs/SHARE_EXTENSION.md` (target nativo pendiente de prebuild).
- Feedback: haptic Medium al enviar; toast «Copiado»; Reduce Motion en fade del hero.
- Telemetría: `shared/productTelemetry.ts`; crash reporting opcional `EXPO_PUBLIC_SENTRY_DSN`.

Pendiente humano: keys ASC/RevenueCat, rebuild dev client, target Share Extension en Xcode.

## Reading format (2026-08-20)

| Item | Estado |
|---|---|
| `selectNucleoFormat` desde discourse/género | DONE |
| Compositor: visual primero, accordion, relaciones XOR | DONE |
| Prompt unidades v1.5 (frases cortas, ejemplos) | DONE |
| Kinds nuevos / timeline / selector de formato | NO |
| QA visual de un Núcleo nuevo en device | PENDIENTE (generar de nuevo) |

## Canvas Lumen (`lumen-v1`, 2026-08-20)

| Item | Estado |
|---|---|
| Parser JSON + `ActionMapData.lumenCanvas` | DONE |
| Illuminate con cadena Gemini 3.7 Flash | DONE |
| Transform JSON/NDJSON salta Entender/Aplicar | DONE |
| Preguntar usa el contrato corto del canvas | DONE |
| Canvases RN (glass + tokens) en ResultScreen | DONE |
| Cliente `generationMode: lumen-v1` | DONE |
| Ingest Núcleo (PDF/web SSRF/YouTube) | conservado |
| xAI / Grok 4.6 | no hasta que Flash no convenza |
| QA visual en device | PENDIENTE |

### Corrección 2026-08-20 (último Núcleo ≠ Lumen)

El mapa `2ac6086e-…` salió `kind: guide` por Gemini 3.5 Flash Lite (cadena HIGH de 3.7 Flash agotó tiempo/cuota). Un artículo con protocolo al final debe ser `explain`.

| Cambio | Estado |
|---|---|
| Ruta de kind: artículo → explain; guide solo procedimiento corto | DONE |
| Illuminate: Flash LOW → Flash MINIMAL → Lite MINIMAL (sin HIGH) | DONE |
| Fuente lineal: stitch de chunks, sin `[[chunk_]]` | DONE |
| Host: banda de kind + título display, como workspace Lumen | SUPERSEDED |
| Host: primera pintura = kicker + hook + tabs + insights opacos | SUPERSEDED |
| Workspace Lumen: header título, banner, min, gancho, profundidad anillos, AskDock | DONE |
| Parse: JSON truncado / kind `Explain` / explain incompleto ya no es LUMEN_PARSE | DONE |
| Parse: comas finales, valores sin comillas y JSON de Lite roto (dump `gen-mt26kmgj`) | DONE |
| Cadena Illuminate: solo aceptar una ruta si `tryParseLumenJson` cuaja | DONE |


