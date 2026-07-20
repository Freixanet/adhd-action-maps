# AUDIT re-audit — Nucleo · 20 jul 2026

**Alcance:** `mobile/` (canónico) + `server.ts` + `shared/` + `supabase/` + smoke iPhone físico + design system vs SPEC §3.  
**Baselines:** [`AUDIT.md`](../AUDIT.md) (2 jul), [`docs/ui-audit/aesthetics.md`](./ui-audit/aesthetics.md) (1 jul), [`SPEC.md`](../SPEC.md), [`ARCHITECTURE.md`](../ARCHITECTURE.md).  
**Método:** lectura estática + Vitest + API LAN + launch `com.freixanet.nucleo` → Metro `192.168.1.16:8081` + revisión de capturas `docs/ui-audit/screens/`.  
**Sin cambios de código** en esta sesión.

Severidades: crítico · alto · medio · bajo.

---

## 0. Resumen ejecutivo

La app móvil ha madurado de producto (lectura, swipe, colecciones, draft, NetInfo, icono de marca) y el glass nativo es real. **No está lista para release de pago**: la API LLM sigue abierta sin JWT ni free-3/día; Supabase de EAS/env está **muerto** (NXDOMAIN); faltan borrado de cuenta, privacidad, paywall/RevenueCat. En diseño, identidad glass+dark es fuerte, pero tokens no se cumplen (hex sprawl, CTA radius, orbe átomo, ProfileMenu light, chips en composer).

| Pilar | Nota 1–5 | Veredicto |
|-------|----------|-----------|
| Seguridad / abuso | **1.5** | LLM público; SSRF; Supabase muerto |
| Producto vs SPEC | **3.0** | Núcleo lectura OK; Home/monetización/legal flojos |
| ADHD / a11y | **3.0** | Cap pasos + draft OK; Dynamic Type y Home next-action flojos |
| Estética / design system | **2.5** | Glass premium; sistema formal incumplido |
| Ingeniería | **2.5** | 28 tests, 0 CI; monolitos crecieron |

**Top 10 backlog (impacto release):**

1. JWT obligatorio + metering free 3/día (+ Pro) en servidor  
2. Restaurar / rotar proyecto Supabase (URL+keys EAS + `.env`)  
3. SSRF harden `fetchUrlContent` + cap body remoto  
4. Borrado de cuenta in-app (Guideline 5.1.1(v))  
5. Política de privacidad + links en perfil/paywall  
6. Paywall UI + RevenueCat (quitar allowlist como “Pro”)  
7. ProfileMenu iconos theme-aware (light)  
8. CTA paso: `RADII.lg` (24) + token `#6A6FE0`  
9. Orbe de carga: glifo núcleo (sin órbitas React)  
10. Home: card Continuar + Recientes; quitar/relocar chips composer no-SPEC  

---

## 1. Delta vs AUDIT.md (2 jul → 20 jul)

### Cerrado o claramente mejor

| ID | Estado | Evidencia |
|----|--------|-----------|
| C-14 Classic móvil | **Cerrado** | Sin `mobile/.../classic/` ni AppVariant móvil |
| Capacitor legacy | **Cerrado** | Sin `capacitor.config` / ios Capacitor en raíz |
| V-06 icono app | **Cerrado** | `AppIcon.tsx` anillo+disco; assets nucleus |
| C-08 offline | **Parcial** | `SessionErrorBanner` consume NetInfo |
| C-23 tests | **Parcial** | Vitest: **28/28 pass**; **0** workflows CI |
| C-04 delimitadores fuente | **Mejorado** | `<<<FUENTE>>>` + safety prefix en text/link |
| C-11 timeouts Gemini | **Parcial** | 60s/120s en generate; stream body sin techo |
| Lectura SPEC 5.4 | **Mejorado** | Swipe, `~N min`, self-check, secciones, cap 9 |
| Draft composer | **Cerrado** | `composerDraft.ts` |
| Colecciones 6.7 | **Presente** | `shared/collections` + UI historial |

### Sigue abierto (críticos/altos)

| ID | Estado | Nota |
|----|--------|------|
| **C-01** | Abierto | Auth opcional **nunca gatea**; IP RL 10/10min; analyze sin RL; stream **200 sin JWT** (smoke 20 jul) |
| **S-01** | Abierto | Sin delete account |
| **S-02** | Abierto | Sin privacidad in-app |
| **C-02** | Abierto | Link fetch sin bloqueo IP privadas / rebind |
| **C-03** | Abierto | `express.json` 50mb; HTML remoto sin byte-cap previo |
| Paywall / RC | Abierto | Solo stub `paywallOpen`; Pro = email allowlist |
| C-23 CI | Abierto | Sin `.github/workflows` |
| V-06 orbe | Abierto | Loading orb sigue 3 órbitas |
| Web Classic fork | Abierto | `src/ClassicApp.tsx` ~2.6k LOC |

### Nuevos / empeorados

