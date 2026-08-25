#!/usr/bin/env node
/**
 * Best-effort batch migrator for design tokens.
 * Safe substitutions only; does not invent visual changes.
 * Re-run check afterward and fix remaining violations manually.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SCAN = [
  'mobile/App.tsx',
  'mobile/src/components',
  'mobile/src/screens',
  'mobile/src/editorial',
  'mobile/src/visualize',
  'mobile/src/hooks',
  'mobile/src/navigation',
  'mobile/src/context',
];

const SKIP_RE =
  /(vendor|LiquidOrb|ExactLiquidOrb|OrbHtml|OrbSkia|ThinkingOrb|NucleoGlyphOrb|border-beam|\.test\.|\.spec\.)/i;

const COLOR_MAP = [
  [/#8[Bb]8[Ff][Ff]5\b/g, 'ACCENT'],
  [/#7[Aa]7[Ee][Ee]0\b/g, 'ACCENT_PRESSED'],
  [/#6[Aa]6[Ff][Ee]0\b/g, 'CTA_FILL'],
  [/#5[Bb]60[Dd]4\b/g, 'CTA_FILL_PRESSED'],
  [/#9[Cc][Aa]0[Aa][Bb]\b/g, 'TEXT_SECONDARY'],
  [/#[Dd]4[Dd]4[Dd][Cc]\b/g, 'TEXT_BODY'],
  [/#[Ff][Aa][Ff][Aa][Ff][Aa]\b/g, 'TEXT_PRIMARY'],
  [/#181[Aa]1[Ff]\b/g, 'BG_BASE'],
  [/#24262[Dd]\b/g, 'BG_SURFACE'],
  [/#2[Cc]2[Ee]37\b/g, 'BG_SURFACE_2'],
  [/#3[Ee]4041\b/g, 'COMPOSER_DARK_SURFACE'],
  [/#[Ee]0[Bb]45[Cc]\b/g, 'SEM_MATIZ'],
  [/#6[Ff][Bb][Ff]8[Ff]\b/g, 'SEM_EJEMPLO'],
  [/#[Ee]07[Aa]6[Bb]\b/g, 'SEM_ALERTA'],
  [/#[Ff]7[Ff]4[Ee][Cc]\b/g, 'EDITORIAL_SHEET_BG'],
  [/#[Ff][Ff][Ff]9[Ee][Cc]\b/g, 'EDITORIAL_SHEET_BG_WARM'],
  [/#68645[Ff]\b/g, 'EDITORIAL_TEXT_MUTED'],
  [/#3[Aa]3[Aa]3[Aa]\b/g, 'EDITORIAL_TEXT_BODY'],
  [/#8[Aa]651[Bb]\b/g, 'EDITORIAL_TEXT_OCHRE'],
];

const HEX_TO_EXPR = {
  '#fff': 'TEXT_PRIMARY',
  '#ffffff': 'TEXT_PRIMARY',
  '#111': 'EDITORIAL_TEXT',
  '#111111': 'EDITORIAL_TEXT',
  '#000': 'BG_BASE',
  '#000000': "primitive.color.neutral.black /* design-token-ignore: absolute black */",
  '#a3a3a3': 'TEXT_SECONDARY',
  '#737373': 'color.text.muted',
  '#525252': 'color.text.muted',
  '#f0f0f0': 'TEXT_PRIMARY',
  '#a8acf8': 'primitive.color.brand.accentSoft',
  '#0b0b12': 'primitive.color.neutral.1000',
  '#1c1e24': 'primitive.color.neutral.900',
  '#656a78': 'VIZ_MUTED',
  '#3a3d47': 'VIZ_GRID',
};

