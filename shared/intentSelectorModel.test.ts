import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  clampSelectorProgress,
  intentSelectorAccessibilityLabel,
  intentToSelectorIndex,
  projectPanToSelectorIndex,
  resolveIntentSelectorCommit,
  selectorIndexToIntent,
  shouldAnimateIntentThumb,
} from './intentSelectorModel';

describe('intentSelectorModel', () => {
  it('maps intent ↔ index', () => {
    expect(intentToSelectorIndex('understand')).toBe(0);
    expect(intentToSelectorIndex('apply')).toBe(1);
    expect(selectorIndexToIntent(0)).toBe('understand');
    expect(selectorIndexToIntent(1)).toBe('apply');
  });

  it('commits only on real change', () => {
    expect(
      resolveIntentSelectorCommit({ current: 'understand', nextIndex: 0 }).changed
    ).toBe(false);
    expect(
      resolveIntentSelectorCommit({ current: 'understand', nextIndex: 1 })
    ).toEqual({ intent: 'apply', index: 1, changed: true });
  });

  it('projects pan + velocity to a segment', () => {
    expect(projectPanToSelectorIndex(0.4, 0)).toBe(0);
    expect(projectPanToSelectorIndex(0.6, 0)).toBe(1);
    expect(clampSelectorProgress(-1)).toBe(0);
    expect(clampSelectorProgress(2)).toBe(1);
  });

  it('respects reduceMotion for thumb animation', () => {
    expect(shouldAnimateIntentThumb(true)).toBe(false);
    expect(shouldAnimateIntentThumb(false)).toBe(true);
  });

  it('labels intents for a11y', () => {
    expect(intentSelectorAccessibilityLabel('understand')).toBe('Entender');
    expect(intentSelectorAccessibilityLabel('apply')).toBe('Aplicar');
  });
});

describe('IntentSelector native system segmented product path', () => {
  const source = readFileSync(
    resolve(__dirname, '../mobile/src/components/IntentSelector.tsx'),
    'utf8'
  );
  const flags = readFileSync(
    resolve(__dirname, '../mobile/src/logic/nativeGlassSegment.ts'),
    'utf8'
  );
  const nativeIndex = readFileSync(
    resolve(__dirname, '../mobile/modules/nucleo-glass-segment/src/index.tsx'),
    'utf8'
  );
  const swift = readFileSync(
    resolve(
      __dirname,
      '../mobile/modules/nucleo-glass-segment/ios/NucleoGlassSegmentModule.swift'
    ),
    'utf8'
  );
  const infoPlist = readFileSync(
    resolve(__dirname, '../mobile/ios/Nucleo/Info.plist'),
    'utf8'
  );

  it('uses native Liquid Glass surfaces for the track and selected lens', () => {
    expect(swift).toContain('Picker("Modo"');
    expect(swift).toContain('.pickerStyle(.segmented)');
    expect(swift).toContain('.controlSize(.large)');
    expect(swift).toContain('native_system_segmented');
    expect(swift).toContain('overflowPad');
    expect(swift).toContain('GlassCompositeSegmentedRoot');
    expect(swift).not.toContain('setBackgroundImage');
    expect(swift).toContain('.glassEffect(.regular.interactive(), in: Capsule())');
  });

  it('does not enable UIDesignRequiresCompatibility', () => {
    expect(infoPlist).not.toContain('UIDesignRequiresCompatibility');
  });

  it('auto-activates native when available (no kill-switch false)', () => {
    expect(flags).not.toMatch(/USE_NATIVE_GLASS_SEGMENT\s*=\s*false/);
    expect(flags).toContain('shouldUseNativeGlassSegment');
    expect(flags).toContain('resolveIntentSelectorImplementation');
    expect(flags).toContain('native_system_segmented');
  });

  it('loads native view manager lazily and exposes system segmented mode', () => {
    expect(nativeIndex).toContain('loadNativeView');
    expect(nativeIndex).toContain('getIntentSelectorImplementationMode');
    expect(nativeIndex).toContain('native_system_segmented');
    expect(nativeIndex).toContain('fallback');
    expect(nativeIndex).not.toContain('native_liquid_glass');
  });

  it('keeps RN host transparent without DEV chrome around the control', () => {
    expect(source).toContain("backgroundColor: 'transparent'");
    expect(source).toContain("overflow: 'visible'");
    expect(source).toContain('SolidCapsuleFallback');
    expect(source).toContain('<NucleoGlassSegment');
    expect(source).not.toContain('intent-selector-implementation');
    expect(source).not.toContain('intentSelectorRenderer');
    expect(source).not.toContain('intent-selector-dev-compare');
  });

  it('does not flip global native glass button switches', () => {
    expect(source).not.toContain('USE_NATIVE_GLASS_BUTTONS');
  });
});
