import {
  needsGeneratedCover,
  thesisFromEntry,
  GENERATED_COVER_STYLE_ID,
  type GeneratedCoverRecord,
} from '@shared/generatedCover';
import type { HistoryEntry } from '@shared/history';
import { apiUrl } from './apiBase';
import { buildLlmRequestHeaders } from './apiHeaders';
import { fetchWithTimeout } from './network';
import { writeNucleoCoverFile } from './nucleoCoverFiles';
import { supabase } from './supabase';

const inFlight = new Set<string>();

type CoverResponse = {
  mimeType?: string;
  base64?: string;
  error?: string;
};

export async function ensureNucleoCover(
  entry: HistoryEntry,
  onReady: (id: string, cover: GeneratedCoverRecord) => void
): Promise<void> {
  if (!needsGeneratedCover(entry) || inFlight.has(entry.id)) return;
  inFlight.add(entry.id);

  try {
    const accessToken = supabase
      ? (await supabase.auth.getSession()).data.session?.access_token
      : undefined;
    const headers = await buildLlmRequestHeaders(accessToken);
    const response = await fetchWithTimeout(
      apiUrl('/api/nucleo-cover'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          title: entry.title,
          thesis: thesisFromEntry(entry),
        }),
      },
      {
        timeoutMs: 50_000,
        timeoutMessage: 'cover_timeout',
      }
    );
    const parsed = (await response.json()) as CoverResponse;
    if (!response.ok || !parsed.base64 || !parsed.mimeType) {
      console.warn('[nucleo-cover]', parsed.error || response.status);
      return;
    }
    const localUri = await writeNucleoCoverFile(entry.id, parsed.mimeType, parsed.base64);
    onReady(entry.id, {
      styleId: GENERATED_COVER_STYLE_ID,
      localUri,
      mimeType: parsed.mimeType,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.warn('[nucleo-cover]', error instanceof Error ? error.message : 'failed');
  } finally {
    inFlight.delete(entry.id);
  }
}

export async function ensureNucleoCovers(
  entries: readonly HistoryEntry[],
  onReady: (id: string, cover: GeneratedCoverRecord) => void
): Promise<void> {
  for (const entry of entries) {
    await ensureNucleoCover(entry, onReady);
  }
}
