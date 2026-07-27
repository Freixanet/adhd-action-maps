import type { UploadedFile } from './attachments';
import { countWords } from './composerText';
import { detectUrlInput } from './urlInput';

export type InlineAttachmentSnapshot = {
  name: string;
  size?: number;
  isPdf?: boolean;
  isImage?: boolean;
  isVideo?: boolean;
  isEpub?: boolean;
  isDocx?: boolean;
  previewUri?: string;
};

export type InlineUserTurnKind = 'ask' | 'source';

export type InlineUserTurnSnapshot = {
  kind: InlineUserTurnKind;
  conversationalMessage: string;
  text: string | null;
  pastedText: string | null;
  attachments: InlineAttachmentSnapshot[];
  sourceUrl: string | null;
  urlKind: 'youtube' | 'link' | null;
  linkTitle: string | null;
};

export function formatInlineFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

export function truncateMiddleName(name: string, max = 24): string {
  if (name.length <= max) return name;
  const ellipsis = '…';
  const keep = max - ellipsis.length;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${name.slice(0, head)}${ellipsis}${name.slice(name.length - tail)}`;
}

export function formatLinkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '') || url;
  } catch {
    return url.replace(/^www\./i, '');
  }
}

function toAttachmentSnapshot(file: UploadedFile): InlineAttachmentSnapshot {
  return {
    name: file.name,
    size: file.size,
    isPdf: file.isPdf,
    isImage: file.isImage,
    isVideo: file.isVideo,
    isEpub: file.isEpub,
    isDocx: file.isDocx,
    previewUri: file.previewUri,
  };
}

export function buildInlineUserTurnSnapshot(params: {
  inputText: string;
  pastedText: string | null;
  uploadedFile: UploadedFile | null;
  conversationalMessage: string;
  kind?: InlineUserTurnKind;
}): InlineUserTurnSnapshot {
  const { inputText, pastedText, uploadedFile, conversationalMessage, kind = 'source' } = params;
  const bodyText = pastedText?.trim() ?? inputText.trim();

  let urlDetection: ReturnType<typeof detectUrlInput> | null = null;
  if (!uploadedFile && bodyText) {
    urlDetection = detectUrlInput(bodyText);
  }

  return {
    kind,
    conversationalMessage,
    text: inputText.trim() || null,
    pastedText,
    attachments: uploadedFile ? [toAttachmentSnapshot(uploadedFile)] : [],
    sourceUrl:
      urlDetection?.kind === 'youtube' || urlDetection?.kind === 'link' ? urlDetection.url : null,
    urlKind:
      urlDetection?.kind === 'youtube'
        ? 'youtube'
        : urlDetection?.kind === 'link'
          ? 'link'
          : null,
    linkTitle: null,
  };
}

export function resolveInlineBubbleLinkTitle(
  snapshot: InlineUserTurnSnapshot,
  mapLabel: string | undefined,
  mapTitle: string | undefined
): string | null {
  const label = mapLabel?.trim();
  if (label && !/^https?:\/\//i.test(label)) return label;
  const title = mapTitle?.trim();
  if (title) return title;
  return snapshot.linkTitle;
}

export { countWords };
