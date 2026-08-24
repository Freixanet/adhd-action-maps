/**
 * Deep-link / share URL contract (pure). Mobile wraps with expo-linking.
 */

import { trackProductEvent } from './productTelemetry';

export type IncomingShare =
  | { kind: 'map'; entryId: string }
  | { kind: 'url'; url: string }
  | { kind: 'text'; text: string };

export const SHARE_EXTENSION_CONTRACT = {
  appGroup: 'group.com.freixanet.nucleo',
  openUrlTemplate: 'nucleo://import?url={encodedUrl}',
  mapUrlTemplate: 'nucleo://map/{entryId}',
} as const;

export function parseNucleoIncomingUrl(raw: string): IncomingShare | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (scheme === 'http' || scheme === 'https') {
    return null;
  }
  if (scheme !== 'nucleo') return null;

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/^\//, '');

  if (host === 'map' || path.startsWith('map/')) {
    const entryId = host === 'map' ? path : path.slice('map/'.length);
    const id = entryId.split('/')[0]?.trim();
    if (id) return { kind: 'map', entryId: id };
  }

  if (host === 'import' || path === 'import') {
    const url = parsed.searchParams.get('url')?.trim();
    if (url) {
      trackProductEvent('share_incoming', { kind: 'url' });
      return { kind: 'url', url };
    }
    const text = parsed.searchParams.get('text')?.trim();
    if (text) {
      trackProductEvent('share_incoming', { kind: 'text' });
      return { kind: 'text', text };
    }
  }

  return null;
}