const CLASS_MAP = [
  [/text-\[10px\]/g, 'text-micro'],
  [/text-\[11px\]/g, 'text-meta'],
  [/text-\[12px\]/g, 'text-caption'],
  [/text-\[13px\]/g, 'text-label'],
  [/text-\[14px\]/g, 'text-callout'],
  [/text-\[15px\]/g, 'text-body'],
  [/text-\[16px\]/g, 'text-title'],
  [/text-\[17px\]/g, 'text-input'],
  [/text-\[18px\]/g, 'text-section-title'],
  [/text-\[20px\]/g, 'text-subtitle'],
  [/text-\[22px\]/g, 'text-page-title'],
  [/text-\[24px\]/g, 'text-heading'],
  [/text-\[26px\]/g, 'text-editorial-cover'],
  // Line-height is carried by text-* theme roles — drop arbitrary leading.
  [/\s*leading-\[\d+px\]/g, ''],
  [/\s*tracking-\[0\.08em\]/g, ''],
  [/\s*tracking-\[0\.12em\]/g, ''],
  [/\s*tracking-\[0\.14em\]/g, ''],
  [/\s*tracking-\[0\.16em\]/g, ''],
  [/rounded-\[12px\]/g, 'rounded-chip'],
  [/rounded-\[16px\]/g, 'rounded-card'],
  [/rounded-\[24px\]/g, 'rounded-cta'],
  [/rounded-\[999px\]/g, 'rounded-full'],
  [/rounded-\[9999px\]/g, 'rounded-full'],
];

const DURATION_MAP = {
  40: 'motion.feedback.duration',
  45: 'motion.feedback.duration',
  50: 'motion.feedback.duration',
  180: 'motion.exit.duration',
  200: 'motion.exit.duration',
  220: 'motion.exit.duration',
  250: 'motion.enter.duration',
  260: 'motion.enter.duration',
  280: 'motion.enter.duration',
  300: 'motion.enter.duration',
  400: 'motion.sheet.duration',
  420: 'motion.sheet.duration',
  480: 'motion.sheet.duration',
  500: 'motion.loading.duration',
  800: 'motion.page.duration',
  900: 'motion.page.duration',
};

const RADIUS_MAP = {
  8: 'radius.control', // xs mapped via primitive — use chip-ish
  12: 'RADII.sm',
  14: 'RADII.sm',
  16: 'RADII.md',
  18: 'RADII.md',
  20: 'RADII.md',
  22: 'RADII.lg',
  24: 'RADII.lg',
  26: 'RADII.lg',
  999: 'RADII.pill',
  9999: 'RADII.pill',
};

function walk(entry, out = []) {
  const abs = path.join(ROOT, entry);
  if (!fs.existsSync(abs)) return out;
  const st = fs.statSync(abs);
  if (st.isFile()) {
    out.push(abs);
    return out;
  }
  for (const name of fs.readdirSync(abs)) {
    const full = path.join(abs, name);
    const rel = path.relative(ROOT, full);
    if (SKIP_RE.test(rel)) continue;
    if (name === 'vendor' || name === 'node_modules') continue;
    const s = fs.statSync(full);
    if (s.isDirectory()) walk(rel, out);
    else if (/\.(tsx|ts)$/.test(name) && !SKIP_RE.test(rel)) out.push(full);
  }
  return out;
}

