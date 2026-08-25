import { detectUrlInput } from './urlInput';
import type { HomeSurface } from '@shared/homeSurfaceModel';

export type ComposerSubmitKind = 'source' | 'ask';

/**
 * Source: file, URL/YouTube, paste-chip, invalid URL attempt, or Núcleo surface
 * with free text (the typed body is the source).
 * Ask: Chat surface with free-form text and no source attachment/paste.
 */
export function classifyComposerSubmit(params: {
  inputText: string;
  pastedText: string | null;
  uploadedFile: { name?: string } | null;
  surface?: HomeSurface;
}): ComposerSubmitKind {
  const { uploadedFile, pastedText, inputText, surface } = params;
  if (uploadedFile) return 'source';
  if (pastedText?.trim()) return 'source';

  const bodyText = inputText.trim();
  if (!bodyText) return 'source';

  const urlDetection = detectUrlInput(bodyText);
  if (
    urlDetection.kind === 'youtube' ||
    urlDetection.kind === 'link' ||
    urlDetection.kind === 'invalid'
  ) {
    return 'source';
  }

  if (surface === 'nucleo') return 'source';
  return 'ask';
}
