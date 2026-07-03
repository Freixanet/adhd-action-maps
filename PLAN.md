# PLAN.md — Backlog ejecutable de nucleo

**Fecha:** 2 jul 2026 · Ordenado por bloqueante > impacto > esfuerzo. Cada fase = una sesión, ejecutable sin criterio propio: toda decisión está tomada aquí o en `SPEC.md` (fuente de verdad). IDs de hallazgo → `AUDIT.md`. Precios de referencia: **6,99 €/mes · 59,99 €/año** (IDs en App Store Connect; la app lee importes de RevenueCat, nunca hardcodea).

**Reglas globales para el ejecutor (todas las fases):**
- Lee `SPEC.md` completo y la sección de fase correspondiente antes de tocar nada.
- Prohibido: refactors fuera del alcance listado, dependencias nuevas no listadas, cambios en `docs/`, tocar `src/` (web) salvo que la fase lo diga.
- Toda animación nueva usa el sistema de motion de `AUDIT.md` §B3.3 (duraciones/curvas/haptics/reduced-motion). Ninguna animación sin gate de reduced motion.
- Al terminar: `npx tsc --noEmit` en raíz y en `mobile/` sin errores nuevos; verificar los criterios de aceptación uno a uno.

---

## P0 — Design system + limpieza estructural (SPEC FASE 0)
**Resuelve:** V-01..V-08, V-10, C-13, C-14, C-15, C-17, C-18, C-07, A-10.

**Archivos:** `shared/uiTokens.ts`, `mobile/tailwind.config.js`, todos los `mobile/src/**/*.tsx` con hex/tamaños hardcodeados, `mobile/App.tsx`, `mobile/src/components/ProfileMenu.tsx`, `mobile/src/context/ThemeContext.tsx` (solo fijar dark), borrados listados abajo.

