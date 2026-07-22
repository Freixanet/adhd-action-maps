import type {
  BlockEmphasis,
  CalloutLabel,
  SourceReference,
  StepContentBlock,
  StepListItem,
} from './contracts';

const EMPHASIS: ReadonlySet<string> = new Set(['hero', 'normal', 'quiet']);

/** Spec allowlist — anything else is dropped, never half-rendered. */
export const ALLOWED_STEP_CONTENT_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'prose',
  'callout',
  'list',
  'stat',
  'comparison',
  'accordion',
  'quiz',
]);

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmphasis(value: unknown): BlockEmphasis | undefined {
  const raw = asString(value);
  return EMPHASIS.has(raw) ? (raw as BlockEmphasis) : undefined;
}

function normalizeReferences(input: unknown): SourceReference[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((ref) => {
      const value = ref as SourceReference;
      if (!value?.label || !value?.locator) return null;
      return {
        label: String(value.label),
        locator: String(value.locator),
        locatorKind: value.locatorKind,
        excerpt: value.excerpt ? String(value.excerpt) : undefined,
        note: value.note ? String(value.note) : undefined,
      } satisfies SourceReference;
    })
    .filter(Boolean) as SourceReference[];
}

const DEFAULT_CALLOUT_LABELS: Record<string, CalloutLabel> = {
  action: 'Para aplicarlo',
  info: 'Idea clave',
  alert: 'Precaución',
};

/**
 * Strict per-block normalizer. Malformed interactive blocks return null
 * (caller drops them with a log) — never throw / never poison the map.
 */
export function normalizeStepContentBlock(
  input: unknown,
  options?: { onDrop?: (reason: string, raw: unknown) => void }
): StepContentBlock | null {
  if (!input || typeof input !== 'object') {
    options?.onDrop?.('not-object', input);
    return null;
  }

  const raw = input as Record<string, unknown>;
  const type = asString(raw.type).toLowerCase();

  if (type && !ALLOWED_STEP_CONTENT_BLOCK_TYPES.has(type)) {
    const reason = `unknown-type:${type}`;
    if (options?.onDrop) {
      options.onDrop(reason, input);
    } else if (typeof console !== 'undefined') {
      console.warn(`[normalizeStepContentBlock] dropped: ${reason}`);
    }
    return null;
  }

  if (type === 'stat') {
    const value = asString(raw.value);
    const label = asString(raw.label);
    if (!value || !label) {
      options?.onDrop?.('stat-missing-value-or-label', input);
      return null;
    }
    const source = asString(raw.source);
    return {
      type: 'stat',
      value,
      label,
      source: source || undefined,
      emphasis: normalizeEmphasis(raw.emphasis),
    };
  }

  if (type === 'comparison') {
    if (!Array.isArray(raw.columns)) {
      options?.onDrop?.('comparison-columns-not-array', input);
      return null;
    }
    let columns = raw.columns.map((c) => asString(c)).filter(Boolean);
    if (columns.length > 3) columns = columns.slice(0, 3);
    if (columns.length === 1) columns = [columns[0]!, ''];
    if (columns.length !== 2 && columns.length !== 3) {
      options?.onDrop?.('comparison-columns-arity', input);
      return null;
    }
    if (!Array.isArray(raw.rows) || raw.rows.length === 0) {
      options?.onDrop?.('comparison-rows-empty', input);
      return null;
    }
    const colCount = columns.length;
    const rows: { label: string; values: string[] }[] = [];
    for (const row of raw.rows) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const label = asString(r.label);
      if (!label) continue;
      const valuesRaw = Array.isArray(r.values) ? r.values.map((v) => asString(v)) : [];
      // Coerce arity to columns — prefer keep over drop (schema cannot enforce equal lengths).
      const values =
        valuesRaw.length === colCount
          ? valuesRaw
          : valuesRaw.length > colCount
            ? valuesRaw.slice(0, colCount)
            : [...valuesRaw, ...Array(colCount - valuesRaw.length).fill('')];
      rows.push({ label, values });
    }
    if (rows.length === 0) {
      options?.onDrop?.('comparison-no-valid-rows', input);
      return null;
    }
    return {
      type: 'comparison',
      columns: columns as [string, string] | [string, string, string],
      rows,
      emphasis: normalizeEmphasis(raw.emphasis),
    };
  }

  if (type === 'accordion') {
    const title = asString(raw.title);
    const body = asString(raw.body);
    if (!title || !body) {
      options?.onDrop?.('accordion-missing-title-or-body', input);
      return null;
    }
    return {
      type: 'accordion',
      title,
      body,
      references: normalizeReferences(raw.references),
    };
  }

  if (type === 'quiz') {
    const question = asString(raw.question);
    const feedback = asString(raw.feedback);
    if (!question || !feedback) {
      options?.onDrop?.('quiz-missing-question-or-feedback', input);
      return null;
    }
    if (!Array.isArray(raw.options)) {
      options?.onDrop?.('quiz-options-not-array', input);
      return null;
    }
    const optionsList = raw.options.map((o) => asString(o)).filter(Boolean);
    if (optionsList.length < 2) {
      options?.onDrop?.('quiz-too-few-options', input);
      return null;
    }
    const correct =
      typeof raw.correct === 'number' && Number.isInteger(raw.correct)
        ? raw.correct
        : Number.parseInt(String(raw.correct ?? ''), 10);
    if (!Number.isInteger(correct) || correct < 0 || correct >= optionsList.length) {
      options?.onDrop?.('quiz-correct-out-of-range', input);
      return null;
    }
    return {
      type: 'quiz',
      question,
      options: optionsList,
      correct,
      feedback,
    };
  }

  if (type === 'callout' || type === 'list' || type === 'prose' || type === '') {
    const resolvedType: 'prose' | 'callout' | 'list' =
      type === 'callout' || type === 'list' ? type : 'prose';
    const kindRaw = asString(raw.kind);
    const kind: 'action' | 'info' | 'alert' | undefined =
      kindRaw === 'action' || kindRaw === 'info' || kindRaw === 'alert' ? kindRaw : undefined;
    const items: StepListItem[] | undefined = Array.isArray(raw.items)
      ? (raw.items
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const strong = asString((item as StepListItem).strong);
            if (!strong) return null;
            const span = asString((item as StepListItem).span);
            return { strong, span: span || undefined } satisfies StepListItem;
          })
          .filter(Boolean) as StepListItem[])
      : undefined;
    const text = asString(raw.text);
    if (!text && !(items && items.length)) {
      options?.onDrop?.('legacy-empty', input);
      return null;
    }
    if (resolvedType === 'callout') {
      return {
        type: 'callout',
        text,
        kind,
        label:
          (asString(raw.label) as CalloutLabel) ||
          DEFAULT_CALLOUT_LABELS[kind || 'info'] ||
          'Idea clave',
        references: normalizeReferences(raw.references),
      };
    }
    if (resolvedType === 'list') {
      return {
        type: 'list',
        text,
        kind,
        items,
        references: normalizeReferences(raw.references),
      };
    }
    return {
      type: 'prose',
      text,
      kind,
      references: normalizeReferences(raw.references),
    };
  }

  options?.onDrop?.(`unknown-type:${type}`, input);
  return null;
}

