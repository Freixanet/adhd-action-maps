# ARCHITECTURE.md — Inventario técnico de Núcleo

**Fecha:** 20 jul 2026 · **Fuente de producto:** `SPEC.md` · **Cliente canónico:** `mobile/`

---

## 1. Stack detectado

| Capa | Tecnología | Ubicación | Estado |
|------|-----------|-----------|--------|
| **Móvil (fuente de verdad)** | Expo 56 · React Native · NativeWind 4 · Reanimated · Skia · expo-glass-effect · FlashList | `mobile/` | Activo |
| **Web (legacy / reference)** | React 19 · Vite 6 · Tailwind | `src/` | Solo referencia; no es UI canónica |
| **Backend** | Node · Express · Gemini · pdfkit · youtube-transcript | `server.ts` + `server/` (auth, remote fetch, legal) | Activo (Railway) |
| **Sync/Auth** | Supabase Auth + RLS | `supabase/migrations/` | Requiere proyecto vivo; host muerto tratado como unset |
| **Monetización** | RevenueCat (cliente) + allowlist Pro servidor | `mobile/src/logic/proPurchases.ts`, `shared/proEntitlement.ts` | Paywall UI; SDK nativo pendiente de rebuild |
| **Compartido** | Contratos, history, stream, tokens, quotas, SSRF | `shared/` | Activo |
| **Tests** | Vitest | `shared/*.test.ts`, root `npm test` | Activo |
| **CI** | GitHub Actions | `.github/workflows/ci.yml` | test + mobile `tsc` (sin orb-web) |

## 2. Estructura del repo

```
/                    server.ts, package.json, Dockerfile, railway.toml
├── server/          llmAccess, remoteContent, legalPages (extraídos del monolito)
├── SPEC.md / PLAN.md / AGENTS.md
├── shared/          contratos y lógica compartida
├── src/             web legacy/reference (ver src/LEGACY.md)
├── mobile/          app Expo (única UI de producto)
│   ├── App.tsx
│   └── src/ context · screens · components · logic · hooks
├── supabase/migrations/
├── docs/            AUDIT, ui-audit, recovery
└── scripts/         local-runtime, release
```

## 3. Mapa pantalla SPEC → móvil (jul 2026)

| SPEC | Estado |
|------|--------|
| 5.1 Home | Continuar card + Recientes + demo primer uso |
| 5.2 Generación | Inline thread + glifo de carga (`NucleoGlyphOrb`); Three.js en Preview orb |
| 5.3–5.4 Lectura | Swipe, remaining, secciones, chrome hide nav+footer |
| 5.5 Completado | CTA jerarquía SPEC (Repasar \| Preguntar → PDF → Nuevo Núcleo) |
| 5.6–5.7 Sidebar | Índice, fijados, recientes, búsqueda, incompletos |
| 5.8 Paywall | Modal + triggers Profundo / Preguntar / free_limit |
| 6.3 PDF | Share sheet; gratis |
| 6.5 Metering | JWT + quotas server-side (in-memory; tabla `usage_daily` lista) |
| Legal | `/privacidad`, `/terminos`, delete account path |

## 4. Plataformas

- **iOS:** vía canónica (dev client / EAS).
- **Android:** misma base; glass con fallback.
- **Web `src/`:** legacy. No portar composer/UI antigua a `mobile/`.

## 5. Deuda estructural restante

1. Partir más `server.ts` / `AppSessionContext` (ya hay primeros módulos).
2. RevenueCat nativo + entitlement server-side (hoy allowlist email en API).
3. Nuevo proyecto Supabase + rotar keys EAS/Railway.
4. Hex sprawl / tipografía tokenizada (P2 parcial).
