import type { ActionMapData, MapDepth, TransformStreamEvent } from './contracts';
import { normalizeMapData } from './mapData';

/** Default idle window when depth is unknown (estándar). */
export const TRANSFORM_IDLE_TIMEOUT_MS = 90_000;
export const TRANSFORM_IDLE_TIMEOUT_MESSAGE =
  'La generación se ha detenido. Comprueba tu conexión e inténtalo de nuevo.';

export function resolveTransformIdleTimeoutMs(depth?: MapDepth): number {
  if (depth === 'rapido') return 75_000;
  if (depth === 'profundo') return 180_000;
  return 90_000;
}

export function resolveTransformFallbackTimeoutMs(depth?: MapDepth): number {
  if (depth === 'rapido') return 45_000;
  if (depth === 'profundo') return 180_000;
  return 75_000;
}

function resolveDepthFromBody(body: unknown): MapDepth {
  const depth = (body as { depth?: string })?.depth;
  if (depth === 'rapido' || depth === 'profundo') return depth;
  return 'estandar';
}

export function isNonRetryableTransformError(message: string): boolean {
  return (
    /Demasiadas solicitudes/i.test(message) ||
    /No hay modelos disponibles/i.test(message) ||
    /l[ií]mite.*Gemini/i.test(message) ||
    /Error 429/i.test(message) ||
    /Error 503/i.test(message) ||
    /quota|RESOURCE_EXHAUSTED/i.test(message) ||
    /plan gratuito de Gemini/i.test(message) ||
    /Inicia sesi[oó]n/i.test(message) ||
    /3 N[uú]cleos gratis/i.test(message) ||
    /l[ií]mite diario/i.test(message) ||
    /exclusiva? de Pro/i.test(message)
  );
}

export type FetchWithTimeoutOptions = {
  timeoutMs?: number;
  timeoutMessage?: string;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 20000,
    timeoutMessage = 'La conexión está tardando demasiado. Inténtalo de nuevo.',
  } = options;

  const controller = new AbortController();
  const { signal } = init;

  let didTimeout = false;
  let externalAbortListener: (() => void) | null = null;

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      externalAbortListener = () => {
        controller.abort();
      };
      signal.addEventListener('abort', externalAbortListener, { once: true });
    }
  }

  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (didTimeout) {
      throw new Error(timeoutMessage);
    }
    if (err && err.name === 'AbortError') {
      if (signal?.aborted) {
        throw err;
      }
      throw new Error(timeoutMessage);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal && externalAbortListener) {
      signal.removeEventListener('abort', externalAbortListener);
    }
  }
}

export function isRenderablePartialMap(map: ActionMapData | null): boolean {
  if (!map) return false;
  const hasTitle = Boolean(map.title?.trim() && map.title !== 'Mapa sin título');
  const hasCore = Boolean(map.coreIdea?.trim());
  const hasSteps = Boolean(map.steps?.length);
  return (hasTitle && hasCore) || hasSteps;
}

export type TransformStreamHandlers = {
  onPartial?: (map: ActionMapData) => void;
  onFirstStreamByte?: () => void;
  onDone: (map: ActionMapData, model?: string) => void;
  onError: (message: string) => void;
};

export type ConsumeTransformStreamResult = 'done' | 'error' | 'idle' | 'incomplete' | 'aborted';

export function parseTransformStreamLine(line: string): TransformStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as TransformStreamEvent;
  } catch {
    return null;
  }
}

