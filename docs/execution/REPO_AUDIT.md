# REPO_AUDIT — S00

**Fecha:** 2026-07-28  
**Commit verificado:** `b81c76c` (`feature/visual-nucleos`)  
**Node:** v22.13.0 (`.nvmrc`)  
**Clasificación:** **FUNCTIONAL**

---

## 1. Resumen ejecutivo

Existe un producto usable de punta a punta: cliente Expo en `mobile/`, backend Express + Gemini en `server.ts`/`server/`, contratos en `shared/`, ingestión multifuente, streaming de Núcleos, historial local/cloud, auth Supabase, paywall y citas. No es greenfield ni solo foundation.

**Recomendación:** conservar y evolucionar el stack actual. No adoptar el stack greenfield de la spec. El primer slice real es **S01 — Baseline y contratos**, alineando Source/Segment/Anchor/Coverage/Evidence con lo ya existente sin reescritura.

---

## 2. Árbol relevante

```
/
├── mobile/                 # Cliente canónico (Expo 56 / RN 0.85)
│   ├── src/screens|components|context|logic
│   ├── modules/            # native UI menu, etc.
│   ├── orb-web/            # orbs HTML embebidos
│   └── ios|android
├── server.ts               # monolito Express + Gemini (activo)
├── server/                 # llmAccess, remoteContent, ingestors, citations
├── shared/                 # contratos, mapData, pipeline, SSRF, quotas
├── src/                    # web legacy/reference (NO UI canónica)
├── supabase/migrations/    # maps + usage_daily + RLS
├── docs/                   # SPEC, execution, ADR ingestión/SSRF
├── .cursor/rules|commands  # sistema de ejecución Núcleo
└── .github/workflows/ci.yml
```

---

## 3. Stack y versiones

| Capa | Tecnología | Estado |
|------|------------|--------|
| App | Expo `~56.0.12`, RN `0.85.3`, TypeScript | Activo |
| UI | Liquid Glass, Uniwind/NativeWind legacy mix, Reanimated, heroui-native | Activo |
| Backend | Express + `@google/genai`, Node 22 | Activo |
| Auth/DB | Supabase Auth + Postgres + RLS | Migraciones presentes; host vivo externo |
| Jobs | Síncronos / stream HTTP (sin Trigger.dev) | Aceptable para alpha |
| Monetización | RevenueCat cliente + allowlist Pro servidor | Parcial |
| Tests | Vitest (root) | Activo |
| CI | `npm test` + `mobile` `tsc -p tsconfig.ci.json` | Activo |

Deps raíz y `mobile/node_modules` ya instaladas; **no** se ejecutó `npm ci` (no hacía falta).

---

## 4. Comandos verificados

| Comando | Resultado | Evidencia |
|---------|-----------|-----------|
| `npm test` | **PASS** 17 files / 142 tests | 2026-07-28 |
| `npm run build` | **PASS** Vite + esbuild `dist/server.cjs` | 2026-07-28 |
| `npm run lint --prefix mobile` | **FAIL** 4 errores TS en props de iconos | preexistente |
| `npm run lint --prefix mobile/orb-web` | **PASS** | 2026-07-28 |
| `npm run build --prefix mobile/orb-web` | **PASS** | 2026-07-28 |
| `npm run lint` (root) | **FAIL** ~19 errores TS conocidos | no expandir baseline |
| `format:check` / Prettier | **Ausente** (no hay script) | — |

---

## 5. Funciones existentes (mapa útil)

### Cliente (`mobile/`)
- Home + composer (texto, cámara, galería, archivo, URL).
- Pill de intent (`understand` / `apply` / `study`).
- Generación inline + stream → ResultScreen.
- Lectura paso a paso, view-all, progreso, reanudación (Continuar).
- Historial, búsqueda, categorías, pin.
- Chat sobre mapa, PDF cheatsheet, paywall, auth sheet.
- Capa 0 (`Layer0Page`) en WIP local (no mergeada).

