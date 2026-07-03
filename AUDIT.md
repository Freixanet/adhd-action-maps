# AUDIT.md — Auditoría exhaustiva de nucleo

**Fecha:** 2 jul 2026 · **Alcance:** repo completo contra `SPEC.md` v1.1 y estándar de apps top 2026 · **Método:** lectura estática + capturas de simulador previas (`docs/ui-audit/`) · Sin cambios de código.

Severidades: 🔴 crítico (bloquea release o quema dinero/datos) · 🟠 alto · 🟡 medio · 🟢 bajo.

---

## RESUMEN CONSOLIDADO (todos los hallazgos por severidad)

Detalle completo de cada ID en su sección (B1-B8). Columna "Fase" = dónde se resuelve según PLAN.md.

| ID | Sev | Área | Hallazgo (una línea) | Fase |
|----|-----|------|----------------------|------|
| C-01 | 🔴 | Seguridad | API LLM pública sin auth ni metering; free 3/día inaplicable en servidor | P7 |
| R-01/02 | 🔴 | Coste | Free intensivo ≈$5.4/mes y Pro "ilimitado" hasta $45/mes: no cierra sin fixes R-03..R-06 | P7 |
| S-01 | 🔴 | Legal | Sin borrado de cuenta en la app (Guideline 5.1.1(v)) — bloquea review | P9 |
| S-02 | 🔴 | Legal | Sin política de privacidad (stores + GDPR) | P10 |
| C-23 | 🔴 | Código | Cero tests, cero CI en todo el repo | P4 |
| C-02 | 🟠 | Seguridad | SSRF en type:link (sin bloqueo de IPs privadas) | P1.5 |
| C-03 | 🟠 | Seguridad | Sin techo de tamaño de texto/HTML remoto (body 50 MB) | P1.5 |
| C-08 | 🟠 | Robustez | Offline detectado (NetInfo) pero ningún componente lo consume | P9 |
| C-13 | 🟠 | Arquitectura | Triple plataforma: web fork 3.309 líneas + ClassicApp muerto + Capacitor legacy | P0 |
| C-14 | 🟠 | Arquitectura | Fork Clásica móvil (3 pantallas + switch en Ajustes) | P0 |
| V-01 | 🟠 | Visual | Paleta entera fuera de SPEC §3.1 (~35 hex hardcodeados) | P0 |
| V-02 | 🟠 | Visual | CTA primario glass/blanco en vez de sólido accent con texto oscuro (§3.3) | P0/P1 |
| V-06/S-06 | 🟠 | Marca | El glifo es el logo de React (icono, splash, orbe) | P0 |
| V-08 | 🟠 | Contraste | Placeholders y labels 11px a ~3.4:1 — falla AA | P0 |
| V-11/A-08 | 🟠 | Visual/ADHD | Completado con 5 CTAs de peso idéntico (viola P5) | P3 |
| A-04 | 🟠 | ADHD | CTA "Empezar a leer" cortado por safe area — acción primaria rota | P1 |
| M-01 | 🟠 | Motion | Sin transición entre pasos (cambio seco) | P1 |
| M-02 | 🟠 | Motion | Completado sin ceremonia ni haptic success | P3 |
| X-01 | 🟠 | A11y | Dynamic Type roto de facto (~20 archivos con px fijos) | P9 |
| X-02 | 🟠 | A11y | Huecos VoiceOver: filtro categorías, quitar-adjunto, chips chat; sin announce de paso | P9 |
| S-03/S-04/S-05 | 🟠 | Legal | Privacy labels sin definir; verificar tier pagado Gemini; paywall sin links legales | P7/P10 |
| R-04/R-05/R-06 | 🟠 | Coste | Sin cap de fuente; profundo a 32k tokens; sin fair-use Pro | P1.5/P7 |
| C-04 | 🟡 | Seguridad | Prompt injection sin delimitadores; en media el texto usuario precede al contrato | P1.5 |
| C-05 | 🟡 | Seguridad | Validación incompleta: type/mimeType sin enum, sourceLabel sin sanear | P1.5 |
| C-06 | 🟡 | Seguridad | Cheatsheet sin rate limit ni ownership | P1.5 |
| C-09 | 🟡 | Robustez | JSON.parse sin catch → 500 genérico sin reintento | P4 |
| C-10 | 🟡 | Robustez | saveHistory falla en silencio (quota) | P9 |
| C-11 | 🟡 | Robustez | Llamadas Gemini sin timeout | P1.5 |
| C-15 | 🟡 | Código | 7+ componentes huérfanos (orbes, ModelSelector, NucleoIcon) | P0 |
| C-16 | 🟡 | Código | server.ts monolito 2.830 líneas; PDF duplicado GET/POST; función muerta | P1.5 (parcial) |
| C-17 | 🟡 | Código | 18+ scripts basura en raíz del repo | P0 |
| C-19 | 🟡 | Rendimiento | Arranque frío: hidratación total AsyncStorage + Skia inmediato | P9 |
| C-20 | 🟡 | Rendimiento | Vista completa sin virtualizar (riesgo baja con tope 9 pasos) | P4 (observar) |
| V-03/04/05 | 🟡 | Visual | Tipos (11 tamaños), espaciado y radios (8 valores) fuera de escala §3.2/3.3 | P0 |
| V-10 | 🟡 | Contraste | Texto blanco sobre indigo glass ~3.8:1 en CTA | P0 |
| V-12 | 🟡 | Visual | Home sin card Continuar/Recientes (sin "siguiente acción") | P2 |
| V-13 | 🟡 | Visual | Lectura sin medida de línea ni escala §3.2 | P1 |
| M-03/04 | 🟡 | Motion | Sin check de paso/sección; scramble ignora reduced motion | P1/P2 |
| A-03 | 🟡 | ADHD | Borrador del composer no persiste al cerrar la app | P2 |
| A-05 | 🟡 | ADHD | Falta "~N min restantes" en lectura | P1 |
| A-06 | 🟡 | ADHD | Mapas "decenas de pasos" posibles hoy (inacabables) | P4 |
| A-07 | 🟡 | ADHD | Vista completa = modo abrumador (se conserva, default correcto) | — |
| X-03 | 🟡 | A11y | Targets <44pt: send chat 32px, quitar-adjunto ~24pt | P9 |
| X-04 | 🟡 | A11y | Reduced motion con huecos (scramble; nuevas animaciones deben nacer con gate) | P1..P9 |
| S-07 | 🟡 | Legal | Scraping YouTube frágil/zona gris ToS (riesgo aceptado, degradar con error tipado) | P4 |
| S-08 | 🟡 | Stores | Falta ITSAppUsesNonExemptEncryption en app.json | P9 |
| S-09 | 🟡 | Legal | GDPR: registro de encargados y supresión (con S-01/S-02) | P10 |
| R-07/08 | 🟡 | Coste | Sin dedupe de transforms ni registro de tokens reales | P7 |
| F-01 | 🟡 | i18n | Strings hardcodeados sin capa i18n (encarece localizar después; no bloquea v1) | — |
| C-07 | 🟢 | Seguridad | Anon key commiteada en eas.json (pública por diseño; mover a secrets) | P0 |
| C-12 | 🟢 | Código | dismissTransformIncomplete muerto; banner sin cierre | P2 |
| C-18 | 🟢 | Código | Helper timeout duplicado móvil/shared | P0 |
| C-21/22 | 🟢 | Rendimiento | Orbe WebView (aceptable); ScrambleText rAF por carácter | P2 |
| V-07 | 🟢 | Visual | Callouts sin sistema borde-3px/4 tipos | P1 |
| V-14 | 🟢 | Visual | Chips/divisores planos vs cards glass | P1 |
| A-01/02/09/10 | 🟢 | ADHD | Botón dev visible; renombrar al final del menú; variante en Ajustes | P0/P2 |
| M-05/06 | 🟢 | Motion | Specs de motion para Continuar y paywall (definidas en B3.2) | P2/P7 |
| X-06 | 🟢 | A11y | TalkBack sin QA (Android nunca probado) | P11 |
| S-10 | 🟢 | ASO | Nombre genérico; título/keywords/capturas propuestos en B7 | P10 |
| R-09/10 | 🟢 | Funnel | Trigger post-completado suave; recordatorio fin de trial | P7/P8 |

