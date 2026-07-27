import type { MapIntent } from './contracts';
import type { UploadedFile } from './attachments';
import type { UrlInputDetection } from './urlInput';

const APPLY_URL_PATTERN =
  /tutorial|how-to|howto|guide|manual|wiki\/how|handbook|playbook|business|linkedin\.com\/pulse/i;
const UNDERSTAND_URL_PATTERN =
  /news|noticia|arxiv|doi\.org|medium\.com|substack|essay|ensayo|paper|research|theguardian|nytimes|elpais/i;

const APPLY_TEXT_PATTERN =
  /\b(cómo|como|paso a paso|guía|guia|tutorial|instrucciones|implementar|aplicar|manual|checklist)\b/i;
const UNDERSTAND_TEXT_PATTERN =
  /\b(ensayo|analisis|análisis|noticia|paper|investigación|investigacion|artículo de opinión|articulo de opinion)\b/i;

export function suggestIntentFromSource(
  text: string,
  uploadedFile: UploadedFile | null,
  urlDetection: UrlInputDetection | null
): MapIntent {
  if (uploadedFile?.isPdf || uploadedFile?.isEpub || uploadedFile?.isDocx) return 'apply';

  if (urlDetection?.kind === 'youtube') return 'understand';

  if (urlDetection?.kind === 'link') {
    const url = urlDetection.url;
    if (APPLY_URL_PATTERN.test(url)) return 'apply';
    if (UNDERSTAND_URL_PATTERN.test(url)) return 'understand';
    return 'understand';
  }

  const sample = text.trim().slice(0, 4000);
  if (!sample) return 'understand';
  if (APPLY_TEXT_PATTERN.test(sample)) return 'apply';
  if (UNDERSTAND_TEXT_PATTERN.test(sample)) return 'understand';
  return 'understand';
}

export function buildComposerSourceKey(
  text: string,
  uploadedFile: UploadedFile | null,
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
