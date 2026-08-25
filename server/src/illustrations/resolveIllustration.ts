import type { IllustrationCandidate } from '../../../shared/editorial';
import {
  EDITORIAL_STYLE_ID,
  STREAMLINE_LOCKED_FAMILY_NAME,
  STREAMLINE_LOCKED_FAMILY_SLUG,
  selectIllustration,
  type IllustrationSpec,
  type ResolvedIllustration,
} from '../../../shared/editorial';
import {
  createStreamlineProvider,
  downloadStreamlineSvg,
  searchLockedFamily,
} from './providers';

export type ResolvedIllustrationDelivery = ResolvedIllustration & {
  /** Ephemeral sanitized SVG — never write to durable history. */
  svgMarkup?: string;
  providerStatus: 'streamline' | 'local-fallback' | 'unavailable';
  keyConfigured: boolean;
};

/**
 * Full server pipeline:
 * IllustrationSpec → family search (UX Line) → score → SVG download → sanitize.
 */
export async function resolveIllustrationDelivery(
  spec: IllustrationSpec,
  apiKey: string | undefined
): Promise<ResolvedIllustrationDelivery> {
  const keyConfigured = Boolean(apiKey?.trim());
  const provider = createStreamlineProvider(apiKey);
  const extras: IllustrationCandidate[] = await provider.search(spec.searchTags);
  const resolved = selectIllustration(spec, extras);

  if (resolved.provider === 'streamline' && resolved.providerAssetKey) {
    const downloaded = await downloadStreamlineSvg(apiKey, resolved.providerAssetKey);
    if (downloaded) {
      return {
        ...resolved,
        familySlug: STREAMLINE_LOCKED_FAMILY_SLUG,
        license: downloaded.license === 'streamline-free' ? 'streamline-free' : resolved.license,
        attributionText:
          resolved.attributionText ??
          `Icons by Streamline · ${STREAMLINE_LOCKED_FAMILY_NAME}`,
        svgMarkup: downloaded.svg,
        providerStatus: 'streamline',
        keyConfigured,
      };
    }
  }

  // Local path — renderer uses editorial SVG scenes keyed by localCatalogId.
  if (resolved.provider === 'local') {
    return {
      ...resolved,
      providerStatus: 'local-fallback',
      keyConfigured,
    };
  }

  // Attempt direct family search for logging/diagnostics even when score missed.
  if (keyConfigured) {
    await searchLockedFamily(apiKey, spec.searchTags);
  }

  return {
    ...resolved,
    styleId: EDITORIAL_STYLE_ID,
    providerStatus: resolved.provider === 'none' ? 'unavailable' : 'local-fallback',
    keyConfigured,
  };
}