Lo que está bien (una línea cada uno): manejo del stream parcial→banner incompleto; aislamiento del composer para re-renders; FlashList en historial; cobertura VoiceOver del flujo principal tras el pase reciente; gate reduced-motion del stack glass; key de Gemini solo en servidor; RLS de Supabase; wordmark Skia y orbe de carga a nivel de marca top.

---

## B1. CÓDIGO

### B1.1 Seguridad

| ID | Sev | Hallazgo | Ubicación | Por qué es problema | Fix |
|----|-----|----------|-----------|---------------------|-----|
| C-01 | 🔴 | **API LLM sin auth ni metering por usuario.** `authenticateOptional` setea `req.userId` y nunca se usa; chat y cheatsheet ni siquiera autentican. Rate limit solo por IP (10 req/10 min, en memoria, se resetea al reiniciar y no cubre réplicas). | `server.ts:59-72` (userId sin uso), `2664-2809` (rutas sin auth), `47-57` (bucket IP) | Cualquiera con la URL pública genera Núcleos gratis a tu coste; el límite free 3/día de SPEC §6.5 es inaplicable server-side. | Exigir JWT Supabase en transform/chat; contador por `userId` en Postgres; el free gate vive en servidor, no en cliente. Bloqueante para FASE 7 (monetización). |
| C-02 | 🟠 | **SSRF en `type: "link"`**: el servidor hace fetch de URLs arbitrarias http/https sin bloquear IPs privadas/metadata (169.254.169.254, 10.x, localhost). | `server.ts:2360-2411` | En Railway puede exponer metadata interna o escanear red interna. | Resolver DNS y rechazar rangos privados/link-local antes del fetch; allowlist de esquemas ya existe. |
| C-03 | 🟠 | **Sin límites de tamaño en texto/HTML remoto:** body JSON hasta 50 MB (`express.json limit`), HTML de URL se carga entero sin cap; upload cap 15 MB solo aplica a `fileData`. | `server.ts:2573`, `2389`, `1410-1412` | Coste LLM y memoria sin techo con una sola petición. | Cap de caracteres del texto fuente (p. ej. 200k chars) + truncado declarado en `limitations`; bajar `express.json` a 20 MB. |
| C-04 | 🟡 | **Prompt injection estructural:** contenido de usuario concatenado tras "Contenido fuente:"; en imagen/vídeo el texto del usuario va ANTES del contrato; chat mete el map JSON del cliente entero. | `server.ts:1468`, `1450-1453`, `2688-2695` | Una fuente hostil puede redefinir instrucciones (romper P1 fidelidad o el JSON). | Delimitadores duros (`<<<FUENTE>>>…<<<FIN>>>`) + instrucción explícita de ignorar órdenes dentro de la fuente; en media, contrato siempre primero. |
| C-05 | 🟡 | **Validación de entrada incompleta:** `type` no se valida contra enum; `mimeType` sin allowlist ni coherencia con `type`; `sourceLabel` sin sanear va al prompt; historial de chat sin cap de longitud. | `server.ts:1414-1427`, `2290`, `2681-2685` | Superficie de abuso y de errores 500 opacos. | Validar enum de `type`, allowlist de mimetypes (pdf/jpeg/png/webp/mp4), cap de history a 6 turnos ya existe pero sin límite de chars — añadirlo. |
| C-06 | 🟡 | Cheatsheet endpoints sin rate limit y con IDOR débil: el POST acepta cualquier `map` del cliente; el GET lee del cache por id sin ownership. | `server.ts:2724-2809` | Generación de PDFs arbitrarios a tu coste CPU; fuga entre usuarios si adivinan ids del cache. | Rate limit + exigir auth cuando haya cuenta; ids de cache no adivinables ya (UUID) pero verificar. |
| C-07 | 🟢 | Anon key Supabase commiteada en `mobile/eas.json:24-33`. Aceptable (es pública por diseño, RLS activa) pero mejor inyectarla como secret EAS. | `mobile/eas.json` | Higiene; rotación más difícil. | Mover a EAS secrets. |

### B1.2 Robustez y manejo de errores

| ID | Sev | Hallazgo | Ubicación | Por qué | Fix |
|----|-----|----------|-----------|---------|-----|
| C-08 | 🟠 | **Offline detectado pero ignorado:** `NetworkStatusProvider` está montado y `useNetworkStatus()` no lo consume nadie. SPEC §7.3 exige estado sin conexión. | `mobile/App.tsx:85-87`, `NetworkStatusContext.tsx` (0 consumidores) | El usuario sin red recibe errores genéricos de fetch en vez del estado diseñado. | Banner offline global + deshabilitar submit con copy de SPEC §7.3. |
| C-09 | 🟡 | `JSON.parse` sin try/catch en el parseo principal del mapa → 500 genérico en vez del error tipado de 5.2. | `server.ts:1529` | El reintento con error en prompt que exige SPEC §6.1 no ocurre en esta ruta. | Envolver, reintentar 1 vez con el error incluido, luego error 5.2. |
| C-10 | 🟡 | `saveHistory` puede fallar (quota) y `commitHistoryStore` ignora el retorno; sin aviso al usuario. | `mobile/src/context/AppSessionContext.tsx:309-312`, `shared/history.ts:109-132` | Pérdida silenciosa de Núcleos guardados. | Toast/banner si `persist()` devuelve false. |
| C-11 | 🟡 | Sin timeout en llamadas Gemini (solo fetch de URL 15s y Supabase 5s). | `server.ts` (generateContent sin AbortSignal) | Peticiones colgadas retienen memoria/conexión y al cliente esperando. | AbortSignal a 120s (profundo) / 60s (resto). |
| C-12 | 🟢 | `dismissTransformIncomplete` exportado y nunca usado; banner incompleto no se puede cerrar sin actuar. | `AppSessionContext.tsx:545-547`, `IncompleteTransformBanner.tsx` | UX menor + código muerto. | Añadir X al banner o eliminar el handler. |

