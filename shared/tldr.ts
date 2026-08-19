/**
 * «En 60 segundos» — synthesis contract (not an index, not an exhaustive summary).
 * Default 3 essential ideas; 4 only when a fourth is indispensable; never more than 4.
 */

import type { ActionMapData, TLDRItem } from './contracts';
import {
  TLDR_DEFAULT_COUNT,
  TLDR_MAX_COUNT,
  TLDR_SUBTITLE_MAX_CHARACTERS,
  TLDR_TITLE_MAX_CHARACTERS,
} from './contracts';

const BOILERPLATE_LIMIT_MARKERS = [
  'generado en modo studydoc',
  'fuente truncada',
  'single nucleo',
  'único núcleo',
];

/** Soft length defense: word-boundary clip without ellipsis or font tricks. */
export function softClipWithoutEllipsis(text: string, max: number): string {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= Math.floor(max * 0.55)) {
    return slice.slice(0, lastSpace).trim();
  }
  return slice.trim();
}

export function deriveTldrTitle(
  seed: string,
  max: number = TLDR_TITLE_MAX_CHARACTERS
): string {
  const cleaned = String(seed ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return 'Idea esencial';
  const clause = cleaned.split(/[:.—–\-–]/)[0]?.trim() || cleaned;
  const words = clause.split(/\s+/).slice(0, 6).join(' ');
  return softClipWithoutEllipsis(words, max) || 'Idea esencial';
}

function titleLooksLikeTruncatedDesc(title: string, desc: string): boolean {
  const t = title.trim().toLowerCase();
  const d = desc.trim().toLowerCase();
  if (!t || !d) return true;
  if (d.startsWith(t) && d.length > t.length + 8) return true;
  if (t.length >= 40 && d.startsWith(t.slice(0, 36))) return true;
  return false;
}

export function normalizeTldrItem(raw: unknown): TLDRItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as { title?: unknown; desc?: unknown };
  const descRaw = typeof item.desc === 'string' ? item.desc.trim() : '';
  const titleRaw = typeof item.title === 'string' ? item.title.trim() : '';
  if (!descRaw && !titleRaw) return null;
  const desc = softClipWithoutEllipsis(
    descRaw || titleRaw,
    TLDR_SUBTITLE_MAX_CHARACTERS
  );
  if (!desc) return null;
  let title = softClipWithoutEllipsis(titleRaw || deriveTldrTitle(desc), TLDR_TITLE_MAX_CHARACTERS);
  if (titleLooksLikeTruncatedDesc(title, desc)) {
    title = deriveTldrTitle(desc);
  }
  return { title: title || 'Idea esencial', desc };
}

