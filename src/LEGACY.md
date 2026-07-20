# Web client — legacy / reference only

The React app under `src/` is **not** the product UI.

- Canonical client: Expo app in `../mobile/` (Liquid Glass, Entender/Aplicar pill, no model selector in composer).
- Do not port Classic or old composer patterns back into `mobile/`.
- `ClassicApp` remains available only as a local reference via `appVariant`; prefer Comprensión.
- Backend shared with mobile: root `server.ts` + `shared/`.

See root `AGENTS.md` and `ARCHITECTURE.md`.