### Backend
- `POST /api/transform`, `/api/transform/stream`, `/api/transform/analyze`
- `POST /api/ask`, `POST /api/maps/:id/chat`
- Cheatsheet PDF, delete account, health, legal pages
- IngestorFactory: text, url, pdf, epub, docx, image (+ YouTube transcript vía pipeline URL)
- SSRF guard (`shared/ssrfGuard`, `secureFetcher`)
- Citas / `citedChunks` (`server/src/citations.ts`)
- Quotas / entitlement Pro

### Shared
- `ActionMapData`, steps, TLDR, coverage, citations, layer0 (WIP)
- `normalizeMapData`, `nucleoPipeline`, depth contracts, no-ai-slop

### Legacy
- `src/` web reference — no portar UI al mobile.

---

## 6. Datos y migraciones

| Artefacto | Contenido |
|-----------|-----------|
| `20260621_initial_sync.sql` | `maps` (owner RLS), índices, `updated_at` |
| `20260720120000_usage_daily.sql` | metering diario |

Historial también en storage local del dispositivo. Sync cloud opcional si Supabase está configurado.

**Huecos vs spec:** storage privado de blobs de fuente no está como producto completo; jobs idempotentes/checkpoints no existen (transform es request/stream).

---

## 7. Auth y seguridad

- Supabase Auth en mobile + middleware servidor (`server/llmAccess.ts`).
- RLS en `maps` por `owner_id`.
- Fuentes tratadas como datos (prompt wrapping / unwrap en pipeline).
- SSRF documentado (ADR-001).
- No hay adaptador X ni scraping de X en el código (correcto respecto a la regla; **falta** el camino oficial/pegar para P0 X).

---

## 8. Adaptadores de fuente vs P0

| Fuente P0 | Estado en repo |
|-----------|----------------|
| Texto pegado | Sí |
| Web | Sí (`urlIngestor` + Readability) |
| PDF | Sí |
| EPUB | Sí (jerárquico) |
| TXT/MD/HTML/DOCX | Parcial (DOCX sí; textuales vía text/url) |
| YouTube transcript | Sí (`youtube-transcript`, no AV download) |
| X (API / share / paste) | **No** (ausente) |

---

## 9. Deuda

1. `server.ts` monolítico (~4k+ líneas) + `AppSessionContext` muy grande.
2. Root `tsc` y mobile icon props: errores conocidos; CI mobile usa `tsconfig.ci.json` más permisivo.
3. Sin Prettier/format script unificado.
4. Duplicación `normalizeMapData` (shared + copia en `server.ts`).
5. ~~Preview Metro a menudo apunta a `antigravity/Untitled-mobile-preview`~~ → **fixed**: LaunchAgent Metro sirve `Projects/adhd-action-maps/mobile`; `status` falla si el cwd no es canónico.
6. RevenueCat nativo / entitlement servidor incompletos.
7. Contratos epistemológicos formales (Source/Segment/Anchor/Evidence) no están un módulo único tipado; hay piezas (`SourceChunk`, citations, coverage) pero no el paquete S01 completo.

---

## 10. Diferencias con `NUCLEO_EXECUTION_SPEC.md`

| Spec | Repo |
|------|------|
| Expo Router + TanStack Query | App propia + context session |
| Fastify modular | Express monolito |
| Trigger.dev | Stream HTTP síncrono |
| Zod en fronteras | Schemas Gemini / normalizers propios |
| X P0 | Ausente |
| Contratos Source/Evidence unificados | Fragmentados pero funcionales |
| Greenfield stack | **No aplicar** (FUNCTIONAL) |

Resolución: ADR-003 (stack existente) se confirma con evidencia de esta auditoría.

---

## 11. Cambios del propietario (sin confirmar / no tocar)

Working tree en `feature/visual-nucleos` respecto a `b81c76c`:

**Modificados:** `AGENTS.md`, AttachMenu, ContinueCard, FloatingGlassButton, ProfileMenu, sidebar, AppSessionContext, demoNucleo, Input/Result screens, `server.ts`, shared contracts/mapData/transformStream/index.

