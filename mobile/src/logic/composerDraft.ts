import { getStorage } from '@shared/storage';
import type { UploadedFile } from './attachments';

export const COMPOSER_DRAFT_KEY = 'nucleo-draft';

export type ComposerDraft = {
  inputText: string;
  uploadedFile: UploadedFile | null;
  pastedText: string | null;
};

export function loadComposerDraft(): ComposerDraft | null {
  try {
    const raw = getStorage().getItem(COMPOSER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ComposerDraft;
    if (typeof parsed.inputText !== 'string') return null;
    return {
      inputText: parsed.inputText,
      uploadedFile: parsed.uploadedFile ?? null,
      pastedText: typeof parsed.pastedText === 'string' ? parsed.pastedText : null,
    };
  } catch {
    return null;
  }
}

export function saveComposerDraft(draft: ComposerDraft): void {
  try {
    getStorage().setItem(
      COMPOSER_DRAFT_KEY,
      JSON.stringify({
        inputText: draft.inputText,
        uploadedFile: draft.uploadedFile,
        pastedText: draft.pastedText,
      })
    );
  } catch {
    // ignore persistence failures
  }
}

export function clearComposerDraft(): void {
  try {
    getStorage().removeItem(COMPOSER_DRAFT_KEY);
  } catch {
    // ignore
  }
}
