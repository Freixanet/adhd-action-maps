import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');

describe('official border-beam-native vendoring', () => {
  it('pins upstream commit and keeps MIT provenance', () => {
    const provenance = readFileSync(
      resolve(root, 'mobile/src/vendor/border-beam-native/PROVENANCE.md'),
      'utf8'
    );
    expect(provenance).toContain('647d26e2a27f26587110fea5a8410c80deb5ac5e');
    expect(provenance).toContain('ports/react-native/border-beam-native');
    const license = readFileSync(
      resolve(root, 'mobile/src/vendor/border-beam-native/LICENSE'),
      'utf8'
    );
    expect(license).toMatch(/MIT License/i);
  });

  it('ships the rotate SkSL shader and beam-spec from upstream', () => {
    const shader = readFileSync(
      resolve(root, 'mobile/src/vendor/border-beam-native/src/rotateShader.ts'),
      'utf8'
    );
    expect(shader).toContain('ROTATE_LAYER_SKSL');
    expect(shader).toMatch(/uniform/);
    const spec = JSON.parse(
      readFileSync(
        resolve(root, 'mobile/src/vendor/border-beam-native/src/beam-spec.json'),
        'utf8'
      )
    );
    expect(spec).toHaveProperty('rotate');
    expect(spec).toHaveProperty('defaults');
  });

  it('Nucleo wrapper forwards the contained pulse to official BorderBeam', () => {
    const wrapper = readFileSync(
      resolve(root, 'mobile/src/components/NucleoLoadingBorderBeam.tsx'),
      'utf8'
    );
    expect(wrapper).toContain("from '../vendor/border-beam-native/src'");
    expect(wrapper).toContain('size="pulse-inner"');
    expect(wrapper).toContain('colorVariant="colorful"');
    expect(wrapper).toContain('theme="dark"');
    expect(wrapper).not.toContain('size="md"');
    expect(wrapper).not.toContain('strength={0.7}');
    expect(wrapper).not.toMatch(/DashPathEffect|BlurMask|Canvas|Skia\.Path/);
  });

  it('marks the pulse uniform padding helper as a Reanimated worklet', () => {
    const shader = readFileSync(
      resolve(root, 'mobile/src/vendor/border-beam-native/src/rotateShader.ts'),
      'utf8'
    );
    expect(shader).toMatch(/function padTo[\s\S]*?'worklet';/);
  });

  it('does not keep the failed DashPathEffect LoadingBorderBeam implementation', () => {
    const failedTs = resolve(root, 'mobile/src/components/LoadingBorderBeam.tsx');
    const failedShared = resolve(root, 'shared/loadingBorderBeam.ts');
    let missing = 0;
    try {
      readFileSync(failedTs);
    } catch {
      missing += 1;
    }
    try {
      readFileSync(failedShared);
    } catch {
      missing += 1;
    }
    expect(missing).toBe(2);
  });

  it('LoadingState integrates only the official wrapper', () => {
    const loading = readFileSync(
      resolve(root, 'mobile/src/components/LoadingState.tsx'),
      'utf8'
    );
    expect(loading).toContain("from './NucleoLoadingBorderBeam'");
    expect(loading).not.toContain("from './LoadingBorderBeam'");
    expect(loading).not.toContain('loadingBorderBeam');
    expect(loading).not.toContain('DashPathEffect');
  });
});
