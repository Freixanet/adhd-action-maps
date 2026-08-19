#!/usr/bin/env node
/**
 * Design-token lint for Nucleo mobile UI production files.
 * Fails on unauthorized hex/rgba, direct type metrics, radii, shadows,
 * durations, and arbitrary Tailwind visual classes — unless the same line
 * contains an allowlisted `design-token-ignore: <concrete reason>`.
 *
 * See docs/design-system/TOKENS.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DESIGN_TOKENS_ROOT
  ? path.resolve(process.env.DESIGN_TOKENS_ROOT)
  : path.resolve(__dirname, '../..');

const ALLOWLIST_PATH = path.join(ROOT, 'scripts/design-tokens/exception-allowlist.json');

const SCAN_ROOTS = [
  'mobile/App.tsx',
  'mobile/src/components',
  'mobile/src/screens',
  'mobile/src/editorial',
  'mobile/src/visualize',
  'mobile/src/hooks',
  'mobile/src/navigation',
  'mobile/src/context',
];

const EXCLUDE_DIR_PARTS = new Set([
  'vendor',
  'node_modules',
  '__tests__',
  'fixtures',
  'assets',
  'generated',
]);

const EXCLUDE_FILE_RE = /(bundledEditorialSvgXml|\.test\.|\.spec\.|Fixture|fixtures)/i;

/**
 * Unreferenced reference renderers whose literal geometry/palette arrays are
 * retained as visual research fixtures. They are intentionally outside the
 * generic React Native style-literal rules and are not production imports.
 * Keep this list exact: filename-pattern exclusions hide unrelated UI.
 */
const SPECIALIZED_RENDERER_FILES = new Set([
  'mobile/src/components/OrbHtmlIterationWebView.tsx',
  'mobile/src/components/liquidGlassAtomOrbShared.ts',
]);

const EXT_RE = /\.(tsx|ts)$/;

const IGNORE_RE = /design-token-ignore:\s*(\S[\s\S]*?)(?:\*\/|$)/;
const IGNORE_LINE_RE = /design-token-ignore:\s*(\S.*)$/;

/** Reasons that indicate unfinished migration — never acceptable. */
const BAD_REASON_RE =
  /\b(pending|todo|fixme|hack|temporary|temp\b|legacy|pair with|unmatched|local\b|wip|later|someday|approx|approximate|normalize|for now|tbd)\b/i;

const GENERIC_REASONS = new Set([
  'exception',
  'ignore',
  'skip',
  'ok',
  'needed',
  'required',
  'special',
  'misc',
  'other',
  'n/a',
  'na',
]);