| ID | Sev | Hallazgo |
|----|-----|----------|
| **N-01** | crítico | Supabase `oxvfiyuljzchdjotyshl.supabase.co` = **NXDOMAIN** (eas.json + mobile `.env`) → `AuthRetryableFetchError` en device |
| **N-02** | alto | Monolitos: `server.ts` ~3349; `AppSessionContext` ~2593 |
| **N-03** | medio | `authenticateOptional` / `isPro` en request **sin uso** → falsa sensación de P7 |
| **N-04** | medio | `GenerationModeChip` (Estándar/beta) en composer — ruido vs AGENTS/SPEC |
| **N-05** | bajo | Galería `docs/ui-audit/screens`: varios PNG dark con **mismo tamaño/contenido cruzado** (nombres poco fiables) |

---

## 2. Pilar A — Seguridad / abuso

### Crítico

**C-01 — LLM público sin metering**  
- `authenticateOptional` (`server.ts` ~99–114) no rechaza.  
- `/api/transform`, `/stream`, analyze: sin JWT requerido.  
- Smoke LAN: `POST /api/transform/stream` con texto → **HTTP 200** sin `Authorization`.  
- Free 3/día: solo SPEC; no `usage_daily`.  
- Rate limit: Map in-memory por IP (10/10min); analyze **sin** RL; sin `trust proxy`.

### Alto

**C-02 — SSRF** (`fetchUrlContent` ~2700+): solo protocolo http(s); redirects por defecto; sin RFC1918/metadata.  
**C-03 — Tamaño:** JSON 50MB; `response.text()` completo antes de truncar a 120k.  
**N-01 — Supabase muerto** en EAS preview/production + local.

### Medio

- Cheatsheet prepare/pdf: sin auth ni ownership fuerte; CPU/PDF forge.  
- Chat: sin auth; `map` client-supplied; sin delimitadores fuente.  
- `depth: profundo` / 32k tokens no gated por Pro en server.  
- Anon key commitada en `eas.json` (rotación difícil; proyecto muerto).

### Bajo / positivo

- RLS maps (`supabase/migrations/20260621_initial_sync.sql`): owner-only sólido.  
- Gemini key solo servidor.  
- Delimitadores fuente en transform texto.

---

## 3. Pilar A — Producto vs SPEC

| SPEC | Estado | Nota |
|------|--------|------|
| 5.1 Continuar card | Parcial | `ContinueChip` pill, no card + progreso |
| 5.1 Recientes home | Ausente | Solo en sidebar |
| 5.1 Entender/Aplicar | Parcial | Pill header (OK producto actual); SPEC pedía en composer |
| 5.1 Sin model selector | Parcial | Sin LLM picker; sí `ModelChip` depth + `GenerationModeChip` |
| 5.2 Generación | Presente | Inline thread + orb |
| 5.3 Intro | Parcial | CTA copy distinto (“Ver En 60s”) |
| 5.4 Lectura | Presente | Swipe, remaining, callouts tint, sections, self-check, ≤9 |
| 5.5 Completado | Parcial | Varios CTAs peso similar + “Crear mapa”; PDF no full-width primario |
| 5.6–5.7 Sidebar/search | Presente | Índice, recientes, incompletos, categorías |
| 5.8 Paywall | Ausente | Stub only |
| 6.3 PDF | Parcial | Share funciona; branding Pro no |
| 6.4 Share ext | Ausente | |
| 6.5 RevenueCat | Ausente | Allowlist `proEntitlement` |
| 6.6 Notifs | Ausente | |
| 6.7 Collections | Presente | |
| Legal delete/privacy | Ausente | Bloquea review |
| Offline | Parcial | Banner; copy ≠ SPEC |

`ARCHITECTURE.md` §3 está **desactualizado** (marca ausentes features ya presentes).

---

## 4. Pilar B — Design system (SPEC §3)

### Scores (1–5)

| Área | 1 jul (aesthetics) | **20 jul** | Comentario |
|------|--------------------:|-----------:|------------|
| Identidad / marca | 4.5 | **3.5** | Icono OK; orbe carga aún átomo; wordmark grabado ≠ tracking SPEC |
| Tokens | 2.5 | **3.0** | §3.1 en `uiTokens`; tipografía/spacing no tokenizados; ~44 hex sueltos |
| Tipografía | 3.5 | **2.5** | Mucho `text-[10–15px]`; chips `allowFontScaling={false}` |
| Color / contraste | 3.0 | **2.5** | Light greys + ProfileMenu `#FAFAFA`; wordmark light muy débil |
| Radios / forma | 3.0 | **2.0** | CTA `RADII.md` 16 ≠ 24; Glass/Composer 20/26 |
| Espaciado | 3.0 | **3.0** | `px-5` OK; footer `px-7`, safe +16 ≠ +8 |
| Glass / elevación | 4.0 | **4.0** | `expo-glass-effect` real + fallback BlurView |
| Microdetalles | 3.5 | **2.5** | Callouts sin borde 3px; motion budget excedido |

