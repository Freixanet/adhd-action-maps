import { analyzeSourceText } from '@shared/collections';
import { Alert } from 'react-native';
import type { SourceAnalysisResponse, TransformRequest } from './contracts';
import { apiUrl } from './apiBase';
import { fetchWithTimeout } from './network';

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
  headers?: Record<string, string>
): Promise<SourceAnalysisResponse> {
  const local = analyzeTransformSourceLocally(body);
  if (local) return local;

  const response = await fetchWithTimeout(
    apiUrl('/api/transform/analyze'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
      body: JSON.stringify(body),
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

export function buildCollectionPartBody(
  base: TransformRequest,
  part: { title: string; text?: string },
  mapId: string
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
      mapId,
    };
  }

  return {
    ...base,
    sourceLabel: part.title,
    segmentTitle: part.title,
    mapId,
    singleNucleoMode: undefined,
  };
}
