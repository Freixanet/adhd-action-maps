# Visual exceptions

Reviewed deviations from Liquid Glass / calm-UI rules. Do not treat these as a template for new work.

## Composer send disc — 38pt visual, 62pt hit

`COMPOSER_CONTROL_SIZE` is 38pt (`mobile/src/logic/composerText.ts`). `PRESS_HIT_SLOP` is 12pt on all sides (`usePressSpring`), so the effective target is 62pt.

Accepted: the disc stays 38pt so it matches the attach control and the rest composer row. Hit area meets the 44pt floor via hitSlop, not via a larger glyph.

Reviewed with the Task 6 QA sweep and Task 9 polish. Revisit only if the composer row is redesigned.
