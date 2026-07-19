# ADHD Action Maps: repository instructions

This repository is the single source of truth for the project formerly called
`optimizador-tdah` and `tdah-optimizar-codex`.

## Canonical product

- The current product client is the Expo/React Native app in `mobile/`.
- Its visual identity uses Liquid Glass surfaces, a top `Entender / Aplicar`
  pill, and no model selector in the composer.
- `server.ts` and `shared/` support that client.
- The root browser client in `src/` is retained as a legacy/reference client.
  Do not use it as the visual source of truth and do not port its old composer
  UI back into `mobile/`.
- Read `mobile/AGENTS.md` before changing anything under `mobile/`.

## Local workflow

Use the repository root as the workspace in Codex, Cursor, Antigravity, or any
other editor. Use the Node version in `.nvmrc`.

```bash
nvm use
npm ci
cd mobile && npm ci --legacy-peer-deps
```

Backend, from the repository root:

```bash
cp .env.example .env
npm run dev
```

Expo client, from a second terminal:

```bash
cd mobile
cp .env.example .env
npm run start:dev-client
```

Never commit `.env` files or API keys.

## Validation

Run the checks relevant to the files changed. The normal baseline is:

```bash
npm test
npm run build
npm run lint --prefix mobile
npm run lint --prefix mobile/orb-web
npm run build --prefix mobile/orb-web
```

The root `npm run lint` currently has known pre-existing TypeScript errors; do
not silently expand that baseline.

## Git discipline

- `main` is the canonical integration branch.
- Start work from an up-to-date `main` and use a short-lived feature branch.
- Do not force-push `main` or delete recovery branches/tags.
- Before editing, inspect `git status` and preserve unrelated user changes.
- The recovery provenance and old branch names are documented in
  `docs/RECOVERY.md`.
