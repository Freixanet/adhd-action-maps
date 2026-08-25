#!/usr/bin/env node
/**
 * Deterministic design-token generator.
 * Reads shared/design-tokens/canonical.json and writes:
 *   - shared/design-tokens/generated/tokens.ts
 *   - mobile/src/theme/tokens.generated.css
 *
 * Themes: `themes.dark` / `themes.light` drive CSS variants and runtime themeColor.
 * `semantic.color` remains the dark default for backward-compatible static imports.
 *
 * Usage:
 *   node scripts/design-tokens/generate.mjs          # write
 *   node scripts/design-tokens/generate.mjs --check  # fail if stale
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CANONICAL = path.join(ROOT, 'shared/design-tokens/canonical.json');
const OUT_TS = path.join(ROOT, 'shared/design-tokens/generated/tokens.ts');
const OUT_CSS = path.join(ROOT, 'mobile/src/theme/tokens.generated.css');

const HEADER_TS = `/* GENERATED FILE — DO NOT EDIT DIRECTLY
 * Source: shared/design-tokens/canonical.json
 * Regenerate: npm run tokens:generate
 */
`;

const HEADER_CSS = `/* GENERATED FILE — DO NOT EDIT DIRECTLY
 * Source: shared/design-tokens/canonical.json
 * Regenerate: npm run tokens:generate
 */
`;

function loadCanonical() {
  return JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
}

function isRef(v) {
  return typeof v === 'string' && /^\{[a-zA-Z0-9_.]+\}$/.test(v);
}

function getPath(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) {
      throw new Error(`Unresolved token path: ${dotted}`);
    }
    cur = cur[p];
  }
  return cur;
}

function resolveValue(root, value, seen = new Set()) {
  if (isRef(value)) {
    const key = value.slice(1, -1);
    if (seen.has(key)) throw new Error(`Circular token ref: ${key}`);
    seen.add(key);
    return resolveValue(root, getPath(root, key), seen);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(root, v, new Set(seen)));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveValue(root, v, new Set(seen));
    }
    return out;
  }
  return value;
}

function resolveTree(root, node) {
  return resolveValue(root, node);
}

function px(n) {
  if (typeof n === 'number') return `${n}px`;
  if (typeof n === 'string' && /^-?\d+(\.\d+)?$/.test(n)) return `${n}px`;
  return String(n);
}

function colorCssVars(color, aliases) {
  const lines = [];
  for (const [cssName, pathKey] of Object.entries(aliases)) {
    if (!pathKey.startsWith('semantic.color.') && !pathKey.startsWith('primitive.color.semantic.')) {
      continue;
    }
    // Remap semantic.color.* against the provided theme color tree
    let value;
    if (pathKey.startsWith('semantic.color.')) {
      const rel = pathKey.slice('semantic.color.'.length);
      value = getPath({ color }, `color.${rel}`);
    } else {
      // primitive semantic brand colors stay shared unless overridden
      continue;
    }
    const rendered = typeof value === 'number' ? px(value) : String(value);
    lines.push(`  --${cssName}: ${rendered};`);
  }
  return lines;
}

function sharedCssVars(resolved, aliases) {
  const lines = [];
  for (const [cssName, pathKey] of Object.entries(aliases)) {
    if (pathKey.startsWith('semantic.color.')) continue;
    const value = getPath(resolved, pathKey);
    const rendered = typeof value === 'number' ? px(value) : String(value);
    lines.push(`  --${cssName}: ${rendered};`);
  }

  const type = resolved.semantic.type;
  for (const [role, style] of Object.entries(type)) {
    const kebab = role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    lines.push(`  --text-${kebab}: ${px(style.fontSize)};`);
    lines.push(`  --text-${kebab}--line-height: ${px(style.lineHeight)};`);
  }

  const space = resolved.semantic.space;
  lines.push(`  --spacing-screen-x: ${px(space.screen.horizontal)};`);
  lines.push(`  --spacing-card-padding: ${px(space.card.padding)};`);
  lines.push(`  --spacing-section-gap: ${px(space.section.gap)};`);

  lines.push(`  --radius-composer: ${px(resolved.semantic.radius.composer)};`);
  lines.push(`  --radius-sheet: ${px(resolved.semantic.radius.sheet)};`);
  lines.push(`  --radius-pill: ${px(resolved.semantic.radius.pill)};`);

  for (const [role, motion] of Object.entries(resolved.semantic.motion)) {
    lines.push(`  --duration-${role}: ${motion.duration}ms;`);
  }

  return lines;
}

function emitColorModule(color) {
  return `{
  background: ${JSON.stringify(color.background, null, 2)},
  orb: ${JSON.stringify(color.orb, null, 2)},
  text: ${JSON.stringify(color.text, null, 2)},
  border: ${JSON.stringify(color.border, null, 2)},
  icon: ${JSON.stringify(color.icon, null, 2)},
  action: ${JSON.stringify(color.action, null, 2)},
  viz: ${JSON.stringify(color.viz, null, 2)},
  editorial: ${JSON.stringify(color.editorial, null, 2)},
}`;
}

function partitionTypeRoles(typeTree) {
  const canonical = [];
  const aliases = {};
  for (const [name, value] of Object.entries(typeTree)) {
    if (isRef(value)) {
      const key = value.slice(1, -1);
      if (!key.startsWith('semantic.type.')) {
        throw new Error(`type.${name} must reference semantic.type.* (got ${value})`);
      }
      const target = key.slice('semantic.type.'.length);
      if (target.includes('.')) {
        throw new Error(`type.${name} must reference a role, not a field (${value})`);
      }
      aliases[name] = target;
    } else if (value && typeof value === 'object') {
      canonical.push(name);
    } else {
      throw new Error(`type.${name} must be a style object or {semantic.type.*} ref`);
    }
  }
  const sizeWeightRoles = [
    'display',
    'pageTitle',
    'heading',
    'title',
    'body',
    'caption',
    'callout',
    'meta',
  ];
  const overlineRole = 'kicker';
  const expected = [...sizeWeightRoles, overlineRole];
  if (JSON.stringify(canonical) !== JSON.stringify(expected)) {
    throw new Error(
      `canonical type roles must be ${expected.join(', ')} in that order (got ${canonical.join(', ')})`,
    );
  }
  for (const [alias, target] of Object.entries(aliases)) {
    if (!canonical.includes(target)) {
      throw new Error(`type.${alias} aliases ${target}, which is not a canonical role`);
    }
  }
  return { canonical: sizeWeightRoles, overlineRole, aliases };
}

function emitTs(resolved, themes, fingerprint, typePartition) {
  const p = resolved.primitive;
  const s = resolved.semantic;
  const g = resolved.specialized.glass;
  const engraved = resolved.specialized.engraved ?? {};
  const darkColor = themes.dark.color;
  const lightColor = themes.light.color;

  const typeStyles = Object.entries(s.type)
    .map(([name, style]) => {
      const entries = Object.entries(style)
        .map(([k, v]) => {
          if (typeof v === 'string' && !/^\d+$/.test(v) && k !== 'textTransform' && k !== 'fontWeight') {
            return `    ${k}: ${JSON.stringify(v)},`;
          }
          if (k === 'fontWeight' || k === 'textTransform') {
            return `    ${k}: ${JSON.stringify(v)},`;
          }
          return `    ${k}: ${JSON.stringify(v)},`;
        })
        .join('\n');
      return `  ${name}: {
    fontFamily: font.family,
${entries}
  },`;
    })
    .join('\n');

  const elev = (name, e) =>
    `  ${name}: ${JSON.stringify(e, null, 2).replace(/\n/g, '\n  ')} as const,`;

  return `${HEADER_TS}