**Nuevos:** sistema ejecución (`.cursor/commands`, rules 00–40, `docs/NUCLEO_EXECUTION_SPEC.md`, `docs/execution/*`), `Layer0Page`, `devToolsPreference`, `shared/layer0*`, prompts README.

**Temas del WIP:** Capa 0 (layer0 schema + UI + early open), modo DEV en ajustes, polish UI sidebar/continue.

**Regla S00:** no revertir, no mergear, no “limpiar” este WIP.

---

## 12. Clasificación

### FUNCTIONAL

Justificación:
- Flujo completo importar → generar → leer → reanudar → historial.
- Múltiples adaptadores reales con tests.
- Auth, quotas, citas, SSRF, CI y builds productivos.

No es `LEGACY_CONFLICT`: la arquitectura no bloquea Entender/Aplicar ni fuentes P0; los huecos (X, contratos formales, jobs) son evolución incremental.

---

## 13. Recomendación

1. Marcar S00 como DONE.
2. Ejecutar **S01** siguiente: formalizar/alinear contratos Source, Segment, Anchor, Coverage, Evidence sobre tipos existentes (`shared/types/chunk`, citations, coverage) + fixtures + tests de rechazo; estabilizar baseline TS sin ampliar errores conocidos.
3. Conservar Express/Expo/shared; no migrar a Fastify/Trigger en S01.
4. Tratar WIP Capa 0 / DEV mode como cambios del propietario: integrar solo si el slice lo exige o el usuario lo pide.
5. X queda para S12; no improvisar scraping.

---

## 14. Primer slice real

**S01 — Baseline y contratos**

Objetivo concreto: un módulo de contratos versionado que compile, valide y rechace fixtures inválidas, mapeando a `SourceChunk`/coverage/citations actuales sin romper el cliente.

---

## 15. Bloqueos

| Bloqueo | Severidad | Notas |
|---------|-----------|-------|
| Ninguno para empezar S01 | — | Deps instaladas, tests verdes |
| Root/mobile TS baseline sucio | Media | No empeorar; limpiar solo en slices dedicados |
| Preview tree desincronizado | Baja | Operativo local, no bloquea contratos |

---

## 16. Huella TypeScript pre-S01 (2026-07-28, commit `b81c76c`)

Capturada **antes** de cualquier código de S01. S01 DONE exige igualdad exacta post-slice.

### Root `npm run lint` (19 errores)

Hash SHA-1 lista ordenada: `8c591d2236c0b19e764d721147e821ceaf692a35`

