import type { IllustrationCandidate } from '../../../shared/editorial';
import {
  EDITORIAL_STYLE_ID,
  normalizeIllustrationTags,
  STREAMLINE_LOCKED_FAMILY_SLUG,
  STREAMLINE_LOCKED_FAMILY_NAME,
  STREAMLINE_LOCKED_PRODUCT_TYPE,
  isLockedStreamlineFamily,
} from '../../../shared/editorial';
import { sanitizeSvgMarkup } from './sanitizeSvg';

export type IllustrationProviderId = 'local' | 'streamline';

export type StreamlineSearchHit = {
  hash: string;
  name: string;
  familySlug: string;
  familyName: string;
  isFree: boolean;
  imagePreviewUrl?: string;
};

export type IllustrationProvider = {
  id: IllustrationProviderId;
  search(
    tags: readonly string[],
    opts?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<IllustrationCandidate[]>;
};

const STREAMLINE_FAMILY_SEARCH = `https://public-api.streamlinehq.com/v1/search/family/${STREAMLINE_LOCKED_FAMILY_SLUG}`;
const STREAMLINE_DOWNLOAD = (hash: string) =>
  `https://public-api.streamlinehq.com/v1/icons/${encodeURIComponent(hash)}/download/svg`;

/**
 * Official Streamline Public API — family-locked to UX Line only.
 * No key → empty results (local editorial SVG wins). Never import from mobile.
 */
export function createStreamlineProvider(apiKey: string | undefined): IllustrationProvider {
  return {
    id: 'streamline',
    async search(tags, opts) {
      const hits = await searchLockedFamily(apiKey, tags, opts);
      return hits.map((row) => candidateFromHit(row, tags));
    },
  };
}

export async function searchLockedFamily(
  apiKey: string | undefined,
  tags: readonly string[],
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<StreamlineSearchHit[]> {
  if (!apiKey?.trim()) return [];
  const query = normalizeIllustrationTags(tags).slice(0, 3).join(' ');
  if (!query) return [];

  const timeoutMs = opts?.timeoutMs ?? 1600;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  opts?.signal?.addEventListener('abort', onAbort);

  try {
    const url =
      `${STREAMLINE_FAMILY_SEARCH}?query=${encodeURIComponent(query)}` +
      `&limit=12&offset=0`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-api-key': apiKey.trim(),
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        hash?: string;
        name?: string;
        familySlug?: string;
        familyName?: string;
        isFree?: boolean;
        imagePreviewUrl?: string;
        familyProductType?: string;
      }>;
    };
    const results = Array.isArray(json.results) ? json.results : [];
    return results
      .filter((row) => isLockedStreamlineFamily(row.familySlug))
      .filter((row) => !row.familyProductType || row.familyProductType === STREAMLINE_LOCKED_PRODUCT_TYPE)
      .filter((row) => row.isFree === true)
      .filter((row) => typeof row.hash === 'string' && row.hash.length > 0)
      .slice(0, 8)
      .map((row) => ({
        hash: String(row.hash),
        name: String(row.name ?? 'icon'),
        familySlug: STREAMLINE_LOCKED_FAMILY_SLUG,
        familyName: String(row.familyName ?? STREAMLINE_LOCKED_FAMILY_NAME),
        isFree: true,
        imagePreviewUrl: row.imagePreviewUrl,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener('abort', onAbort);
  }
}

export async function downloadStreamlineSvg(
  apiKey: string | undefined,
  hash: string,
  opts?: { signal?: AbortSignal; timeoutMs?: number; size?: number }
): Promise<{ svg: string; license: 'streamline-free' | 'streamline-unknown' } | null> {
  if (!apiKey?.trim() || !hash.trim()) return null;
  const timeoutMs = opts?.timeoutMs ?? 2000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const size = opts?.size ?? 128;
    const url =
      `${STREAMLINE_DOWNLOAD(hash.trim())}` +
      `?size=${size}&responsive=true&strokeToFill=false` +
      `&colors=${encodeURIComponent('#8B8FF5,#E0B45C,#FAFAFA')}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'image/svg+xml',
        'x-api-key': apiKey.trim(),
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const raw = await res.text();
    const svg = sanitizeSvgMarkup(raw);
    if (!svg) return null;
    return { svg, license: 'streamline-unknown' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function candidateFromHit(
  row: StreamlineSearchHit,
  tags: readonly string[]
): IllustrationCandidate {
  return {
    assetId: `streamline:${row.hash}`,
    provider: 'streamline',
    providerAssetKey: row.hash,
    tags: normalizeIllustrationTags(tags),
    roles: ['spot-illustration', 'concept-metaphor', 'experiment-sequence'],
    compositions: ['centered', 'sequence'],
    accessibilityLabel: row.name,
    license: row.isFree ? 'streamline-free' : 'streamline-unknown',
    attributionRequired: true,
    attributionText: `Icons by Streamline · ${STREAMLINE_LOCKED_FAMILY_NAME}`,
    familySlug: STREAMLINE_LOCKED_FAMILY_SLUG,
  };
}

export function createLocalProvider(): IllustrationProvider {
  return {
    id: 'local',
    async search() {
      return [];
    },
  };
}

export async function searchIllustrationProviders(
  tags: readonly string[],
  providers: readonly IllustrationProvider[],
  opts?: { timeoutMs?: number }
): Promise<IllustrationCandidate[]> {
  const settled = await Promise.all(
    providers.map((p) => p.search(tags, { timeoutMs: opts?.timeoutMs ?? 1600 }))
  );
  return settled.flat().filter((c) => {
    void EDITORIAL_STYLE_ID;
    if (c.provider === 'streamline') {
      return isLockedStreamlineFamily(c.familySlug ?? STREAMLINE_LOCKED_FAMILY_SLUG);
    }
    return c.provider === 'local';
  });
}
