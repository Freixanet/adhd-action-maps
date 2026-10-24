# Action Maps

Turn dense source material into a navigable explanation: a core idea, a short summary and timed next steps. The extraction records what it covered so the map can communicate its scope.

## What it does

- Paste text, notes or a transcript.
- Supply a web link or upload a text, Markdown, CSV or PDF file.
- Read an explanation and work through its next steps.
- Split longer sources into collections, with progress and history.

## Current implementation

The main client lives in **`mobile/`**, built with Expo and React Native. The Express backend and shared domain code live at the repository root. `src/` is the earlier browser client and remains available for reference.

| Part | Responsibility |
| --- | --- |
| `mobile/` | Current product interface |
| `server.ts`, `youtube.ts` | Source ingestion and Gemini requests |
| `shared/` | Map and collection behavior, with unit tests |
| `src/` | Earlier browser client |
| `supabase/migrations/` | Account-scoped storage and sync groundwork |

## Run locally

Use Node.js 22.13.0 from `.nvmrc`. Configure a local `.env` with `GEMINI_API_KEY`; an optional `GEMINI_MODEL` selects the model.

```sh
nvm use
npm ci
npm run dev
```

In a second terminal:

```sh
cd mobile
npm ci --legacy-peer-deps
cp .env.example .env
npm run start:dev-client
```

The backend also serves the earlier browser client at `http://localhost:3000`.

## Checks and build

```sh
npm test
npm run lint
npm run lint --prefix mobile
npm run build
```

The root and mobile client have separate dependency installations. The root test suite covers shared map and collection logic; it does not establish native interaction quality or live model accuracy.

## Architecture and deployment

Read [the architecture](ARCHITECTURE.md) and [native foundations](docs/NATIVE_FOUNDATION.md) for the implementation boundaries and staging checks. Native iOS and Android tracks are experiments alongside the Expo client.

Built by [Marcos Freixanet](https://github.com/Freixanet) · [Contact](mailto:mfreixanet@icloud.com).