export const TOKEN_FINGERPRINT = ${JSON.stringify(fingerprint)};

export const primitive = ${JSON.stringify(p, null, 2)} as const;

/** @deprecated Prefer themeColor[scheme] or colorsFor(scheme). Defaults to dark. */
export const color = ${emitColorModule(darkColor)} as const;

export const themeColor = {
  dark: ${emitColorModule(darkColor)} as const,
  light: ${emitColorModule(lightColor)} as const,
} as const;

export type ColorSchemeName = keyof typeof themeColor;

export function colorsFor(scheme: ColorSchemeName) {
  return themeColor[scheme];
}

export const space = ${JSON.stringify(s.space, null, 2)} as const;

export const font = ${JSON.stringify(s.font ?? {}, null, 2)} as const;

export const reading = ${JSON.stringify(s.reading ?? {}, null, 2)} as const;

export const type = {
${typeStyles}
} as const;

export type TypeRole = keyof typeof type;

/** Eight size×weight roles. Other \`type\` keys are deprecated aliases of these. */
export const canonicalTypeRoles = ${JSON.stringify(typePartition.canonical)} as const;
/** Overline of meta: same 13/18/500, open tracking, uppercase. Not a ninth size. */
export const overlineTypeRole = ${JSON.stringify(typePartition.overlineRole)} as const;
export const typeRoleAliases = ${JSON.stringify(typePartition.aliases, null, 2)} as const;

export const radius = ${JSON.stringify(s.radius, null, 2)} as const;

export const motion = ${JSON.stringify(s.motion, null, 2)} as const;

export const shadow = {
${Object.entries(s.shadow)
  .map(([k, v]) => elev(k, v))
  .join('\n')}
} as const;

