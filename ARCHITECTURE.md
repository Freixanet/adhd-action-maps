# ARCHITECTURE.md — Inventario técnico de nucleo

**Fecha:** 2 jul 2026 · **Generado por:** auditoría Fase A · **Fuente de producto:** `SPEC.md`

---

## 1. Stack detectado

| Capa | Tecnología | Ubicación | Estado |
|------|-----------|-----------|--------|
| **Móvil (fuente de verdad)** | Expo 56 · React Native 0.85 · NativeWind 4 · Reanimated 4 · Skia · expo-glass-effect (iOS 26 liquid glass) · FlashList | `mobile/` | Activo, dev client iOS funcionando |
| **Web** | React 19 · Vite 6 · Tailwind 4 · motion | `src/` + `index.html` | Activo, servida por el backend |
| **Backend** | Node · Express 4 · @google/genai (Gemini) · pdfkit · youtube-transcript | `server.ts` (2.830 líneas, monolito) | Activo, deploy Railway (Docker) |
| **Sync/Auth** | Supabase (Postgres + RLS + OAuth Google/Apple) | `supabase/migrations/`, anon key en `mobile/eas.json` | Opcional, activo |
| **Cáscara nativa legacy** | Capacitor 7 (iOS) | `capacitor.config.ts`, `ios/App` | **Legacy** — envoltorio de la web, anterior a la app Expo |
| **Compartido** | 17 módulos TS (contratos, history, stream, tokens, prefs) | `shared/` | Activo, consumido por móvil y web |
| **Tests** | — | — | **Cero tests en todo el repo; sin framework configurado** |

Builds: EAS (perfiles preview/producción en `mobile/eas.json`, apuntan a Railway prod). CI: no hay.

## 2. Estructura del repo

```
/                    server.ts (backend+web server), package.json, Dockerfile, railway.toml
├── SPEC.md          fuente de verdad de producto (v1.1)
├── shared/          contratos y lógica compartida móvil↔web (17 archivos)
├── src/             web React (ComprensionApp.tsx 3.309 líneas, ClassicApp.tsx 2.637 muerto)
├── mobile/          app Expo (fuente de verdad)
│   ├── App.tsx      boot, providers (Theme, Network, AppSession), variante
│   └── src/
│       ├── context/     AppSessionContext.tsx (1.268 líneas, god-context) + Composer/Theme/Network
│       ├── screens/     InputScreen, LoadingScreen, ResultScreen, ComprensionApp + classic/ (fork muerto)
│       ├── components/  ~45 componentes (glass stack, drawer, cards, menús)
│       ├── logic/       apiBase, cloudHistory, attachments, appVariant…
│       └── shims/       localStorage→AsyncStorage
├── ios/App          Capacitor legacy (candidato a borrar)
├── docs/ui-audit/   auditorías previas (README.md funcional, aesthetics.md estética)
└── scripts/         local-runtime (LaunchAgents), ui-audit (idb), setup release
```

Basura en raíz: `fix*.py`, `search_*.py`, `update_footer_animation.py`, `generate_native_composer.py`, `atom-demo/`, `atom-icon.html`, `NUCLEO_MOBILE_FULL_EXPORT.md` (258 KB) — restos de sesiones, sin uso.

## 3. Mapa pantalla SPEC → archivo

