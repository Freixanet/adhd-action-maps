# Mobile release QA checklist

## Setup automático (desde la raíz del repo)

```bash
./scripts/setup-mobile-release.sh env
```

Esto escribe `mobile/.env` con Supabase y API base.

## Pasos que requieren credenciales (una sola vez)

### 1. Expo / EAS

```bash
cd mobile
npm run eas:login          # abre el navegador; inicia sesión en expo.dev
npm run eas:init           # crea el proyecto y rellena extra.eas.projectId
npm run build:preview      # builds internos iOS + Android
```

Alternativa CI: define `EXPO_TOKEN` en el entorno.

### 2. Supabase OAuth redirects

Opción A — script (token personal en https://supabase.com/dashboard/account/tokens):

```bash
SUPABASE_ACCESS_TOKEN=... ./scripts/setup-mobile-release.sh supabase-redirects
```

Opción B — manual en Auth → URL Configuration:

- `nucleo://login-callback`
- `nucleo://**`
- `com.freixanet.nucleo://login-callback`
- `com.nucleo.app://login-callback`
- `exp://**`
- `http://localhost:3000/**`
- `http://127.0.0.1:3000/**`

### 3. Apple / Google (solo para submit a stores)

Configura credenciales en Expo cuando vayas a publicar:

```bash
cd mobile
eas credentials
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

## Functional QA (iOS + Android)

- [ ] App boots after fresh install
- [ ] Input → loading skeleton → result navigation works
- [ ] Text, link, YouTube, PDF, image, and video transforms succeed
- [ ] Step-by-step and lectura completa modes work
- [ ] Reading progress bar updates in both modes
- [ ] Knowledge sections render when present
- [ ] History drawer opens via button and edge swipe
- [ ] Pin, rename, and delete history entries work
- [ ] Theme toggle persists across relaunch
- [ ] Model selector changes preference sent to API
- [ ] Map chat sheet works on an active map
- [ ] OAuth sign-in works when Supabase is configured
- [ ] Haptics fire on key interactions

## Regression (web)

- [ ] `npm run lint && npm run build` pass at repo root
