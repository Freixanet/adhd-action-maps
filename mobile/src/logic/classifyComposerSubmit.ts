import type { UploadedFile } from './attachments';
import { detectUrlInput } from './urlInput';

export type ComposerSubmitKind = 'source' | 'ask';

/**
 * Source: file, URL/YouTube, paste-chip, or invalid URL attempt.
 * Ask: free-form conversational text without a source attachment/paste.
 */
export function classifyComposerSubmit(params: {
  inputText: string;
  pastedText: string | null;
  uploadedFile: UploadedFile | null;
}): ComposerSubmitKind {
  const { uploadedFile, pastedText, inputText } = params;
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
  return 'ask';
}
