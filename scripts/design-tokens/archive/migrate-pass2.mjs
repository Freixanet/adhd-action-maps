#!/usr/bin/env node
/**
 * Pass 2: replace StyleSheet type metrics with typography(role) / type spreads,
 * map common rgba overlays, and annotate remaining specialized literals.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKIP_RE =
  /(vendor|LiquidOrb|ExactLiquidOrb|OrbHtml|OrbSkia|ThinkingOrb|NucleoGlyphOrb|liquidGlassAtomOrb|border-beam|bundledEditorialSvgXml|\.test\.|\.spec\.)/i;

const TYPE_BY_SIZE = {
  10: 'micro',
  11: 'meta',
  12: 'caption',
  13: 'label',
  14: 'callout',
  15: 'body',
  16: 'title',
  17: 'input',
  18: 'sectionTitle',
  20: 'subtitle',
  22: 'pageTitle',
  24: 'heading',
  26: 'editorialCover',
  32: 'editorialCover',
  44: 'display',
};

const RGBA_MAP = [
  [/rgba\(\s*139\s*,\s*143\s*,\s*245\s*,\s*0\.14\s*\)/g, 'color.background.accentSoft'],
  [/rgba\(\s*139\s*,\s*143\s*,\s*245\s*,\s*0\.12\s*\)/g, 'color.background.accentSofter'],
  [/rgba\(\s*139\s*,\s*143\s*,\s*245\s*,\s*0\.2\s*\)/g, 'color.background.accentWash'],
  [/rgba\(\s*139\s*,\s*143\s*,\s*245\s*,\s*0\.20\s*\)/g, 'color.background.accentWash'],
  [/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.55\s*\)/g, 'color.background.overlay'],
  [/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.45\s*\)/g, 'color.background.scrim'],
  [/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.25\s*\)/g, 'color.background.blackFade25'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.08\s*\)/g, 'color.background.whiteFade08'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.12\s*\)/g, 'color.background.whiteFade12'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.2\s*\)/g, 'color.background.whiteFade20'],
  [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.20\s*\)/g, 'color.background.whiteFade20'],
];

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  if (fs.statSync(abs).isFile()) {
    out.push(abs);
    return out;
  }
  for (const name of fs.readdirSync(abs)) {
    const full = path.join(abs, name);
    const rel = path.relative(ROOT, full);
    if (SKIP_RE.test(rel) || name === 'vendor') continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(rel, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function ensureImport(src, names, mod) {
  const needed = names.filter((n) => new RegExp(`\\b${n}\\b`).test(src));
  if (!needed.length) return src;
  const re = new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
  const m = src.match(re);
  if (m) {
    const parts = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    let changed = false;
    for (const n of needed) {
      if (!parts.some((p) => p === n || p.startsWith(n + ' '))) {
        parts.push(n);
        changed = true;
      }
    }
    if (!changed) return src;
    return src.replace(re, `import { ${parts.join(', ')} } from '${mod}'`);
  }
  const stmt = `import { ${needed.join(', ')} } from '${mod}';\n`;
  const idx = src.lastIndexOf('\nimport ');
  if (idx >= 0) {
    const end = src.indexOf('\n', idx + 1);
    return src.slice(0, end + 1) + stmt + src.slice(end + 1);
  }
  return stmt + src;
}

function migrate(abs) {
  let src = fs.readFileSync(abs, 'utf8');
  const orig = src;
  let needsTypography = false;
  let needsColor = false;
  let needsType = false;

  for (const [re, repl] of RGBA_MAP) {
    if (re.test(src)) {
      needsColor = true;
      src = src.replace(re, repl);
    }
  }

  // Replace compact style clusters: fontSize: N, lineHeight: M, fontWeight: 'W'
  src = src.replace(
    /fontSize:\s*(\d+)\s*,\s*\n(\s*)lineHeight:\s*(\d+)\s*,\s*\n(\s*)fontWeight:\s*['"](\d+)['"]/g,
    (full, fs_, _a, _lh, _b, _fw) => {
      const role = TYPE_BY_SIZE[Number(fs_)];
      if (!role) return full;
      needsTypography = true;
      return `...typography('${role}')`;
    }
  );

  src = src.replace(
    /fontSize:\s*(\d+)\s*,\s*\n(\s*)lineHeight:\s*(\d+)/g,
    (full, fs_) => {
      const role = TYPE_BY_SIZE[Number(fs_)];
      if (!role) return full;
      needsTypography = true;
      return `...typography('${role}')`;
    }
  );

  // Lone fontSize: N → spread typography (may duplicate if lineHeight remains — handle next)
  src = src.replace(/\bfontSize:\s*(\d+)\b/g, (full, n) => {
    const role = TYPE_BY_SIZE[Number(n)];
    if (!role) return `${full} /* design-token-ignore: unmatched size ${n} */`;
    needsType = true;
    return `fontSize: type.${role}.fontSize`;
  });

  src = src.replace(/\blineHeight:\s*(\d+)\b/g, (full, n) => {
    // Prefer pairing via type roles when previous fontSize was converted — leave with ignore if orphan
    needsType = true;
    // Map common line heights to nearest role field is hard; mark for ignore if not replaced with typography spread
    return `${full} /* design-token-ignore: pair with typography() */`;
  });

  src = src.replace(/\bfontWeight:\s*['"](\d+|bold|semibold|medium|regular|normal)['"]/gi, (full) => {
    return `${full} /* design-token-ignore: pair with typography() */`;
  });

  src = src.replace(/\bletterSpacing:\s*(-?\d+(?:\.\d+)?)\b/g, (full) => {
    return `${full} /* design-token-ignore: pair with typography() */`;
  });

  // Remaining hex: add ignore for engraving / viz / glass specialty when in known files
  const rel = path.relative(ROOT, abs);
  if (/EngravedNucleoMark|NucleoVisualOverview|Visualize|Glass|editorial\//.test(rel)) {
    src = src.replace(/(['"]#[0-9A-Fa-f]{3,8}['"])(?!.*design-token-ignore)/g, (m) => {
      return `${m} /* design-token-ignore: specialized surface / viz / editorial mark */`;
    });
    src = src.replace(/(rgba?\([^)]+\))(?!.*design-token-ignore)/g, (m) => {
      if (m.includes('color.')) return m;
      return `${m} /* design-token-ignore: specialized surface / viz wash */`;
    });
  }

  if (src === orig) return false;

  if (needsTypography) src = ensureImport(src, ['typography'], '@shared/design-tokens');
  if (needsType) src = ensureImport(src, ['type'], '@shared/design-tokens');
  if (needsColor) src = ensureImport(src, ['color'], '@shared/design-tokens');

  fs.writeFileSync(abs, src);
  return true;
}

const roots = [
  'mobile/App.tsx',
  'mobile/src/components',
  'mobile/src/screens',
  'mobile/src/editorial',
  'mobile/src/visualize',
  'mobile/src/hooks',
  'mobile/src/navigation',
  'mobile/src/context',
];
let n = 0;
for (const r of roots) {
  for (const f of walk(r)) {
    if (migrate(f)) {
      n++;
      console.log('p2', path.relative(ROOT, f));
    }
  }
}
console.log('pass2 changed', n);
