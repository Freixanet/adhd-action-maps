/**
 * Resolve authorized PDF document URL for the evidence viewer.
 */

import {
  resolvePdfDocumentUrl as resolveShared,
  type ResolvePdfDocumentUrlResult,
} from '@shared/pdf/resolveDocumentUrl';
import { createSignedSourceUrl } from './sourcesStorageClient';

export type ResolvePdfDocumentUrlArgs = {
  sourceMeta: unknown;
  createSignedUrl?: typeof createSignedSourceUrl;
};

export async function resolvePdfDocumentUrl(
  args: ResolvePdfDocumentUrlArgs
): Promise<ResolvePdfDocumentUrlResult> {
  const createSignedUrl = args.createSignedUrl ?? createSignedSourceUrl;
  return resolveShared({
    sourceMeta: args.sourceMeta,
    createSignedUrl,
  });
}
