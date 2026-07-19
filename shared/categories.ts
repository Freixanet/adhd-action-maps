import type { MapIntent, SavedSession, SourceType } from './contracts';
import type { HistoryEntry } from './history';
import { migrateCategoryToEnum } from './nucleoPipeline';

export const DEFAULT_MAP_CATEGORIES = [
  'IA y tecnología',
  'Salud',
  'Negocio',
  'Aprendizaje',
  'Finanzas',
  'Legal',
  'Personal',
  'Otros',
] as const;

export type DefaultMapCategory = (typeof DEFAULT_MAP_CATEGORIES)[number];
export const FALLBACK_MAP_CATEGORY: DefaultMapCategory = 'Otros';

export type MapStatus = 'unread' | 'in_progress' | 'completed' | 'action_pending';

export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of input) {
    const tag = String(item ?? '')
      .trim()
      .slice(0, 32);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 5) break;
  }

  return tags;
}

export function normalizeCategoryName(input: unknown): string | null {
  const value = String(input ?? '').trim().slice(0, 48);
  return value || null;
}

export function sanitizeUserCategory(input: unknown): string | null {
  const value = migrateCategoryToEnum(input);
  return value || null;
}

export function resolveMapCategory(suggested: unknown): string {
  return migrateCategoryToEnum(suggested);
}

export function collectUserCategories(_entries: Array<{ category?: string }>): string[] {
  return [];
}

export function collectUsedCategories(entries: Array<{ category?: string }>): string[] {
  const seen = new Set<string>();
  const used: string[] = [];

  for (const entry of entries) {
    const category = resolveMapCategory(entry.category);
    const key = category.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    used.push(category);
  }

  used.sort((a, b) => {
    if (a === FALLBACK_MAP_CATEGORY) return 1;
    if (b === FALLBACK_MAP_CATEGORY) return -1;
    return a.localeCompare(b, 'es');
  });

  return used;
}

export function getAllCategoryOptions(): string[] {
  return [...DEFAULT_MAP_CATEGORIES];
}

export function getCategoryEditSections(usedCategories: readonly string[] = []): {
  used: string[];
  suggested: string[];
} {
  const used = [...usedCategories];
  const usedKeys = new Set(used.map((category) => category.toLowerCase()));
  const suggested: string[] = [];

  for (const category of DEFAULT_MAP_CATEGORIES) {
    if (!usedKeys.has(category.toLowerCase())) {
      suggested.push(category);
    }
  }

  return { used, suggested };
}

export function deriveMapStatus(
  session: Pick<SavedSession, 'currentStep' | 'isComplete' | 'viewAll'>,
  intent?: MapIntent
): MapStatus {
  if (session.isComplete) return 'completed';
  if (session.currentStep > 0 || session.viewAll) return 'in_progress';
  if (intent === 'apply') return 'action_pending';
  return 'unread';
}

export function getSourceTypeLabel(sourceType: SourceType, sourceKind?: string): string {
  if (sourceKind === 'image') return 'Imagen';
  if (sourceKind === 'video') return 'Vídeo';

  const labels: Record<SourceType, string> = {
    text: 'Texto',
    link: 'Enlace',
    youtube: 'YouTube',
    pdf: 'PDF',
    file: 'Archivo',
  };

  return labels[sourceType] ?? sourceType;
}

export function getIntentLabel(intent?: MapIntent): string {
  if (intent === 'apply') return 'Aplicar';
  if (intent === 'study') return 'Estudiar';
  return 'Entender';
}

export function getEntrySourceLabel(entry: HistoryEntry): string {
  const kind = (entry.session.data as { sourceMetadata?: { kind?: string } } | undefined)
    ?.sourceMetadata?.kind;
  return getSourceTypeLabel(entry.sourceType, kind);
}

export function normalizeHistoryEntry(entry: HistoryEntry): HistoryEntry {
  const data = entry.session.data as {
    category?: string;
    tags?: string[];
    intent?: MapIntent;
  };

  const category =
    migrateCategoryToEnum(entry.category) ??
    migrateCategoryToEnum(data.category) ??
    FALLBACK_MAP_CATEGORY;
  const tags = entry.tags?.length ? normalizeTags(entry.tags) : normalizeTags(data.tags);
  const intent =
    entry.intent === 'apply' || entry.intent === 'study' || entry.intent === 'understand'
      ? entry.intent
      : data.intent === 'apply' || data.intent === 'study'
        ? data.intent
        : 'understand';
  const status = deriveMapStatus(entry.session, intent);

  return {
    ...entry,
    category,
    tags,
    intent,
    status,
  };
}
