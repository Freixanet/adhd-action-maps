# Canonical repository and recovery record

## Decision

The canonical project is GitHub repository `Freixanet/adhd-action-maps` and its
default branch `main`. The canonical local checkout is:

```text
~/Projects/adhd-action-maps
```

Always open that folder as the workspace, regardless of whether the editor is
Codex, Cursor, Antigravity, VS Code, or another tool.

## Recovered version

The Liquid Glass product line was recovered from commit:

```text
87e8036171cf9cd7f8f48fdce975df22bc7a3f2d
```

It was present on both of these historical branches:

- `codex/cursor-ios-agent-local`
- `test/cursor-ios-agent`

That commit contains the desired visual signature: Liquid Glass components,
the top `Entender / Aplicar` pill, and no model selector in the composer. The
two documentation commits that had independently landed on the former `main`
line were merged into the recovered line without rewriting history.

## Old names and copies

The following names are historical aliases, not separate current projects:

- `optimizador-tdah`
- `tdah-optimizar-codex`
- `TDAH Optimizer`

The pre-recovery local checkout is archived intact, including its working-tree
changes and Git stash. Compatibility symlinks may point old local folder names
to `~/Projects/adhd-action-maps`; do not mistake the archived folder for the
canonical checkout.

## Branch rules

- `main`: current, canonical, and expected starting point.
- `agent/*`, `codex/*`, `test/*`, `stabilize/*`: working or historical lines;
  useful for archaeology, not the default source of truth.
- Recovery tags beginning with `recovery/` are immutable reference points.

Do not force-push `main`, delete recovery references, or copy code between old
folders manually. Commit work in the canonical checkout and push it to GitHub.
