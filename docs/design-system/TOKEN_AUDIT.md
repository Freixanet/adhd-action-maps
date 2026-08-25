# Design token audit

Audit refresh: 2026-08-04 (repair of the initial migration)  
Scope: `mobile/` canonical client (not legacy `src/`).  
Baseline of work: local tree (not GitHub main as source of truth).

## Initial exception count (before this repair)

| Metric | Count |
|---|---|
| `design-token-ignore` lines in `mobile/` | **205** |
| Of which `pair with typography()` | 83 |
| Of which `pending alias` / dual-tone wash | 45 |
| Of which Liquid Glass elevation recipe | 27 |
| Of which specialized / viz washes | ~54 |
| Of which `local` / `unmatched` / `legacy` | 6 |

Those “0 checker violations” depended on suppressing unfinished migration work. That is not a clean bill of health.

## After this repair

| Metric | Count |
|---|---|
| Live `design-token-ignore` lines | **2** |
| Allowlisted exceptions | **2** |
| Unauthorized checker violations | **0** (with allowlist enforced) |
| Approximate visual remaps left intentional | **0** (durations/radii/type restored to HEAD metrics via tokens) |

The allowlist is occurrence-based: each entry has a unique id and exact source
line, and can authorize exactly one literal. A duplicate cannot silently reuse
one of the two approved exceptions.

The checker currently scans **126 production TypeScript/TSX files**. Its only
specialized exclusions are the two unreferenced research renderers listed in
`scripts/design-tokens/check.mjs`; `LiquidOrbSkia` is part of the normal scan.

### Allowlisted exceptions (complete list)

1. **`mobile/src/components/blocks/CalloutBlock.tsx`** — `color-rgb` / `rgba(`  
   Reason: `runtime alpha wash from brand.accentRgb channels`  
   Why inevitable: fallback tint builds `rgba(r,g,b,alpha)` from `primitive.color.brand.accentRgb` when hex parse fails.

2. **`mobile/src/components/blocks/CalloutBlock.tsx`** — `color-rgb` / `rgba(`  
   Reason: `runtime alpha wash from parsed hex channels`  
   Why inevitable: channels come from `Number.parseInt` on a runtime hex; alpha is a call argument.

### Migrated (not ignored)

Rough accounting of former ignore/debt that is now tokenized:

| Category | Approx. migrated |
|---|---|
| Typography pair-with / incomplete compositions | ~83 ignore sites → `typography(role)` / type roles |
| Dual-tone / wash rgba+hex pending alias | ~45 → `color.background.*` / `color.action.*` / `color.text.*` |
| Liquid Glass elevation recipes | ~27 → `shadow.glassFloating*` / `shadow.glassCallout` / `shadow.glassDrawer` |
| WebView invalid CSS / quoted rgba / TS paths | 9+ sites in `NucleoVisualizeWebView.tsx` → CSS variables from tokens |
| Local duration/radius/unmatched size | 6 → exact motion/radius/type tokens |
| Specialized engraved metal stops | → `engraved.*` |

Exact “infracciones reales migradas” relative to the 205 ignores: **203** removed by tokenization; **2** retained as allowlisted runtime alpha assembly.

## Architecture

| Layer | Location |
|---|---|
| Canonical | `shared/design-tokens/canonical.json` |
| Generated TS | `shared/design-tokens/generated/tokens.ts` |
| Generated CSS | `mobile/src/theme/tokens.generated.css` |
| Facades | `@shared/design-tokens`, `@shared/uiTokens`, editorial re-exports |
| Guard | `npm run check:design-tokens` (+ allowlist budget) |
| Archived migrators | `scripts/design-tokens/archive/` (do not re-run) |

## Visual regressions corrected in this repair

Examples restored to pre-migration HEAD metrics (via tokens, not bare literals):

| Location | Was (migration approx.) | Restored |
|---|---|---|
| HistoryDrawer open | `motion.enter` 250ms | `motion.drawer` 260ms |
| LoadingState fade | 250ms | `motion.fade` 300ms |
| StepFooterNav opacity | `motion.exit` 180ms | `motion.exitSoft` 200ms |
| Accordion collapse | 180ms | 200ms |
| Comparison enter | 420ms | `motion.reveal` 480ms |
| Quiz shake | all 50ms | 40 / 50 / 45 / 40ms |
| Quiz settle | ignored 320 | `motion.quizSettle` 320ms |
| loadingGenerationUi | 420ms | `motion.sheetAlt` 400ms |
| InlineGenerationThread bubble | radius 16 | `radius.bubble` 18 |
| NucleoVisualOverview card | 24 | `radius.overview` 22 |
| NucleoVisualizeWebView shell | 16 | `radius.vizCard` 20 |
| StatBlock display type | split ignores | `typography('display')` 44/50/700/−0.8 |
| WebView CSS | invalid TS paths / quoted rgba | interpolated token CSS vars |
| ExactLiquidOrb fallback | invalid quoted CSS colors | exact orb color/motion tokens |
| Active Skia orb | palette, shadow and animation literals | `color.orb`, `motion.orb*`, `shadow.none` |

## Protection

- New unauthorized literals fail `npm run check:design-tokens`.
- Stale generated CSS/TS fails `npm run tokens:check`.
- Pending/generic ignores fail the checker.
- New ignores without allowlist entries fail CI.
- A single allowlist entry cannot authorize duplicated literals.
- Active scripts cannot auto-write `design-token-ignore`.
- All first-party WebView templates receive a CSS-integrity check, including the orb fallback.

## Validation run (2026-08-04)

- `npm run tokens:generate`: passed; fingerprint `e05c01c324ba142f`.
- `npm run tokens:check`: passed (generated artifacts current).
- `node scripts/design-tokens/check.mjs`: passed — 126 production files, 0 findings, 2 allowlisted occurrences.
- `npx vitest run shared/design-tokens/designTokens.test.ts`: passed — 29/29.
- `npm run mobile:check:shared-resolve`: passed.
- `npm run lint --prefix mobile`: blocked by two syntax errors in vendored `orb-web/node_modules/@types/three` declarations; no app-source error was emitted.
- `npm run mobile:bundle:ios`: did not reach an export result because Expo attempted to claim the already-running Metro port 8081; the attempt was stopped after it produced no `metadata.json`.
- `git diff --check`: passed.

The real-simulator attempt is recorded in `docs/design-system/evidence/token-final-2026-08-04/`. Rebuilding the installed Nucleo Dev Client linked the already-declared `react-native-netinfo` pod and removed the `RNCNetInfo is null` startup error. The real input screen is now captured, but the complete visual matrix is still pending.

Toolchain note: `mobile/package-lock.json` intentionally governs the mobile
package with TypeScript **6.0.3** and `ignoreDeprecations: "6.0"`; the repository
root independently uses TypeScript **5.8.3**. Running the root compiler against
`mobile/tsconfig.ci.json` is therefore not the supported mobile check and fails
early with `TS5103`; `npm run lint --prefix mobile` is the authoritative command.

## Pre-existing TypeScript errors (unchanged baseline)

`mobile` `tsc -p tsconfig.ci.json` still reports exactly these 5 (IconProps / `absoluteFillObject`):

- ContinueChip.tsx
- KnowledgeSectionsList.tsx
- MapChatSheet.tsx
- NativeGlassButton.tsx
- SourceCoverageCard.tsx
