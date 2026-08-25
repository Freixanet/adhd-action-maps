import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Native system segmented intent selector', () => {
  const moduleSrc = readFileSync(
    resolve(__dirname, '../mobile/modules/nucleo-glass-segment/ios/NucleoGlassSegmentModule.swift'),
    'utf8'
  );
  const flags = readFileSync(
    resolve(__dirname, '../mobile/src/logic/nativeGlassSegment.ts'),
    'utf8'
  );
  const selector = readFileSync(
    resolve(__dirname, '../mobile/src/components/IntentSelector.tsx'),
    'utf8'
  );
  const infoPlist = readFileSync(
    resolve(__dirname, '../mobile/ios/Nucleo/Info.plist'),
    'utf8'
  );

  it('uses native Liquid Glass track with a smaller native selected lens', () => {
    expect(moduleSrc).toContain('Picker("Modo"');
    expect(moduleSrc).toContain('.pickerStyle(.segmented)');
    expect(moduleSrc).toContain('.controlSize(.large)');
    expect(moduleSrc).toContain('native_system_segmented');
    expect(moduleSrc).toContain('outerWidth: CGFloat = 196');
    expect(moduleSrc).toContain('overflowPad');
    expect(moduleSrc).toContain('safeAreaRegions = []');
    expect(moduleSrc).toContain('clipsToBounds = false');

    expect(moduleSrc).toContain('GlassCompositeSegmentedRoot');
    expect(moduleSrc).toContain('.glassEffect(.regular, in: Capsule())');
    expect(moduleSrc).toContain('.glassEffect(.regular.interactive(), in: Capsule())');
    expect(moduleSrc).not.toContain('SystemGlassThumb');
    expect(moduleSrc).not.toContain('setBackgroundImage');
    expect(moduleSrc).not.toContain('matchedGeometryEffect');
    expect(moduleSrc).not.toContain('native_liquid_glass');
    expect(moduleSrc).toContain('lensHorizontalInset');
    expect(moduleSrc).toContain('lensVerticalInset');
    expect(moduleSrc).not.toMatch(/UIButton\.Configuration\.glass/);
  });

  it('native RN host is transparent — no outer pill under the Picker', () => {
    expect(selector).toContain("backgroundColor: 'transparent'");
    expect(selector).toContain("overflow: 'visible'");
    expect(selector).toContain('<NucleoGlassSegment');
    expect(selector).toContain('SolidCapsuleFallback');
    expect(selector).toContain('NATIVE_OUTER_WIDTH = 196');
    expect(selector).toContain('NATIVE_OVERFLOW_PAD');
    const nativeBranch = selector.slice(
      selector.indexOf('if (useNative)'),
      selector.indexOf('SolidCapsuleFallback')
    );
    expect(nativeBranch).not.toContain('fallbackTrackSurface');
    expect(nativeBranch).not.toContain('backgroundColor: trackBg');
  });

  it('auto-selects native via availability (no permanent off switch)', () => {
    expect(flags).toContain('isNativeGlassSegmentAvailable');
    expect(flags).toContain('native_system_segmented');
    expect(flags).toContain('fallback_solid');
    expect(infoPlist).not.toContain('UIDesignRequiresCompatibility');
  });
});