### B1.3 Arquitectura, duplicación, muerto

| ID | Sev | Hallazgo | Ubicación | Fix |
|----|-----|----------|-----------|-----|
| C-13 | 🟠 | **Triple plataforma fantasma:** web fork total (`src/ComprensionApp.tsx` 3.309 líneas + `ClassicApp.tsx` 2.637 muerto) + Capacitor legacy (`ios/App`, 7 deps `@capacitor/*`). Cada feature se paga 2-3 veces. | raíz, `src/`, `ios/` | Decisión de ARCHITECTURE.md §4: congelar web, borrar Capacitor y `ClassicApp.tsx`. |
| C-14 | 🟠 | Fork Clásica móvil: 3 pantallas duplicadas + switch en Ajustes, declarada descatalogada en SPEC §2. | `mobile/src/screens/classic/*`, `ProfileMenu.tsx:104-114`, `App.tsx:32-44` | Borrar carpeta, switch, `AppVariantContext` y `appVariant.ts` (FASE 0). |
| C-15 | 🟡 | Componentes huérfanos: `ModelSelector`, `NucleoIcon`, `InteractiveAtomOrb`→`AtomCanvasIcon`→`QuantumOrbView`, `LiquidGlassOrb(+Skia,+shared)`. | `mobile/src/components/` | Borrar (verificado 0 imports externos). |
| C-16 | 🟡 | `server.ts` monolito 2.830 líneas mezclando 7 responsabilidades; `estimateSourceComplexity` muerto (607-613); PDF duplicado GET/POST. | `server.ts` | Extraer módulos (prompts, quality, pdf, scraping) sin cambiar comportamiento; unificar ruta PDF. |
| C-17 | 🟡 | Basura en raíz del repo: `fix*.py` (7), `search_*.py` (9), `update_footer_animation.py`, `atom-demo/`, `atom-icon.html`, `NUCLEO_MOBILE_FULL_EXPORT.md` (258 KB). | raíz | Borrar; nada los referencia. |
| C-18 | 🟢 | Duplicación helper de timeout de red entre `mobile/src/logic/network.ts` y `shared/transformStream.ts:27-60`. | ambos | Unificar en shared. |

### B1.4 Rendimiento

| ID | Sev | Hallazgo | Ubicación | Fix |
|----|-----|----------|-----------|-----|
| C-19 | 🟡 | **Arranque frío:** hidratación completa de AsyncStorage (`getAllKeys`+`multiGet`) + Canvas Skia montado inmediatamente en Input. | `mobile/src/shims/localStorage.ts:8-21`, `EngravedNucleoMark.tsx` | Hidratar solo claves conocidas; diferir Skia un frame (el patrón `useDeferredGlassMount` ya existe, reutilizar). |
| C-20 | 🟡 | **Vista completa sin virtualizar:** un solo ScrollView renderiza intro + todos los pasos; con mapas de profundo actual (12+ pasos, "decenas") puede hacer jank. | `ResultScreen.tsx:460-477` | Con el tope de 9 pasos de SPEC §6.1 el riesgo baja; si persiste, FlashList con secciones. Prioridad tras FASE 4. |
| C-21 | 🟢 | Orbe de loading = WebView con HTML inline y animaciones CSS; coste de memoria/arranque de un WebView por carga. | `ExactLiquidOrbWebView.tsx`, `LoadingState.tsx:144` | Aceptable ahora; candidato a Skia puro si se toca el glifo (SPEC §3.4 ya obliga a tocarlo). |
| C-22 | 🟢 | `ScrambleText` anima por carácter con rAF, ignora reduced motion. | `LoadingState.tsx:30-56` | Gate con `reduceMotion` (ya disponible en el hook). |

### B1.5 Tests

| ID | Sev | Hallazgo | Fix |
|----|-----|----------|-----|
| C-23 | 🔴 | **Cero tests, cero framework, cero CI** en todo el repo. El pipeline de calidad (~600 líneas de heurísticas en server.ts) y la migración de datos de FASE 4 no tienen red. | Mínimo viable: Vitest en raíz para `shared/` (history, categories, transformStream parsing) + tests del contrato JSON del pipeline con fixtures; smoke E2E manual documentado. Añadir a FASE 4 como criterio. |

---

## B2. DISEÑO VISUAL