### Hallazgos diseño (V)

1. **V-A** Color no enforceable — hex fuera de tabla §3.1.  
2. **V-B** CTA paso: fill `#6A6FE0` OK, radius **16** (debe 24).  
3. **V-C** Loading brand: órbitas React en `ExactLiquidOrbWebView` / orb-web.  
4. **V-D** `ProfileMenu`: `menuIconColor = TEXT_PRIMARY` siempre → icons casi invisibles en light.  
5. **V-E** Composer: chips depth + generation (conflicto AGENTS).  
6. **V-F** Tipografía ad hoc; Dynamic Type roto en chips.  
7. **V-G** Callouts: tint 5% OK; **falta borde izquierdo 3px** SPEC/FASE 1.  
8. **V-H** Reduced-motion: step transition corte duro (SPEC pide fade 150ms).  
9. **V-I** Motion decorativo (orb, sheen, glow) vs “nada más se anima”.  
10. **V-J** Completado: 4–5 CTAs + primario “Crear mapa” — jerarquía ADHD débil.  
11. **V-K** Home light: wordmark “nucleo” contraste muy bajo.  
12. **V-L** Light mode: fondos drawer/canvas aún pueden divergir (aesthetics #2).

### Pantalla a pantalla (código + capturas)

| Pantalla | Dark | Light | Notas estéticas |
|----------|------|-------|-----------------|
| Home | Composición limpia; pill Entender; composer glass; chip Estándar | Wordmark casi invisible; hero vacío sin Continuar/Recientes | Falta next-action ADHD |
| Loading | Orbe glass + fases + Cancelar — fuerte | — | Interior debería ser glifo núcleo |
| Lectura | Tipografía clara; bullets accent; footer Atrás/Completar | — | CTA radius off-spec |
| Completado | — | Cards + fila CTAs iguales + Crear mapa | Viola P5 / una acción primaria |
| Drawer | — | Índice + recientes + profile menu | Icons login light problemáticos |

---

## 5. Live smoke (20 jul 2026)

| Check | Resultado |
|-------|-----------|
| Metro LAN `192.168.1.16:8081` | `packager-status:running` |
| Backend `:3000` | HTTP 200 |
| Device | iPhone 17 Pro Max paired; app `com.freixanet.nucleo` launched con deep link Metro |
| Supabase DNS | **NXDOMAIN** `oxvfiyuljzchdjotyshl.supabase.co` |
| `POST /api/transform/stream` sin auth | **HTTP 200** (quema LLM) |
| Vitest | **28/28** passed |
| Segunda app `com.marcfreixanet.nucleo.dev2026` | Firma inválida / no confiar — ignorar |

---

## 6. Lo que está bien

- Identidad Liquid Glass nativa (`expo-glass-effect`) con gates de accessibility.  
- Flujo lectura ADHD maduro (progreso, remaining, self-check, secciones, cap 9).  
- Icono / splash / `AppIcon` ya no son el logo React.  
- Delimitadores de fuente + timeouts de arranque Gemini.  
- RLS Supabase (cuando el proyecto exista).  
- Shared tests reales (pipeline + collections).  
- Classic móvil y Capacitor eliminados.  
- Composer isolation / FlashList historial (baseline previo).

---

## 7. Backlog priorizado (mezcla ingeniería + diseño)

### P0 — bloquea dinero / review / datos

1. Auth JWT + usage metering (free 3/día, Pro fair-use) en todos los endpoints LLM.  
2. Nuevo proyecto Supabase + rotar keys en EAS/env; verificar RLS.  
3. Account deletion + privacy/terms URLs.  
4. SSRF + caps de body en link fetch.

### P1 — producto shippable

5. Paywall + RevenueCat; retirar allowlist como fuente de verdad.  
6. Home Continuar card + Recientes.  
7. Completado: un CTA primario (“Nuevo Núcleo”), secundarios en menú/overflow.  
8. Relocar/eliminar `GenerationModeChip` del composer.

### P2 — design system polish

9. ProfileMenu theme icons; CTA radius 24; token `#6A6FE0`.  
10. Orbe = glifo núcleo; callout border 3px.  
11. Hex lint / tipografía roles; Dynamic Type en chips.  
12. Reduced-motion fades 150ms en pasos.

### P3 — higiene

13. CI (test + mobile lint).  
14. Partir `server.ts` / `AppSessionContext`.  
15. Actualizar `ARCHITECTURE.md`; limpiar capturas ui-audit duplicadas.  
16. Web Classic: archivar o marcar explícitamente legacy-only.

---

## 8. Fuentes

- Código: `server.ts`, `mobile/src/**`, `shared/uiTokens.ts`, `mobile/eas.json`  
- Docs: `AUDIT.md`, `SPEC.md` §3/§5, `docs/ui-audit/aesthetics.md`  
- Capturas: `docs/ui-audit/screens/mobile/comprension/*`  
- Runtime: Metro/API `192.168.1.16`, device UDID `00008150-001128EC0CEA401C`
