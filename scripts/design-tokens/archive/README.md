# Archived one-shot migration scripts

These scripts (`migrate-batch`, `migrate-pass2`, `fix-remaining`) were used during
the initial design-token migration. They can rewrite large parts of `mobile/` and
`fix-remaining` could append `design-token-ignore` automatically.

Do **not** re-run them. Token work goes through:

1. Edit `shared/design-tokens/canonical.json`
2. `npm run tokens:generate`
3. Consume `@shared/design-tokens` in components
4. `npm run check:design-tokens`

Kept only as historical reference.