```
mobile/src/components/ContinueChip.tsx(38,45): error TS2322: Type '{ size: number; color: string; fill: string; }' is not assignable to type 'IntrinsicAttributes & IconProps'.
mobile/src/components/ContinueExpandTransition.tsx(193,47): error TS2345: Argument of type '() => { width: number; height: number; transform: ({ translateX: number; translateY?: undefined; } | { translateY: number; translateX?: undefined; })[]; }' is not assignable to parameter of type '() => DefaultStyle'.
mobile/src/components/GlassTouchGlow.tsx(73,5): error TS2322: Type '({ translateX: number; translateY?: undefined; } | { translateY: number; translateX?: undefined; })[]' is not assignable to type 'string | readonly (({ scale: AnimatableNumericValue; } & { translateX?: never; translateY?: never; scaleX?: never; scaleY?: never; rotate?: never; rotateX?: never; rotateY?: never; ... 4 more ...; matrix?: never; }) | ... 11 more ... | ({ ...; } & { ...; }))[]'.
mobile/src/components/KnowledgeSectionsList.tsx(97,67): error TS2322: Type '{ size: number; color: string; style: { marginTop: number; }; }' is not assignable to type 'IntrinsicAttributes & IconProps'.
mobile/src/components/MapChatSheet.tsx(278,62): error TS2322: Type '{ size: number; color: string; className: string; }' is not assignable to type 'IntrinsicAttributes & IconProps'.
mobile/src/components/SourceCoverageCard.tsx(59,17): error TS2322: Type '{ size: number; color: string; style: { marginTop: number; }; }' is not assignable to type 'IntrinsicAttributes & IconProps'.
mobile/src/components/blocks/QuizBlock.tsx(60,5): error TS2322: Type '({ translateX: number; scale?: undefined; } | { scale: number; translateX?: undefined; })[]' is not assignable to type 'string | readonly (({ scale: AnimatableNumericValue; } & { translateX?: never; translateY?: never; scaleX?: never; scaleY?: never; rotate?: never; rotateX?: never; rotateY?: never; ... 4 more ...; matrix?: never; }) | ... 11 more ... | ({ ...; } & { ...; }))[]'.
server.ts(2872,37): error TS2345: Argument of type 'StepContentBlock[]' is not assignable to parameter of type '{ text?: string; items?: { strong?: string; span?: string; }[]; }[]'.
server.ts(2995,32): error TS2339: Property 'visualization' does not exist on type 'unknown'.
server.ts(468,17): error TS2339: Property 'kind' does not exist on type 'StepContentBlock'.
server.ts(472,36): error TS2367: This comparison appears to be unintentional because the types '"info" | "alert"' and '"action"' have no overlap.
server.ts(566,41): error TS2345: Argument of type 'StepContentBlock[]' is not assignable to parameter of type '{ text?: string; items?: { strong?: string; span?: string; }[]; }[]'.
shared/ssrfGuard.test.ts(13,35): error TS2339: Property 'reason' does not exist on type 'SafeUrlCheck'.
shared/ssrfGuard.test.ts(19,35): error TS2339: Property 'reason' does not exist on type 'SafeUrlCheck'.
shared/ssrfGuard.test.ts(25,35): error TS2339: Property 'reason' does not exist on type 'SafeUrlCheck'.
shared/usageLimits.test.ts(20,37): error TS2339: Property 'code' does not exist on type '{ ok: true; used: number; limit: number; } | { ok: false; used: number; limit: number; code: "free_limit" | "pro_fair_use"; }'.
shared/visualizeCompiler.test.ts(118,13): error TS2352: Conversion of type 'VisualizeRouteA | VisualizeRouteC' to type '{ spec: { relations: unknown[]; }; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
src/components/HistoryPanel.tsx(335,11): error TS2322: Type '{ children: Element[]; type: "button"; onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void; onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void; ... 6 more ...; className: string; }' is not assignable to type 'DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>'.
src/components/HistoryPanel.tsx(409,7): error TS2322: Type '{ children: any[]; className: string; onSelectStart: (event: SyntheticEvent) => void; }' is not assignable to type 'DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>'.
```

### Mobile `npm run lint --prefix mobile` (4 errores)

Hash SHA-1 lista ordenada: `8d0f085701c45530c01bd35980ae6240f93bc507`

```
src/components/ContinueChip.tsx(38,45): error TS2322: Type '{ size: number; color: string; fill: string; }' is not assignable to type 'IntrinsicAttributes & IconProps'.
src/components/KnowledgeSectionsList.tsx(97,67): error TS2322: Type '{ size: number; color: string; style: { marginTop: number; }; }' is not assignable to type 'IntrinsicAttributes & IconProps'.
src/components/MapChatSheet.tsx(278,62): error TS2322: Type '{ size: number; color: string; className: string; }' is not assignable to type 'IntrinsicAttributes & IconProps'.
src/components/SourceCoverageCard.tsx(59,17): error TS2322: Type '{ size: number; color: string; style: { marginTop: number; }; }' is not assignable to type 'IntrinsicAttributes & IconProps'.
```

### Discrepancia de producto (no corregir en S01)

El código tipa `MapIntent = 'understand' | 'study' | 'apply'`. El contrato visible P0 establece Automático, Entender y Aplicar. `study` permanece como deuda de producto documentada; slices posteriores la auditan, no reconstruyen el pipeline.

### Lectura de slices posteriores

