import { font, space, type } from '@shared/design-tokens';
import { isGeneratedCoverRecord } from '@shared/generatedCover';
import { getVisualAssetById } from '@shared/editorial/visualLibrary';
import { resolveNucleoCover } from '@shared/homeFeed';
import type { HistoryEntry } from '@shared/history';
import { buildNucleoRoundCarouselSvg } from '@shared/nucleoRoundCarouselCard';
import { getBundledEditorialSvgXml } from '../editorial/visuals/bundledEditorialSvgXml';
import {
  RECENT_NUCLEO_ART_SCALE,
  RECENT_NUCLEO_COVER_RATIO,
} from '../components/RecentNucleoCard';
import { readNucleoCoverDataUri } from './nucleoCoverFiles';

export type NucleoRoundCarouselFace = {
  id: string;
  title: string;
  /** JPEG/PNG data URI. Originkit paints this as a CSS background (SVG nested photos do not show in WKWebView). */
  photo: string | null;
  svg: string;
};

export async function buildNucleoRoundCarouselFaces(
  items: readonly HistoryEntry[],
  size: number,
  colors: {
    background: { canvas: string; accentSoft: string };
    text: { primary: string };
  }
): Promise<NucleoRoundCarouselFace[]> {
  return Promise.all(
    items.map(async (entry) => {
      const resolution = resolveNucleoCover(entry);
      const asset = getVisualAssetById(resolution.assetId);
      const illustrationXml = asset ? getBundledEditorialSvgXml(asset.localModule) : null;
      const generated = isGeneratedCoverRecord(entry.generatedCover) ? entry.generatedCover : null;
      const photo = generated
        ? await readNucleoCoverDataUri(generated.localUri, generated.mimeType)
        : null;
      const title = entry.title?.trim() || 'Núcleo';
      return {
        id: entry.id,
        title,
        photo,
        svg: buildNucleoRoundCarouselSvg({
          size,
          canvas: colors.background.canvas,
          accentSoft: colors.background.accentSoft,
          textPrimary: colors.text.primary,
          title,
          titleSize: type.continueTitle.fontSize,
          titleLineHeight: type.continueTitle.lineHeight,
          titleWeight: type.continueTitle.fontWeight,
          titleTracking: type.continueTitle.letterSpacing,
          fontFamily: font.family,
          coverRatio: RECENT_NUCLEO_COVER_RATIO,
          artScale: RECENT_NUCLEO_ART_SCALE,
          artOffsetY: -space.stack.lg,
          padX: space.stack.md,
          padBottom: space.stack.sm,
          illustrationXml: photo ? null : illustrationXml,
          focusViewBox: photo ? undefined : asset?.focusViewBox,
        }),
      };
    })
  );
}
