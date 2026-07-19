import { isYouTubeUrl } from './youtube';

export type UrlInputDetection =
  | { kind: 'youtube'; url: string }
  | { kind: 'link'; url: string }
  | { kind: 'text' }
  | { kind: 'invalid'; message: string };

export type TransformSourceKind = 'link' | 'youtube' | 'text';

const URL_WITH_EXTRA_TEXT_MESSAGE =
  'Pega solo el enlace, sin texto adicional, o pega directamente el texto completo.';

const INVALID_URL_MESSAGE =
  'URL inválida. Ingresa un enlace completo (https://...).';

const BARE_DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])+)+\/?[^\s]*$/i;

export function normalizeUrlCandidate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const nonEmptyLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return nonEmptyLines.length === 1 ? nonEmptyLines[0] : trimmed;
}

function looksLikeUrlAttempt(candidate: string): boolean {
  const value = candidate.trim();
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return true;
  if (/^www\./i.test(value)) return true;
  return BARE_DOMAIN_PATTERN.test(value);
}

function normalizeToAbsoluteUrl(candidate: string): string | null {
  let value = candidate.trim();
  if (!value) return null;

  if (/^www\./i.test(value)) {
    value = `https://${value}`;
  } else if (!/^https?:\/\//i.test(value) && BARE_DOMAIN_PATTERN.test(value)) {
    value = `https://${value}`;
  }

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function detectUrlInput(text: string): UrlInputDetection {
  const trimmed = text.trim();
  if (!trimmed) return { kind: 'text' };

  const nonEmptyLines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (nonEmptyLines.length > 1) {
    if (looksLikeUrlAttempt(nonEmptyLines[0])) {
      return { kind: 'invalid', message: URL_WITH_EXTRA_TEXT_MESSAGE };
    }
    return { kind: 'text' };
  }

  const candidate = nonEmptyLines[0] ?? trimmed;

  if (isYouTubeUrl(candidate)) {
    return { kind: 'youtube', url: candidate };
  }

  if (!looksLikeUrlAttempt(candidate)) {
    return { kind: 'text' };
  }

  const normalized = normalizeToAbsoluteUrl(candidate);
  if (!normalized) {
    return { kind: 'invalid', message: INVALID_URL_MESSAGE };
  }

  if (isYouTubeUrl(normalized)) {
    return { kind: 'youtube', url: normalized };
  }

  return { kind: 'link', url: normalized };
}

export function friendlyTransformError(
  message: string,
  sourceKind?: TransformSourceKind
): string {
  if (!message) return message;

  if (message.includes('did not match the expected pattern')) {
    return 'No se pudo conectar con el servidor. Comprueba tu conexión a internet e inténtalo de nuevo.';
  }

  const isUrlSource = sourceKind === 'link' || sourceKind === 'youtube';

  if (
    isUrlSource &&
    /suficiente texto legible|no contiene suficiente texto/i.test(message)
  ) {
    return `${message} La página puede cargar el contenido con JavaScript o estar detrás de un paywall. Copia el texto y pégalo aquí.`;
  }

  if (
    isUrlSource &&
    /No se pudo acceder al enlace \((401|403)\)/.test(message)
  ) {
    return `${message} Puede requerir suscripción o inicio de sesión. Copia el texto manualmente.`;
  }

  if (
    isUrlSource &&
    /fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo|network request failed/i.test(message)
  ) {
    return 'No se pudo descargar el enlace. Comprueba la URL y tu conexión.';
  }

  return message;
}
