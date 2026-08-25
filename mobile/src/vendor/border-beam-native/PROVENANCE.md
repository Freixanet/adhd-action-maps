# Provenance — border-beam-native (vendored)

## Upstream

- Repository: https://github.com/Jakubantalik/border-beam
- Upstream path: `ports/react-native/border-beam-native/`
- Commit (pinned): `647d26e2a27f26587110fea5a8410c80deb5ac5e`
- Date pinned: 2026-08-03
- License: MIT (see `LICENSE` in this directory)

## What was copied

Contents of `ports/react-native/border-beam-native/src/` plus `package.json`,
`README.md`, `tsconfig.json`, and the repository `LICENSE`.

Not copied: the Expo example app, `node_modules`, build/`lib` outputs,
or `package-lock.json`.

## Why vendored

`npm install border-beam-native` returns 404. Nucleo already provides the peer
dependencies (`@shopify/react-native-skia`, `react-native-reanimated`).

## Patches

See `PATCHES.md` for any Nucleo-local diffs against upstream (if any).
