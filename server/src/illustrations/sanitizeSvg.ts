/**
 * Strip executable / remote references from Streamline SVG before handing to RN.
 * Markup is ephemeral — never persist to history or client disk intentionally.
 */
export function sanitizeSvgMarkup(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) return null;
  if (trimmed.length > 120_000) return null;

  let svg = trimmed;
  // Drop scripts, foreignObject, and event handlers.
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '');
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Block external resource loads.
  svg = svg.replace(/\bxlink:href\s*=\s*("https?:[^"]*"|'https?:[^']*')/gi, '');
  svg = svg.replace(/\bhref\s*=\s*("https?:[^"]*"|'https?:[^']*')/gi, '');
  svg = svg.replace(/url\(\s*["']?https?:/gi, 'url(');

  if (!/<svg[\s>]/i.test(svg)) return null;
  return svg;
}