const RULES = [
  {
    id: 'color-hex',
    re: /#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{1}|[0-9A-Fa-f]{3}|[0-9A-Fa-f]{5})?\b/g,
    message: 'Hex color literal. Use color.* / uiTokens semantic exports (docs/design-system/TOKENS.md).',
  },
  {
    id: 'color-rgb',
    re: /rgba?\(/g,
    message: 'rgb/rgba color literal. Use a semantic color token.',
  },
  {
    id: 'font-size',
    re: /\bfontSize\s*:\s*\d+(\.\d+)?\b/g,
    message: 'Direct fontSize. Use typography(role) or type.* from @shared/design-tokens.',
  },
  {
    id: 'line-height',
    re: /\blineHeight\s*:\s*\d+(\.\d+)?\b/g,
    message: 'Direct lineHeight. Use typography(role) or type.* from @shared/design-tokens.',
  },
  {
    id: 'letter-spacing',
    re: /\bletterSpacing\s*:\s*-?\d+(\.\d+)?\b/g,
    message: 'Direct letterSpacing. Use typography(role) or type.*.',
  },
  {
    id: 'font-weight',
    re: /\bfontWeight\s*:\s*['`]?(?:[1-9]00|bold|normal|semibold|medium|light)['`]?/gi,
    message: 'Direct fontWeight. Use typography(role) or type.*.',
  },
  {
    id: 'font-family',
    re: /\bfontFamily\s*:\s*(?!font\.|Platform\.select)['"`]?[A-Za-z]/g,
    message: 'Direct fontFamily. Use the canonical font.family token.',
  },
  {
    id: 'font-scaling-disabled',
    re: /\ballowFontScaling\s*=\s*\{?\s*false\b/g,
    message: 'Dynamic Type is disabled. Keep allowFontScaling enabled for product text.',
  },
  {
    id: 'font-size-fit',
    re: /\badjustsFontSizeToFit\b/g,
    message: 'Do not shrink text to fit. Let the layout reflow or wrap.',
  },
  {
    id: 'justified-text',
    re: /(?:textAlign\s*[:=]\s*['"]justify['"]|text-align\s*:\s*justify)/gi,
    message: 'Justified text creates visual rivers. Use natural/left alignment.',
  },
  {
    id: 'automatic-hyphenation',
    re: /(?:hyphens\s*:\s*['"]?auto|android_hyphenationFrequency\s*[:=]\s*['"]?full)/gi,
    message: 'Automatic hyphenation is not allowed in Nucleo reading content.',
  },
  {
    id: 'border-radius',
    re: /\bborderRadius\s*:\s*\d+(\.\d+)?\b/g,
    message: 'Direct borderRadius. Use radius.* / RADII from tokens.',
  },
  {
    id: 'shadow',
    re: /\bshadow(?:Color|Offset|Opacity|Radius)\s*:\s*(?!(?:shadow|primitive|color|glass)\.)\S/g,
    message: 'Direct shadow*. Use shadow.* recipes from @shared/design-tokens.',
  },
  {
    id: 'elevation',
    re: /\belevation\s*:\s*(?!(?:shadow|control|primitive)\.)\d+/g,
    message: 'Direct elevation. Use shadow.* / control.* recipes from @shared/design-tokens.',
  },
  {
    id: 'duration',
    re: /\bduration\s*:\s*\d+/g,
    message: 'Direct animation duration. Use motion.* / duration tokens.',
  },
  {
    id: 'arbitrary-class',
    re: /\b(?:text|leading|tracking|rounded|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|bg|border)-\[(?:#|[0-9])/g,
    message: 'Arbitrary visual Tailwind/Uniwind class. Use theme tokens / semantic utilities.',
  },
];

/** Patterns that prove WebView HTML/CSS was corrupted by a bad migration. */
const WEBVIEW_CSS_RULES = [
  {
    id: 'webview-ts-path',
    re: /(?<!\$\{)(?<![\w-])(?:color|radius|space|type|motion|shadow|primitive)\.[a-zA-Z][\w.]*/g,
    message: 'Unresolved TypeScript token path inside CSS/HTML string.',
  },
  {
    id: 'webview-quoted-color',
    re: /(?:background|border(?:-color)?|color)\s*:\s*['"`](?:rgba?\(|#)/gi,
    message: 'CSS color value incorrectly wrapped in quotes.',
  },
  {
    id: 'webview-invalid-prop',
    re: /(?:background|border(?:-color)?|color)\s*:\s*(?:color\.|radius\.|space\.|type\.)/g,
    message: 'Critical CSS property has a non-CSS token path value.',
  },
];

const WEBVIEW_QUOTED_CSS_COLOR_RE = /['"`](?:rgba?\(|#[0-9A-Fa-f]{3,8}\b)/gi;

function shouldSkipFile(rel, includeSpecialized = false) {
  const parts = rel.split(path.sep);
  if (parts.some((p) => EXCLUDE_DIR_PARTS.has(p))) return true;
  if (!includeSpecialized && SPECIALIZED_RENDERER_FILES.has(rel)) return true;
  if (EXCLUDE_FILE_RE.test(rel)) return true;
  return false;
}

function collectFiles(options = {}) {
  const includeSpecialized = options.includeSpecialized === true;
  const out = [];
  for (const entry of SCAN_ROOTS) {
    const abs = path.join(ROOT, entry);
    if (!fs.existsSync(abs)) continue;
    const st = fs.statSync(abs);
    if (st.isFile()) {
      out.push(abs);
      continue;
    }
    const stack = [abs];
    while (stack.length) {
      const dir = stack.pop();
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = path.relative(ROOT, full);
        if (shouldSkipFile(rel, includeSpecialized)) continue;
        const s = fs.statSync(full);
        if (s.isDirectory()) {
          if (!EXCLUDE_DIR_PARTS.has(name)) stack.push(full);
        } else if (EXT_RE.test(name) && !shouldSkipFile(rel, includeSpecialized)) {
          out.push(full);
        }
      }
    }
  }
  return out;
}

export function extractIgnoreReason(line) {
  const block = line.match(/\/\*\s*design-token-ignore:\s*([^*]+?)\s*\*\//);
  if (block) return block[1].trim();
  const lineC = line.match(/\/\/\s*design-token-ignore:\s*(.+)$/);
  if (lineC) return lineC[1].trim();
  return null;
}

export function validateIgnoreReason(reason) {
  if (reason == null) return { ok: false, code: 'missing', message: 'design-token-ignore without a reason' };
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, code: 'empty', message: 'Empty ignore reason' };
  if (trimmed.length < 12) {
    return { ok: false, code: 'too-short', message: `Ignore reason too short / generic: "${trimmed}"` };
  }
  if (GENERIC_REASONS.has(trimmed.toLowerCase())) {
    return { ok: false, code: 'generic', message: `Generic ignore reason: "${trimmed}"` };
  }
  if (BAD_REASON_RE.test(trimmed)) {
    return {
      ok: false,
      code: 'pending-debt',
      message: `Ignore reason marks unfinished work (pending/todo/legacy/local/…): "${trimmed}"`,
    };
  }
  return { ok: true };
}

export function loadAllowlist(root = ROOT) {
  const abs = path.join(root, 'scripts/design-tokens/exception-allowlist.json');
  if (!fs.existsSync(abs)) {
    return { version: 1, exceptions: [] };
  }
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

export function exceptionKey(file, line, rule, match) {
  return `${file}::${line}::${rule}::${match}`;
}

function lintFile(abs) {
  const rel = path.relative(ROOT, abs);
  const text = fs.readFileSync(abs, 'utf8');
  return lintText(text, rel);
}

export function lintText(text, fileLabel = 'fixture.tsx', options = {}) {
  const allowlist = options.allowlist ?? null;
  const lines = text.split(/\r?\n/);
  const findings = [];
  const usedAllowlist = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = i > 0 ? lines[i - 1].trim() : '';
    const reason =
      extractIgnoreReason(line) ??
      (/^\/\/\s*design-token-ignore:/.test(prev) ? extractIgnoreReason(prev) : null);

    if (reason != null) {
      const validity = validateIgnoreReason(reason);
      if (!validity.ok) {
        findings.push({
          file: fileLabel,
          line: i + 1,
          col: 1,
          rule: 'ignore-reason',
          match: reason.slice(0, 80),
          message: validity.message,
        });
        continue;
      }
    }

    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line))) {
        if (reason != null) {
          if (allowlist) {
            const key = exceptionKey(fileLabel, i + 1, rule.id, m[0]);
            const entry = allowlist.exceptions.find(
              (e) =>
                typeof e.id === 'string' &&
                e.file === fileLabel &&
                e.line === i + 1 &&
                e.rule === rule.id &&
                e.match === m[0] &&
                e.reason === reason
            );
            if (!entry) {
              findings.push({
                file: fileLabel,
                line: i + 1,
                col: m.index + 1,
                rule: 'ignore-allowlist',
                match: m[0],
                message: `Exception not in allowlist (${rule.id}). Add a reviewed entry to exception-allowlist.json or migrate to a token.`,
              });
            } else if (usedAllowlist.has(entry.id)) {
              findings.push({
                file: fileLabel,
                line: i + 1,
                col: m.index + 1,
                rule: 'ignore-budget',
                match: m[0],
                message: `Allowlist exception "${entry.id}" can authorize exactly one occurrence.`,
              });
            } else {
              usedAllowlist.add(entry.id);
            }
          }
          continue;
        }
        findings.push({
          file: fileLabel,
          line: i + 1,
          col: m.index + 1,
          rule: rule.id,
          match: m[0],
          message: rule.message,
        });
      }
    }
  }
  return findings;
}

/** Validate interpolated WebView HTML (post-template values). */
export function lintWebViewCss(html, fileLabel = 'webview.html') {
  const findings = [];
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const cssTextAssignments = [...html.matchAll(/\.cssText\s*=\s*[`'"]([\s\S]*?)[`'"]/g)].map((m) => m[1]);
  const chunks = [...styleBlocks, ...cssTextAssignments];

  for (const chunk of chunks) {
    for (const rule of WEBVIEW_CSS_RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(chunk))) {
        // Allow CSS custom properties and var()
        if (m[0].startsWith('--')) continue;
        findings.push({
          file: fileLabel,
          line: 1,
          col: m.index + 1,
          rule: rule.id,
          match: m[0],
          message: rule.message,
        });
      }
    }
    WEBVIEW_QUOTED_CSS_COLOR_RE.lastIndex = 0;
    let quoted;
    while ((quoted = WEBVIEW_QUOTED_CSS_COLOR_RE.exec(chunk))) {
      findings.push({
        file: fileLabel,
        line: 1,
        col: quoted.index + 1,
        rule: 'webview-quoted-css-color',
        match: quoted[0],
        message: 'CSS color token is incorrectly wrapped in quotes.',
      });
    }
  }
  return findings;
}

/** Lint every first-party WebView template, including specialized renderers. */
export function lintWebViewSourceCss(text, fileLabel = 'webview.tsx') {
  const styles = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  // Keep the complete assignment line: CSS values may themselves contain
  // quoted colors, so stopping at the first quote would miss the violation.
  const cssTextAssignments = text.split(/\r?\n/).filter((line) => /\.cssText\s*=/.test(line));
  const findings = [];
  for (const style of [...styles, ...cssTextAssignments]) {
    // Template interpolations resolve to CSS values at runtime. Keep the surrounding CSS intact.
    const resolved = style.replace(/\$\{[^}]+\}/g, 'TOKEN');
    findings.push(...lintWebViewCss(`<style>${resolved}</style>`, fileLabel));
  }
  return findings;
}

export function lintPaths(files, options = {}) {
  return files.flatMap((f) => {
    const rel = path.isAbsolute(f) ? path.relative(ROOT, f) : f;
    const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    const text = fs.readFileSync(abs, 'utf8');
    return lintText(text, rel, options);
  });
}

export { RULES, IGNORE_RE, BAD_REASON_RE, collectFiles, lintFile, WEBVIEW_CSS_RULES };

function main() {
  const allowlist = loadAllowlist();
  const files = collectFiles();
  const findings = lintPaths(files, { allowlist });

  const seenExceptionIds = new Set();
  for (const entry of allowlist.exceptions || []) {
    if (!entry.id || typeof entry.id !== 'string' || !Number.isInteger(entry.line) || entry.line < 1) {
      findings.push({
        file: entry.file || 'exception-allowlist.json',
        line: 0,
        col: 1,
        rule: 'ignore-allowlist',
        match: entry.id || '(missing id)',
        message: 'Every allowlist entry requires a unique id and exact positive line number.',
      });
    } else if (seenExceptionIds.has(entry.id)) {
      findings.push({
        file: entry.file,
        line: entry.line,
        col: 1,
        rule: 'ignore-allowlist',
        match: entry.id,
        message: `Duplicate allowlist id: ${entry.id}`,
      });
    } else {
      seenExceptionIds.add(entry.id);
    }
  }

  // Budget: every allowlisted exception must still exist in source.
  for (const entry of allowlist.exceptions || []) {
    const stillLive = (() => {
      for (const abs of files) {
        const rel = path.relative(ROOT, abs);
        if (rel !== entry.file) continue;
        const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (i + 1 !== entry.line) continue;
          const reason = extractIgnoreReason(line);
          if (reason !== entry.reason) continue;
          for (const rule of RULES) {
            if (rule.id !== entry.rule) continue;
            rule.re.lastIndex = 0;
            let m;
            while ((m = rule.re.exec(line))) {
              if (m[0] === entry.match) return true;
            }
          }
        }
      }
      return false;
    })();
    if (!stillLive) {
      findings.push({
        file: entry.file,
        line: 0,
        col: 1,
        rule: 'ignore-allowlist',
        match: entry.match,
        message: `Allowlist entry no longer present in source. Remove stale exception for ${entry.rule}.`,
      });
    }
  }

  for (const abs of collectFiles({ includeSpecialized: true })) {
    const rel = path.relative(ROOT, abs);
    if (!/WebView\.tsx$/.test(rel)) continue;
    findings.push(...lintWebViewSourceCss(fs.readFileSync(abs, 'utf8'), rel));
  }

  if (findings.length) {
    console.error(`Design token check failed: ${findings.length} violation(s)\n`);
    for (const f of findings.slice(0, 80)) {
      console.error(`${f.file}:${f.line}:${f.col}  [${f.rule}] ${f.match}`);
      console.error(`  ${f.message}`);
    }
    if (findings.length > 80) {
      console.error(`\n…and ${findings.length - 80} more`);
    }
    console.error('\nFix by using tokens. Exceptions require a concrete reason AND an allowlist entry.');
    console.error('Docs: docs/design-system/TOKENS.md');
    process.exit(1);
  }

  const n = (allowlist.exceptions || []).length;
  console.log(`Design token check passed (${files.length} files, ${n} allowlisted exception(s)).`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
