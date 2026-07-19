# Mobile preview bridge (`mobile-preview`)

Preview on your iPhone changes pushed by **Cursor mobile / Cursor Agents** on branch `mobile-preview`, without touching your main local checkout.

## How it works

| Piece | Role |
|-------|------|
| **`mobile-preview` branch** | Cursor mobile commits here and pushes to `origin`. |
| **Main folder** (`Untitled/`) | Your normal work; never hard-reset by this setup. |
| **Mirror worktree** (`../Untitled-mobile-preview/`) | Separate checkout; auto `git reset --hard origin/mobile-preview` every 3s. |
| **Expo LAN (port 8082)** | Runs from the mirror’s `mobile/` folder; iPhone loads the bundle over local WiFi. |

Metro watches `shared/` from the repo root (see `mobile/metro.config.js`), so the mirror must be a full repo checkout—not `mobile/` alone.

The bridge uses **port 8082** only. A separate Expo dev server on **8081** (main checkout) is left untouched.

## Start preview (Mac)

From the **main** repo root:

```bash
npm run mobile:preview
```

First run may:

1. Create `origin/mobile-preview` if missing.
2. Create the sibling worktree at `../Untitled-mobile-preview`.
3. Install `mobile/node_modules` in the mirror (npm).
4. Free port **8082** if a previous preview Metro is still running.
5. Start auto-pull + `npx expo start --dev-client --host lan --port 8082`.

### Mac LAN IP

```bash
ipconfig getifaddr en0
```

Example: `192.168.1.16` → on iPhone connect the **dev build** to:

```text
http://192.168.1.16:8082
```

iPhone and Mac must be on the **same WiFi**. No tunnel or ngrok is used.

## Cursor mobile workflow

1. In [cursor.com/agents](https://cursor.com/agents), select repo **Freixanet/optimizador-tdah**.
2. Work **only** on branch **`mobile-preview`**.
3. Let agents commit and push to `origin/mobile-preview`.
4. Within ~3 seconds the mirror pulls; JS/TS/style/asset changes should **Fast Refresh** on the phone.

## What refreshes automatically

Usually fine with Fast Refresh:

- `.tsx` / `.ts` / `.js` under `mobile/` and `shared/`
- NativeWind / CSS changes
- Static assets already bundled by Metro

## What needs a manual restart or rebuild

Stop Expo (`Ctrl+C`) and run `npm run mobile:preview` again, or rebuild the native app if needed:

- New npm dependencies (`package.json` / lockfile)
- `app.json`, `app.config.js`, Expo plugins
- Native permissions, icons, splash
- iOS pods / `expo prebuild` output
- `expo-dev-client` native changes → new EAS/dev build

After dependency changes in the mirror:

```bash
cd ../Untitled-mobile-preview/mobile && npm ci
```

Then restart `npm run mobile:preview` from the main repo.

## Environment variables

If `mobile/.env` exists in your **main** checkout but not in the mirror, the bridge copies it once on startup. Otherwise copy `mobile/.env.example` → `mobile/.env` in either location.

## Stop

Press **`Ctrl+C`** in the terminal running `mobile:preview`. The auto-pull loop is stopped via `trap`.

To stop only the preview Metro on 8082 without touching 8081:

```bash
lsof -ti tcp:8082 | xargs kill -9
```

## Remove the mirror (reversible)

From the **main** repo:

```bash
git worktree remove ../Untitled-mobile-preview
# if git complains about dirty state in the mirror:
# git worktree remove --force ../Untitled-mobile-preview

git worktree prune
```

Optional: delete remote branch only if you no longer need it:

```bash
git push origin --delete mobile-preview
```

Your main checkout and branch are unchanged.

## Do not

- Do not run `git reset --hard` in the main `Untitled/` folder for this workflow.
- Do not point Cursor mobile at other branches if you expect live preview on the phone.
- Do not edit code only in the mirror; changes there are overwritten on every pull.