Referencias: capturas en `docs/ui-audit/screens/`, inventario estético en `docs/ui-audit/aesthetics.md`. SPEC §3 define la paleta destino (#0B0B0E base); el código actual usa #181A1F/#FAFAFA — la migración es FASE 0, así que aquí se audita (a) coherencia interna actual y (b) distancia contra SPEC §3.

### B2.1 Coherencia con SPEC §3

| ID | Sev | Hallazgo | Ubicación | Fix |
|----|-----|----------|-----------|-----|
| V-01 | 🟠 | **Paleta entera fuera de SPEC:** canvas `#181A1F`/`neutral-50`, acento indigo Tailwind (#4f46e5/#6366f1) vs `accent #8B8FF5`; no existen los 4 acentos semánticos (sem-matiz/ejemplo/alerta solo aproximados por amber/emerald/red sueltos). | `shared/uiTokens.ts`, `mobile/tailwind.config.js`, ~35 hex en `mobile/src` | FASE 0: tabla §3.1 como única fuente en uiTokens + tailwind extend; migrar los ~95 usos. |
| V-02 | 🟠 | **CTA primario viola §3.3:** los CTAs actuales usan texto blanco sobre indigo translúcido glass (StepFooterGlassButton accent), no texto #0B0B0E sobre `accent` sólido a 52px. | `StepFooterGlassButton.tsx`, `FloatingGlassButton.tsx:51-52` | FASE 0/1: variante CTA sólida según spec; el glass queda para superficies, no para el primario. |
| V-03 | 🟡 | **Tipografía fuera de escala:** 11 tamaños en uso (10-30px) vs 5 roles de §3.2; body actual 16px vs 17px/1.55; label 11px vs 13px. | inventario en `aesthetics.md` apéndice B | FASE 0: mapear cada uso a display/title/body/label/meta; los tamaños ad hoc desaparecen. |
| V-04 | 🟡 | **Espaciado fuera de escala:** px-3/px-4/px-5 (12/16/20) conviven; §3.3 fija padding global 20px y escala 4/8/16/24/32. | `InputScreen.tsx:64,177`, `ResultScreen.tsx:408-416` | FASE 0: px-5 (20px) global; gaps a escala. |
| V-05 | 🟡 | **Radios fuera de tabla:** 8 valores activos (12-26) vs §3.3 (16 cards / 12 chips / 24 CTA+input). Composer 26→24, menús 20→16, filas 14→12. | apéndice D de aesthetics.md | FASE 0 con la consolidación ya decidida en SPEC. |
| V-06 | 🟠 | **Marca:** el glifo es el logo de React (átomo 3 órbitas) en AppIcon, icono de app y splash. Riesgo legal/de identidad y §3.4 lo prohíbe. | `AppIcon.tsx`, `mobile/assets/icon.png`, `ExactLiquidOrbWebView` interior | FASE 0: glifo círculo+disco; assets de icono los genera Marc. |
| V-07 | 🟢 | Bloques semánticos: callouts actuales (action/info/alert) usan color solo en icono/label, sin borde izq 3px ni fondo `bg-surface` consistente; falta tipo "ejemplo". | `StepContentBlocks.tsx:19-21,38-65` | FASE 1 según §3.1/5.4. |

### B2.2 Contraste WCAG AA (combinaciones reales actuales, tema oscuro)

| Par actual | Ratio aprox | ¿AA? | Dónde | Nota |
|------------|-------------|------|-------|------|
| neutral-100 (#f5f5f5) sobre #181A1F | ~15:1 | ✅ | titulares | — |
| neutral-300 (#d4d4d4) sobre #181A1F | ~10:1 | ✅ | body | — |
| neutral-400 (#a3a3a3) sobre #181A1F | ~5.9:1 | ✅ | metadata | — |
| neutral-500 (#737373) sobre #181A1F | ~3.4:1 | ❌ texto normal | placeholders, hero sub, eyebrows 11px | **V-08 🟠** — placeholder del composer y labels 11px fallan AA; peor aún al ser 11px. Fix: FASE 0 mapea a `text-secondary #9CA0AB` (~5.0:1 sobre #0B0B0E ✅). |
| indigo-400/500 sobre #181A1F | ~4.6-5.5:1 | ✅ límite | links, paso activo | `accent #8B8FF5` de SPEC da ~6.7:1 sobre #0B0B0E — mejora. |
| #ffffff iconos sobre glass claro | ~1.2:1 | ❌ | ProfileMenu popover en tema claro | **V-09** — desaparece con app solo-oscura (FASE 0); si se corrige antes: `#525252`. |
| texto blanco sobre indigo glass CTA | ~3.8:1 | ❌ texto normal | StepFooterNav primario | **V-10 🟡** — el CTA de §3.3 (texto #0B0B0E sobre #8B8FF5, ~8:1) lo resuelve. |

### B2.3 Contra el estándar 2026 (dónde se queda corta)

| ID | Sev | Gap vs top apps (Things/Flighty/Arc/Reader-class) | Fix |
|----|-----|--------------------------------------------------|-----|
| V-11 | 🟠 | **Jerarquía del completado:** 5 botones apilados con el mismo peso; las mejores apps cierran con 1 acción + celebración contenida. Viola P5 y §5.5. | FASE 3: 1 primario + 1 secundario + menú ···. |
| V-12 | 🟡 | **Home sin "siguiente acción":** no hay card Continuar ni Recientes; el usuario que vuelve ve el hero vacío como el de primer uso. Flighty/Things abren siempre con "lo tuyo en curso". | FASE 2 (§5.1). |
| V-13 | 🟡 | **Tipografía de lectura:** body 16px/leading-7 correcto pero sin optical sizing ni ajuste de medida (~66ch); títulos de paso 24px se quedan cerca del body. §3.2 (17/1.55 + title 22 semibold) cierra el gap; añadir `maxWidth` de línea en pasos. | FASE 1. |
| V-14 | 🟢 | Chips de referencia y divisores planos (border neutral) contra cards glass ricos — inconsistencia de material en Result. | Unificar chips con `bg-surface-2` + radius 12 (FASE 1). |
| V-15 | 🟢 | El wordmark grabado Skia y el orbe son nivel top; conservarlos como firma (ya protegido en SPEC §3.4). | — |

---

## B3. MOTION

### B3.1 Inventario de motion existente

| Interacción | Implementación | Duración/curva actual | ¿Propósito? | Veredicto |
|-------------|----------------|----------------------|-------------|-----------|
| Composer focus pulse + sheen | `LiquidGlassMotionShell.tsx` (scale 1.006-1.018, ring indigo, sheen sweep) | ~600ms spring | Feedback de foco | ✅ conservar; ya respeta reduced motion |
| Drawer open/close | `HistoryDrawer.tsx` Reanimated (translateX + radius dinámico + sombra) | spring | Orientación espacial | ✅ conservar; afinar damping (B3.3) |
| Progreso de lectura | `ReadingProgressBar` width animada | timing ~250ms | Orientación | ✅ |
| Header auto-hide en vista completa | `useMapHeaderAutoHide` | timing | Foco de lectura | ✅ |
| Scramble de fases de carga | `LoadingState` rAF por carácter | continuo | **Decorativo** | 🟡 M-04: ignora reduced motion; sustituir por crossfade de textos |
| Orbe de carga | WebView CSS (levitación + glow) | continuo | Emocional/espera | ✅ con gate reduced-motion (ya pasa flag) |
| Dots de stepper carga | opacity loop | continuo | Progreso | ✅ |
| FadeIn/FadeOut banners | Reanimated entering/exiting | 200-300ms | Feedback | ✅ |
| Haptic avance de paso | `stepHaptic` (impact light) | — | Feedback | ✅ ya cumple §3.5 |

### B3.2 Motion que FALTA (SPEC §3.5 + estándar 2026)

| ID | Sev | Falta | Spec propuesta |
|----|-----|-------|----------------|
| M-01 | 🟠 | **Transición entre pasos** — hoy el contenido cambia sin transición (re-render seco). | Slide horizontal 250ms `Easing.out(Easing.cubic)`; saliente -24pt opacity→0, entrante desde +24pt; con swipe, sigue al dedo y suelta con spring (damping 28, stiffness 320). Haptic light al confirmar. Reduced motion: crossfade 150ms. |
| M-02 | 🟠 | **Momento de completado** — hoy el estado aparece sin ceremonia; no hay haptic success. | Secuencia: check scale 0.8→1.0 (350ms, spring damping 14) + haptic `success` + fade-in del título (250ms, delay 120ms). Una vez por Núcleo (persistir flag). Reduced motion: fade 150ms + haptic success (el haptic se mantiene). |
| M-03 | 🟡 | **Check de paso / mini-completado de sección** (§3.5 + §5.4.8). | Check scale 0.8→1 (250ms ease-out) + haptic light; en cierre de sección, además el label de sección hace fade-swap. |
| M-04 | 🟡 | Scramble sin gate de reduced motion (arriba). | Crossfade 150ms entre textos de fase cuando `reduceMotion`. |
| M-05 | 🟢 | Card Continuar (FASE 2) sin spec de motion. | Pressed: scale 0.98 (100ms); al reanudar, la barra de progreso de la card se transfiere visualmente a la barra del lector (shared-element opcional, si cuesta >1 día: cut simple). |
| M-06 | 🟢 | Paywall (FASE 7). | Presentación modal sheet estándar iOS; beneficios stagger 40ms entre filas, fade+8pt rise 200ms. Sin loops. |

### B3.3 Sistema de motion (tokens únicos)

```
DURATION:  instant 100ms · fast 150ms · base 250ms · slow 350ms
EASING:    standard = cubic-bezier(0.2, 0, 0, 1)  (Easing.out(Easing.cubic) aprox)
           spring-ui = { damping: 28, stiffness: 320 }   (gestos, drawer)
           spring-pop = { damping: 14, stiffness: 380 }  (checks, celebración)
HAPTICS:   light = avance de paso, cierre de sección, toggle
           success = Núcleo completado (única vez)
           (nada más; prohibido medium/heavy y haptic en scroll)
REDUCED:   toda animación >150ms → fade 150ms; springs → timing 150ms;
           loops (orbe, dots, scramble) → estado estático; haptics se conservan.
```
Regla de oro (§3.5): si una animación no da feedback, orientación o recompensa, no existe. El sheen del composer es el único ornamento permitido y ya está gateado.

---

## B4. ADHD-PROOF (elemento a elemento)

Formato por pantalla: decisiones exigidas / default / progreso visible / distracción / acción primaria / abandono a mitad.

### Home (InputScreen)
- **Decisiones:** hoy 3 visibles antes de escribir (intent en header, profundidad en chip, adjuntar). SPEC las deja en 0 obligatorias (defaults Entender/Estándar + preselección automática) ✅ diseño correcto, implementación pendiente (FASE 2).
- **Default:** sí en todo.
- **Progreso/final:** N/A.
- **Distracción:** 🟡 A-01 — botón dev "Vista previa de pantalla de carga" visible en `__DEV__` (`LoadingPreviewButton`); SPEC 5.1.4 lo elimina. 🟢 A-02 — hero copy desaparece al enfocar; correcto.
- **Primaria inequívoca:** send circle accent; correcto.
- **Abandono:** texto del composer NO se persiste — si el usuario cierra la app con texto escrito, lo pierde. 🟡 A-03: persistir borrador en AsyncStorage (una línea de SPEC a añadir, ver Fase C diff).

### Loading
- **Decisiones:** 0 ✅. **Primaria:** Cancelar única ✅.
- **Progreso:** fases reales + dots ✅ (mejor aún con streaming a 5.3, ya especificado).
- **Distracción:** scramble por carácter es ruido para lectores sensibles (M-04).
- **Abandono:** cancelar con parcial → banner incompleto ✅ ya implementado.

### Result — intro
- **Decisiones:** 1 (empezar) ✅. **Progreso:** tiempo total visible ✅.
- 🟠 A-04 — **CTA "Empezar a leer" cortado por safe area** (bug conocido, SPEC §3.3). `ResultScreen` footer. Es LA acción primaria de la app rota en el momento clave. FASE 1.
- **Distracción:** chips de referencia + card fuente + TLDR: densidad alta pero funcional; correcto.

### Result — paso a paso
- **Decisiones por paso:** 1 (siguiente) ✅. **Progreso:** barra + "Paso X de Y" ✅; falta "~N min restantes" (SPEC 5.4.7) 🟡 A-05.
- **Final visible:** último paso cambia a "Completar" ✅.
- **Distracción:** ninguna; auto-hide de header ayuda ✅.
- **Abandono:** paso persistido ✅; falta card Continuar en Home para reanudar (FASE 2) y notificación 24h (FASE 8).
- 🟡 A-06 — pasos >9 hoy posibles ("decenas"): mapas inacabables violan P3. FASE 4 (tope 9 + secciones) + FASE 5 (Colecciones).

### Result — vista completa
- 🟡 A-07 — el modo vista completa presenta TODO el contenido de golpe: para TDAH es el modo "abrumador". Justificación funcional existe (escaneo/repaso), se conserva, pero el default debe ser paso a paso (hoy lo es ✅) y el toggle no debe ser prominente en intro (hoy correcto).

### Result — completado
- 🟠 A-08 — **5 acciones con peso igual** = parálisis de decisión en el momento de recompensa. Viola P5. FASE 3 (1+1+···).
- Falta haptic success + ceremonia (M-02): la recompensa emocional es el motor de retención TDAH.

### Sidebar / historial
- **Decisiones:** lista + long-press oculto: patrón estándar ✅. Índice del mapa abierto excelente para orientación ✅.
- 🟢 A-09 — "Renombrar" en menú contextual añade una decisión de bajo valor; se conserva (ya existe) pero al final del menú.
- **Distracción:** categorías con label 11px difícil de leer (V-08).

### Menús (Profile/Ajustes, ModelChip, AttachMenu)
- 🟢 A-10 — Ajustes expone "Experiencia: Comprensión/Clásica": decisión sin valor de usuario, a eliminar (FASE 0, ya en SPEC).
- ModelChip abre bottom sheet para 3 opciones: el ciclado al tap de SPEC 5.1 reduce a 0 la navegación ✅ (FASE 2).

### Chat "Preguntar"
- **Decisiones:** entrada libre = carga cognitiva alta, pero mitigada con preguntas sugeridas ✅ ya implementadas (`MapChatSheet:272-297`).
- **Abandono:** conversación no persistida — aceptable (scope).

### Elementos sin justificación funcional → eliminar
1. Toggle de tema claro (SPEC §8) — FASE 0.
2. Selector de variante Clásica — FASE 0.
3. Botón dev "Vista previa" — FASE 2.
4. `LoadingPreviewButton`, componentes huérfanos (C-15).
5. Scramble por carácter → sustituir por fade (M-04).

---

## B5. ACCESIBILIDAD

| ID | Sev | Hallazgo | Ubicación | Fix |
|----|-----|----------|-----------|-----|
| X-01 | 🟠 | **Dynamic Type ausente de facto:** 0 usos de `allowFontScaling`/`maxFontSizeMultiplier` (el default de RN escala, pero) ~20 archivos con tamaños fijos `text-[10..15px]` y alturas fijas (52px CTA, 38px send) que rompen a >XL; wordmark Skia no escala (aceptable, es marca). | inventario apéndice B de aesthetics.md | SPEC §7.7 exige escala hasta XL: en FASE 0 la escala tipográfica se define en pt con multiplicador; capar con `maxFontSizeMultiplier={1.4}` los elementos de layout crítico; QA con XL. |
| X-02 | 🟠 | **VoiceOver:** cobertura de labels buena tras el pase reciente, con huecos: `HistoryCategoryFilter` sin label (`:20-24`), botones quitar-adjunto icon-only (`InputScreen.tsx:128-152`), chips de preguntas sugeridas del chat sin role/label (`MapChatSheet:285-293`). La barra de progreso no anuncia el cambio de paso (sin `accessibilityLiveRegion`/announce). | citados | Labels en los 3 huecos; `AccessibilityInfo.announceForAccessibility("Paso 3 de 5")` al avanzar. |
| X-03 | 🟡 | **Áreas táctiles <44pt:** send del chat 32×32 (`MapChatSheet:335`), quitar-adjunto ~24pt, chips de categoría compactos. hitSlop presente solo en ~11 sitios. | citados | hitSlop hasta 44pt efectivos en todos los icon buttons (auditoría FASE 9). |
| X-04 | 🟡 | **Reduced motion:** cubierto en glass/composer/orbe; huecos: ScrambleText (M-04), transiciones nuevas de FASE 1-2 deben nacer con gate (sistema B3.3). | `LoadingState.tsx:30-56` | Gate central: helper `useMotionConfig()` que devuelve duraciones/curvas ya reducidas. |
| X-05 | 🟡 | **Contraste:** V-08/V-10 (placeholders 3.4:1, CTA blanco/indigo 3.8:1) también son hallazgos AA formales. | — | Resuelto por paleta FASE 0. |
| X-06 | 🟢 | TalkBack (Android) sin QA alguno (la app nunca se ha probado en Android). | — | Incluir en QA de la fase Android. |

---

## B6. RENTABILIDAD Y COSTE

### B6.1 Coste de API por Núcleo (estimación)

Precios Gemini API verificados (jul 2026, USD/1M tokens): `gemini-3.5-flash` $1.50 in / $9.00 out (thinking cuenta como output) · `gemini-3-flash-preview` $0.50/$3.00 · `gemini-3.1-flash-lite` $0.25/$1.50 · `gemini-3-pro-preview` ≈$2.00/$12.00.

Cadenas actuales (`server.ts:84-137`): rápido/estándar → 3.5-flash primero; profundo (auto) → 3-pro-preview primero. Supuestos: fuente típica 6-15k tokens de entrada + ~2k de prompt; salida real 40-70% del cap (`maxOutputTokens`: 6144/8192/32768).

| Profundidad | Modelo efectivo | Input est. | Output est. | **Coste/Núcleo** | Peor caso (cap + 1 repair) |
|-------------|-----------------|-----------|-------------|------------------|---------------------------|
| Rápido | 3.5-flash | 8k → $0.012 | 3k → $0.027 | **~$0.04** | ~$0.10 |
| Estándar | 3.5-flash | 10k → $0.015 | 5k → $0.045 | **~$0.06** | ~$0.16 |
| Profundo | 3-pro-preview | 15k → $0.030 | 15-25k (incl. thinking) → $0.18-0.30 | **~$0.25-0.35** | ~$0.85 (32k out + repair) |
| Chat (por pregunta) | 3.5-flash | mapa+historial ~8k → $0.012 | **sin cap** (`server.ts:2697-2706`) | ~$0.03-0.06 | sin techo |

### B6.2 ¿Cierran los números? (recalibrado jul 2026 — precios: 6,99 €/mes · 59,99 €/año)

**Modelo actual (sin fixes R-03..R-06):**
- Free intensivo (90 Núcleos/mes × ~$0.06): **~$5.4/mes de coste** vs ingreso €0. 🔴 R-01.
- Pro abusador (5 profundos/día × ~$0.30): **~$45/mes de coste** vs **6,99 €/mes (~$7.6)**. 🔴 R-02.

**Modelo con fixes (cadena free barata + profundo 16k + fair-use 30/día + cap 120k):**
- Free intensivo (90/mes × ~$0.02 con flash-preview/lite): **~$1.7/mes** — aceptable como CAC.
- Pro típico (2 profundos/día + 5 estándar): ~60/mes × mix ≈ **~$4-6/mes de coste** vs 6,99 € → **margen ~15-40%** antes de infra.
- Pro anual (59,99 €/año = 5,00 €/mes efectivo): mismo usuario típico → **margen ajustado pero viable** si fair-use contiene cola alta; el anual es el plan preferido (2 meses gratis).
- Nota: hoy el coste no depende de cuenta (C-01); los fixes de SPEC FASE 7 / PLAN P7 son prerequisito.

### B6.3 Fixes propuestos → **incorporados en SPEC FASE 7 y PLAN P1.5/P7**

### B6.3 Fixes propuestos (por orden)

| ID | Sev | Fix | Efecto |
|----|-----|-----|--------|
| R-03 | 🔴 | **Free tier a modelo barato:** cadena free = `gemini-3-flash-preview` → `3.1-flash-lite` ($0.50/$3). Coste free intensivo: $5.4 → **~$1.7/mes**. La calidad Flash-preview es suficiente para rápido/estándar; el modelo premium se convierte en beneficio Pro real ("mejor modelo"). | ÷3 coste free |
| R-04 | 🟠 | **Cap de fuente:** truncar entrada a ~120k chars (~30k tokens) con aviso en `limitations`; hoy es ilimitado (C-03). | techo por petición |
| R-05 | 🟠 | **Profundo: bajar `maxOutputTokens` 32768 → 16384.** Con tope de 9 pasos (FASE 4) no hay uso legítimo de 32k; el thinking de pro-preview se come el resto. | ~-40% coste profundo |
| R-06 | 🟠 | **Fair use Pro invisible:** 30 Núcleos/día y 20 preguntas de chat/día por usuario (límite server-side que un humano normal no toca). Chat con `maxOutputTokens: 2048`. | techo de cola alta |
| R-07 | 🟡 | Contador free en servidor (requiere C-01/auth); dedupe: hash de fuente+intent+depth → cache 24h de mapas idénticos (el `mapCache` actual no ahorra LLM). | evita dobles cobros |
| R-08 | 🟡 | Repair solo para free en flash-lite y solo si `passed=false` por razones estructurales (ya casi así); registrar tokens reales por petición (el SDK los devuelve) en una tabla `usage` para decidir con datos. | visibilidad |

### B6.4 Funnel free→paywall→pago

| Etapa | Estado | Hallazgo |
|-------|--------|----------|
| Triggers | Solo en SPEC (4º Núcleo / Profundo / Preguntar) | ✅ diseño correcto: los 3 llegan en momento de intención alta. R-09 🟡: falta el trigger "post-completado" — tras completar el 3º Núcleo del día, banner suave "Mañana tienes 3 más, o ilimitados con Pro" (momento de recompensa, no de bloqueo). |
| Fricción | Paywall §5.8 sin timers ni dark patterns, trial 7 días | ✅. R-10 🟢: añadir "Recordarme antes de que acabe el trial" (notificación local día 5) — reduce cancelaciones rabiosas y reviews negativas. |
| Momento | Contador visible "2 de 3 hoy" solo cuando quede ≤1 (§5.1) | ✅ correcto para TDAH (no meter ansiedad de escasez desde el primer uso). |
| Restaurar | En SPEC | ✅ obligatorio Apple. |
| Precio | **6,99 €/mes · 59,99 €/año** (SPEC §6.5/§5.8; IDs en App Store Connect; importes vía RevenueCat) | ✅ definido |

---

## B7. STORES Y LEGAL

| ID | Sev | Hallazgo | Detalle | Fix |
|----|-----|----------|---------|-----|
| S-01 | 🔴 | **Sin borrado de cuenta.** La app crea cuentas (Supabase OAuth) y App Store Guideline 5.1.1(v) exige borrado de cuenta dentro de la app. No existe ni pantalla ni endpoint. | `ProfileMenu` solo tiene cerrar sesión | Añadir "Eliminar cuenta y datos" (borra filas Supabase + auth user + local). Bloqueante de review. |
| S-02 | 🔴 | **Sin política de privacidad** en repo ni URL. Obligatoria en ambas stores y por GDPR (usuario en España). Datos: email (OAuth), fuentes → Gemini API, mapas en **Supabase UE (AWS eu-west)**. | — | PLAN P10: `/privacidad` declarando residencia UE, subencargados, fuentes a Gemini sin entrenamiento (paid tier). |
| S-03 | 🟠 | **App Privacy labels:** deberán declarar "User Content" (fuentes/mapas) vinculado a identidad si hay cuenta, y "Identifiers/Email". Sin analítica ni ads → sin tracking, **no necesita ATT** ✅. Play Data Safety equivalente. | — | Rellenar en App Store Connect/Play Console coherente con S-02. |
| S-04 | 🟠 | **Gemini y datos de usuario:** en paid tier Google no usa datos para entrenar ✅ (confirmado en pricing docs), pero hay que declararlo en la política y NO usar free tier de API en producción (sí entrena). Verificar que la key de prod es de proyecto facturado. | `.env` prod | Declarar en política; verificar billing del proyecto. |
| S-05 | 🟠 | **IAP:** suscripción debe ir por IAP (Guideline 3.1.1) — RevenueCat lo cubre; obligatorio: restaurar compra (en SPEC ✅), mostrar precio+duración+renovación automática en paywall, links a Términos (EULA) y Privacidad EN el paywall. SPEC §5.8 no menciona esos links. | SPEC §5.8 | Añadir a SPEC (diff en Fase C). |
| S-06 | 🟡 | **Marca:** glifo actual = logo React (V-06). Riesgo de rechazo/reclamo y de identidad débil en el icono de la store. | assets | Ya en FASE 0. |
| S-07 | 🟡 | **YouTube transcripts** vía scraping (`youtube-transcript`): frágil y en zona gris de ToS de YouTube. Riesgo operativo (se rompe sin aviso), no de review. | `server.ts:2414-2445` | Aceptar riesgo documentado + degradación elegante (error tipado "no hay transcripción disponible", ya existe parcial). |
| S-08 | 🟡 | **Export compliance iOS:** falta `ITSAppUsesNonExemptEncryption=false` en `app.json` → pregunta manual en cada submit. | `mobile/app.json` | Añadir a infoPlist. |
| S-09 | 🟡 | **GDPR extra:** consentimiento no necesario para funcionalidad (base = ejecución de contrato), pero sí derecho de supresión (cubierto por S-01) y registro de encargados. Sin cookies/analytics hoy → sin banner. Si entra analítica (B8), elegir privacy-first sin consentimiento requerido (TelemetryDeck-class). | — | Con S-02. |
| S-10 | 🟢 | **ASO básico:** nombre "nucleo" es genérico y colisiona (química/educación). Propuesta: título store "nucleo — entiende cualquier fuente" (ES) / subtítulo "Convierte PDFs, vídeos y artículos en lecturas que sí terminas". Keywords ES: resumir pdf, resumen youtube, tdah lectura, estudiar rápido, comprensión lectora. Capturas: 5 verticales siguiendo el flujo Home→Loading→Paso→Completado→Historial, fondo #0B0B0E, un claim por captura. Sin localizar a EN en v1 (decisión SPEC) — limita mercado, consciente. | — | Preparar en FASE 9 (release). |

---

## B8. LO QUE FALTA (ni en código ni en SPEC)

| Feature | Esfuerzo | Impacto | Veredicto |
|---------|----------|---------|-----------|
| **Crash reporting (Sentry expo)** | Bajo (1 día) | Alto — sin esto vuelas ciego en producción; imprescindible antes de TestFlight | ✅ **Recomendada** — añadir a FASE 9 |
| **Analítica privacy-first de eventos clave** (TelemetryDeck o PostHog EU; eventos: transform_start/done/fail, step_advance, completion, paywall_view/trial_start) | Bajo-medio (2 días) | Alto — el funnel B6.4 no se puede optimizar sin datos; sin consentimiento GDPR si es TelemetryDeck-class | ✅ **Recomendada** — FASE 9 |
| **Petición de review tras completar** (StoreKit `requestReview` tras 2º Núcleo completado, máx 1/90 días) | Trivial (2h) | Alto — el momento post-completado es el pico emocional; motor ASO | ✅ **Recomendada** — FASE 8 (junto a notificaciones) |
| **Borrado de cuenta** | Medio | Obligatorio (S-01) | ✅ ya contabilizada en B7 |
| **Widget iOS "Continuar"** (WidgetKit, deep link al Núcleo en curso) | Alto (config nativa + expo-widgets inmaduro) | Medio — bonito para retención TDAH pero requiere deep links primero | ❌ Descartada v1: coste nativo alto, depende de deep links inexistentes |
| **Deep links / universal links** (nucleo://map/:id) | Medio | Medio — prerequisito de widget/share/notificaciones ricas | ⚠️ **Parcial**: incluir solo el routing interno `nucleo://map/:id` al implementar notificaciones (FASE 8 lo necesita para abrir el Núcleo correcto); universal links (dominio) fuera de v1 |
| **App Intents / Siri Shortcuts** | Alto | Bajo — uso marginal para este público | ❌ Descartada: coste nativo alto, sin evidencia de demanda |
| **Localización a inglés** | Medio (strings hardcodeados en ~45 componentes, sin i18n) | Alto a medio plazo, nulo para v1 ES | ❌ Descartada v1 (decisión ya en SPEC §8); hallazgo 🟡 F-01: no hay capa i18n — cada string nuevo aumenta el coste de localizar después; no bloquea. |
| **Import por Share Extension** | Alto | Alto | ✅ Ya en SPEC (FASE 6), no falta |
| **Modo offline de lectura** | — | — | ✅ Ya cubierto (historial local persiste; §7.3) |
| **iPad/tablet layout** | Medio | Bajo v1 | ❌ Descartada: `supportsTablet` sin diseñar; enviar iPhone-only v1 |
| **Backup/export total de datos (JSON)** | Bajo | Bajo-medio (GDPR portabilidad + confianza) | ⚠️ Barato: botón "Exportar mis datos" en Ajustes junto a borrado de cuenta (mismo trabajo de S-01); recomendado incluirlo ahí |

---

## FASE C.2 — CAMBIOS A SPEC.md (**aplicados 2 jul 2026**)

### Diff 1 — §5.8 Paywall: links legales obligatorios (hallazgo S-05)
**Actual:** «…→ CTA "Probar 7 días gratis" → link `meta` "Restaurar compra". Sin timers falsos ni dark patterns.»
**Propuesto:** «…→ CTA "Probar 7 días gratis" → fila `meta` con tres links: "Restaurar compra · Términos · Privacidad" (obligatorio App Store 3.1.2; los dos últimos abren web). Bajo el CTA, texto `meta`: precio, duración y "se renueva automáticamente, cancela cuando quieras". Sin timers falsos ni dark patterns.»

### Diff 2 — §5.1 Home: persistencia del borrador (hallazgo A-03)
**Actual:** (§5.1 no menciona qué pasa con texto escrito y no enviado)
**Propuesto (añadir al final de 5.1):** «**Borrador persistente:** el texto del composer y los adjuntos seleccionados se guardan localmente al perder foco o pasar a background, y se restauran al reabrir la app. Se limpian al enviar o al borrar manualmente.»

### Diff 3 — FASE 4 Alcance: endurecimiento del pipeline (hallazgos C-03, C-04, C-05, C-09, C-11, R-04, S-07)
**Actual:** «…Actualizar buildDepthContract() en server.ts: eliminar rangos >9 pasos y la instrucción «decenas».»
**Propuesto (añadir a continuación):** «Endurecer la entrada del pipeline en server.ts: (a) truncar la fuente a 120.000 caracteres con aviso en `limitations`; (b) envolver el contenido de usuario en delimitadores `<<<FUENTE>>>…<<<FIN_FUENTE>>>` con instrucción de ignorar órdenes internas, y en imagen/vídeo el contrato va siempre antes del texto del usuario; (c) validar `type` contra enum y `mimeType` contra allowlist (pdf, jpeg, png, webp, mp4); (d) capturar fallos de JSON.parse y reintentar 1 vez incluyendo el error, luego error tipado 5.2; (e) timeout de 120 s (profundo) / 60 s (resto) en llamadas al LLM; (f) si YouTube no tiene transcripción, error tipado "Este vídeo no tiene transcripción disponible" sin reintento.»

### Diff 4 — FASE 4 Aceptación: tests mínimos (hallazgo C-23)
**Actual:** (criterios 1-7 actuales)
**Propuesto (añadir):** «(8) Existe suite Vitest en raíz con tests verdes para: normalización/validación del JSON del mapa contra el esquema §4 (fixtures válido, inválido y truncado), migración de categorías a Otros, y parseo del stream NDJSON; `npm test` pasa en CI local.»

### Diff 5 — FASE 7 Alcance: enforcement y coste en servidor (hallazgos C-01, R-03, R-05, R-06, R-07)
**Actual:** «Alcance: integrar RevenueCat, entitlement `pro`, contador 3/día con **reset a las 04:00 hora local**, los 3 triggers del paywall…»
**Propuesto:** «Alcance: integrar RevenueCat, entitlement `pro`, contador 3/día con **reset a las 04:00 hora local** — **verificado en servidor**: `/api/transform` y `/api/maps/:id/chat` exigen JWT de Supabase; el contador vive en Postgres por userId (el cliente solo lo refleja); los 3 triggers del paywall (4º Núcleo / Profundo / Preguntar), pantalla paywall completa con productos reales y restaurar compra, retirada de marca de agua del PDF con entitlement. **Control de coste:** cadena de modelos free = `gemini-3-flash-preview` → `gemini-3.1-flash-lite`; la cadena premium actual (3.5-flash / 3-pro-preview) pasa a ser exclusiva Pro; `maxOutputTokens` de profundo baja de 32768 a 16384; fair use Pro server-side: 30 Núcleos/día y 20 preguntas de chat/día; chat con `maxOutputTokens: 2048`; registrar tokens de entrada/salida reales por petición en tabla `usage`.»
**Aceptación (añadir):** «(6) llamar a /api/transform sin JWT devuelve 401; (7) el 4º transform del día de un userId free devuelve 402 con código `free_limit` aunque el cliente se manipule; (8) una cuenta free nunca ejecuta la cadena premium (verificable en header X-Gemini-Model-Used).»

### Diff 6 — FASE 8 Alcance: review prompt + deep link interno (hallazgos B8, R-10)
**Actual:** «…solicitud de permiso tras primer Núcleo completado.»
**Propuesto (añadir):** «Deep link interno `nucleo://map/:id` que abre el Núcleo indicado (lo usan las notificaciones para llevar al Núcleo correcto). Petición de review nativa (StoreKit requestReview) tras el segundo Núcleo completado con éxito, máximo una vez cada 90 días, nunca tras un error. Si hay trial activo (FASE 7), notificación local el día 5 recordando que el trial acaba.»

### Diff 7 — FASE 9 Alcance: cierre de release (hallazgos S-01, S-08, C-08, C-10, B8)
**Actual:** «Alcance: `prefers-reduced-motion` en todas las animaciones de 3.5; Dynamic Type hasta XL…; estados sin conexión; áreas táctiles 44pt auditadas; revisión de todos los strings contra §7.6; barrido de estados vacíos/error faltantes en todas las pantallas.»
**Propuesto (añadir):** «Borrado de cuenta y datos desde Ajustes (Guideline 5.1.1(v)): elimina filas de Supabase, el usuario de auth y el estado local, con confirmación destructiva; junto a él, "Exportar mis datos" (JSON del historial via share sheet). Banner offline global consumiendo NetworkStatusContext con el copy de §7.3 y submit deshabilitado. Aviso si la persistencia local falla (retorno de saveHistory). `ITSAppUsesNonExemptEncryption=false` en app.json. Crash reporting (sentry-expo) y analítica privacy-first sin consentimiento requerido (TelemetryDeck o equivalente UE) con exactamente estos eventos: transform_start, transform_done, transform_fail, step_advance, nucleo_completed, paywall_view, trial_start, subscribe.»

### Diff 8 — §8 FUERA DE ALCANCE: descartes de auditoría (hallazgos B8)
**Actual:** (lista actual de fuera de alcance)
**Propuesto (añadir):** «Widget iOS, App Intents/Siri, universal links con dominio, layout iPad: descartados para v1 por coste/impacto (auditoría jul 2026). Localización EN ya estaba fuera; se reafirma.»
