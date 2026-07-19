export const DEFAULT_API_BASE = 'https://optimizador-tdah-production.up.railway.app';

export function createApiUrlResolver(getBaseUrl: () => string) {
  return function apiUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${getBaseUrl()}${normalizedPath}`;
  };
}