export const blur = ${JSON.stringify(s.blur, null, 2)} as const;

export const control = ${JSON.stringify(s.control, null, 2)} as const;

export const glass = ${JSON.stringify(g, null, 2)} as const;

export const engraved = ${JSON.stringify(engraved, null, 2)} as const;

/** Flat React Native text style helper. */
export function typography(role: TypeRole): {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: '200' | '400' | '500' | '600' | '700' | '800' | '900';
  letterSpacing: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
} {
  const style = type[role];
  return {
    fontFamily: font.family,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: style.fontWeight as '200' | '400' | '500' | '600' | '700' | '800' | '900',
    letterSpacing: style.letterSpacing,
    ...('textTransform' in style ? { textTransform: (style as { textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize' }).textTransform } : {}),
  };
}
`;
}

function emitCss(resolved, themes, aliases, fingerprint) {
  const shared = sharedCssVars(resolved, aliases).join('\n');
  const darkColorVars = colorCssVars(themes.dark.color, aliases).join('\n');
  const lightColorVars = colorCssVars(themes.light.color, aliases).join('\n');

  // Also emit semantic brand aliases that differ per theme
  const darkBrand = [
    `  --color-sem-clave: ${themes.dark.color.action.primary};`,
    `  --color-sem-matiz: ${themes.dark.color.text.warning};`,
    `  --color-sem-ejemplo: ${themes.dark.color.text.success};`,
    `  --color-sem-alerta: ${themes.dark.color.text.danger};`,
  ].join('\n');
  const lightBrand = [
    `  --color-sem-clave: ${themes.light.color.action.primary};`,
    `  --color-sem-matiz: ${themes.light.color.text.warning};`,
    `  --color-sem-ejemplo: ${themes.light.color.text.success};`,
    `  --color-sem-alerta: ${themes.light.color.text.danger};`,
  ].join('\n');

  return `${HEADER_CSS}
/* fingerprint: ${fingerprint} */

@theme {
${shared}
${darkColorVars}
${darkBrand}
}

@layer theme {
  :root {
    @variant light {
${shared}
${lightColorVars}
${lightBrand}
    }

    @variant dark {
${shared}
${darkColorVars}
${darkBrand}
    }
  }
}
`;
}

function fingerprint(canonicalRaw) {
  return crypto.createHash('sha256').update(canonicalRaw).digest('hex').slice(0, 16);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function assertThemesDiffer(themes) {
  const dark = JSON.stringify(themes.dark.color);
  const light = JSON.stringify(themes.light.color);
  if (dark === light) {
    throw new Error('themes.dark.color and themes.light.color must not be identical');
  }
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const raw = fs.readFileSync(CANONICAL, 'utf8');
  const canonical = JSON.parse(raw);
  const fp = fingerprint(raw);

  if (!canonical.themes?.dark?.color || !canonical.themes?.light?.color) {
    throw new Error('canonical.json must define themes.dark.color and themes.light.color');
  }

  const typePartition = partitionTypeRoles(canonical.semantic.type);

  const resolved = {
    primitive: resolveTree(canonical, canonical.primitive),
    semantic: resolveTree(canonical, canonical.semantic),
    specialized: resolveTree(canonical, canonical.specialized),
  };

  const themes = {
    dark: { color: resolveTree(canonical, canonical.themes.dark.color) },
    light: { color: resolveTree(canonical, canonical.themes.light.color) },
  };
  assertThemesDiffer(themes);

  const ts = emitTs(resolved, themes, fp, typePartition);
  const css = emitCss(resolved, themes, canonical.cssAliases, fp);

  if (checkOnly) {
    const okTs = fs.existsSync(OUT_TS) && fs.readFileSync(OUT_TS, 'utf8') === ts;
    const okCss = fs.existsSync(OUT_CSS) && fs.readFileSync(OUT_CSS, 'utf8') === css;
    if (!okTs || !okCss) {
      console.error('Design tokens are out of date. Run: npm run tokens:generate');
      if (!okTs) console.error(`  stale: ${path.relative(ROOT, OUT_TS)}`);
      if (!okCss) console.error(`  stale: ${path.relative(ROOT, OUT_CSS)}`);
      process.exit(1);
    }
    console.log('Design tokens generated files are up to date.');
    return;
  }

  ensureDir(OUT_TS);
  ensureDir(OUT_CSS);
  fs.writeFileSync(OUT_TS, ts);
  fs.writeFileSync(OUT_CSS, css);
  console.log(`Wrote ${path.relative(ROOT, OUT_TS)}`);
  console.log(`Wrote ${path.relative(ROOT, OUT_CSS)}`);
  console.log(`fingerprint ${fp}`);
}

main();
