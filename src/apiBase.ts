import { createApiUrlResolver, DEFAULT_API_BASE } from '@shared/apiBase';
import { isNativeShell } from './nativeShell';

export { DEFAULT_API_BASE };

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured?.trim()) return configured.trim().replace(/\/$/, '');
  if (isNativeShell()) return DEFAULT_API_BASE;
  return '';
}

export const apiUrl = createApiUrlResolver(getApiBaseUrl);
