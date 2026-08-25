import { describe, expect, it } from 'vitest';
import { EDITORIAL_ASSET_CATALOG } from './visualLibrary';
import { selectVisualAsset } from './selectVisualAsset';

/**
 * Legacy hand-drawn sceneMarkup is no longer the active paint path.
 * Keep a smoke check that semantic selection still resolves local modules.
 */
describe('editorial local modules (replaces sceneMarkup paint)', () => {
  it('hero and metaphors resolve to bundled localModule ids', () => {
    const hero = selectVisualAsset({ intent: 'progress-toward-goal', role: 'hero' });
    expect(hero.asset.localModule).toBe('hiking');

    const delay = selectVisualAsset({ intent: 'procrastination', role: 'metaphor' });
    expect(delay.asset.localModule).toBe('procrastination');
  });

  it('every catalog entry has a unique localModule', () => {
    const modules = EDITORIAL_ASSET_CATALOG.map((a) => a.localModule);
    expect(new Set(modules).size).toBe(modules.length);
  });
});
