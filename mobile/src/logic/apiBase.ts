import Constants from 'expo-constants';
import { createApiUrlResolver, DEFAULT_API_BASE } from '@shared/apiBase';

export { DEFAULT_API_BASE };

const LOCAL_API_PORT = 3000;

function getMetroHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    null;

  if (!hostUri || typeof hostUri !== 'string') return null;
  return hostUri.split(':')[0]?.trim() || null;
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  );
}

function isPhysicalDeviceHost(host: string): boolean {
  return host !== '127.0.0.1' && host !== 'localhost';
}

function rewriteLocalHost(url: string, metroHost: string): string {
  const parsed = new URL(url);
  parsed.hostname = metroHost;
  return parsed.toString().replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '');
  const metroHost = __DEV__ ? getMetroHost() : null;

  if (configured) {
    if (__DEV__ && metroHost) {
      const parsed = new URL(configured);
      const isLoopback = isLoopbackHost(parsed.hostname);

      // An explicit LAN IPv4 API base from .env is authoritative on physical devices;
      // do not rewrite it to Metro host because Metro may resolve to IPv6/hostname while backend listens on IPv4.
      if (isLoopback && isPhysicalDeviceHost(metroHost)) {
        return rewriteLocalHost(configured, metroHost);
      }
    }
    return configured;
  }

  if (__DEV__) {
    if (metroHost && isPhysicalDeviceHost(metroHost)) {
      return `http://${metroHost}:${LOCAL_API_PORT}`;
    }
    return `http://127.0.0.1:${LOCAL_API_PORT}`;
  }

  return DEFAULT_API_BASE;
}

export const apiUrl = createApiUrlResolver(getApiBaseUrl);
