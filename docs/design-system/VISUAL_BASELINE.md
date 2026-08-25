# Visual baseline (design-token migration repair)

Date: 2026-08-04  
Goal: same look as pre-migration HEAD metrics — **no redesign**.

## Required surfaces

| Surface | Status this run | Evidence |
|---|---|---|
| Inicio / Input | **Verified live after rebuilding the Dev Client** — Nucleo loads the real dark input screen; no `RNCNetInfo` runtime error | `evidence/token-final-2026-08-04/05-rebuilt-client-loaded.png` |
| Loading | Not verified live | — |
| Creación/importación de fuente | Not verified live | — |
| Resultado / núcleo normal | Not verified live | — |
| Núcleo editorial | Prior captures only (pre-repair) | `references/editorial-*-prior.png` from `docs/editorial/captures/` |
| Formularios | Not verified live | — |
| Modal / sheet | Not verified live | Partial: Simulator system dialog screenshots only |
| `NucleoVisualizeWebView` CSS | **Verified** via token-resolved HTML at 390px + unit lint | `webview-causal-token-css.html`, `webview-causal-390.png` |
| Claro / oscuro | Not verified live this run | — |
| ~390px width | WebView sample at 390×844 | `webview-causal-390.png` |

## Capture paths (this repair)

Directory: `docs/design-system/evidence/token-repair-2026-08-04/`

| File | What it shows |
|---|---|
| `01-launch.png` … `11-after-return.png` | Real Simulator I/O — mostly Expo Dev Client launcher / Safari handoff / home screen. **Not** product UI. |
| `webview-causal-390.png` | Real Chromium headless render of causal-flow CSS vars from generated tokens (390px). |
| `webview-causal-token-css.html` | Source HTML for that render. |
| `references/*-prior.png` | Prior in-repo product captures for comparison when live re-capture is available. |

Additional real-simulator attempt: `docs/design-system/evidence/token-final-2026-08-04/`

| File | What it shows |
|---|---|
| `01-launch.png` | Failed launch using an incorrect bundle id; simulator state only. |
| `02-nucleo-launch.png` | Real Nucleo development client waiting for Metro. |
| `03-nucleo-metro.png` | Real system “Open in Nucleo?” confirmation over the dev client and the `RNCNetInfo is null` runtime error behind it. |
| `04-rebuilt-client.png` | Newly rebuilt Nucleo client downloading the Metro bundle. |
| `05-rebuilt-client-loaded.png` | Real Nucleo input screen after the native rebuild; `RNCNetInfo` is linked and the app starts. |

## Diff vs HEAD (metric restoration)

Restored from local `git show HEAD` where the migrator approximated values (examples in `TOKEN_AUDIT.md`): durations 40/45/200/260/300/320/400/480, radii 18/20/22, typography compositions, WebView washes.

## How to finish visual sign-off

On a Simulator or device already connected to Metro:

```bash
xcrun simctl io booted screenshot docs/design-system/evidence/token-repair-2026-08-04/<name>.png
```

Capture Input, Loading, source import, Result, Editorial, a form, a sheet, Visualize, light+dark, at ~390pt width. Compare to `references/` and HEAD behavior.

## Honest limitation

The stale development-client blocker was resolved by rebuilding and reinstalling
Nucleo on the iPhone 17 Pro simulator; the app now starts and the input surface
has real evidence. The remaining loading/result/editorial/form/sheet/light-mode
matrix still lacks live interaction evidence, so the overall visual matrix
remains **not approved**.
