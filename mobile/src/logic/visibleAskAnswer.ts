import { parseAskModelText } from '@shared/askChatContract';

function unwrapAnswerField(source: string): string | null {
  const key = source.match(/"answer"\s*:\s*"/);
  if (!key || key.index === undefined) return null;
  let out = '';
  let escaped = false;
  for (let i = key.index + key[0].length; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  const raw = out.replace(/\\u[0-9a-fA-F]{0,3}$/i, '').replace(/\\$/, '');
  if (!raw.trim()) return null;
  try {
    return (JSON.parse(`"${raw}"`) as string).trim();
  } catch {
    return raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim() || null;
  }
}

/**
 * Local copy so Metro HMR cannot crash on a new `@shared` named export
 * (`undefined is not a function`).
 */
export function visibleAskAnswer(text: string): string {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return '';
  if (typeof parseAskModelText === 'function') {
    try {
      return parseAskModelText(trimmed).answer;
    } catch {
      return unwrapAnswerField(trimmed) ?? trimmed;
    }
  }
  return unwrapAnswerField(trimmed) ?? trimmed;
}
