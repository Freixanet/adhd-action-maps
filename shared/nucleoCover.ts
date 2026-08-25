import type { ActionMapData, SourceType } from './contracts';
import type { HistoryEntry } from './history';
import { selectVisualAsset } from './editorial/selectVisualAsset';
import {
  getVisualAssetById,
  getVisualAssetByLocalModule,
  type VisualIntent,
} from './editorial/visualLibrary';

/** Home “Jump back in” section title. Spanish product copy; key ready for i18n. */
export const JUMP_BACK_IN_SECTION_TITLE = 'Vuelve a tus Núcleos';

/**
 * Stable ids written by demo / editorial preview flows.
 * Keep in sync with mobile/src/data/demoNucleo.ts and
 * mobile/src/editorial/buildEditorialDemoMap.ts.
 */
const EXCLUDED_HISTORY_IDS = new Set(['nucleo-demo-included', 'nucleo-editorial-demo']);

export function isDemoOrPreviewHistoryEntry(entry: Pick<HistoryEntry, 'id'>): boolean {
  const id = entry.id;
  if (EXCLUDED_HISTORY_IDS.has(id)) return true;
  if (id.startsWith('nucleo-editorial-demo-')) return true;
  return false;
}

/**
 * Latest user-created Núcleos for Home, newest creation first.
 * Does not mutate `entries`. Excludes demos / fixtures / preview nucleos.
 */
export function selectLatestCreatedNucleos(
  entries: readonly HistoryEntry[],
  limit = 5
): HistoryEntry[] {
  const capped = Math.max(0, Math.floor(limit));
  if (capped === 0 || entries.length === 0) return [];

  return [...entries]
    .filter((entry) => !isDemoOrPreviewHistoryEntry(entry))
    .sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, capped);
}

export type NucleoCoverResolution = {
  /** Catalog asset id — stable for the same entry inputs. */
  assetId: string;
  localModule: string;
  intent: VisualIntent;
  queryTags: readonly string[];
  accessibilityLabel: string;
  source: 'editorial-cover' | 'fallback';
};

const SOURCE_FALLBACK_INTENT: Record<SourceType, VisualIntent> = {
  youtube: 'attention-drain',
  link: 'focus-path',
  pdf: 'hard-test',
  file: 'hard-test',
  text: 'progress-toward-goal',
};

function titleQueryTags(title: string): string[] {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9áéíóúüñ]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .slice(0, 6);
}

function readActionMap(entry: HistoryEntry): ActionMapData | null {
  const raw = entry.session?.data;
  if (!raw || typeof raw !== 'object') return null;
  return raw as ActionMapData;
}

/**
 * Deterministic cover art for a history entry.
 * Priority: editorial cover page illustration → catalog fallback from title/source.
 * Never uses remote URLs or ephemeral previewUri.
 */
export function resolveNucleoCover(entry: HistoryEntry): NucleoCoverResolution {
  const map = readActionMap(entry);
  const coverPage = map?.editorialPlan?.pages?.find((page) => page.archetype === 'cover');

  if (coverPage) {
    const tags = coverPage.illustration?.searchTags ?? titleQueryTags(entry.title);
    const resolvedId =
      coverPage.resolvedIllustration?.localCatalogId ||
      coverPage.resolvedIllustration?.assetId ||
      coverPage.illustration?.fallbackAssetId;

    if (resolvedId) {
      const byId = getVisualAssetById(resolvedId) ?? getVisualAssetByLocalModule(resolvedId);
      if (byId) {
        return {
          assetId: byId.id,
          localModule: byId.localModule,
          intent: (byId.intentTags[0] ?? 'progress-toward-goal') as VisualIntent,
          queryTags: tags,
          accessibilityLabel: byId.accessibilityLabel,
          source: 'editorial-cover',
        };
      }
    }

    const selection = selectVisualAsset({
      intent: 'progress-toward-goal',
      role: 'hero',
      composition: 'path-progress',
      queryTags: tags,
    });

    return {
      assetId: selection.asset.id,
      localModule: selection.asset.localModule,
      intent: 'progress-toward-goal',
      queryTags: tags,
      accessibilityLabel: selection.asset.accessibilityLabel,
      source: 'editorial-cover',
    };
  }

  const intent = SOURCE_FALLBACK_INTENT[entry.sourceType] ?? 'progress-toward-goal';
  const queryTags = [
    ...titleQueryTags(entry.title),
    entry.sourceType,
    entry.category?.toLowerCase() ?? '',
  ].filter(Boolean);

  const selection = selectVisualAsset({
    intent,
    role: 'hero',
    composition: 'centered-scene',
    queryTags,
  });

  return {
    assetId: selection.asset.id,
    localModule: selection.asset.localModule,
    intent,
    queryTags,
    accessibilityLabel: selection.asset.accessibilityLabel,
    source: 'fallback',
  };
}
