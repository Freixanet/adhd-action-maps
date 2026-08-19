/**
 * Ban unsupported generic coaching advice unless it is grounded in source+context.
 */

const GENERIC_PATTERNS: RegExp[] = [
  /\bhaz\s+una\s+lista\b/i,
  /\bempieza\s+poco\s+a\s+poco\b/i,
  /\bs[eé]\s+constante\b/i,
  /\bmant[eé]n\s+la\s+motivaci[oó]n\b/i,
  /\bdivide\s+la\s+tarea\b/i,
  /\bmake\s+a\s+list\b/i,
  /\bstart\s+small\b/i,
  /\bstay\s+motivated\b/i,
  /\bbreak\s+(?:it|the\s+task)\s+down\b/i,
  /\bbe\s+consistent\b/i,
];

const VAGUE_SUCCESS: RegExp[] = [
  /\bsentirme\s+mejor\b/i,
  /\bprogresar\b/i,
  /\bmejorar\s+en\s+general\b/i,
  /\bfeel\s+better\b/i,
  /\bmake\s+progress\b/i,
];

/** Meta placeholders that pretend to be success criteria. */
export function isMetaSuccessPlaceholder(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return (
    /\bse[nñ]ala(?:r)?\s+un\s+resultado\b/i.test(t) ||
    /\bindica(?:r)?\s+un\s+resultado\s+observable\b/i.test(t) ||
    /\b\(hecho,\s*no\s+sensaci[oó]n\)/i.test(t)
  );
}

export function isGenericUnsupportedAdvice(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return GENERIC_PATTERNS.some((re) => re.test(t));
}

export function isVagueSuccessCriterion(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return true;
  if (isMetaSuccessPlaceholder(t)) return true;
  return VAGUE_SUCCESS.some((re) => re.test(t));
}

export function startsWithVerb(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // Spanish / English verb-led heuristic: first token is alphabetic and not an article.
  const first = t.split(/\s+/)[0] ?? '';
  if (!/^[\p{L}]+/u.test(first)) return false;
  const blocked = /^(el|la|los|las|un|una|unos|unas|the|a|an|my|tu|su)$/i;
  return !blocked.test(first);
}
