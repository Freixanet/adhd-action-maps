/**
 * Editorial title line balancing — planner may supply `titleLines`;
 * otherwise a deterministic local fallback runs. Never shrinks type.
 */

/** Short Spanish conjunctions / prepositions that must not end a line. */
export const EDITORIAL_TITLE_TRAILING_BAD = new Set([
  'y',
  'e',
  'o',
  'u',
  'de',
  'del',
  'la',
  'el',
  'las',
  'los',
  'un',
  'una',
  'unos',
  'unas',
  'en',
  'a',
  'al',
  'con',
  'por',
  'para',
  'sin',
  'sobre',
  'entre',
  'hacia',
  'hasta',
  'ni',
  'que',
]);

export type TitleLinesValidation = {
  ok: boolean;
  reasons: string[];
};

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function wordsOf(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

function lastWord(line: string): string {
  const w = wordsOf(line);
  return (w[w.length - 1] ?? '').toLowerCase();
}

/**
 * Validate planner-supplied title lines against editorial rules.
 * Cover may use up to 3 lines; other pages max 2.
 */
export function validateTitleLines(
  title: string,
  titleLines: readonly string[] | undefined,
  opts: { maxLines: number }
): TitleLinesValidation {
  const reasons: string[] = [];
  if (!titleLines || titleLines.length === 0) {
    return { ok: false, reasons: ['titleLines missing'] };
  }
  if (titleLines.length > opts.maxLines) {
    reasons.push(`more than ${opts.maxLines} lines`);
  }
  if (titleLines.some((l) => !l.trim())) {
    reasons.push('empty line');
  }
  const joined = normalizeSpaces(titleLines.join(' '));
  if (joined !== normalizeSpaces(title)) {
    reasons.push('concatenation does not match title');
  }
  const last = titleLines[titleLines.length - 1] ?? '';
  if (wordsOf(last).length === 1 && titleLines.length > 1) {
    reasons.push('last line is a single word');
  }
  for (const [i, line] of titleLines.entries()) {
    const trail = lastWord(line);
    if (EDITORIAL_TITLE_TRAILING_BAD.has(trail) && i < titleLines.length - 1) {
      reasons.push(`line ${i} ends with “${trail}”`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

function scorePartition(parts: string[]): number {
  const lengths = parts.map((p) => p.length);
  const max = Math.max(...lengths);
  const min = Math.min(...lengths);
  // Prefer balanced lengths; slight penalty for more lines when equal.
  return max - min + parts.length * 0.01;
}

function isLegalPartition(parts: string[]): boolean {
  if (parts.some((p) => wordsOf(p).length === 0)) return false;
  const last = parts[parts.length - 1] ?? '';
  if (parts.length > 1 && wordsOf(last).length === 1) return false;
  for (let i = 0; i < parts.length - 1; i++) {
    if (EDITORIAL_TITLE_TRAILING_BAD.has(lastWord(parts[i]!))) return false;
  }
  return true;
}

/**
 * Deterministic balance: try bipartitions (and tripartitions when maxLines≥3).
 * Falls back to a single line when no legal multi-line split exists.
 */
export function balanceTitleLines(title: string, maxLines: number): string[] {
  const words = wordsOf(title);
  if (words.length <= 1) return [title.trim()];

  const candidates: string[][] = [];

  // Two-line splits
  if (maxLines >= 2) {
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const parts = [a, b];
      if (isLegalPartition(parts)) candidates.push(parts);
    }
  }

  // Three-line splits (cover)
  if (maxLines >= 3 && words.length >= 4) {
    for (let i = 1; i < words.length - 1; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const parts = [
          words.slice(0, i).join(' '),
          words.slice(i, j).join(' '),
          words.slice(j).join(' '),
        ];
        if (isLegalPartition(parts)) candidates.push(parts);
      }
    }
  }

  if (candidates.length === 0) return [normalizeSpaces(title)];

  candidates.sort((a, b) => scorePartition(a) - scorePartition(b));
  return candidates[0]!;
}

/**
 * Resolve display lines: prefer valid planner lines, else local balance.
 */
export function resolveEditorialTitleLines(
  title: string,
  titleLines: readonly string[] | undefined,
  opts: { maxLines: number; isCover?: boolean }
): string[] {
  const maxLines = opts.isCover ? Math.max(opts.maxLines, 3) : opts.maxLines;
  const check = validateTitleLines(title, titleLines, { maxLines });
  if (check.ok && titleLines) {
    return titleLines.map((l) => l.trim());
  }
  return balanceTitleLines(title, maxLines);
}