export function normalizeStepContentBlocks(
  input: unknown,
  options?: { onDrop?: (reason: string, raw: unknown) => void }
): StepContentBlock[] {
  if (!Array.isArray(input)) return [];
  const out: StepContentBlock[] = [];
  for (const raw of input) {
    const block = normalizeStepContentBlock(raw, options);
    if (!block) {
      const prev = out[out.length - 1];
      if (prev?.type === 'prose' && prev.text.trimEnd().endsWith(':')) {
        out.pop();
        options?.onDrop?.('orphan-prose-before-dropped-block', prev);
      }
      continue;
    }
    out.push(block);
  }
  return out;
}

/** Plain text for metrics / study-signal heuristics — never style. */
export function getBlockPlainText(block: StepContentBlock): string {
  switch (block.type) {
    case 'prose':
    case 'callout':
      return block.text.trim();
    case 'list':
      return [
        block.text,
        ...(block.items?.map((item) => `${item.strong} ${item.span ?? ''}`) ?? []),
      ]
        .join(' ')
        .trim();
    case 'stat':
      return `${block.value} ${block.label} ${block.source ?? ''}`.trim();
    case 'comparison':
      return [
        ...block.columns,
        ...block.rows.flatMap((row) => [row.label, ...row.values]),
      ]
        .join(' ')
        .trim();
    case 'accordion':
      return `${block.title} ${block.body}`.trim();
    case 'quiz':
      return `${block.question} ${block.options.join(' ')} ${block.feedback}`.trim();
    default: {
      const _exhaustive: never = block;
      return String(_exhaustive);
    }
  }
}

export function countBlockPlainWords(block: StepContentBlock): number {
  return getBlockPlainText(block).split(/\s+/).filter(Boolean).length;
}

export const INTERACTIVE_BLOCK_TYPES = ['stat', 'comparison', 'accordion', 'quiz'] as const;

export function isInteractiveBlock(
  block: StepContentBlock
): block is Extract<StepContentBlock, { type: (typeof INTERACTIVE_BLOCK_TYPES)[number] }> {
  return (INTERACTIVE_BLOCK_TYPES as readonly string[]).includes(block.type);
}
