# ADHD Action Maps

Turn messy input into **navigable action maps**. Dense text, YouTube transcripts, web links, or PDFs become a structured, low-friction format: core idea, TL;DR, and timed next steps.

## Canonical project status

This is the single repository for the project previously known as
`optimizador-tdah` and `tdah-optimizar-codex`.

- **Current product UI:** `mobile/` (Expo / React Native)
- **Visual signature:** Liquid Glass, top `Entender / Aplicar` pill, and no
  model selector in the composer
- **Backend and shared domain code:** `server.ts` and `shared/`
- **Legacy/reference browser client:** `src/`

Open the repository root in Codex, Cursor, Antigravity, or another editor. The
tool-specific instruction files all point to the same project rules in
[`AGENTS.md`](AGENTS.md). See [`docs/RECOVERY.md`](docs/RECOVERY.md) for the
recovered version and historical names.

---

## What it does

- **Text / transcript** — paste chaotic notes or a YouTube transcript
- **Link** — server-side page fetch + readable text extraction
- **File** — upload `.txt`, `.md`, `.csv`, or `.pdf`
- **Output** — title, central idea, quick summary, and steps with estimated time

Built for ADHD-friendly consumption: less wall-of-text, more executable structure.

---

## Requirements

- Node.js 22.13.0 (see `.nvmrc`)
- Gemini API key (`GEMINI_API_KEY`)

---

## Run the canonical app locally

1. Select Node and install backend/shared dependencies:

   ```bash
   nvm use
   npm ci
   ```

2. Configure `.env`:

   ```env
   GEMINI_API_KEY=your_key_here
   # Optional:
   GEMINI_MODEL=gemini-3.5-flash
   ```

3. Start the backend from the repository root:

   ```bash
   npm run dev
   ```

4. In a second terminal, install and start the Expo client:

   ```bash
   cd mobile
   npm ci --legacy-peer-deps
   cp .env.example .env
   npm run start:dev-client
   ```

The server also exposes the legacy browser client at
[http://localhost:3000](http://localhost:3000); it is not the canonical UI.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Express + Vite (development) |
| `npm run build` | Frontend build + server bundle |
| `npm run start` | Production server |
| `npm run lint` | TypeScript typecheck |
| `npm test` | Shared/backend test suite |
| `npm run lint --prefix mobile` | Expo client typecheck |

---

## Stack

- React 19 + Vite + Tailwind CSS v4
- Express (`/api/transform`)
- Google Gemini API (`@google/genai`)
- Capacitor / native tracks for iOS & Android experiments

---

## Native apps & sync (staging first)

See [`docs/NATIVE_FOUNDATION.md`](docs/NATIVE_FOUNDATION.md) for the reversible plan, checkpoints, and local commands.

- `ios/` — iOS 17+ SwiftUI app with a UIKit document bridge. Generate the Xcode project with `cd ios && xcodegen generate` (no secrets in git).
- `android/` — Android 10+ Compose base with Room and DataStore. Requires a local JDK for Gradle.
- `supabase/migrations/` — additive migration for **staging first**. RLS policies keep maps private per account.
- Web works without Supabase. With `VITE_SUPABASE_*`, profile auth supports **Google** or **email + password**, and migrates local history on sign-in.
- Railway can use `railway.toml`; set secrets in the dashboard, never in git.

Before production: register web/iOS/Android redirect URLs in Supabase and test OAuth, RLS, migration, offline use, and multi-device conflicts in staging.

---

## Author

**Marcos Freixanet** · [github.com/Freixanet](https://github.com/Freixanet) · mfreixanet@icloud.com