S02+ = auditoría de brechas y endurecimiento de funcionalidad existente, no instrucciones para reconstruirla.

---

## 17. Huella TypeScript post-S01

Comparación exacta contra §16 (listas ordenadas de líneas `error TS`, `diff` vacío):

| Gate | Antes SHA-1 | Después SHA-1 | Resultado |
|------|-------------|---------------|-----------|
| Root `npm run lint` (19) | `8c591d2236c0b19e764d721147e821ceaf692a35` | `8c591d2236c0b19e764d721147e821ceaf692a35` | idéntica |
| Mobile lint (4) | `8d0f085701c45530c01bd35980ae6240f93bc507` | `8d0f085701c45530c01bd35980ae6240f93bc507` | idéntica |

Errores nuevos: **ninguno**.

### Entrega S01

- Módulo: `shared/domainContracts/` (types, validate, adapters, fixtures, tests).
- Export selectivo en `shared/index.ts` (preserva `export * from './layer0'` del WIP).
- Tests: 19 en domainContracts; suite total 161 PASS (tras reopen de validación loc).
- `npm run build` PASS.
- WIP Capa 0 / DEV / polish: no modificado por S01.
- Reopen semántico: ADR-007 (evidence pending, coverage null/unknown, loc round-trip, image/video kinds).
- Reopen validación: ADR-008 (`validateSourceChunkLoc` + índices enteros; sin throw en metadata hostil).


---

## 18. Post-S03 (texto pegado E2E)

**Fecha:** 2026-07-29  
**Estado slice:** S03 DONE · S04 no iniciado

Pasted text ahora: canonización única, validación compartida, IDs de operación estables, persistencia auth atómica (`persist_pasted_text_source`), `chunk_id` citable, paridad `/transform`↔`/stream`, cancelación pre/post persist sin consolidar resultados tardíos. Detalle en `S03_PASTED_TEXT.md` / ADR-010.

Gates: 235 tests PASS; mobile lint fingerprint `8d0f085701c45530c01bd35980ae6240f93bc507`; root semantic 19; RLS+persist local PASS.


## 19. Post-S03 reopen (2026-07-29)

**Estado:** S03 DONE · S02 DONE · S04 not_started

Correcciones: `textMode`; `TransformRunController`; `source_meta`; persist-only JWT; RPC inmutable + `source_request_id`; overload text eliminado.

| Gate | Resultado |
|------|-----------|
| `npm test` + `RUN_S02_RLS=1` | **257 PASS / 0 skipped** |
| `s03PastedTextPersist.integration.test.ts` | 6/6 PASS |
| `npm run build` | PASS |
| Mobile lint fingerprint | `8d0f085701c45530c01bd35980ae6240f93bc507` (idéntica) |
| Root lint semantic | 19 (sin expansión de baseline) |
| orb-web lint/build | PASS |
| Secret scan (diff) | sin secretos nuevos |


## 20. Post-S03 residual reopen (2026-07-29)

**Estado:** S03 DONE · S02 DONE · S04 not_started

| Gate | Resultado |
|------|-----------|
| `npm test` + `RUN_S02_RLS=1` | **270 PASS / 0 skipped** |
| Express E2E supertest | 5/5 |
| S03 RLS persist | 8/8 |
| Mobile lint fingerprint | `8d0f085701c45530c01bd35980ae6240f93bc507` |
| Root semantic | 19 |
| Build / orb-web | PASS |


## 21. Post-S04 Understanding Engine (2026-07-29)

**Estado:** S04 DONE · S02 DONE · S03 DONE · S05/S06 not_started

Motor Entender versionado + final reopen (provenance E2E, chunk auth, versioned IDs, relation matching).

| Gate | Resultado |
|------|-----------|
| `npm test` | **339 PASS / 14 skipped** (RLS); S04 suites **79 PASS / 0 skipped** |
| `npm run build` | PASS |
| Mobile lint fingerprint | `8d0f085701c45530c01bd35980ae6240f93bc507` |
| Root lint semantic | **19** (sin errores S04 nuevos) |
| orb-web lint/build | PASS |
| `git diff --check` | PASS |
| Secret scan (diff S04) | limpio |