/** Soft persist defense: never keep more than TLDR_MAX_COUNT; never invent fillers. */
export function normalizeTldrItems(input: unknown): TLDRItem[] {
  if (!Array.isArray(input)) return [];
  const out: TLDRItem[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (out.length >= TLDR_MAX_COUNT) break;
    const item = normalizeTldrItem(raw);
    if (!item) continue;
    const key = item.desc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function essentialIdeaToTldrItem(raw: unknown): TLDRItem | null {
  if (typeof raw === 'string') {
    const desc = softClipWithoutEllipsis(raw, TLDR_SUBTITLE_MAX_CHARACTERS);
    if (!desc) return null;
    return { title: deriveTldrTitle(desc), desc };
  }
  return normalizeTldrItem(raw);
}

export function normalizeEssentialIdeaItems(input: unknown): TLDRItem[] {
  if (!Array.isArray(input)) return [];
  const out: TLDRItem[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (out.length >= TLDR_MAX_COUNT) break;
    const item = essentialIdeaToTldrItem(raw);
    if (!item) continue;
    const key = item.desc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function essentialIdeaSearchText(idea: TLDRItem | string): string {
  if (typeof idea === 'string') return idea.trim();
  return `${idea.title} ${idea.desc}`.trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 3)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function isBoilerplateLimit(text: string): boolean {
  const lower = text.toLowerCase();
  return BOILERPLATE_LIMIT_MARKERS.some((m) => lower.includes(m));
}

type ScoredIdea = TLDRItem & { score: number; kind: 'core' | 'tldr' | 'knowledge' | 'step' | 'limit' };

/**
 * Rebuild «En 60 segundos» from the full map: pick the most important ideas,
 * not the first N source-order items. Prefer exactly 3; keep 4 only for an
 * indispensable limit/condition that would otherwise leave a hole.
 */
export function synthesizeTldrFromMap(data: ActionMapData): TLDRItem[] {
  const candidates: ScoredIdea[] = [];

  for (const item of data.tldr ?? []) {
    const normalized = normalizeTldrItem(item);
    if (!normalized) continue;
    candidates.push({ ...normalized, score: 55, kind: 'tldr' });
  }

  const coreIdea = String(data.coreIdea ?? '').trim();
  const coreSupport = String(data.coreSupport ?? '').trim();
  if (coreIdea) {
    const desc = softClipWithoutEllipsis(coreSupport || coreIdea, TLDR_SUBTITLE_MAX_CHARACTERS);
    candidates.push({
      title: deriveTldrTitle(coreIdea),
      desc,
      score: 90,
      kind: 'core',
    });
  }

  const layer0What = String(data.layer0?.what ?? '').trim();
  if (layer0What && layer0What !== coreSupport && layer0What !== coreIdea) {
    candidates.push({
      title: deriveTldrTitle(layer0What),
      desc: softClipWithoutEllipsis(layer0What, TLDR_SUBTITLE_MAX_CHARACTERS),
      score: 70,
      kind: 'core',
    });
  }

  for (const section of data.knowledgeSections ?? []) {
    const title = softClipWithoutEllipsis(String(section.title ?? ''), TLDR_TITLE_MAX_CHARACTERS);
    const desc = softClipWithoutEllipsis(String(section.summary ?? ''), TLDR_SUBTITLE_MAX_CHARACTERS);
    if (!title || !desc) continue;
    candidates.push({ title, desc, score: 42, kind: 'knowledge' });
  }

  for (const step of data.steps ?? []) {
    const body =
      String(step.purpose ?? '').trim() ||
      String(step.selfCheck ?? '').trim() ||
      '';
    if (!body) continue;
    candidates.push({
      title: softClipWithoutEllipsis(
        String(step.shortNav || step.title || ''),
        TLDR_TITLE_MAX_CHARACTERS
      ) || deriveTldrTitle(body),
      desc: softClipWithoutEllipsis(body, TLDR_SUBTITLE_MAX_CHARACTERS),
      score: 28,
      kind: 'step',
    });
  }

  const limitSources = [
    ...(data.coverage?.notes ?? [])
      .filter((n) => n.tone === 'warning' || /límite|matiz|no afirma|cautela/i.test(`${n.label} ${n.detail}`))
      .map((n) => String(n.detail || n.label || '')),
    ...(data.sourceMetadata?.limitations ?? []),
  ];
  for (const lim of limitSources) {
    const text = String(lim ?? '').trim();
    if (!text || isBoilerplateLimit(text)) continue;
    candidates.push({
      title: 'Límite crítico',
      desc: softClipWithoutEllipsis(text, TLDR_SUBTITLE_MAX_CHARACTERS),
      score: 48,
      kind: 'limit',
    });
  }

  // Prefer unique, high-score ideas. Importance over source order.
  candidates.sort((a, b) => b.score - a.score);

  const selected: ScoredIdea[] = [];
  for (const cand of candidates) {
    if (selected.length >= TLDR_MAX_COUNT) break;
    const tokens = tokenSet(`${cand.title} ${cand.desc}`);
    const redundant = selected.some(
      (s) => jaccard(tokens, tokenSet(`${s.title} ${s.desc}`)) >= 0.45
    );
    if (redundant) continue;

    if (selected.length >= TLDR_DEFAULT_COUNT) {
      // Fourth slot only for an indispensable limit/condition.
      if (cand.kind !== 'limit') continue;
    }
    selected.push(cand);
  }

  // Ensure at least one item when the map has core content.
  if (!selected.length && coreIdea) {
    selected.push({
      title: deriveTldrTitle(coreIdea),
      desc: softClipWithoutEllipsis(coreSupport || coreIdea, TLDR_SUBTITLE_MAX_CHARACTERS),
      score: 90,
      kind: 'core',
    });
  }

  return selected.map(({ title, desc }) => ({ title, desc }));
}

export function selectLatestHistoryEntryByTime<
  T extends { createdAt: number; updatedAt: number },
>(entries: T[]): T | null {
  if (!entries.length) return null;
  let best = entries[0]!;
  let bestTs = Math.max(best.createdAt, best.updatedAt);
  for (let i = 1; i < entries.length; i += 1) {
    const entry = entries[i]!;
    const ts = Math.max(entry.createdAt, entry.updatedAt);
    if (ts > bestTs) {
      best = entry;
      bestTs = ts;
    }
  }
  return best;
}

export function tldrItemsEqual(a: TLDRItem[], b: TLDRItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (item, i) => item.title === b[i]?.title && item.desc === b[i]?.desc
  );
}
