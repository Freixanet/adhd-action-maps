import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('NativeGlassButton — system glass + fallback_solid', () => {
  const source = readFileSync(
    resolve(__dirname, '../mobile/src/components/NativeGlassButton.tsx'),
    'utf8'
  );
  const flags = readFileSync(
    resolve(__dirname, '../mobile/src/logic/nativeGlassButtons.ts'),
    'utf8'
  );
  const swift = readFileSync(
    resolve(__dirname, '../mobile/modules/nucleo-glass-button/ios/NucleoGlassButtonModule.swift'),
    'utf8'
  );
  const bridge = readFileSync(
    resolve(__dirname, '../mobile/modules/nucleo-glass-button/src/index.tsx'),
    'utf8'
  );

  it('uses UIKit Liquid Glass configurations without tints', () => {
    expect(swift).toContain('UIButton.Configuration');
    expect(swift).toContain('.glass()');
    expect(swift).toContain('.prominentGlass()');
    expect(swift).toContain('native_system_glass');
    expect(swift).toContain('clipsToBounds = false');
    expect(swift).toContain('button.tintColor = nil');
    expect(swift).not.toContain('baseBackgroundColor = glassTintColor');
    expect(swift).not.toContain('UIVisualEffectView');
    expect(swift).not.toContain('BlurView');
    expect(swift).not.toContain('buttonStyle(.glass)');
  });

  it('exposes availability-based renderer (no permanent off switch)', () => {
    expect(flags).toContain('isNativeGlassButtonAvailable');
    expect(flags).toContain('shouldUseNativeGlassButton');
    expect(flags).not.toMatch(/USE_NATIVE_GLASS_BUTTONS\s*=\s*false/);
    expect(flags).not.toMatch(/USE_NATIVE_GLASS_FILLED_CTAS\s*=\s*false/);
    expect(bridge).toContain('native_system_glass');
    expect(bridge).toContain('fallback_solid');
  });

  it('native path has no JS underlay; fallback_solid never text-only', () => {
    expect(source).toContain('isNativeGlassButtonAvailable');
    expect(source).toContain('native-glass-button-shell');
    expect(source).toContain('native-glass-button-fallback-surface');
    expect(source).toContain("overflow: 'visible'");
    const fallbackIdx = source.indexOf('testID="native-glass-button-fallback-surface"');
    const useNativeIdx = source.indexOf('if (useNative)');
    expect(useNativeIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(useNativeIdx);
  });

  it('disabled state is passed to native isEnabled', () => {
    expect(source).toContain('isEnabled={!disabled}');
    expect(swift).toContain('view.button.isEnabled = enabled ?? true');
  });
});
