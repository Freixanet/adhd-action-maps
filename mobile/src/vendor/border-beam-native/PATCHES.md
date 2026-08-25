# Patches against upstream border-beam-native

Pinned commit: `647d26e2a27f26587110fea5a8410c80deb5ac5e`

No visual or shader parameters have been altered.

## Current patches

### Reanimated 4 worklet compatibility (`src/rotateShader.ts`)

**Symptom (Nucleo):** The pulse renderer calls `padTo` while deriving Skia
uniforms on the UI thread. Reanimated 4 rejected that imported helper at
runtime with `Tried to synchronously call a non-worklet function on the UI
thread`, so the pulse failed to render.

**Change:** Add the `worklet` directive to the pure `padTo` helper. Its logic,
inputs and output are unchanged.

**Why allowed:** Execution-context annotation only; no layout, shader, preset,
color, duration, or strength values are changed.
