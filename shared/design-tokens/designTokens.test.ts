import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintText } from '../../scripts/design-tokens/check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHECK = path.join(ROOT, 'scripts/design-tokens/check.mjs');
const GENERATE = path.join(ROOT, 'scripts/design-tokens/generate.mjs');

function runNode(script, args = [], env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('design tokens generator', () => {
  it('emits different light and dark theme colors', async () => {
    const { themeColor } = await import('./generated/tokens.ts');
    expect(themeColor.light.background.canvas).not.toBe(themeColor.dark.background.canvas);
    expect(themeColor.light.text.primary).not.toBe(themeColor.dark.text.primary);
    expect(themeColor.light.action.primary).not.toBe(themeColor.dark.action.primary);
    expect(themeColor.light.background.canvas).toBe('#F7F7FB');
    expect(themeColor.dark.background.canvas).toBe('#181A1F');

    const css = fs.readFileSync(path.join(ROOT, 'mobile/src/theme/tokens.generated.css'), 'utf8');
    const lightBlock = css.match(/@variant\s+light\s*\{([\s\S]*?)\n\}/);
    const darkBlock = css.match(/@variant\s+dark\s*\{([\s\S]*?)\n\}/);
    expect(lightBlock?.[1]).toBeTruthy();
    expect(darkBlock?.[1]).toBeTruthy();
    expect(lightBlock?.[1]).not.toBe(darkBlock?.[1]);
    expect(lightBlock?.[1]).toMatch(/--color-base:\s*#F7F7FB/);
    expect(darkBlock?.[1]).toMatch(/--color-base:\s*#181A1F/);
  });

  it('is deterministic across two runs', () => {
    expect(runNode(GENERATE).status).toBe(0);
    const ts1 = fs.readFileSync(path.join(ROOT, 'shared/design-tokens/generated/tokens.ts'), 'utf8');
    const css1 = fs.readFileSync(path.join(ROOT, 'mobile/src/theme/tokens.generated.css'), 'utf8');
    expect(runNode(GENERATE).status).toBe(0);
    expect(fs.readFileSync(path.join(ROOT, 'shared/design-tokens/generated/tokens.ts'), 'utf8')).toBe(ts1);
    expect(fs.readFileSync(path.join(ROOT, 'mobile/src/theme/tokens.generated.css'), 'utf8')).toBe(css1);
  });

  it('--check passes when generated files match', () => {
    const r = runNode(GENERATE, ['--check']);
    expect(r.status).toBe(0);
  });

  it('--check fails when CSS is stale', () => {
    const cssPath = path.join(ROOT, 'mobile/src/theme/tokens.generated.css');
    const original = fs.readFileSync(cssPath, 'utf8');
    fs.writeFileSync(cssPath, original + '\n/* stale */\n');
    try {
      const r = runNode(GENERATE, ['--check']);
      expect(r.status).not.toBe(0);
      expect(r.stdout + r.stderr).toMatch(/out of date/i);
    } finally {
      fs.writeFileSync(cssPath, original);
    }
  });
});

describe('design tokens checker', () => {
  it('passes on the production mobile UI tree', () => {
    const r = runNode(CHECK);
    expect(r.status).toBe(0);
  });

  it('accepts token usage', () => {
    const findings = lintText(
      `import { color, typography, radius, motion, shadow } from '@shared/design-tokens';
const s = { color: color.text.primary, ...typography('body'), borderRadius: radius.card, duration: motion.enter.duration, ...shadow.card };
`,
      'ok.tsx'
    );
    expect(findings).toEqual([]);
  });

  it('rejects direct hex color', () => {
    expect(lintText(`const c = '#8B8FF5';`, 'bad.tsx').some((f) => f.rule === 'color-hex')).toBe(true);
  });

  it('rejects direct fontSize', () => {
    expect(lintText(`const s = { fontSize: 15 };`, 'bad.tsx').some((f) => f.rule === 'font-size')).toBe(true);
  });

  it('rejects arbitrary typography class', () => {
    expect(lintText(`<Text className="text-[15px]" />`, 'bad.tsx').some((f) => f.rule === 'arbitrary-class')).toBe(
      true
    );
  });

  it('rejects direct borderRadius', () => {
    expect(lintText(`const s = { borderRadius: 14 };`, 'bad.tsx').some((f) => f.rule === 'border-radius')).toBe(true);
  });

  it('rejects direct shadow props', () => {
    expect(lintText(`const s = { shadowOpacity: 0.2 };`, 'bad.tsx').some((f) => f.rule === 'shadow')).toBe(true);
  });

  it('rejects direct duration', () => {
    expect(lintText(`withTiming(1, { duration: 250 });`, 'bad.tsx').some((f) => f.rule === 'duration')).toBe(true);
  });

  it('rejects typography accessibility regressions', () => {
    expect(lintText(`<Text adjustsFontSizeToFit />`, 'bad.tsx').some((f) => f.rule === 'font-size-fit')).toBe(true);
    expect(lintText(`<Text allowFontScaling={false} />`, 'bad.tsx').some((f) => f.rule === 'font-scaling-disabled')).toBe(true);
    expect(lintText(`<Text style={{ textAlign: 'justify' }} />`, 'bad.tsx').some((f) => f.rule === 'justified-text')).toBe(true);
    expect(lintText(`<Text style={{ fontFamily: 'Arial' }} />`, 'bad.tsx').some((f) => f.rule === 'font-family')).toBe(true);
  });

  it('allows calculated geometry', () => {
    const findings = lintText(
      `const radius = size / 2; // design-token-ignore: circle from props
const offset = measuredWidth * 0.12; // design-token-ignore: calculated layout geometry
`,
      'geom.tsx'
    );
    expect(findings).toEqual([]);
  });

  it('allows vendor/orb exclusions via env root fixture', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nucleo-dt-'));
    const vendor = path.join(dir, 'mobile/src/vendor/foo');
    fs.mkdirSync(vendor, { recursive: true });
    fs.writeFileSync(path.join(vendor, 'x.tsx'), `const c = '#ff0000';\n`);
    const orb = path.join(dir, 'mobile/src/components');
    fs.mkdirSync(orb, { recursive: true });
    fs.writeFileSync(path.join(orb, 'OrbHtmlIterationWebView.tsx'), `const c = '#ff0000';\n`);
    fs.writeFileSync(path.join(orb, 'Clean.tsx'), `import { color } from '@shared/design-tokens';\nconst c = color.text.primary;\n`);
    const r = runNode(CHECK, [], { DESIGN_TOKENS_ROOT: dir });
    expect(r.status).toBe(0);
  });

  it('rejects design-token-ignore without a reason', () => {
    // Pattern requires \\S+ after the colon
    const findings = lintText(`const c = '#fff'; // design-token-ignore:`, 'bad.tsx');
    expect(findings.some((f) => f.rule === 'color-hex')).toBe(true);
  });

  it('accepts design-token-ignore with a reason', () => {
    const findings = lintText(`const c = '#fff'; // design-token-ignore: SVG stop color`, 'ok.tsx');
    expect(findings).toEqual([]);
  });
});
