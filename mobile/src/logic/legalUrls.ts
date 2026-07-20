import { apiUrl } from './apiBase';

const FALLBACK_ORIGIN = 'https://optimizador-tdah-production.up.railway.app';

function resolvePublicOrigin(): string {
  try {
    const base = apiUrl('/');
    const origin = new URL(base).origin;
    if (origin && origin !== 'null') return origin;
  } catch {
    // fall through
  }
  return FALLBACK_ORIGIN;
}

export function privacyPolicyUrl(): string {
  return (
    process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || `${resolvePublicOrigin()}/privacidad`
  );
}

export function termsOfUseUrl(): string {
  return process.env.EXPO_PUBLIC_TERMS_URL?.trim() || `${resolvePublicOrigin()}/terminos`;
}
