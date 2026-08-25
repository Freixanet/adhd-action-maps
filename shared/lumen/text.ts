/** Split a packed science paragraph into short beats. */
export function splitBeats(text: string, max = 5): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length) return parts.slice(0, max);
  const fallback = text.trim();
  return fallback ? [fallback] : [];
}
