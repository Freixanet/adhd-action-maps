import type { MapIntent } from './contracts';

export type IntentSourceHint = {
  isPdf?: boolean;
  isEpub?: boolean;
  isDocx?: boolean;
};

export type UrlInputDetectionLike = {
  kind: 'youtube' | 'link' | string;
  url?: string;
} | null;

const APPLY_URL_PATTERN =
  /tutorial|how-to|howto|guide|manual|wiki\/how|handbook|playbook|business|linkedin\.com\/pulse/i;
const UNDERSTAND_URL_PATTERN =
  /news|noticia|arxiv|doi\.org|medium\.com|substack|essay|ensayo|paper|research|theguardian|nytimes|elpais/i;

const APPLY_TEXT_PATTERN =
  /\b(cómo|como|paso a paso|guía|guia|tutorial|instrucciones|implementar|aplicar|manual|checklist)\b/i;
const UNDERSTAND_TEXT_PATTERN =
  /\b(ensayo|analisis|análisis|noticia|paper|investigación|investigacion|artículo de opinión|articulo de opinion)\b/i;

/** Visible DEV attach-menu labels for S08 multipage PDF QA. */
export const QA_MULTIPAGE_PDF_UNDERSTAND_LABEL = 'QA PDF multipágina · Entender';
export const QA_MULTIPAGE_PDF_APPLY_LABEL = 'QA PDF multipágina · Aplicar';

export const QA_MULTIPAGE_PDF_FILE_NAME = 's08-multipage.pdf';

export type QaMultipagePdfIntent = Extract<MapIntent, 'understand' | 'apply'>;

/**
 * Product preselection: passive sources default to understanding. Applying a
 * document requires an explicit instruction/pin; otherwise a safety-sensitive
 * PDF can open as a context gate instead of showing the generated Núcleo.
 */
export function suggestIntentFromSource(
  text: string,
  uploadedFile: IntentSourceHint | null,
  urlDetection: UrlInputDetectionLike
): MapIntent {
  const sample = text.trim().slice(0, 4000);
  if (sample && APPLY_TEXT_PATTERN.test(sample)) return 'apply';
  if (sample && UNDERSTAND_TEXT_PATTERN.test(sample)) return 'understand';

  if (uploadedFile?.isPdf || uploadedFile?.isEpub || uploadedFile?.isDocx) {
    return 'understand';
  }

  if (urlDetection?.kind === 'youtube') return 'understand';

  if (urlDetection?.kind === 'link') {
    const url = urlDetection.url ?? '';
    if (APPLY_URL_PATTERN.test(url)) return 'apply';
    if (UNDERSTAND_URL_PATTERN.test(url)) return 'understand';
    return 'understand';
  }

  if (!sample) return 'understand';
  return 'understand';
}

export function buildComposerSourceKey(
  text: string,
  uploadedFile: { name: string; size: number; mimeType?: string | null } | null,
  pastedText: string | null = null
): string {
  if (uploadedFile) {
    return `file:${uploadedFile.name}:${uploadedFile.size}:${uploadedFile.mimeType ?? ''}`;
  }
  if (pastedText) {
    return `pasted:${pastedText.length}:${pastedText.trim().slice(0, 120)}`;
  }
  return `text:${text.trim()}`;
}

/**
 * Composer intent after attach / text change.
 * A pinned intent (QA menu or user pill) wins until cleared.
 */
export function resolveComposerIntent(args: {
  pinnedIntent: MapIntent | null;
  text: string;
  uploadedFile: IntentSourceHint | null;
  urlDetection: UrlInputDetectionLike;
}): MapIntent {
  if (args.pinnedIntent) return args.pinnedIntent;
  return suggestIntentFromSource(args.text, args.uploadedFile, args.urlDetection);
}

/** Plan for a DEV QA multipage attach — same file, explicit intent. */
export function planQaMultipagePdfAttach(intent: QaMultipagePdfIntent): {
  fileName: string;
  intent: QaMultipagePdfIntent;
  pinnedIntent: QaMultipagePdfIntent;
  menuLabel: string;
} {
  return {
    fileName: QA_MULTIPAGE_PDF_FILE_NAME,
    intent,
    pinnedIntent: intent,
    menuLabel:
      intent === 'understand' ? QA_MULTIPAGE_PDF_UNDERSTAND_LABEL : QA_MULTIPAGE_PDF_APPLY_LABEL,
  };
}

export function intentDisplayLabel(intent: MapIntent): 'Entender' | 'Aplicar' {
  return intent === 'apply' ? 'Aplicar' : 'Entender';
}