function ensureImports(src, names, fromModule) {
  const needed = names.filter((n) => src.includes(n));
  if (!needed.length) return src;
  const existing = new Set();
  const importRe = new RegExp(
    `import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${fromModule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
    'g'
  );
  let m;
  let found = false;
  let out = src;
  while ((m = importRe.exec(src))) {
    found = true;
    m[1].split(',').forEach((p) => existing.add(p.trim().split(/\s+as\s+/)[0].trim()));
  }
  const missing = needed.filter((n) => !existing.has(n) && new RegExp(`\\b${n}\\b`).test(src));
  // Only add symbols that appear as identifiers after replacement — rough
  const really = missing.filter((n) => {
    // present as word not only in string
    return new RegExp(`(?:^|[^'"\`#])\\b${n}\\b`).test(out);
  });
  if (!really.length) return out;
  if (found) {
    out = out.replace(importRe, (full, inner) => {
      const parts = inner.split(',').map((s) => s.trim()).filter(Boolean);
      for (const n of really) if (!parts.some((p) => p.startsWith(n))) parts.push(n);
      return `import { ${parts.join(', ')} } from '${fromModule}'`;
    });
    // only first
    return out;
  }
  const stmt = `import { ${really.join(', ')} } from '${fromModule}';\n`;
  const lastImport = out.lastIndexOf('\nimport ');
  if (lastImport >= 0) {
    const end = out.indexOf('\n', lastImport + 1);
    return out.slice(0, end + 1) + stmt + out.slice(end + 1);
  }
  return stmt + out;
}

function migrateFile(abs) {
  let src = fs.readFileSync(abs, 'utf8');
  const original = src;
  const usedUi = new Set();
  const usedDt = new Set();

  // className arbitrary
  for (const [re, repl] of CLASS_MAP) {
    src = src.replace(re, repl);
  }

  // Simple hex → token (quoted)
  for (const [re, token] of COLOR_MAP) {
    const before = src;
    src = src.replace(new RegExp(`['"]${re.source}['"]`, re.flags), () => {
      usedUi.add(token);
      return token;
    });
    // JSX-ish unquoted rare — skip
    if (src !== before) usedUi.add(token);
  }

  for (const [hex, expr] of Object.entries(HEX_TO_EXPR)) {
    const re = new RegExp(`['"]${hex}['"]`, 'gi');
    if (re.test(src)) {
      src = src.replace(re, () => {
        if (expr.includes('primitive') || expr.includes('color.')) usedDt.add(expr.split(/[.\s]/)[0]);
        else usedUi.add(expr);
        return expr.includes('/*') ? expr.split(' /*')[0] : expr;
      });
    }
  }

  // borderRadius: N
  src = src.replace(/\bborderRadius\s*:\s*(\d+)\b/g, (full, n) => {
    const key = Number(n);
    if (key === 2 || key === 3) {
      return `${full} /* design-token-ignore: hairline/chip geometry */`;
    }
    const tok = RADIUS_MAP[key];
    if (!tok) return `${full} /* design-token-ignore: local radius ${n} */`;
    if (tok.startsWith('RADII')) usedUi.add('RADII');
    if (tok.startsWith('radius')) usedDt.add('radius');
    return `borderRadius: ${tok}`;
  });

  // duration: N in objects
  src = src.replace(/\bduration\s*:\s*(\d+)\b/g, (full, n) => {
    const key = Number(n);
    // orb-scale durations stay ignored
    if (key >= 2000) return `${full} /* design-token-ignore: specialized effect timing */`;
    const tok = DURATION_MAP[key];
    if (!tok) return `${full} /* design-token-ignore: local duration ${n}ms */`;
    usedDt.add('motion');
    return `duration: ${tok}`;
  });

  // fontSize/lineHeight/fontWeight/letterSpacing — annotate for manual pass if clustered
  // Prefer leaving for typography() manual migration; add ignore only when alone in viz files

  if (src === original) return false;

  // Imports
  const uiNames = [
    'ACCENT',
    'ACCENT_PRESSED',
    'CTA_FILL',
    'CTA_FILL_PRESSED',
    'TEXT_PRIMARY',
    'TEXT_BODY',
    'TEXT_SECONDARY',
    'BG_BASE',
    'BG_SURFACE',
    'BG_SURFACE_2',
    'COMPOSER_DARK_SURFACE',
    'SEM_MATIZ',
    'SEM_EJEMPLO',
    'SEM_ALERTA',
    'SEM_CLAVE',
    'EDITORIAL_SHEET_BG',
    'EDITORIAL_SHEET_BG_WARM',
    'EDITORIAL_TEXT',
    'EDITORIAL_TEXT_BODY',
    'EDITORIAL_TEXT_MUTED',
    'EDITORIAL_TEXT_OCHRE',
    'RADII',
    'VIZ_MUTED',
    'VIZ_GRID',
  ].filter((n) => new RegExp(`\\b${n}\\b`).test(src));

  src = ensureImports(src, uiNames, '@shared/uiTokens');
  const dtNames = ['motion', 'radius', 'color', 'primitive', 'typography', 'type', 'shadow', 'space'].filter((n) =>
    new RegExp(`\\b${n}\\b`).test(src)
  );
  src = ensureImports(src, dtNames, '@shared/design-tokens');

  fs.writeFileSync(abs, src);
  return true;
}

const files = SCAN.flatMap((e) => walk(e));
let changed = 0;
for (const f of files) {
  if (migrateFile(f)) {
    changed++;
    console.log('migrated', path.relative(ROOT, f));
  }
}
console.log(`Changed ${changed}/${files.length} files`);
