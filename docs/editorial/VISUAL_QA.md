# Editorial visual QA

## Captures (source of truth for this vertical)

- `captures/01-cover.png`
- `captures/02-enemies.png`
- `captures/03-experiment.png`
- Preview HTML: `captures/_preview.html` (same SVG markup as the app)

## Audit (confirmed)

| Finding | Reality |
|---|---|
| Pages not using Streamline UI | Fixed: pages go through `EditorialIllustration` → local scene first; spots may use `StreamlineOrLocalIllustration` |
| Streamline API product type | **Icons** only (`docs.streamlinehq.com`). Locked family `ux-line` = UX Line icons |
| UX Line for editorial heroes? | **No** — icons ≠ full editorial illustrations |
| Fixture content | Demo still driven by fixtures; two topics: procrastination + attention |
| No STREAMLINE_API_KEY | Local family paints; Streamline returns empty |

## Architecture

1. Library — `shared/editorial/visualLibrary.ts`
2. Selector — `shared/editorial/selectVisualAsset.ts` (deterministic, diversity-aware)
3. Markup — `shared/editorial/sceneMarkup.ts` (shared SVG family)
4. Compositor — `mobile/src/editorial/EditorialIllustration.tsx`
5. Pages — Cover / Enemies / Experiment renderers

## Honest quality note

Heroes are **Nucleo-authored path-based editorial compositions**, not a licensed commercial illustration pack and not Streamline. They are denser than the earlier stick/glyph prototype, but they are still a silhouette family. Licensing a coherent commercial illustration set (or Streamline Illustrations outside the Icons API, if product terms allow) is the next leap for “premium pack” look.