**Instrucciones:**
1. Sustituye los tokens de `shared/uiTokens.ts` y `mobile/tailwind.config.js` por la tabla exacta de SPEC §3.1 (base #0B0B0E, surface, accent #8B8FF5, text-primary/secondary, sem-*). Nada de valores fuera de tabla.
2. Migra todos los colores hardcodeados de `mobile/src` a tokens (buscar `#[0-9a-fA-F]{6}`, `indigo-`, `neutral-`). Tipografía a los 5 roles de §3.2; espaciado y radios a §3.3 (padding pantalla 20px; radios 16/12/24).
3. App solo oscura: `ThemeContext` devuelve siempre dark; elimina el toggle de tema y el selector de variante de `ProfileMenu.tsx`.
4. Borra: `mobile/src/screens/classic/` entera, `AppVariantContext`/`appVariant.ts` (móvil y `src/appVariant.ts` NO — web no se toca), `ModelSelector.tsx`, `NucleoIcon.tsx`, `InteractiveAtomOrb.tsx`, `AtomCanvasIcon.tsx`, `QuantumOrbView.tsx`, `LiquidGlassOrb.tsx`, `LiquidGlassOrbSkia.tsx`, `liquidGlassOrbShared.ts`. En `App.tsx` elimina la rama classic.
5. Borra de la raíz: `fix*.py`, `search_*.py`, `update_footer_animation.py`, `generate_native_composer.py`, `atom-demo/`, `atom-icon.html`, `NUCLEO_MOBILE_FULL_EXPORT.md`, `ios/` (Capacitor), `capacitor.config.ts` y las deps `@capacitor/*` de `package.json`.
6. Glifo: sustituye el átomo React por círculo + disco descentrado (SPEC §3.4) en `EngravedNucleoMark`, en el interior del orbe (`ExactLiquidOrbWebView`) y en `mobile/assets/icon.png` (sin logo React en el icono de la app).
7. Renombrado UI "mapa"→"Núcleo" en strings visibles (no en tipos ni claves de storage).
8. Unifica el helper de timeout: `mobile/src/logic/network.ts` reexporta el de `shared/transformStream.ts`.

**Aceptación (binaria):** (1) `rg '#(181A1F|FAFAFA|4f46e5|6366f1)' mobile/src` → 0 resultados; (2) Ajustes sin toggle tema ni variante; (3) `rg -l 'classic' mobile/src` → 0; (4) los 9 componentes listados no existen; (5) `ls ios capacitor.config.ts` falla; (6) ningún string visible dice "mapa"; (7) app arranca en simulador con la paleta nueva; (8) `mobile/assets/icon.png` no contiene el glifo React (círculo + disco §3.4).

**NO tocar:** `server.ts`, `src/` (web), `shared/contracts.ts`, lógica de `AppSessionContext` (solo strings/estilos).

---

## P1 — Fixes críticos de lectura (SPEC FASE 1)
**Resuelve:** A-04, A-05, M-01, M-03, V-07, V-13, V-14.

**Archivos:** `mobile/src/screens/ResultScreen.tsx`, `StepFooterNav.tsx`, `StepFooterGlassButton.tsx`, `StepContentBlocks.tsx`, `ReadingProgressBar.tsx`.

**Instrucciones:**
1. Safe area: el footer de CTAs de intro/lectura usa `useSafeAreaInsets().bottom + 16` como paddingBottom. Verificar en simulador con notch.
2. CTA primario = fondo `accent` sólido, texto #0B0B0E, 52px, radius 24 (SPEC §3.3). Secundarios quedan glass.
3. Bloques semánticos: borde izquierdo 3px + label coloreado según tipo clave/matiz/ejemplo/alerta (colores sem-* de §3.1), fondo `surface`, radius 16.
4. "~N min restantes" junto a "Paso X de Y": suma `tiempoEstimado` de pasos restantes; oculto si falta el dato.
5. Swipe horizontal entre pasos (gesto sigue al dedo, spring-ui al soltar; umbral 30% ancho o velocidad). Transición M-01: 250ms standard, saliente -24pt, entrante +24pt. Reduced motion: crossfade 150ms.
6. Haptic light al avanzar paso (ya existe `stepHaptic`, verificar que se dispara también con swipe). Check de paso M-03: scale 0.8→1 spring-pop.
7. Cuerpo de paso: 17px/1.55, `maxWidth` de línea ~640 unidades en tablets/landscape (en iPhone el padding 20 basta).

**Aceptación:** (1) CTA visible completo en iPhone con home indicator; (2) swipe izquierda avanza y derecha retrocede con animación; (3) con Reduce Motion activado no hay slide, solo fade; (4) los 4 tipos de bloque muestran borde 3px del color correcto; (5) "~N min" visible en paso 1 y desaparece en el último; (6) haptic en cada avance.

**NO tocar:** `server.ts`, InputScreen, historial.

---

## P1.5 — Endurecimiento del servidor (paralelo, sin UI)
**Resuelve:** C-02 (SSRF), C-03, C-04, C-05, C-06, C-11, R-04, R-05, C-16 (parcial).

**Archivos:** solo `server.ts` (+ `.env.example` para documentar nuevas vars).

**Instrucciones:**
1. SSRF en `type:link`: rechazar esquemas distintos de `http:`/`https:` (400, código `invalid_url`); resolver el host con `dns.promises.lookup` y rechazar (400, código `invalid_url`) IPs en 10.0.0.0/8, 172.16/12, 192.168/16, 127/8, 169.254/16 (incl. 169.254.169.254), ::1, fc00::/7 **antes** del fetch.
2. Límites: `express.json({ limit: "20mb" })`; texto fuente (texto pegado, HTML extraído, transcripción) truncado a 120.000 caracteres añadiendo a `limitations` el aviso "Fuente truncada a 120k caracteres".
3. Prompt injection: contenido de usuario siempre entre `<<<FUENTE>>>` y `<<<FIN_FUENTE>>>` con instrucción en systemInstruction de ignorar órdenes dentro de la fuente. En imagen/vídeo el contrato va antes del texto del usuario (invertir orden en `server.ts:1450-1453`).
4. Validación: `type` contra enum (text|link|youtube|pdf|image|video → si no, 400); `mimeType` allowlist (application/pdf, image/jpeg, image/png, image/webp, video/mp4); `sourceLabel` truncado a 200 chars y sin saltos de línea; history de chat cap 6 turnos y 8.000 chars totales.
5. Timeout Gemini: AbortSignal 120s (profundo) / 60s (resto) en cada `generateContent`/stream; al abortar, tratar como fallo de modelo (siguiente en cadena o error tipado).
6. `maxOutputTokens` profundo 32768 → 16384. Chat: añadir `maxOutputTokens: 2048`.
7. Cheatsheet: aplicar el rate limiter existente a las 3 rutas cheatsheet; eliminar la ruta POST `/api/maps/:id/cheatsheet.pdf` (duplicada; el cliente móvil usa prepare+GET — verificar con `rg cheatsheet mobile/src` antes de borrar). Eliminar `estimateSourceComplexity` (muerta).

**Aceptación:** (1) POST transform con `{type:"link", text:"http://169.254.169.254/..."}` → 400; (2) POST transform con `{type:"link", text:"file:///etc/passwd"}` → 400; (3) texto de 500k chars genera mapa con aviso en limitations; (4) `type:"exe"` → 400; (5) profundo devuelve mapas con cap ≤16384 tokens de salida; (6) cheatsheet responde 429 al exceder rate; (7) web y móvil generan Núcleos igual que antes con fuentes normales.

**NO tocar:** prompts de contenido (solo envoltorio), pipeline de calidad, cliente.

---

## P2 — Home + Generación (SPEC FASE 2)
**Resuelve:** V-12, A-01, A-03, C-12, C-21/22, M-04, M-05.
**Archivos:** `InputScreen.tsx`, `IntentSelector.tsx`, `ModelChip.tsx`, `ComposerDock/Surface`, `LoadingState.tsx`, `AppSessionContext.tsx` (borrador + Continuar), componente nuevo `ContinueCard.tsx`.
**Instrucciones:** implementar SPEC §5.1 y §5.2 literales (card Continuar con progreso y motion M-05; Recientes 3; demo primer uso; selector Entender|Aplicar + chip profundidad dentro de la caja con ciclado al tap; preselección por tipo de fuente; placeholder estático; ejemplos rotatorios solo primer uso; eliminar `LoadingPreviewButton`). Borrador persistente según SPEC §5.1 punto 5 (clave `nucleo-draft`). X en `IncompleteTransformBanner` vía `dismissTransformIncomplete`. Scramble → crossfade con `reduceMotion` (M-04).
**Aceptación:** los 8 criterios de SPEC FASE 2 + (a) matar la app con texto escrito y reabrir lo restaura; (b) banner incompleto tiene X; (c) con Reduce Motion los textos de fase hacen fade.
**NO tocar:** ResultScreen, server.ts.

---

## P3 — Completado + Sidebar + Búsqueda (SPEC FASE 3)
**Resuelve:** V-11/A-08, M-02, A-09.
**Instrucciones:** SPEC FASE 3 literal (1 CTA primario "Volver al inicio" + secundario "Repasar puntos clave" + menú ··· con PDF/Preguntar/Ver completo; Exportar PDF en long-press del historial; chip Incompletos; búsqueda sobre ideaCentral). Añadir ceremonia M-02 (check spring-pop + haptic success una sola vez por Núcleo, flag persistido en la entrada de historial) y mover "Renombrar" al final del menú contextual.
**Aceptación:** criterios de SPEC FASE 3 + (a) completar un Núcleo dispara haptic success exactamente una vez aunque se revisite; (b) el completado muestra exactamente 2 botones + menú.

---

## P4 — Pipeline robusto (SPEC FASE 4)
**Resuelve:** A-06, C-09, C-23, S-07, C-20 (mitigado).
**Instrucciones:** SPEC FASE 4 literal (esquema §4, enum 8 categorías + migración, tope 9 pasos, secciones, autochequeo, endurecimiento server.ts según alcance FASE 4). Vitest en raíz (`npm i -D vitest`): tests de normalización JSON (fixtures válido/inválido/truncado), migración categorías a Otros, parseo NDJSON. Script `"test": "vitest run"`.
**Aceptación:** criterios (1)-(8) de SPEC FASE 4 + `npm test` verde con ≥12 asserts.

---

## P5 — Colecciones (SPEC FASE 5) · P6 — Ficha PDF (SPEC FASE 6)
Ejecutar tal cual SPEC (alcance y aceptación cerrados allí). Sin añadidos de auditoría.

---

## P7 — Monetización + enforcement (SPEC FASE 7)
**Resuelve:** C-01, R-01..R-08, S-05, R-09, M-06.

**Instrucciones:** SPEC FASE 7 literal. RevenueCat + entitlement `pro`; productos de referencia 6,99 €/mes y 59,99 €/año (IDs en App Store Connect; importes solo desde RevenueCat). **Servidor — auth y límites (no por IP):** JWT Supabase obligatorio en `/api/transform`, `/api/transform/stream`, `/api/maps/:id/chat` y rutas `/api/maps/:id/cheatsheet.*` (401 sin token); contador free 3/día por `userId` en Postgres (tabla `usage_daily`, reset 04:00 hora local del usuario — el cliente envía su offset); 402 `free_limit` en el 4º transform del día aunque el cliente se manipule. **Servidor — control de coste (4 parámetros):** (1) cadena free = `gemini-3-flash-preview` → `gemini-3.1-flash-lite`; cadena premium (3.5-flash / 3-pro-preview) exclusiva Pro; (2) `maxOutputTokens` profundo = 16384 (si P1.5 no lo aplicó aún, aplicarlo aquí); (3) fair use Pro server-side: 30 Núcleos/día y 20 preguntas chat/día; chat `maxOutputTokens: 2048`; (4) cap fuente 120k chars + `express.json` 20mb (si P1.5 no lo aplicó aún, aplicarlo aquí). Tabla `usage` con tokens reales por petición (`usageMetadata` del SDK). Verificar entitlement Pro server-side (RevenueCat webhook o claim JWT). Paywall §5.8 (links Restaurar/Términos/Privacidad). Trigger suave post-3º-Núcleo (R-09). Motion paywall M-06.

**Aceptación:** criterios SPEC FASE 7 (1)-(8) + (9) paywall muestra Restaurar/Términos/Privacidad + (10) GET `/api/maps/:id/cheatsheet.pdf` sin JWT → 401 + (11) contador free se incrementa por userId, no por IP (verificable con dos cuentas desde la misma IP).
**NO tocar:** pipeline de generación (solo selección de cadena).

---

## P8 — Share Extension + Notificaciones (SPEC FASE 8 + Diff 6)
SPEC FASE 8 + Diff 6: deep link `nucleo://map/:id`, requestReview tras 2º completado (máx 1/90 días, flag en AsyncStorage), notificación día 5 de trial.

---

## P9 — Pulido + cuenta (SPEC FASE 9)
**Resuelve:** S-01, S-08, C-08, C-10, C-19, X-01..X-05.
**Instrucciones:** SPEC FASE 9 literal (reduced motion total, Dynamic Type XL con `maxFontSizeMultiplier={1.4}` en layout crítico, offline con banner consumiendo `useNetworkStatus` + submit deshabilitado, 44pt en todos los icon buttons, strings §7.6, estados vacíos). Borrado de cuenta y datos en Ajustes (Guideline 5.1.1(v): Supabase rows + auth user + storage local, confirmación destructiva) + "Exportar mis datos" (JSON via share sheet). Toast si `saveHistory` devuelve false. AsyncStorage por claves conocidas + Skia diferido. `ITSAppUsesNonExemptEncryption=false`. VoiceOver huecos + announce de paso. Sentry + TelemetryDeck (eventos SPEC FASE 9).
**Aceptación:** checklist §7 al 100% + (a) borrar cuenta deja Supabase sin filas del usuario y vuelve a Home deslogueado; (b) banner offline §7.3 con submit deshabilitado; (c) texto XL usable; (d) link "Privacidad" en Ajustes abre `/privacidad` publicada (contenido completo en P10 si aún no existe).

---

## P10 — Legal + release (bloqueante pre-lanzamiento)
**Resuelve:** S-02, S-03, S-04, S-09, S-10, B8 (Sentry, analítica).

**Instrucciones:** (1) `sentry-expo` con DSN por env, sin PII en breadcrumbs; (2) TelemetryDeck (UE) con los 8 eventos de SPEC FASE 9; (3) política de privacidad en `/privacidad` + link en Ajustes y paywall, declarando: datos almacenados en **UE (Supabase, AWS eu-west)**; fuentes enviadas a **Google Gemini API** solo para generación; **sin uso para entrenamiento** (tier de API de pago); subencargados (Google, Supabase, Railway, RevenueCat, Sentry, TelemetryDeck); retención; derechos GDPR; contacto; (4) **Bloqueante pre-lanzamiento:** verificar que `GEMINI_API_KEY` de producción pertenece a proyecto Google Cloud con **billing activo** (paid tier — el free tier entrena con datos); documentar verificación; (5) App Privacy labels y Play Data Safety coherentes con (3); (6) ficha store según AUDIT S-10; productos IAP 6,99 €/mes y 59,99 €/año en App Store Connect (IDs para RevenueCat).

**Requiere de Marc:** textos legales finales, cuentas Sentry/TelemetryDeck.

---

## PRE-LANZAMIENTO — BLOQUEANTES

**BLOQUEANTE:** Migrar la key de Gemini de producción a un proyecto de Google Cloud con billing activo (el free tier de la API entrena con los datos enviados; incompatible con la política de privacidad).
**Aceptación:** (1) la key de producción pertenece a proyecto con billing verificado en Cloud Console; (2) la política de privacidad declara el flujo real de datos a Gemini y que no se usan para entrenamiento; (3) la política declara alojamiento de datos en UE (Supabase, AWS eu-west).

---

## P11 — Android (nueva, tras P9)
Primera build EAS Android; QA visual de fallbacks glass (blur/rgba ya existen), TalkBack (X-06), back gesture, teclado. Sin fecha hasta que iOS esté en TestFlight.

---

## Dependencias
P0 → P1 → P2 → P3 (UI en cadena). P1.5 independiente (puede ir ya). P4 tras P1.5. P5-P6 tras P4. P7 tras P4 (necesita pipeline estable) y P1.5 (auth). P8 tras P7 (trial). P9 tras P3. P10 tras P7. P11 al final.
