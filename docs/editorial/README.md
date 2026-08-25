# Editorial results system (first vertical)

## Goal

Nucleo designs the reading path automatically. The user does not choose
Entender / Aplicar before generation. Pages are native React Native layout;
illustrations are a separate layer (`IllustrationSpec` → local catalog or
Streamline). Full-page raster images are forbidden.

## Copy limits (planner / LLM)

If copy exceeds these budgets, the model must synthesize — never pad. The client
keeps fixed type sizes and scrolls as fallback (`EditorialPlanHost`); it must
not auto-shrink typography.

| Surface | Limit |
|---------|--------|
| Cover title | ≤ 3 lines |
| Other page titles | ≤ 2 lines |
| Lede (`page.body`) | ≤ 3 lines |
| Block title (`items[].title`) | ≤ 2 lines |
| Description (`items[].body`) | ideal 2–3 lines |
| Callout / claim | ≤ 3 lines |
| Sequence labels (experiment/process) | ≤ 2 words |

Source of truth: `shared/editorial/copyLimits.ts`
(`EDITORIAL_COPY_LIMITS_CONTRACT`, soft char caps, `collectEditorialCopyLimitIssues`).
Inject the contract into planner prompts next to `NO_AI_SLOP_WRITING_CONTRACT`.

## Style

Production style id: `nucleo-editorial-v1` only. Models must not invent styles,
colors, or stroke recipes. Local monoline glyphs are the default look.

Streamline family choice for later production (pending license confirmation):
prefer **monoline / line** free assets over filled / 3D / duotone. UX Line vs
New York Monoline must be confirmed with real Streamline samples before locking;
until then local glyphs ship the vertical.

## Modules

| Path | Role |
|------|------|
| `shared/editorial/` | Contracts, validation, fixtures, local catalog, selection |
| `server/src/illustrations/providers.ts` | Streamline + local providers (server only) |
| `mobile/src/editorial/` | Page renderers + DEV demo map builder |

## Flow

1. `compileEditorialPlan` (deterministic fixtures today; Gemini planner later).
2. Per-page `IllustrationSpec` with 3–6 tags.
3. `selectIllustration` scores local catalog (+ optional Streamline candidates).
4. Below confidence threshold → fallback asset or `none` (never wrong art).
5. `ActionMapData.editorialPlan` + `generationMode: 'editorial-v1'`.
6. `ResultScreen` hosts `EditorialPlanHost` for editorial maps.

## Environment

```bash
# Server only — never EXPO_PUBLIC / VITE_
STREAMLINE_API_KEY=
# Optional soft timeout ms for Streamline search (default 1200)
STREAMLINE_SEARCH_TIMEOUT_MS=1200
```

App works with an empty key (local catalog only).

## License / attribution (pending confirmation with Streamline)

Before production use of Streamline assets, confirm:

1. Free-tier attribution requirements for in-app display.
2. Whether SVG may be cached on device or must stay ephemeral.
3. Redistribution limits for Nucleo’s packaged app stores.
4. Commercial use under the free API plan.

Do not purchase a plan from an agent session. Show `Icons by Streamline` when
`attributionRequired` is true on any resolved asset.

## DEV

Profile menu → **Abrir demo editorial** loads the procrastination fixture
(`EDITORIAL_DEMO_NUCLEO_ID`) with six native pages and local glyphs.

## Next vertical

1. Gemini structured planner behind `compileEditorialPlan` (same contracts).
2. Progressive page streaming into `editorialPlan.pages`.
3. Confirm Streamline style lock + ephemeral SVG download path.
4. Wire live transform route to emit `editorialPlan` for text sources.
