# Native foundation checkpoint

This document tracks the reversible native migration without replacing the web app.

## Current status (2026-06-26)

| Phase | Status | Notes |
| --- | --- | --- |
| Backup / safety | Ready | `scripts/backup-working-tree.sh` creates a dated tarball outside the repo. |
| Shared contract | Done | [`shared/contracts.ts`](../shared/contracts.ts) is consumed by web (`src/`) and mobile (`mobile/`) via `@shared/*` alias. |
| Express / Railway | Done | [`server.ts`](../server.ts) keeps `/api/transform`, optional Supabase auth, rate limits, `/health`. |
| Supabase schema | Done | [`supabase/migrations/`](../supabase/migrations/) with RLS. Apply in **staging first**. |
| Web cloud sync | Done (optional) | Web works offline with localStorage. With `VITE_SUPABASE_*`, profile menu offers sign-in and sync. |
| **React Native (official mobile)** | **In progress** | Expo app in [`mobile/`](../mobile/): navigation stack, shared logic, drawer history, loading skeletons, reading progress, theme/model selectors, video attachments. |
| Swift/Kotlin shells | **Archived** | Moved to [`archive/ios-native/`](../archive/ios-native/) and [`archive/android-native/`](../archive/android-native/). |

## Architecture

```
shared/          ← pure TS logic (contracts, history, mapData, urlInput, …)
src/             ← web React + Vite (unchanged UX)
mobile/          ← Expo React Native + NativeWind (official iOS + Android)
server.ts        ← Express API (unchanged)
```

## Reversible rules

- Do not remove the existing web flow or `/api/transform`.
- Prefer extending `shared/` over duplicating logic in `src/` and `mobile/`.
- Do not publish to App Store, Play Store, Supabase prod, or Railway prod until explicitly approved.

## Mobile release (requires human setup)

1. Sync env: `./scripts/setup-mobile-release.sh env`
2. Expo: `cd mobile && npm run eas:login && npm run eas:init`
3. Supabase redirects: `SUPABASE_ACCESS_TOKEN=... ./scripts/setup-mobile-release.sh supabase-redirects`
4. Preview builds: `cd mobile && npm run build:preview`
5. Follow [`mobile/QA_CHECKLIST.md`](../mobile/QA_CHECKLIST.md)

## Local commands

```bash
# Web (unchanged)
npm install
npm run dev

# Mobile (Expo)
cd mobile && npm install && npx expo start

# Type checks
npm run lint
cd mobile && npm run lint
```
