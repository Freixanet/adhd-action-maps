# Design tokens

## Source of truth

Edit **`shared/design-tokens/canonical.json`** only.

Derived files (do not edit by hand):

- `shared/design-tokens/generated/tokens.ts`
- `mobile/src/theme/tokens.generated.css` (imported by `mobile/global.css`)

Public TypeScript entry: **`@shared/design-tokens`**  
Legacy aliases: `@shared/uiTokens` (re-exports the same resolved values)

Do not import `shared/design-tokens/generated/*` from app code.

## Layers

1. **Primitive** — palette, space scale, type sizes, radii, durations, springs, elevations.
2. **Semantic** — intent names (`color.text.primary`, `space.screen.horizontal`, `type.body`, `motion.enter`, `shadow.glassFloating`).
3. **Specialized** — Liquid Glass / engraved mark recipes (`glass.*`, `engraved.*`).

Prefer semantic names that express role (`surface`, `text.secondary`, `motion.loading`) over appearance-only labels (`gray7`, `duration300`), except for a clearly defined foundational scale.

## Commands

```bash
npm run tokens:generate      # write derived TS + CSS (deterministic)
npm run tokens:check         # fail if derived files are stale
npm run check:design-tokens  # stale check + production UI lint + exception budget
npm run validate             # design tokens + unit tests + mobile checks
```

## Add or change a token

1. Confirm the value is a reusable decision (not one-off geometry).
2. Search for an existing semantic role with the same meaning and exact value.
3. Add a primitive only if the value is new.
4. Add the semantic alias with an intent-based name.
5. `npm run tokens:generate`
6. Consume via `@shared/design-tokens` (or `@shared/uiTokens` aliases).
7. `npm run check:design-tokens`
8. Document non-obvious roles in `TOKEN_AUDIT.md` when needed.

Do not create a token only to silence the checker, and do not approximate a previous metric to a nearby token.

## Theme colors

Semantic colors are dual-theme:

- `themeColor.dark` / `themeColor.light` — full palettes
- `colorsFor('light' | 'dark')` — resolver
- Deprecated static `color` — **always dark** (compat only)

In React Native, prefer `useThemeColors()` from `ThemeContext` for StyleSheet/inline styles. Uniwind classes (`bg-base`, `text-body`, …) follow `Uniwind.setTheme(scheme)`.

`@shared/uiTokens` static aliases (`BG_BASE`, `TEXT_PRIMARY`, …) remain dark-only. Use `uiColorsFor(scheme)` or `useThemeColors()` for theme-aware painting.

Light direction: porcelain canvas `#F7F7FB`, graphite text, iris accent `#5B60D4`.

## Usage examples

```tsx
import { typography, radius, motion, shadow, space, colorsFor } from '@shared/design-tokens';
import { useThemeColors } from '../context/ThemeContext';

function Card() {
  const colors = useThemeColors();
  return (
    <View style={{ backgroundColor: colors.background.surface, borderColor: colors.border.default }}>
      <Text style={{ color: colors.text.primary, ...typography('pageTitle') }} />
    </View>
  );
}
```

```tsx
// Wrong — static `color` / uiTokens aliases ignore light mode
import { color } from '@shared/design-tokens';
import { BG_BASE, TEXT_PRIMARY } from '@shared/uiTokens';
```

```tsx
// Wrong
<Text style={{ fontSize: 15, color: '#FAFAFA' }} className="text-[15px]" />
```

## Exceptions

A `design-token-ignore: <reason>` is allowed only when the value is **inevitable** (dynamic channel math, vendor code, intrinsic icon geometry, external API). The reason must be concrete and must **not** contain unfinished-work language (`pending`, `todo`, `legacy`, `local`, `pair with`, `unmatched`, …).

Every live exception must also appear in:

`scripts/design-tokens/exception-allowlist.json`

CI fails if:

- a new ignore appears without an allowlist entry
- an allowlist entry is stale
- an ignore reason is empty, generic, or marks migration debt
- an allowlist entry has no unique id or exact source line
- one allowlist entry is used by more than one literal

Current budget: **2** exceptions (both in `CalloutBlock` runtime alpha washes). See `TOKEN_AUDIT.md`.

## Checker

`scripts/design-tokens/check.mjs` scans production UI paths and fails on hex/rgba,
direct type metrics, radii, shadows, elevations, durations, and arbitrary visual
classes. Vendor code, generated SVG/XML bundles, tests, fixtures, and assets are
excluded. The only specialized exclusions are two unreferenced research
renderers (`OrbHtmlIterationWebView.tsx` and `liquidGlassAtomOrbShared.ts`),
kept explicit so their palette/geometry data cannot hide product UI drift.
The active Skia orb and all first-party WebView templates, including orb
fallbacks, are checked for token usage and invalid CSS values.

One-shot migrators that could rewrite the app or auto-append ignores are archived
under `scripts/design-tokens/archive/` and must not be re-run.