export async function consumeTransformStream(
  response: Response,
  handlers: TransformStreamHandlers,
  options: {
    signal?: AbortSignal;
    idleTimeoutMs?: number;
  } = {}
): Promise<ConsumeTransformStreamResult> {
  const body = response.body;
  if (!body) return 'incomplete';

  const idleTimeoutMs = options.idleTimeoutMs ?? TRANSFORM_IDLE_TIMEOUT_MS;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleAborted = false;
  let firstStreamByteEmitted = false;

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const resetIdle = () => {
    clearIdle();
    idleTimer = setTimeout(() => {
      idleAborted = true;
      reader.cancel().catch(() => undefined);
    }, idleTimeoutMs);
  };

  const onExternalAbort = () => {
    idleAborted = true;
    reader.cancel().catch(() => undefined);
  };

  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  resetIdle();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (idleAborted) {
        return options.signal?.aborted ? 'aborted' : 'idle';
      }

      if (value?.byteLength && !firstStreamByteEmitted) {
        firstStreamByteEmitted = true;
        handlers.onFirstStreamByte?.();
      }

      resetIdle();
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const event = parseTransformStreamLine(line);
        if (!event) continue;

        if (event.type === 'partial' && event.map) {
          const normalized = normalizeMapData(event.map);
          if (normalized && isRenderablePartialMap(normalized)) {
            handlers.onPartial?.(normalized);
          }
          continue;
        }

        if (event.type === 'done' && event.map) {
          const normalized = normalizeMapData(event.map);
          if (!normalized) {
            handlers.onError('No se pudo interpretar el mapa generado.');
            return 'error';
          }
          handlers.onDone(normalized, event.model);
          return 'done';
        }

        if (event.type === 'error') {
          handlers.onError(event.error || 'Error desconocido durante la generación.');
          return 'error';
        }
      }
    }

    return 'incomplete';
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    if (options.signal?.aborted) {
      return 'aborted';
    }
    if (idleAborted || name === 'AbortError') {
      return 'idle';
    }
    throw err;
  } finally {
    clearIdle();
    options.signal?.removeEventListener('abort', onExternalAbort);
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export type FetchTransformOptions = {
  streamUrl: string;
  fallbackUrl: string;
  body: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  depth?: MapDepth;
  idleTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  handlers: TransformStreamHandlers;
};

function streamEndedWithoutDoneMessage(
  result: ConsumeTransformStreamResult,
  receivedRenderablePartial: boolean
): string {
  if (result === 'idle') {
    return TRANSFORM_IDLE_TIMEOUT_MESSAGE;
  }
  if (receivedRenderablePartial) {
    return 'La generación se interrumpió antes de completarse.';
  }
  return 'Streaming incompleto';
}

export async function fetchTransformWithProgress({
  streamUrl,
  fallbackUrl,
  body,
  headers = {},
  signal,
  depth,
  idleTimeoutMs,
  fallbackTimeoutMs,
  handlers,
}: FetchTransformOptions): Promise<'stream' | 'fallback'> {
  let receivedRenderablePartial = false;
  let streamEstablished = false;

  const resolvedDepth = depth ?? resolveDepthFromBody(body);
  const resolvedIdleTimeoutMs = idleTimeoutMs ?? resolveTransformIdleTimeoutMs(resolvedDepth);
  const resolvedFallbackTimeoutMs =
    fallbackTimeoutMs ?? resolveTransformFallbackTimeoutMs(resolvedDepth);
  const resolvedStreamTimeoutMs = (() => {
    if (resolvedDepth === 'rapido') return 20000;
    if (resolvedDepth === 'profundo') return 45000;
    return 25000; // estandar
  })();

  const wrappedHandlers: TransformStreamHandlers = {
    onPartial: (map) => {
      receivedRenderablePartial = true;
      handlers.onPartial?.(map);
    },
    onFirstStreamByte: handlers.onFirstStreamByte,
    onDone: handlers.onDone,
    onError: handlers.onError,
  };

  const shouldAllowRestFallback = () =>
    !signal?.aborted && !streamEstablished && !receivedRenderablePartial;

  try {
    const response = await fetchWithTimeout(
      streamUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
          ...headers,
        },
        body: JSON.stringify(body),
        signal,
      },
      {
        timeoutMs: resolvedStreamTimeoutMs,
        timeoutMessage: 'La generación está tardando demasiado en empezar. Inténtalo de nuevo.',
      }
    );

    if (!response.ok) {
      const errPayload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(errPayload.error || `Error del servidor (${response.status})`);
    }

    if (!response.body) {
      throw new Error('Streaming no disponible');
    }

    streamEstablished = true;

    const result = await consumeTransformStream(response, wrappedHandlers, {
      signal,
      idleTimeoutMs: resolvedIdleTimeoutMs,
    });

    if (result === 'done') return 'stream';

    if (result === 'aborted') {
      throw new DOMException('Aborted', 'AbortError');
    }

    throw new Error(streamEndedWithoutDoneMessage(result, receivedRenderablePartial));
  } catch (err: unknown) {
    if (signal?.aborted) throw err;
    const message = err instanceof Error ? err.message : '';
    if (message && isNonRetryableTransformError(message)) {
      throw err;
    }
    if (!shouldAllowRestFallback()) throw err;

    const fallbackResponse = await fetchWithTimeout(
      fallbackUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal,
      },
      {
        timeoutMs: resolvedFallbackTimeoutMs,
        timeoutMessage: 'La generación está tardando demasiado. Inténtalo de nuevo.',
      }
    );

    const parsed = (await fallbackResponse.json()) as ActionMapData & { error?: string };
    if (!fallbackResponse.ok || parsed.error) {
      throw new Error(parsed.error || `Error del servidor (${fallbackResponse.status})`);
    }

    const normalized = normalizeMapData(parsed);
    if (!normalized) {
      throw new Error('No se pudo interpretar el mapa generado.');
    }

    wrappedHandlers.onDone(normalized, parsed.modelUsed);
    return 'fallback';
  }
}