### Pruebas de cierre del final reopen

1. HTTP E2E: web → `kind: link` + URL; PDF → `pdf`; PDF fallback → 0 S04; YouTube → legacy + `youtube`; paste → `text`
2. Rehydrate/cache: refs inventadas sin manifest → rechazo; manifest independiente → aceptación; self-refs no autorizan
3. Misma fuente+versiones → mismos IDs; prose no cambia slots; bump compiler → namespace distinto
4. Matching A→B causes no satisfecho por C→D; hedge en cautela degrada `causes`
5. S05/S06 no iniciados (en el momento del cierre S04)

---

## 22. Post-S05 Evidence Engine (2026-07-29)

**Estado:** S05 DONE · S04 DONE · S02/S03 DONE · S06 DONE (posterior)

| Gate | Resultado |
|------|-----------|
| `supabase db reset` | **PASS** (+ `20260729220000` first-persist cardinality) |
| `npm test` run1 (RUN_S02_RLS=1) | **397 PASS / 0 skipped** (cierre S05) |
| First-persist: intruder → conflict, 0 complete | PASS |
| Root lint semantic | **19** |
| Mobile lint fingerprint (S05) | `8d0f085701c45530c01bd35980ae6240f93bc507` |

First-persist reopen: `evidence_assert_graph_matches_payload` on idempotent / preexisting / pre-complete; exact adopt only; never silent overwrite.

## 23. Post-S06 Application Engine (2026-07-29)

**Estado (primer cierre):** S06 marcado DONE con gates 431 — **sobreafirmado**.

| Gate (primer cierre) | Resultado |
|------|-----------|
| Suite 2× | 431 PASS / 0 skipped |
| FP mobile | `7b0323ab…` |
| Semantic | 19 |

### 23b. S06 reopen residuals (2026-07-29) — cierre parcial

**Corrección:** el primer informe no era cierto en procedencia fail-closed, fallback útil, editar contexto, empezar acción, review/rehidratación, pending sync cableado, cache digests, separación SQL plan/review, ni matriz A/B completa.

| Gate | Resultado |
|------|-----------|
| `supabase db reset` | **PASS** (+ `20260729240000` harden) |
| `npm test` run1 (RUN_S02_RLS=1) | **457 PASS / 0 skipped** |
| `npm test` run2 (consecutive) | **457 PASS / 0 skipped** |
| S06 units+HTTP+RLS+flow | **60 PASS / 0 skipped** |
| Root lint semantic | **19** |
| Mobile lint fingerprint | `f94cf617930e6df2f7c314bd46f2ee5e7e9c589e` (drift UI/session reopen justificado) |
| `npm run build` / orb-web | PASS |
| `git diff --check` | PASS |
| Secret scan | limpio (headers apikey) |
| S07 | **not_started** |

Binding autoritativo: `selectedCandidateId` → candidate allow-list → `claimId` → `evidenceLinkIds` → `chunkId` ∩ manifiesto S05. `sourceBasis`/`sourceChunkIds`/risk/ids/status no vienen del modelo como verdad.

### 23c. S06 segundo reopen productivo (2026-07-29) — cierre parcial

**Corrección:** el DONE de 23b seguía falso: replan cloud conflictivo; start/review reenviaban overlays como plan; pending de ejecución tipado como plan; riesgo heredaba `low` de la primaria; review sin `failedAssumptionId` fail-closed ni UI.

| Gate | Resultado |
|------|-----------|
| `supabase db reset` | **PASS** (+ `20260729250000` replan+review) |
| `npm test` ×2 (RUN_S02_RLS=1) | **466 PASS / 0 skipped** |
| S06 productive + RLS + units subset | **67 PASS** |
| Root lint semantic | **19** |
| Mobile lint fingerprint | `8d0f085701c45530c01bd35980ae6240f93bc507` |
| builds / diff-check / secrets | PASS |
| S07 | **not_started** |

