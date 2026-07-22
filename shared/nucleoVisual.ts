import type {
  NucleoVisualItem,
  NucleoVisualKind,
  NucleoVisualLink,
  NucleoVisualSpec,
  SourceReference,
  TLDRItem,
} from './contracts';

const VISUAL_KINDS = new Set<NucleoVisualKind>([
  'concept',
  'flow',
  'cycle',
  'hierarchy',
  'comparison',
  'bar',
  'line',
]);

const KIND_ALIASES: Record<string, NucleoVisualKind> = {
  sequence: 'flow',
  process: 'flow',
  loop: 'cycle',
  compare: 'comparison',
  tree: 'hierarchy',
  network: 'concept',
  'concept-map': 'concept',
  conceptmap: 'concept',
  bars: 'bar',
  column: 'bar',
  chart: 'bar',
  trend: 'line',
};

const NUMERIC_KINDS = new Set<NucleoVisualKind>(['bar', 'line']);
const MAX_ITEMS = 6;
const MAX_LINKS = 10;

export type NormalizeNucleoVisualOptions = {
  coreIdea?: string;
  tldr?: TLDRItem[];
  stepIds?: string[];
  /** Root overviews default to a concept fallback. Step visuals pass false. */
  fallback?: boolean;
};

function compactText(input: unknown, maxLength: number): string {
  return String(input ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

function normalizeKind(input: unknown): NucleoVisualKind {
  const value = compactText(input, 24).toLowerCase();
  if (VISUAL_KINDS.has(value as NucleoVisualKind)) return value as NucleoVisualKind;
  return KIND_ALIASES[value] ?? 'concept';
}

function normalizeReferences(input: unknown): SourceReference[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const references = input
    .map((candidate) => {
      const ref = candidate as Partial<SourceReference>;
      const label = compactText(ref?.label, 80);
      const locator = compactText(ref?.locator, 100);
      if (!label || !locator) return null;
      return {
        label,
        locator,
        locatorKind: ref.locatorKind,
        excerpt: compactText(ref.excerpt, 240) || undefined,
        note: compactText(ref.note, 180) || undefined,
      } satisfies SourceReference;
    })
    .filter(Boolean)
    .slice(0, 3) as SourceReference[];
  return references.length ? references : undefined;
}

function uniqueId(requested: string, index: number, seen: Set<string>): string {
  let candidate = requested || `visual-${index + 1}`;
  if (!seen.has(candidate)) {
    seen.add(candidate);
    return candidate;
  }
  let suffix = index + 1;
  while (seen.has(`visual-${suffix}`)) suffix += 1;
  candidate = `visual-${suffix}`;
  seen.add(candidate);
  return candidate;
}

function normalizeItems(
  input: unknown,
  kind: NucleoVisualKind,
  stepIds?: Set<string>
): NucleoVisualItem[] {
  if (!Array.isArray(input)) return [];
  const seenIds = new Set<string>();
  return input
    .map((candidate, index) => {
      const raw = candidate as Record<string, unknown>;
      const label = compactText(raw?.label, 36);
      if (!label) return null;
      const requestedId = compactText(raw?.id, 40);
      const item: NucleoVisualItem = {
        id: uniqueId(requestedId, index, seenIds),
        label,
        detail: compactText(raw?.detail, 240) || undefined,
        group: compactText(raw?.group, 48) || undefined,
        unit: compactText(raw?.unit, 24) || undefined,
        references: normalizeReferences(raw?.references),
      };
      const numericValue = raw?.value;
      if (typeof numericValue === 'number' && Number.isFinite(numericValue)) item.value = numericValue;
      const numericOrder = typeof raw?.order === 'number' ? raw.order : Number(raw?.order);
      if (raw?.order !== undefined && Number.isFinite(numericOrder)) item.order = numericOrder;
      const stepId = compactText(raw?.stepId, 64);
      if (stepId && (!stepIds || stepIds.has(stepId))) item.stepId = stepId;
      if (kind === 'comparison' && !item.group) item.group = item.label;
      if (kind === 'line' && !item.group) item.group = 'Serie';
      return item;
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS) as NucleoVisualItem[];
}

function normalizeLinks(input: unknown, itemIds: Set<string>): NucleoVisualLink[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input
    .map((candidate) => {
      const raw = candidate as Record<string, unknown>;
      const source = compactText(raw?.source, 40);
      const target = compactText(raw?.target, 40);
      if (!source || !target || source === target || !itemIds.has(source) || !itemIds.has(target)) {
        return null;
      }
      const key = `${source}->${target}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        source,
        target,
        label: compactText(raw?.label, 40) || undefined,
      } satisfies NucleoVisualLink;
    })
    .filter(Boolean)
    .slice(0, MAX_LINKS) as NucleoVisualLink[];
}

function defaultLinks(kind: NucleoVisualKind, items: NucleoVisualItem[]): NucleoVisualLink[] {
  if (items.length < 2) return [];
  if (kind === 'concept' || kind === 'hierarchy') {
    return items.slice(1).map((item) => ({ source: items[0].id, target: item.id }));
  }
  if (kind !== 'flow' && kind !== 'cycle') return [];
  const links = items.slice(0, -1).map((item, index) => ({
    source: item.id,
    target: items[index + 1].id,
  }));
  if (kind === 'cycle') links.push({ source: items[items.length - 1].id, target: items[0].id });
  return links;
}

function buildConceptFallback(options: NormalizeNucleoVisualOptions): NucleoVisualSpec | undefined {
  const tldr = Array.isArray(options.tldr) ? options.tldr : [];
  const coreIdea = compactText(options.coreIdea, 240);
  const branches = tldr
    .map((item, index) => {
      const label = compactText(item?.title, 36);
      if (!label) return null;
      return {
        id: `branch-${index + 1}`,
        label,
        detail: compactText(item?.desc, 240) || undefined,
      } satisfies NucleoVisualItem;
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS - 1) as NucleoVisualItem[];
  if (!coreIdea && branches.length < 2) return undefined;
  const core: NucleoVisualItem = {
    id: 'core',
    label: 'Idea central',
    detail: coreIdea || undefined,
  };
  const items = [core, ...branches];
  if (items.length < 2) return undefined;
  return {
    version: 2,
    kind: 'concept',
    title: 'Lo esencial de un vistazo',
    summary: coreIdea || branches.map((item) => item.detail || item.label).join(' '),
    items,
    links: defaultLinks('concept', items),
  };
}

export function getNucleoVisualQualityIssues(visual: NucleoVisualSpec): string[] {
  const issues: string[] = [];
  if (visual.items.length < 2 || visual.items.length > MAX_ITEMS) issues.push('item-count');
  if (!visual.summary.trim()) issues.push('summary');
  if (NUMERIC_KINDS.has(visual.kind)) {
    if (!visual.items.every((item) => Number.isFinite(item.value))) issues.push('numeric-values');
    if (!visual.items.every((item) => Boolean(item.unit || visual.unit))) issues.push('numeric-units');
    if (visual.kind === 'line') {
      const groupCounts = new Map<string, number>();
      visual.items.forEach((item) => {
        const group = item.group || 'Serie';
        groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
      });
      if ([...groupCounts.values()].some((count) => count < 2)) issues.push('line-series');
    }
  }
  if (visual.kind === 'comparison') {
    const groupCount = new Set(visual.items.map((item) => item.group)).size;
    if (groupCount < 2 || groupCount > 3) issues.push('comparison-groups');
  }
  if ((visual.kind === 'flow' || visual.kind === 'cycle' || visual.kind === 'hierarchy') && !visual.links?.length) {
    issues.push('links');
  }
  return issues;
}

export function normalizeNucleoVisual(
  input: unknown,
  options: NormalizeNucleoVisualOptions = {}
): NucleoVisualSpec | undefined {
  const raw = (input ?? {}) as Record<string, unknown>;
  const kind = normalizeKind(raw.kind);
  const stepIds = options.stepIds ? new Set(options.stepIds) : undefined;
  const items = normalizeItems(raw.items, kind, stepIds)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.order ?? a.index) - (b.item.order ?? b.index))
    .map(({ item }) => item);
  const itemIds = new Set(items.map((item) => item.id));
  const normalizedLinks = normalizeLinks(raw.links, itemIds);
  const links = normalizedLinks.length ? normalizedLinks : defaultLinks(kind, items);
  const title = compactText(raw.title, 96);
  const summary =
    compactText(raw.summary, 280) ||
    compactText(raw.accessibleSummary, 280) ||
    compactText(items[0]?.detail, 280) ||
    title;
  const visual: NucleoVisualSpec = {
    version: 2,
    kind,
    title: title || 'Lo esencial de un vistazo',
    summary,
    items,
    links: links.length ? links : undefined,
    references: normalizeReferences(raw.references),
    unit: compactText(raw.unit, 24) || undefined,
    xLabel: compactText(raw.xLabel, 56) || undefined,
    yLabel: compactText(raw.yLabel, 56) || undefined,
  };

  const issues = getNucleoVisualQualityIssues(visual);
  if (!issues.length) return visual;
  if (options.fallback === false) return undefined;
  return buildConceptFallback(options);
}

export function normalizeOptionalStepVisual(input: unknown): NucleoVisualSpec | undefined {
  return normalizeNucleoVisual(input, { fallback: false });
}
