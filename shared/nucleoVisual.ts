import type {
  NucleoVisual,
  NucleoVisualItem,
  NucleoVisualKind,
  TLDRItem,
} from './contracts';

const VISUAL_KINDS = new Set<NucleoVisualKind>([
  'flow',
  'cycle',
  'comparison',
  'hierarchy',
]);

const KIND_ALIASES: Record<string, NucleoVisualKind> = {
  sequence: 'flow',
  process: 'flow',
  timeline: 'flow',
  loop: 'cycle',
  compare: 'comparison',
  tree: 'hierarchy',
  network: 'hierarchy',
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
  return KIND_ALIASES[value] ?? 'flow';
}

function normalizeItems(input: unknown): NucleoVisualItem[] {
  if (!Array.isArray(input)) return [];
  const seenIds = new Set<string>();

  return input
    .map((item, index) => {
      const raw = item as { id?: unknown; label?: unknown; detail?: unknown };
      const label = compactText(raw?.label, 48);
      const detail = compactText(raw?.detail, 220);
      if (!label || !detail) return null;
      const requestedId = compactText(raw?.id, 40) || `visual-${index + 1}`;
      const id = seenIds.has(requestedId) ? `visual-${index + 1}` : requestedId;
      seenIds.add(id);
      return {
        id,
        label,
        detail,
      } satisfies NucleoVisualItem;
    })
    .filter(Boolean)
    .slice(0, 5) as NucleoVisualItem[];
}

function fallbackItems(tldr: TLDRItem[]): NucleoVisualItem[] {
  return tldr
    .map((item, index) => {
      const label = compactText(item?.title, 48);
      const detail = compactText(item?.desc, 220);
      if (!label || !detail) return null;
      return {
        id: `visual-${index + 1}`,
        label,
        detail,
      } satisfies NucleoVisualItem;
    })
    .filter(Boolean)
    .slice(0, 5) as NucleoVisualItem[];
}

export function normalizeNucleoVisual(
  input: unknown,
  tldr: TLDRItem[] = []
): NucleoVisual | undefined {
  const raw = input as { kind?: unknown; title?: unknown; items?: unknown };
  let items = normalizeItems(raw?.items);
  const usesFallback = items.length < 2;
  if (usesFallback) items = fallbackItems(tldr);
  if (items.length < 2) return undefined;

  return {
    kind: usesFallback ? 'flow' : normalizeKind(raw?.kind),
    title:
      compactText(raw?.title, 90) ||
      (usesFallback ? 'El Núcleo de un vistazo' : 'Cómo se conecta lo importante'),
    items,
  };
}
