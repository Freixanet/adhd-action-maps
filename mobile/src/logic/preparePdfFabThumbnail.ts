/**
 * Copy the attached PDF into an app-controlled cache file:// URL.
 */

import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

const CACHE_PREFIX = 'nucleo-pdf-fab-thumb';
export const PDF_FAB_THUMB_PDF = 'document.pdf';

export type PdfFabThumbnailSession = {
  sessionId: string;
  pdfUri: string;
  baseUrl: string;
  cleanup: () => Promise<void>;
};

function cacheRoot(): string {
  const root = cacheDirectory ?? '';
  return `${root}${CACHE_PREFIX}/`;
}

function toFileBaseUrl(dir: string): string {
  const withSlash = dir.endsWith('/') ? dir : `${dir}/`;
  return withSlash.startsWith('file://') ? withSlash : `file://${withSlash}`;
}

async function materializePdf(
  target: string,
  args: { pdfLocalUri?: string | null; pdfBase64?: string | null }
): Promise<void> {
  if (args.pdfLocalUri) {
    const sourceInfo = await getInfoAsync(args.pdfLocalUri);
    if (sourceInfo.exists) {
      await copyAsync({ from: args.pdfLocalUri, to: target });
      return;
    }
  }
  if (args.pdfBase64) {
    await writeAsStringAsync(target, args.pdfBase64, {
      encoding: EncodingType.Base64,
    });
    return;
  }
  throw new Error('pdf_local_missing');
}

export async function preparePdfFabThumbnailSession(args: {
  pdfLocalUri?: string | null;
  pdfBase64?: string | null;
}): Promise<PdfFabThumbnailSession> {
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const root = cacheRoot();
  const dir = `${root}${sessionId}/`;

  const cleanup = async () => {
    try {
      await deleteAsync(dir, { idempotent: true });
    } catch {
      // idempotent
    }
  };

  try {
    await makeDirectoryAsync(root, { intermediates: true });
    await deleteAsync(dir, { idempotent: true });
    await makeDirectoryAsync(dir, { intermediates: true });
    await materializePdf(`${dir}${PDF_FAB_THUMB_PDF}`, {
      pdfLocalUri: args.pdfLocalUri,
      pdfBase64: args.pdfBase64,
    });

    const baseUrl = toFileBaseUrl(dir);
    return {
      sessionId,
      pdfUri: `${baseUrl}${PDF_FAB_THUMB_PDF}`,
      baseUrl,
      cleanup,
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