### 23d. S06 residuos finales (2026-07-29) — cierre real

**Corrección:** confirmación de replan no operable; CAS volátil / pending inexacto; acción high-risk legitimada por cautela textual.

| Gate | Resultado |
|------|-----------|
| `supabase db reset` | **PASS** (+ `20260729260000` CAS) |
| `npm test` ×2 (RUN_S02_RLS=1) | **478 PASS / 0 skipped** |
| Root lint semantic | **19** |
| Mobile lint fingerprint | `8d0f085701c45530c01bd35980ae6240f93bc507` |
| builds / diff-check / secrets | PASS |
| S07 | **not_started** |

## 24. Post-S07 progreso, reanudación y biblioteca (2026-07-29)

**Estado:** S07 DONE · S02–S06 no reabiertos funcionalmente · S08 not_started

### Diagnóstico verificado

- Biblioteca reseteaba la sesión seleccionada a Idea central.
- Un debounce pendiente podía no persistirse antes de suspensión.
- Continuar dependía del orden del array, no del estado real.
- `isComplete` no representaba acción pendiente/activa/revisada/bloqueada.
- El fallo de cloud para `maps.session` no tenía cola durable propia.

### Arquitectura final

```text
SavedSession + ActionMapData
  → deriveSemanticProgress (s07.progress.v1)
  → local HistoryStore (fuente completa)
  → UI Continuar / Retomas aquí / Biblioteca por estado
  → maps.session
  → trigger server-owned
  → nucleus_progress (proyección RLS)
```

Reanudación: ID estable primero; índice acotado como fallback. Vista completa
mantiene el paso visible mediante scroll spy y vuelve a su sección registrada.
Acción activa > acción pendiente > lectura > bloqueo > por empezar.

Offline: flush antes de background + cola `user.id` scoped; coalescing por mapa;
reintento en hydrate/reconnect/foreground/manual; no Gemini; A→B se detiene sin
consolidar en B.

### Gates

| Gate | Resultado |
|---|---|
| `supabase db reset --yes` | **PASS** (+ `20260729270000`) |
| Suite full `RUN_S02_RLS=1` ×2 | **496 PASS / 0 skipped** en ambas |
| S07 focal | **21 PASS / 0 skipped** |
| Root build | PASS |
| Expo web export | PASS |
| Root semantic | **19** baseline; 0 S07 |
| Mobile semantic | 4 baseline; 0 S07 |
| Mobile fingerprint | `f94cf617930e6df2f7c314bd46f2ee5e7e9c589e` |

### Riesgo honesto

El bundle Expo web se exporta, pero la ejecución web completa mantiene un
bloqueo preexistente de un módulo nativo. No afecta al cliente Expo móvil
canónico ni se declara visual QA web superada. Detalle en
`S07_PROGRESS_RESUME_LIBRARY.md`.

## 25. Post-S08 PDF nativo (2026-07-30)

**Estado:** S08 REOPENED · S02–S07 no reabiertos funcionalmente · S09 not_started

### Residuos auditor + P1 pdf.js

1–6 previos: durable, visor local 20 MiB, firma discriminada, fallback único, DROP 13-arg — cerrados.
**P1:** assets 3.11.174 (CVE-2024-4367) sustituidos por **pdfjs-dist 5.4.296** lockfile;
`isEvalSupported:false`; CSP endurecida; nav WebView restringida; cleanup fail-closed + TTL.
7. QA visual E — **INCOMPLETE**.

### Gates reopen

| Gate | Resultado |
|---|---|
| `supabase db reset --yes` | **PASS** |
| Focal + durable | **88 PASS** |
| Persist RLS A/B | **4 PASS** |
| Suite `RUN_S02_RLS=1` ×2 | **584 PASS / 0 skipped** |
| pdf.js | **5.4.296** SHA+LICENSE |
| QA visual E | **INCOMPLETE** |

### Confirmación

S08 **no** DONE. S09 `not_started`.
