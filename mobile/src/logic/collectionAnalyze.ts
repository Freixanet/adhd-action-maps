import { analyzeSourceText } from '@shared/collections';
import { Alert } from 'react-native';
import type { SourceAnalysisResponse, TransformRequest } from './contracts';
import { apiUrl } from './apiBase';
import { fetchWithTimeout } from './network';
import { createPastedTextOperationIds } from '@shared/pastedText';

export function analyzeTransformSourceLocally(body: TransformRequest): SourceAnalysisResponse | null {
  if (body.type === 'text' && body.text?.trim()) {
    const result = analyzeSourceText(body.text, body.sourceLabel);
    return {
      shouldProposeSplit: result.shouldProposeSplit,
      partCount: result.partCount,
      parts: result.parts.map((part) => ({ title: part.title, text: part.text })),
      totalWords: result.totalWords,
      collectionTitle: result.collectionTitle,
    };
  }
  return null;
}

export async function analyzeTransformSource(
  body: TransformRequest,
  headers?: Record<string, string>,
  signal?: AbortSignal
): Promise<SourceAnalysisResponse> {
  const local = analyzeTransformSourceLocally(body);
  if (local) return local;

  if (signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }

  const response = await fetchWithTimeout(
    apiUrl('/api/transform/analyze'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
      body: JSON.stringify(body),
      signal,
    },
    { timeoutMs: 60_000 }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'No se pudo analizar la fuente.');
  }

  return response.json() as Promise<SourceAnalysisResponse>;
}

export function promptCollectionSplit(partCount: number): Promise<'split' | 'single'> {
  return new Promise((resolve) => {
    Alert.alert(
      'Fuente larga',
      `Esta fuente es larga. ¿La divido en ${partCount} Núcleos?`,
      [
        {
          text: 'No, uno solo',
          onPress: () => resolve('single'),
        },
        {
          text: 'Sí, dividir',
          style: 'default',
          onPress: () => resolve('split'),
        },
      ],
      { cancelable: false }
    );
  });
}

/**
 * Build a part body with stable operation IDs and forced textMode source.
 * Short/interrogative part text never routes to ASK.
 */
export function buildCollectionPartBody(
  base: TransformRequest,
  part: { title: string; text?: string },
  ids: {
    mapId: string;
    sourceId: string;
    sourceVersionId: string;
    sourceRequestId: string;
  }
): TransformRequest {
  if (part.text?.trim()) {
    return {
      text: part.text,
      type: 'text',
      preferredModel: base.preferredModel,
      intent: base.intent,
      depth: base.depth,
      generationMode: base.generationMode,
      userDisplayName: base.userDisplayName,
      outputLanguage: base.outputLanguage,
      sourceLabel: part.title,
      segmentTitle: part.title,
      sourceContentKind: base.sourceContentKind,
      mapId: ids.mapId,
      sourceId: ids.sourceId,
      sourceVersionId: ids.sourceVersionId,
      sourceRequestId: ids.sourceRequestId,
      textMode: 'source',
    };
  }

  return {
    ...base,
    sourceLabel: part.title,
    segmentTitle: part.title,
    mapId: ids.mapId,
    sourceId: ids.sourceId,
    sourceVersionId: ids.sourceVersionId,
    sourceRequestId: ids.sourceRequestId,
    textMode: 'source',
    singleNucleoMode: undefined,
  };
}

/** Mint one stable identity per collection part (reused across part retries). */
export function mintCollectionPartIdentities(partCount: number) {
  return Array.from({ length: partCount }, () => createPastedTextOperationIds());
}
