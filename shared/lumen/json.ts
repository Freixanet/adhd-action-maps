const LITERAL_START = /^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/;

function stripTrailingCommas(src: string): string {
  return src.replace(/,(\s*[}\]])/g, '$1');
}

function quoteBareValues(src: string): string {
  let out = '';
  let i = 0;
  let inStr = false;
  let escape = false;
  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      out += ch;
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inStr = false;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === ':') {
      out += ch;
      i += 1;
      while (i < src.length && /\s/.test(src[i])) {
        out += src[i];
        i += 1;
      }
      const rest = src.slice(i);
      if (!rest || rest.startsWith('"') || rest.startsWith('{') || rest.startsWith('[')) continue;
      const literal = rest.match(LITERAL_START);
      if (literal) {
        out += literal[0];
        i += literal[0].length;
        continue;
      }
      let end = i;
      while (end < src.length && !',\n}]'.includes(src[end])) end += 1;
      const raw = src.slice(i, end).trim();
      if (raw) out += JSON.stringify(raw);
      else out += src.slice(i, end);
      i = end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function insertMissingCommas(src: string): string {
  let out = '';
  let inStr = false;
  let escape = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    out += ch;
    if (inStr) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '"' || ch === '}' || ch === ']' || /\d/.test(ch)) {
      // handled below after leaving a value
    }
    if ((ch === '"' && !inStr) || ch === '}' || ch === ']' || /[\d]/.test(ch)) {
      // no-op; we detect after a completed value via peek
    }
  }
  // Simpler second pass: between a closed token and a quoted key, insert a comma.
  return src.replace(/(["\d}\]])\s*\n\s*"/g, '$1,\n"');
}

export function repairLooseJson(src: string): string {
  let s = src.trim();
  s = quoteBareValues(s);
  s = insertMissingCommas(s);
  s = stripTrailingCommas(s);
  return closeTruncatedJson(s);
}

export function closeTruncatedJson(src: string): string {
  let s = src.trim();
  if (!s.startsWith('{') && !s.startsWith('[')) {
    const start = Math.min(
      ...['{', '['].map((ch) => {
        const i = s.indexOf(ch);
        return i < 0 ? Number.POSITIVE_INFINITY : i;
      })
    );
    if (!Number.isFinite(start)) return s;
    s = s.slice(start);
  }
  const stack: Array<'}' | ']'> = [];
  let inStr = false;
  let escape = false;
  for (const ch of s) {
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (inStr) s += '"';
  s = s.replace(/,\s*$/, '');
  while (stack.length) s += stack.pop();
  return stripTrailingCommas(s);
}

function tryParse(candidate: string): unknown | undefined {
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf('{');
  if (start < 0) {
    throw new Error('No JSON object in model output');
  }
  const slice = raw.slice(start);
  const attempts = [slice, stripTrailingCommas(slice), repairLooseJson(slice)];
  for (const candidate of attempts) {
    const parsed = tryParse(candidate);
    if (parsed !== undefined) return parsed;
    const end = candidate.lastIndexOf('}');
    if (end > 0) {
      const sliced = tryParse(candidate.slice(0, end + 1));
      if (sliced !== undefined) return sliced;
    }
  }
  throw new Error('No JSON object in model output');
}

export function classifyInput(input: string): 'url' | 'text' | 'topic' {
  const t = input.trim();
  if (/^https?:\/\/\S+$/i.test(t) && !/\s/.test(t)) return 'url';
  if (t.length < 180 && !t.includes('\n')) return 'topic';
  return 'text';
}