| SPEC §5 | Archivo(s) móvil | Estado vs SPEC |
|---------|------------------|----------------|
| 5.1 Home | `mobile/src/screens/InputScreen.tsx` + `ComposerDock/Surface`, `IntentSelector`, `ModelChip`, `AttachMenu*` | **A medias** — falta card Continuar, Recientes, demo primer uso, selector de modo dentro del input, preselección por fuente, placeholder estático |
| 5.2 Generación | `LoadingScreen.tsx` + `LoadingState.tsx` + `ExactLiquidOrbWebView` | **A medias** — orbe+fases+streaming OK; textos de fase distintos; glifo es átomo React |
| 5.3 Introducción | `ResultScreen.tsx` (renderResumen) + `SourceMetadataGlassCard` | **Casi** — estructura correcta; labels distintos ("Núcleo"/"Señal extraída"); bug CTA safe-area pendiente |
| 5.4 Lectura | `ResultScreen.tsx` (renderStep) + `ReadingProgressBar`, `StepFooterNav`, `StepContentBlocks` | **A medias** — progreso+persistencia+haptics OK; sin swipe, sin "~N min restantes", sin autochequeo, sin secciones, callouts sin sistema 4 colores/3px |
| 5.5 Completado | `ResultScreen.tsx` (renderCompletion) + `CompletionGlassButton`, `TakeawaysGlassCard` | **A medias** — contenido OK; 5 CTAs con mismo peso (viola P5) |
| 5.6 Sidebar | `HistoryDrawer.tsx` + `HistorySheet.tsx` + `HistoryEntryGlassMenu` | **Casi** — índice+fijados+recientes+long-press OK; falta Exportar PDF en menú |
| 5.7 Búsqueda | `SidebarGlassHeader` + `HistoryCategoryFilter` | **A medias** — búsqueda en vivo + chips categoría OK; sin chip Incompletos |
| 5.8 Paywall | — | **Ausente** — cero código de monetización |
| 6.3 PDF | `server.ts:2521-2809` (pdfkit) + `AppSessionContext:1037-1118` (share) | **Casi** — funciona; diseño no sigue paleta SPEC |
| 6.4 Share Ext | — | **Ausente** |
| 6.5 RevenueCat | — | **Ausente** |
| 6.6 Notificaciones | — | **Ausente** (expo-notifications no instalado) |
| 6.7 Colecciones | — | **Ausente** |

Implementado y NO en SPEC: chat "Preguntar al mapa" (`MapChatSheet`, será Pro), sync Supabase completa, variante Clásica (a retirar), tema claro (a retirar), renombrar historial.

## 4. ¿Soporta el stack iOS + Android + web?

**Sí, con matices.** Evaluación por plataforma:

- **iOS:** Expo dev client funcionando; EAS configurado; liquid glass nativo iOS 26 con fallback blur. Listo para TestFlight tras fases de SPEC.
- **Android:** misma base RN. `app.json` tiene config Android (adaptive icon, package). **Riesgo:** `expo-glass-effect` es iOS-only — el fallback blur/rgba ya existe en `GlassSurface`/`LiquidGlassSurface`, pero **nadie ha probado la app en Android** (no hay build EAS Android ejecutada en el repo). Trabajo estimado: días de QA visual, no re-arquitectura.
- **Web:** existe pero es un **fork completo** (`src/ComprensionApp.tsx`, 3.309 líneas monolíticas) que duplica toda la UI. Comparte solo `shared/`. Cada cambio de producto se paga dos veces. Además hay una tercera vía muerta: Capacitor (`ios/App`) que envuelve la web.

### Recomendación (UNA ruta)

**Mantener Expo/RN como única base de producto para iOS+Android; degradar la web a escaparate/companion, no a paridad.** Justificación:
1. El móvil es la fuente de verdad declarada y la implementación más avanzada; migrar a otra base (Flutter/KMP) tiraría ~45 componentes y el sistema glass sin ganancia.
2. React Native soporta ambas stores con esta base; el único hueco real es QA Android (fallbacks glass ya existen).
3. La paridad web total es el mayor coste oculto del repo (3.309 líneas duplicadas). Alternativas: (a) congelar web como demo/landing con generación limitada, o (b) a medio plazo evaluar `react-native-web` sobre la base Expo. Para el objetivo de negocio (stores + suscripción), la web no es bloqueante.
4. **Eliminar** la vía Capacitor (`ios/App`, `capacitor.config.ts`, deps `@capacitor/*`): tercera plataforma fantasma que confunde builds y añade 7 dependencias.

## 5. Deuda estructural crítica (resumen; detalle en AUDIT.md)

1. `server.ts` monolito 2.830 líneas: API + scraping + calidad + PDF + estáticos, sin auth efectiva ni metering por usuario.
2. `AppSessionContext.tsx` god-context 1.268 líneas (composer ya aislado).
3. Fork Clásica (3 pantallas) + web ClassicApp muerto (2.637 líneas).
4. 7+ componentes huérfanos (ModelSelector, NucleoIcon, cadena QuantumOrb/AtomCanvas/InteractiveAtomOrb, LiquidGlassOrb*).
5. Cero tests, cero CI, cero crash reporting, cero analítica.
